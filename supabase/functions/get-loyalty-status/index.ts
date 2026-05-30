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
    let phone: string | null = null;
    let shopDomain: string | null = null;
    let clientId: string | null = null;
    let shopifyOrderId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      memberUserId = url.searchParams.get('member_user_id');
      email = url.searchParams.get('email');
      phone = url.searchParams.get('phone');
      shopDomain = url.searchParams.get('shop_domain');
      clientId = url.searchParams.get('client_id');
      shopifyOrderId = url.searchParams.get('shopify_order_id');
    } else if (req.method === 'POST') {
      const body = await req.json();
      memberUserId = body.member_user_id || null;
      email = body.email || body.customer_email || null;
      phone = body.phone || null;
      shopDomain = body.shop_domain || null;
      clientId = body.client_id || null;
      shopifyOrderId = body.shopify_order_id || null;
    }

    // If no email/member but we have a shopify_order_id, resolve member via points transaction
    if (!memberUserId && !email && !phone && shopifyOrderId) {
      const { data: txn } = await supabase
        .from('loyalty_points_transactions')
        .select('member_user_id')
        .eq('reference_id', shopifyOrderId)
        .eq('transaction_type', 'earned')
        .limit(1)
        .maybeSingle();
      if (txn?.member_user_id) memberUserId = txn.member_user_id;
    }

    // If no member identifier but shop_domain is provided, return program/tier config for guests
    if (!memberUserId && !email && !phone) {
      if (!shopDomain) {
        return new Response(
          JSON.stringify({ error: 'Either member_user_id or email (or customer_email) is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Guest / program-config mode — resolve client from shop_domain, return tier thresholds only
      let guestClientId: string | null = null;
      const { data: guestStore } = await supabase
        .from('store_installations')
        .select('client_id')
        .eq('shop_domain', shopDomain)
        .eq('installation_status', 'active')
        .maybeSingle();
      if (guestStore) guestClientId = guestStore.client_id;

      if (!guestClientId) {
        return new Response(
          JSON.stringify({ error: 'Store not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: guestProgram } = await supabase
        .from('loyalty_programs')
        .select('id, program_name, points_name, points_name_singular, currency')
        .eq('client_id', guestClientId)
        .maybeSingle();

      const TIER_KEYS_GUEST = ['bronze', 'silver', 'gold', 'platinum'];
      let guestTierThresholds: Record<string, number> & { names?: Record<string, string> } | null = null;
      // Hoisted out of the `if (guestProgram?.id)` block so they remain in scope
      // for the Response body below — used as the storefront's default earn rate
      // when no member exists yet.
      let defaultEarnRate = 1;
      let defaultEarnDivisor = 1;
      if (guestProgram?.id) {
        const { data: guestTiers } = await supabase
          .from('loyalty_tiers')
          .select('tier_name, tier_level, min_lifetime_points, is_default, points_earn_rate, points_earn_divisor')
          .eq('loyalty_program_id', guestProgram.id)
          .order('tier_level', { ascending: true });

        if (guestTiers && guestTiers.length > 0) {
          const thresholds: Record<string, number> = {};
          const names: Record<string, string> = {};
          guestTiers.forEach((t: any, idx: number) => {
            const key = TIER_KEYS_GUEST[idx] || `tier${idx + 1}`;
            thresholds[key] = t.min_lifetime_points ?? 0;
            names[key] = t.tier_name;
          });
          guestTierThresholds = { ...thresholds, names };

          // Default earn rate: prefer tier marked is_default, else lowest tier level
          const defTier = (guestTiers as any[]).find((t) => t.is_default) || guestTiers[0];
          if (defTier) {
            defaultEarnRate    = Number(defTier.points_earn_rate)    || 1;
            defaultEarnDivisor = Number(defTier.points_earn_divisor) || 1;
          }
        }
      }

      // Fetch brand name for guest mode too (powers the header storeName)
      let guestOrgName: string | null = null;
      if (guestClientId) {
        const { data: guestClient } = await supabase
          .from('clients')
          .select('name')
          .eq('id', guestClientId)
          .maybeSingle();
        guestOrgName = guestClient?.name || null;
      }

      return new Response(
        JSON.stringify({
          guest: true,
          default_earn_rate: defaultEarnRate,
          default_earn_divisor: defaultEarnDivisor,
          tier_thresholds: guestTierThresholds,
          organization_name: guestOrgName,
          program: guestProgram ? {
            name: guestProgram.program_name,
            points_name: guestProgram.points_name,
            points_name_singular: guestProgram.points_name_singular,
            currency: guestProgram.currency,
          } : null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let memberUserIdToUse = memberUserId;
    let resolvedClientId = clientId;

    // If shop_domain is provided, find the client_id via store_installations
    if (shopDomain && !resolvedClientId) {
      const { data: storeInstall } = await supabase
        .from('store_installations')
        .select('client_id')
        .eq('shop_domain', shopDomain)
        .eq('installation_status', 'active')
        .maybeSingle();

      if (storeInstall) {
        resolvedClientId = storeInstall.client_id;
      }
    }

    // If we have email or phone but not member_user_id, look up the member
    let memberReferralCode: string | null = null;
    let memberFirstName: string | null = null;
    if (!memberUserIdToUse && (email || phone)) {
      // Normalise phone for suffix matching:
      // usePhone() on Shopify's thank-you page often returns the number WITHOUT a
      // country-code prefix (e.g. "7878765432" instead of "+917878765432").
      // We store numbers in E.164 in the DB, so an exact match fails.
      // Using a LIKE '%digits' query matches regardless of the country-code prefix.
      const phoneDigits = (phone || '').replace(/\D/g, '');
      const useSuffix = phoneDigits.length >= 7; // only suffix-match for plausible lengths

      let query = supabase
        .from('member_users')
        .select('*');

      if (email && phone) {
        const phonePart = useSuffix
          ? `phone.eq.${phone},phone.like.%${phoneDigits}`
          : `phone.eq.${phone}`;
        query = query.or(`email.eq.${email},${phonePart}`);
      } else if (email) {
        query = query.eq('email', email);
      } else {
        // Phone only
        if (useSuffix) {
          query = query.or(`phone.eq.${phone},phone.like.%${phoneDigits}`);
        } else {
          query = query.eq('phone', phone!);
        }
      }

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
      // Capture first name from member record
      if (memberData.full_name) {
        memberFirstName = memberData.full_name.trim().split(' ')[0] || null;
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

    let statusData = statusRows?.[0] || null;

    // Auto-enroll: if the member exists in member_users but has no loyalty status yet
    // (common for phone-only orders where the enrollment webhook hasn't fired yet),
    // create the status row on-the-fly so the widget renders immediately.
    if ((statusError || !statusData) && memberUserIdToUse && resolvedClientId) {
      try {
        const { data: enrollProgram } = await supabase
          .from('loyalty_programs')
          .select('id')
          .eq('client_id', resolvedClientId)
          .eq('is_active', true)
          .maybeSingle();

        if (enrollProgram) {
          const { data: defaultTier } = await supabase
            .from('loyalty_tiers')
            .select('id, tier_level')
            .eq('loyalty_program_id', enrollProgram.id)
            .order('tier_level', { ascending: true })
            .limit(1)
            .maybeSingle();

          await supabase.from('member_loyalty_status').insert({
            member_user_id: memberUserIdToUse,
            loyalty_program_id: enrollProgram.id,
            current_tier_id: defaultTier?.id ?? null,
            points_balance: 0,
            lifetime_points_earned: 0,
            lifetime_points_redeemed: 0,
            total_orders: 0,
            total_spend: 0,
          }).select('id').single();

          // Re-fetch after enrollment
          const { data: newRows } = await statusQuery;
          statusData = newRows?.[0] || null;
        }
      } catch (_enrollErr) {
        // Best-effort — if concurrent insert already created the row, re-fetch below
        const { data: retryRows } = await statusQuery;
        statusData = retryRows?.[0] || null;
      }
    }

    if (!statusData) {
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
    // welcome_bonus_claimed gates the new-member welcome screen; true once the
    // user has claimed their first bonus or earned any points. Backfilled true
    // for existing members so the migration doesn't trigger a retroactive screen.
    const welcomeBonusClaimed = !!statusData.welcome_bonus_claimed;

    const { data: recentTransactions } = await supabase
      .from('loyalty_points_transactions')
      .select('*')
      .eq('member_loyalty_status_id', status.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch referral earning rule to return the Shopify discount code for the referral link
    let referralFriendDiscountCode: string | null = null;
    if (program?.id) {
      const { data: referralRule } = await supabase
        .from('loyalty_earning_rules')
        .select('shopify_discount_code')
        .eq('loyalty_program_id', program.id)
        .eq('rule_type', 'referral')
        .eq('is_active', true)
        .maybeSingle();
      referralFriendDiscountCode = referralRule?.shopify_discount_code || null;
    }

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

    // Detect self-referral on this order: processReferral inserts a row with
    // status='self_referral' when a buyer uses their own referral code. The
    // widget uses this flag to show honest UX instead of a misleading share
    // banner. Scoped to this member + this order, so future orders aren't
    // affected by past self-referral attempts.
    let wasSelfReferral = false;
    if (shopifyOrderId && memberUserIdToUse && status.loyalty_program_id) {
      const { data: srRow } = await supabase
        .from('member_referrals')
        .select('id')
        .eq('loyalty_program_id', status.loyalty_program_id)
        .eq('shopify_order_id', shopifyOrderId)
        .eq('referred_member_id', memberUserIdToUse)
        .eq('status', 'self_referral')
        .maybeSingle();
      wasSelfReferral = !!srRow;
    }

    // Fetch first name if lookup was by member_user_id (not email/phone, so memberData wasn't set)
    if (!memberFirstName && memberUserIdToUse) {
      const { data: nameRow } = await supabase
        .from('member_users')
        .select('full_name')
        .eq('id', memberUserIdToUse)
        .maybeSingle();
      if (nameRow?.full_name) {
        memberFirstName = nameRow.full_name.trim().split(' ')[0] || null;
      }
    }

    // Fetch brand/organization name from clients table
    let organizationName: string | null = null;
    if (resolvedClientId) {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('name')
        .eq('id', resolvedClientId)
        .maybeSingle();
      organizationName = clientRow?.name || null;
    }

    return new Response(
      JSON.stringify({
        member_user_id: memberUserIdToUse,
        client_id: resolvedClientId || null,
        referral_code: memberReferralCode,
        referral_friend_discount_code: referralFriendDiscountCode,
        was_self_referral: wasSelfReferral,
        welcome_bonus_claimed: welcomeBonusClaimed,
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
        first_name: memberFirstName,
        organization_name: organizationName,
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
