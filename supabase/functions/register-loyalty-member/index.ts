import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { shop_domain, email, phone, first_name, last_name, full_name, referral_code } = await req.json();

    if (!shop_domain || (!email && !phone)) {
      return new Response(
        JSON.stringify({ error: 'shop_domain and (email or phone) are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build full_name from first_name/last_name if not provided
    const memberFullName = full_name || `${first_name || ''} ${last_name || ''}`.trim() || 'Member';

    // Find integration and client
    // Try integration_configs first, then fall back to store_installations
    let clientId: string | null = null;

    const { data: integration } = await supabase
      .from('integration_configs')
      .select('client_id')
      .eq('shop_domain', shop_domain)
      .maybeSingle();

    if (integration) {
      clientId = integration.client_id;
    } else {
      const { data: storeInstall } = await supabase
        .from('store_installations')
        .select('client_id')
        .eq('shop_domain', shop_domain)
        .maybeSingle();

      if (storeInstall) {
        clientId = storeInstall.client_id;
      }
    }

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Shop not found or not integrated' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if member already exists
    let query = supabase
      .from('member_users')
      .select('id, email, phone, full_name')
      .eq('client_id', clientId);

    if (email) {
      query = query.eq('email', email);
    } else if (phone) {
      query = query.eq('phone', phone);
    }

    const { data: existingMember } = await query.maybeSingle();

    if (existingMember) {
      // Member row exists — but check if they have a loyalty status (they may have been created without one)
      const { data: existingStatus } = await supabase
        .from('member_loyalty_status')
        .select('id')
        .eq('member_user_id', existingMember.id)
        .maybeSingle();

      if (!existingStatus) {
        // No loyalty status — find the active program and create it now
        const { data: loyaltyProgram } = await supabase
          .from('loyalty_programs')
          .select('id, welcome_bonus_points')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .maybeSingle();

        if (loyaltyProgram) {
          const { data: defaultTier } = await supabase
            .from('loyalty_tiers')
            .select('id')
            .eq('loyalty_program_id', loyaltyProgram.id)
            .eq('is_default', true)
            .maybeSingle();

          const welcomePoints = loyaltyProgram.welcome_bonus_points || 0;

          const { data: newStatus } = await supabase
            .from('member_loyalty_status')
            .insert({
              member_user_id: existingMember.id,
              loyalty_program_id: loyaltyProgram.id,
              current_tier_id: defaultTier?.id || null,
              points_balance: welcomePoints,
              lifetime_points_earned: welcomePoints,
              lifetime_points_redeemed: 0,
              total_orders: 0,
              total_spend: 0,
            })
            .select()
            .single();

          if (welcomePoints > 0 && newStatus) {
            await supabase
              .from('loyalty_points_transactions')
              .insert({
                member_loyalty_status_id: newStatus.id,
                member_user_id: existingMember.id,
                transaction_type: 'bonus',
                points_amount: welcomePoints,
                balance_after: welcomePoints,
                description: 'Welcome bonus',
              });
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Member enrolled in loyalty program',
              member: existingMember,
              loyalty_status: newStatus,
              welcome_bonus: welcomePoints,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Member already registered',
          member: existingMember,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get loyalty program
    const { data: loyaltyProgram, error: programError } = await supabase
      .from('loyalty_programs')
      .select('id, welcome_bonus_points')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();

    if (programError || !loyaltyProgram) {
      return new Response(
        JSON.stringify({ error: 'No active loyalty program found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get default tier
    const { data: defaultTier } = await supabase
      .from('loyalty_tiers')
      .select('id')
      .eq('loyalty_program_id', loyaltyProgram.id)
      .eq('is_default', true)
      .maybeSingle();

    // Create new member
    const { data: newMember, error: insertError } = await supabase
      .from('member_users')
      .insert({
        client_id: clientId,
        email: email || null,
        phone: phone || null,
        full_name: memberFullName,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Failed to register member', details: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create loyalty status for the member
    const welcomePoints = loyaltyProgram.welcome_bonus_points || 0;

    const { data: loyaltyStatus, error: statusError } = await supabase
      .from('member_loyalty_status')
      .insert({
        member_user_id: newMember.id,
        loyalty_program_id: loyaltyProgram.id,
        current_tier_id: defaultTier?.id || null,
        points_balance: welcomePoints,
        lifetime_points_earned: welcomePoints,
        lifetime_points_redeemed: 0,
        total_orders: 0,
        total_spend: 0,
      })
      .select()
      .single();

    if (statusError) {
      console.error('Failed to create loyalty status:', statusError);
    }

    // Log welcome bonus transaction if points awarded
    if (welcomePoints > 0 && loyaltyStatus) {
      await supabase
        .from('loyalty_points_transactions')
        .insert({
          member_loyalty_status_id: loyaltyStatus.id,
          member_user_id: newMember.id,
          transaction_type: 'bonus',
          points_amount: welcomePoints,
          balance_after: welcomePoints,
          description: 'Welcome bonus',
        });
    }

    // ── Award referral points to the referrer ──────────────────────────────
    let referralPointsAwarded = 0;
    if (referral_code && loyaltyStatus) {
      try {
        // 1. Find who referred this new member
        const { data: referrerStatus } = await supabase
          .from('member_loyalty_status')
          .select('id, member_user_id, points_balance, lifetime_points_earned, referral_points_earned')
          .eq('referral_code', referral_code.toUpperCase())
          .maybeSingle();

        if (referrerStatus) {
          // 2. Find the active referral earning rule for this client
          const { data: referralRule } = await supabase
            .from('loyalty_earning_rules')
            .select('id, points_reward, max_referrals_per_day, cooldown_days')
            .eq('client_id', clientId)
            .eq('rule_type', 'referral')
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          const referralPoints = referralRule?.points_reward ?? 0;

          if (referralPoints > 0) {
            // 3. Check max_referrals_per_day limit
            let canAward = true;
            if (referralRule?.max_referrals_per_day) {
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              const { count } = await supabase
                .from('loyalty_points_transactions')
                .select('id', { count: 'exact', head: true })
                .eq('member_user_id', referrerStatus.member_user_id)
                .eq('description', 'Referral bonus')
                .gte('created_at', todayStart.toISOString());
              if ((count ?? 0) >= referralRule.max_referrals_per_day) {
                canAward = false;
              }
            }

            if (canAward) {
              const newBalance = (referrerStatus.points_balance ?? 0) + referralPoints;
              const newLifetime = (referrerStatus.lifetime_points_earned ?? 0) + referralPoints;
              const newReferralPoints = (referrerStatus.referral_points_earned ?? 0) + referralPoints;

              // 4. Update referrer balance + referral_points_earned
              await supabase
                .from('member_loyalty_status')
                .update({
                  points_balance: newBalance,
                  lifetime_points_earned: newLifetime,
                  referral_points_earned: newReferralPoints,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', referrerStatus.id);

              // 5. Log transaction for referrer
              await supabase
                .from('loyalty_points_transactions')
                .insert({
                  member_loyalty_status_id: referrerStatus.id,
                  member_user_id: referrerStatus.member_user_id,
                  transaction_type: 'earned',
                  points_amount: referralPoints,
                  balance_after: newBalance,
                  description: 'Referral bonus',
                  reference_id: newMember.id,
                });

              // 6. Record in member_referrals table
              await supabase
                .from('member_referrals')
                .upsert({
                  loyalty_program_id: loyaltyProgram.id,
                  referrer_member_id: referrerStatus.member_user_id,
                  referred_member_id: newMember.id,
                  referral_code: referral_code.toUpperCase(),
                  referred_email: email || null,
                  referred_phone: phone || null,
                  status: 'completed',
                  points_awarded: referralPoints,
                  completed_at: new Date().toISOString(),
                }, { onConflict: 'loyalty_program_id,referred_member_id', ignoreDuplicates: true });

              referralPointsAwarded = referralPoints;
            }
          }
        }
      } catch (refErr) {
        console.error('Referral points award error:', refErr);
        // Non-fatal: member registration still succeeds
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Member registered successfully',
        member: newMember,
        loyalty_status: loyaltyStatus,
        welcome_bonus: welcomePoints,
        referral_points_awarded: referralPointsAwarded,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
