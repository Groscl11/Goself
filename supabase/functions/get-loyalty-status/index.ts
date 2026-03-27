import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Support both GET (query params) and POST (body) requests
    let memberUserId: string | null = null;
    let email: string | null = null;
    let shopDomain: string | null = null;
    let clientId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      memberUserId = url.searchParams.get('member_user_id');
      email = url.searchParams.get('email');
      shopDomain = url.searchParams.get('shop_domain');
      clientId = url.searchParams.get('client_id');
    } else if (req.method === 'POST') {
      const body = await req.json();
      memberUserId = body.member_user_id || null;
      email = body.email || body.customer_email || null; // Support both 'email' and 'customer_email'
      shopDomain = body.shop_domain || null;
      clientId = body.client_id || null;
    }

    if (!memberUserId && !email) {
      return new Response(
        JSON.stringify({ error: 'Either member_user_id or email (or customer_email) is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let memberUserIdToUse = memberUserId;
    let resolvedClientId = clientId;

    // If shop_domain is provided, find the client_id
    // Try integration_configs first, then fall back to store_installations
    if (shopDomain && !resolvedClientId) {
      const { data: integration } = await supabase
        .from('integration_configs')
        .select('client_id')
        .eq('shop_domain', shopDomain)
        .maybeSingle();

      if (integration) {
        resolvedClientId = integration.client_id;
      } else {
        // Fallback: check store_installations (created during Shopify OAuth)
        const { data: storeInstall } = await supabase
          .from('store_installations')
          .select('client_id')
          .eq('shop_domain', shopDomain)
          .maybeSingle();

        if (storeInstall) {
          resolvedClientId = storeInstall.client_id;
        }
      }
    }

    // If we have email but not member_user_id, look up the member
    let memberReferralCode: string | null = null;
    if (!memberUserIdToUse && email) {
      let query = supabase
        .from('member_users')
        .select('*')
        .eq('email', email);

      if (resolvedClientId) {
        query = query.eq('client_id', resolvedClientId);
      }

      const { data: memberData } = await query.maybeSingle();

      // No email-only fallback — a client_id scope must always be resolved from
      // shop_domain before lookup. Falling back cross-client leaks another
      // merchant's member data to this store's widget.

      if (!memberData) {
        return new Response(
          JSON.stringify({ error: 'Member not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      memberUserIdToUse = memberData.id;
      // Resolve client_id from member record if not already resolved via shop_domain
      if (!resolvedClientId && memberData.client_id) {
        resolvedClientId = memberData.client_id;
      }
      // Don't set referral_code here — member_loyalty_status.referral_code is the source of truth
    }

    let statusQuery = supabase
      .from('member_loyalty_status')
      .select('*, current_tier:loyalty_tiers(*), loyalty_program:loyalty_programs(*)')
      .eq('member_user_id', memberUserIdToUse)
      .order('points_balance', { ascending: false })
      .limit(1);

    // Always scope to the resolved client's loyalty program to prevent
    // cross-client points leaking into another store's widget.
    if (resolvedClientId) {
      const { data: clientPrograms } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('client_id', resolvedClientId);
      const programIds = (clientPrograms || []).map((p: any) => p.id);
      if (programIds.length > 0) {
        statusQuery = statusQuery.in('loyalty_program_id', programIds);
      } else {
        // Client has no loyalty program — return 404 rather than leaking other client data
        return new Response(
          JSON.stringify({ error: 'No loyalty program found for this store' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: statusRows, error: statusError } = await statusQuery;

    const statusData = statusRows?.[0] || null;

    if (statusError || !statusData) {
      return new Response(
        JSON.stringify({ error: 'Member not enrolled in loyalty program' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use member_loyalty_status.referral_code as source of truth; fall back to UUID-derived code
    memberReferralCode = statusData.referral_code || (memberUserIdToUse ? memberUserIdToUse.replace(/-/g, '').slice(0, 8).toUpperCase() : null);

    const status = statusData;
    const program = status.loyalty_program;
    const tier = status.current_tier;

    const { data: recentTransactions } = await supabase
      .from('loyalty_points_transactions')
      .select('*')
      .eq('member_loyalty_status_id', status.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch all tiers for this program to build tier_thresholds map for the widget
    const TIER_KEYS = ['bronze', 'silver', 'gold', 'platinum'];
    let tierThresholds: Record<string, number> & { names?: Record<string, string> } | null = null;
    let currentTierKey = 'bronze'; // fallback
    if (program?.id) {
      const { data: allTiers } = await supabase
        .from('loyalty_tiers')
        .select('tier_name, tier_level, min_lifetime_points')
        .eq('loyalty_program_id', program.id)
        .order('tier_level', { ascending: true });

      if (allTiers && allTiers.length > 0) {
        const thresholds: Record<string, number> = {};
        const names: Record<string, string> = {};
        allTiers.forEach((t: any, idx: number) => {
          const key = TIER_KEYS[idx] || `tier${idx + 1}`;
          thresholds[key] = t.min_lifetime_points ?? 0;
          names[key] = t.tier_name;
          // Map current tier's DB name → normalized widget key
          if (tier && t.tier_name === tier.tier_name) {
            currentTierKey = key;
          }
        });
        tierThresholds = { ...thresholds, names };
      }
    }

    return new Response(
      JSON.stringify({
        member_user_id: memberUserIdToUse,
        client_id: resolvedClientId || null,
        referral_code: memberReferralCode,
        points_balance: status.points_balance,
        lifetime_points_earned: status.lifetime_points_earned,
        lifetime_points_redeemed: status.lifetime_points_redeemed,
        total_orders: status.total_orders,
        total_spend: status.total_spend,
        tier: {
          name: currentTierKey,
          display_name: tier?.tier_name || 'None',
          level: tier?.tier_level || 0,
          color: tier?.color_code || '#3B82F6',
          benefits: tier?.benefits_description || '',
          points_earn_rate: tier?.points_earn_rate || 1,
          points_earn_divisor: tier?.points_earn_divisor || 1,
          max_redemption_percent: tier?.max_redemption_percent || 100,
        },
        program: {
          name: program.program_name,
          points_name: program.points_name,
          points_name_singular: program.points_name_singular,
          currency: program.currency,
          allow_redemption: program.allow_redemption,
        },
        tier_thresholds: tierThresholds,
        recent_transactions: recentTransactions || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error getting loyalty status:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
