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

    const { shop_domain, email, phone, first_name, last_name, full_name } = await req.json();

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
                transaction_type: 'earn',
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
          transaction_type: 'earn',
          points_amount: welcomePoints,
          balance_after: welcomePoints,
          description: 'Welcome bonus',
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Member registered successfully',
        member: newMember,
        loyalty_status: loyaltyStatus,
        welcome_bonus: welcomePoints,
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
