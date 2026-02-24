import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  member_user_id: string;
  points_to_redeem: number;
  order_amount: number;
  reference_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { member_user_id, points_to_redeem, order_amount, reference_id }: RequestBody = await req.json();

    if (!member_user_id || !points_to_redeem || !order_amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (points_to_redeem <= 0) {
      return new Response(
        JSON.stringify({ error: 'Points to redeem must be greater than 0' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/redeem_points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({
        p_member_user_id: member_user_id,
        p_points_to_redeem: points_to_redeem,
        p_order_amount: order_amount,
        p_reference_id: reference_id || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to redeem points');
    }

    if (result.error) {
      return new Response(
        JSON.stringify(result),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error redeeming loyalty points:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
