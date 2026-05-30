/**
 * claim-welcome-bonus
 *
 * Awards a one-time welcome bonus to a newly-enrolled loyalty member.
 * Idempotent — second call is a no-op.
 *
 * Request body:
 *   { member_user_id?: string, email?: string, shop_domain?: string }
 *
 * Response:
 *   { success: true, points_credited: number, new_balance: number }
 *   { success: false, error: string }
 *
 * Trust model: anon JWT (verify_jwt=false). Auth is via member_user_id +
 * shop_domain → store_installations join, scoped to one merchant.
 *
 * The bonus amount is read from `loyalty_earning_rules` where
 * rule_type='signup' AND is_active=true, scoped to the loyalty program.
 * If no rule exists, returns success with 0 points (claim is still marked).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const memberUserId = body.member_user_id || null;
    const email = body.email || null;
    const shopDomain = body.shop_domain || null;

    if (!memberUserId && !email) {
      return jsonError('member_user_id or email required', 400);
    }

    // Resolve client_id via shop_domain (preferred) or via member's record
    let clientId: string | null = null;
    if (shopDomain) {
      const { data: store } = await supabase
        .from('store_installations')
        .select('client_id')
        .eq('shop_domain', shopDomain)
        .eq('installation_status', 'active')
        .maybeSingle();
      if (store) clientId = store.client_id;
    }

    // Resolve member_user_id from email if not provided
    let resolvedMemberId = memberUserId;
    if (!resolvedMemberId && email) {
      let q = supabase.from('member_users').select('id, client_id').eq('email', email);
      if (clientId) q = q.eq('client_id', clientId);
      const { data: member } = await q.maybeSingle();
      if (!member) {
        return jsonError('Member not found', 404);
      }
      resolvedMemberId = member.id;
      if (!clientId) clientId = member.client_id;
    }

    if (!clientId) {
      return jsonError('Could not resolve client for this member', 400);
    }

    // Find the active loyalty program for this client
    const { data: program } = await supabase
      .from('loyalty_programs')
      .select('id')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();
    if (!program) {
      return jsonError('No active loyalty program for this client', 404);
    }

    // Find the member's loyalty status row
    const { data: status } = await supabase
      .from('member_loyalty_status')
      .select('id, points_balance, lifetime_points_earned, welcome_bonus_claimed')
      .eq('member_user_id', resolvedMemberId)
      .eq('loyalty_program_id', program.id)
      .maybeSingle();
    if (!status) {
      return jsonError('Member is not enrolled in this loyalty program', 404);
    }

    // Idempotency: if already claimed, return success with current balance
    if (status.welcome_bonus_claimed) {
      return jsonOk({
        success: true,
        points_credited: 0,
        new_balance: status.points_balance,
        already_claimed: true,
      });
    }

    // Look up bonus amount from signup earning rule (configurable per merchant)
    const { data: rule } = await supabase
      .from('loyalty_earning_rules')
      .select('points_reward')
      .eq('client_id', clientId)
      .eq('rule_type', 'signup')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const bonusPoints: number = rule?.points_reward ?? 100;  // default 100 if not configured

    // Award points + flag claimed atomically (best-effort; not in a real txn
    // since supabase-js doesn't expose them — but the flag prevents double-credit)
    const newBalance = (status.points_balance ?? 0) + bonusPoints;
    const newLifetime = (status.lifetime_points_earned ?? 0) + bonusPoints;

    const { error: updateErr } = await supabase
      .from('member_loyalty_status')
      .update({
        points_balance: newBalance,
        lifetime_points_earned: newLifetime,
        welcome_bonus_claimed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', status.id)
      .eq('welcome_bonus_claimed', false);  // race-condition guard

    if (updateErr) {
      console.error('[claim-welcome-bonus] update error:', updateErr);
      return jsonError('Failed to credit welcome bonus', 500);
    }

    // Log the transaction (only if non-zero bonus)
    if (bonusPoints > 0) {
      await supabase.from('loyalty_points_transactions').insert({
        member_loyalty_status_id: status.id,
        member_user_id: resolvedMemberId,
        transaction_type: 'earned',
        points_amount: bonusPoints,
        balance_after: newBalance,
        description: 'Welcome bonus',
      });
    }

    return jsonOk({
      success: true,
      points_credited: bonusPoints,
      new_balance: newBalance,
    });
  } catch (e) {
    console.error('[claim-welcome-bonus] error:', e);
    return jsonError(e.message || 'Internal server error', 500);
  }
});

function jsonOk(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
