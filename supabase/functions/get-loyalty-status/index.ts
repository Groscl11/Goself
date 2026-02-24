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
    if (shopDomain && !resolvedClientId) {
      const { data: integration } = await supabase
        .from('integration_configs')
        .select('client_id')
        .eq('shop_domain', shopDomain)
        .maybeSingle();

      if (integration) {
        resolvedClientId = integration.client_id;
      }
    }

    // If we have email but not member_user_id, look up the member
    if (!memberUserIdToUse && email) {
      let query = supabase
        .from('member_users')
        .select('id')
        .eq('email', email);

      if (resolvedClientId) {
        query = query.eq('client_id', resolvedClientId);
      }

      const { data: memberData } = await query.maybeSingle();

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
