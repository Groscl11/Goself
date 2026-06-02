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

    // ── SECURITY: Verify caller identity ─────────────────────────────────────
    // adjust-loyalty-points uses service_role (bypasses RLS), so we must
    // manually authenticate the caller. Only admin users or client users
    // belonging to the target shop may adjust points.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerJwt = authHeader.replace('Bearer ', '').trim();
    const anonKey = (Deno.env.get('SUPABASE_ANON_KEY') ?? '').trim();

    // Reject if the caller is using the anon key (unauthenticated widget/public)
    if (!callerJwt || callerJwt === anonKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — a logged-in user JWT is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, callerJwt);
    const { data: { user: callerUser }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('client_id, role')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (!callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Forbidden — caller profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = callerProfile.role === 'admin';
    // ─────────────────────────────────────────────────────────────────────────

    const { shop_domain, email, phone, points, reason, order_id, order_amount } = await req.json();

    if (!shop_domain || (!email && !phone) || points === undefined || points === null) {
      return new Response(
        JSON.stringify({
          error: 'shop_domain, (email or phone), and points are required',
          note: 'Use positive points to add, negative to remove'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const pointsValue = Number(points);
    if (isNaN(pointsValue)) {
      return new Response(
        JSON.stringify({ error: 'points must be a valid number' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // SECURITY (H-17): cap per-call adjustment to prevent bulk fraud from a
    // compromised account. Large adjustments require a separate approval workflow.
    const MAX_POINTS_PER_CALL = 10000;
    if (Math.abs(pointsValue) > MAX_POINTS_PER_CALL) {
      return new Response(
        JSON.stringify({ error: `Points adjustment cannot exceed ±${MAX_POINTS_PER_CALL} per call` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsedOrderAmount = order_amount === undefined || order_amount === null || order_amount === ''
      ? null
      : Number(order_amount);

    if (parsedOrderAmount !== null && isNaN(parsedOrderAmount)) {
      return new Response(
        JSON.stringify({ error: 'order_amount must be a valid number when provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find client by shop domain
    const { data: storeInstall, error: integrationError } = await supabase
      .from('store_installations')
      .select('client_id')
      .eq('shop_domain', shop_domain)
      .eq('installation_status', 'active')
      .maybeSingle();

    if (integrationError || !storeInstall) {
      return new Response(
        JSON.stringify({
          error: 'Shop not found or not integrated',
          shop_domain,
          details: integrationError?.message
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const clientId = storeInstall.client_id;

    // SECURITY: verify the caller belongs to this shop's client (or is admin)
    if (!isAdmin && callerProfile.client_id !== clientId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden — you do not have access to this store' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find member user
    let query = supabase
      .from('member_users')
      .select('id, email, phone, full_name, client_id')
      .eq('client_id', clientId);

    if (email) {
      query = query.eq('email', email);
    } else {
      query = query.eq('phone', phone);
    }

    const { data: member, error: memberError } = await query.maybeSingle();

    if (memberError || !member) {
      return new Response(
        JSON.stringify({
          error: 'Member not found',
          email: email || undefined,
          phone: phone || undefined,
          shop_domain
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get loyalty program
    const { data: loyaltyProgram, error: programError } = await supabase
      .from('loyalty_programs')
      .select('id')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();

    if (programError || !loyaltyProgram) {
      return new Response(
        JSON.stringify({
          error: 'No active loyalty program found for this client'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get or create member loyalty status
    let { data: loyaltyStatus, error: statusError } = await supabase
      .from('member_loyalty_status')
      .select('*')
      .eq('member_user_id', member.id)
      .eq('loyalty_program_id', loyaltyProgram.id)
      .maybeSingle();

    if (statusError && statusError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({ error: 'Database error', details: statusError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create loyalty status if doesn't exist
    if (!loyaltyStatus) {
      // Get default tier
      const { data: defaultTier } = await supabase
        .from('loyalty_tiers')
        .select('id')
        .eq('loyalty_program_id', loyaltyProgram.id)
        .eq('is_default', true)
        .maybeSingle();

      const { data: newStatus, error: createError } = await supabase
        .from('member_loyalty_status')
        .insert({
          member_user_id: member.id,
          loyalty_program_id: loyaltyProgram.id,
          current_tier_id: defaultTier?.id || null,
          points_balance: 0,
          lifetime_points_earned: 0,
          lifetime_points_redeemed: 0,
          total_orders: 0,
          total_spend: 0,
        })
        .select()
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create loyalty status', details: createError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      loyaltyStatus = newStatus;
    }

    const currentPoints = loyaltyStatus.points_balance || 0;
    const newBalance = currentPoints + pointsValue;

    if (newBalance < 0) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient points',
          current_points: currentPoints,
          requested_adjustment: pointsValue,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check for duplicate order processing if order_id is provided
    if (order_id && pointsValue > 0) {
      const { data: isDuplicate, error: dupError } = await supabase
        .rpc('check_duplicate_order_points', {
          p_order_id: order_id,
          p_member_user_id: member.id,
          p_loyalty_program_id: loyaltyStatus.loyalty_program_id,
        });

      if (dupError) {
        console.error('Error checking duplicate:', dupError);
      } else if (isDuplicate) {
        return new Response(
          JSON.stringify({
            error: 'Duplicate order processing prevented',
            message: `Points have already been awarded for order ${order_id}`,
            order_id: order_id,
            duplicate: true
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Update loyalty status
    const updateFields: any = {
      points_balance: newBalance,
      updated_at: new Date().toISOString(),
    };

    if (pointsValue > 0) {
      updateFields.lifetime_points_earned = (loyaltyStatus.lifetime_points_earned || 0) + pointsValue;

      // Treat positive point adjustments with an order_id as completed order awards.
      if (order_id) {
        updateFields.total_orders = (loyaltyStatus.total_orders || 0) + 1;

        if (parsedOrderAmount !== null) {
          updateFields.total_spend = Number(loyaltyStatus.total_spend || 0) + parsedOrderAmount;
        }
      }
    } else {
      updateFields.lifetime_points_redeemed = (loyaltyStatus.lifetime_points_redeemed || 0) + Math.abs(pointsValue);
    }

    const { error: updateError } = await supabase
      .from('member_loyalty_status')
      .update(updateFields)
      .eq('id', loyaltyStatus.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update points', details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log transaction (transaction_reference_id will be auto-generated by trigger)
    // Note: order_id column is UUID type, so we use reference_id for text order IDs
    const transactionData: any = {
      member_loyalty_status_id: loyaltyStatus.id,
      member_user_id: member.id,
      transaction_type: pointsValue > 0 ? 'earned' : 'redeemed',
      points_amount: pointsValue,
      balance_after: newBalance,
      order_id: null, // Set to null since external order IDs aren't UUIDs
      order_amount: parsedOrderAmount,
      description: reason || (pointsValue > 0 ? 'Points adjustment (added)' : 'Points adjustment (removed)'),
      reference_id: order_id || null, // Use reference_id for external order IDs
    };

    const { data: txData, error: txError } = await supabase
      .from('loyalty_points_transactions')
      .insert(transactionData)
      .select('transaction_reference_id')
      .single();

    if (txError) {
      console.error('Failed to log transaction:', txError);
      // Return error instead of silently continuing
      return new Response(
        JSON.stringify({
          error: 'Points updated but transaction logging failed',
          details: txError.message,
          points_updated: true,
          new_balance: newBalance
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Audit log — every adjustment is recorded with who did it and why
    try {
      await supabase.from('admin_audit_log').insert({
        actor_user_id: callerUser.id,
        actor_role: callerProfile.role,
        action: 'adjust_loyalty_points',
        target_entity: 'member_loyalty_status',
        target_id: member?.id ?? null,
        metadata: {
          shop_domain,
          points: pointsValue,
          reason: reason ?? null,
          email: email ?? null,
          phone: phone ?? null,
          order_id: order_id ?? null,
          new_balance: null, // balance logged by the DB update itself
        },
      });
    } catch { /* audit log is best-effort */ }

    return new Response(
      JSON.stringify({
        success: true,
        message: pointsValue > 0 ? 'Points added successfully' : 'Points removed successfully',
        transaction_reference_id: txData?.transaction_reference_id || null,
        member_id: member.id,
        email: member.email,
        phone: member.phone,
        full_name: member.full_name,
        previous_points: currentPoints,
        adjustment: pointsValue,
        new_balance: newBalance,
        order_id: order_id || null,
      }),
      {
        status: 200,
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
