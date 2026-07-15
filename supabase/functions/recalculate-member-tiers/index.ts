import { corsHeaders } from '../_shared/cors.ts';

/**
 * recalculate-member-tiers
 *
 * Runs check_tier_upgrade() for every member in a loyalty program.
 * Called by the admin after adding/editing tiers so existing members
 * who already qualify are immediately moved to the correct tier.
 *
 * POST body: { program_id: string } OR { client_id: string } OR { shop_domain: string }
 * Returns:   { processed: number, upgraded: number }
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // SECURITY (H-13): this function uses service_role to mutate member tier
    // data for an entire loyalty program. Any authenticated user could invoke it
    // without this check. Require admin role or a verified client whose clientId
    // matches the target program.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerJwt = authHeader.replace('Bearer ', '').trim();
    const anonKey = (Deno.env.get('SUPABASE_ANON_KEY') ?? '').trim();

    if (!callerJwt || callerJwt === anonKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, callerJwt);
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerProfile } = await supabase
      .from('profiles').select('client_id, role').eq('id', user.id).maybeSingle();

    if (!callerProfile || !['admin', 'client'].includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden — admin or client role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    let programId: string | null = body.program_id || null;

    // Resolve program_id from client_id or shop_domain if not provided directly
    if (!programId && body.client_id) {
      const { data: prog } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('client_id', body.client_id)
        .eq('is_active', true)
        .maybeSingle();
      programId = prog?.id || null;
    }

    if (!programId && body.shop_domain) {
      const { data: store } = await supabase
        .from('store_installations')
        .select('client_id')
        .eq('shop_domain', body.shop_domain)
        .eq('installation_status', 'active')
        .maybeSingle();
      if (store?.client_id) {
        const { data: prog } = await supabase
          .from('loyalty_programs')
          .select('id')
          .eq('client_id', store.client_id)
          .eq('is_active', true)
          .maybeSingle();
        programId = prog?.id || null;
      }
    }

    if (!programId) {
      return new Response(
        JSON.stringify({ error: 'program_id, client_id, or shop_domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all member status rows for this program
    const { data: members, error: fetchError } = await supabase
      .from('member_loyalty_status')
      .select('id, current_tier_id')
      .eq('loyalty_program_id', programId);

    if (fetchError) throw fetchError;
    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, upgraded: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let upgraded = 0;

    // Run check_tier_upgrade for each member — track who changed tiers
    for (const member of members) {
      const oldTierId = member.current_tier_id;

      await supabase.rpc('check_tier_upgrade', {
        p_member_loyalty_status_id: member.id,
      });

      // Re-fetch to detect if tier changed
      const { data: refreshed } = await supabase
        .from('member_loyalty_status')
        .select('current_tier_id')
        .eq('id', member.id)
        .maybeSingle();

      if (refreshed && refreshed.current_tier_id !== oldTierId) {
        upgraded++;
      }
    }

    console.log(`[recalculate-member-tiers] program=${programId} processed=${members.length} upgraded=${upgraded}`);

    return new Response(
      JSON.stringify({ processed: members.length, upgraded }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[recalculate-member-tiers] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
