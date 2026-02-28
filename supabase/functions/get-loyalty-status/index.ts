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

      let { data: memberData } = await query.maybeSingle();

      // If not found with client filter (or no client resolved), try email-only fallback
      if (!memberData) {
        const { data: fallbackMembers } = await supabase
          .from('member_users')
          .select('*')
          .eq('email', email)
          .limit(10);
        if (fallbackMembers && fallbackMembers.length === 1) {
          memberData = fallbackMembers[0];
        } else if (fallbackMembers && fallbackMembers.length > 1) {
          // Multiple members with same email across clients — pick the one with an active loyalty status
          for (const candidate of fallbackMembers) {
            const { data: hasStatus } = await supabase
              .from('member_loyalty_status')
              .select('id')
              .eq('member_user_id', candidate.id)
              .maybeSingle();
            if (hasStatus) { memberData = candidate; break; }
          }
        }
      }

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
      // referral_code column may not exist — derive a code from the member UUID as fallback
      memberReferralCode = memberData.referral_code || memberData.id.replace(/-/g, '').slice(0, 10).toUpperCase();
    }

    const { data: statusData, error: statusError } = await supabase
      .from('member_loyalty_status')
      .select('*, current_tier:loyalty_tiers(*), loyalty_program:loyalty_programs(*)')
      .eq('member_user_id', memberUserIdToUse)
      .maybeSingle();

    if (statusError || !statusData) {
      return new Response(
        JSON.stringify({ error: 'Member not enrolled in loyalty program' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Ensure referral_code is always set (derive from UUID if column doesn't exist)
    if (!memberReferralCode && memberUserIdToUse) {
      memberReferralCode = memberUserIdToUse.replace(/-/g, '').slice(0, 10).toUpperCase();
    }

    const status = statusData;
    const program = status.loyalty_program;
    const tier = status.current_tier;

    const { data: recentTransactions } = await supabase
      .from('loyalty_points_transactions')
      .select('*')
      .eq('member_loyalty_status_id', status.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return new Response(
      JSON.stringify({
        member_user_id: memberUserIdToUse,
        referral_code: memberReferralCode,
        points_balance: status.points_balance,
        lifetime_points_earned: status.lifetime_points_earned,
        lifetime_points_redeemed: status.lifetime_points_redeemed,
        total_orders: status.total_orders,
        total_spend: status.total_spend,
        tier: {
          name: tier?.tier_name || 'None',
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
