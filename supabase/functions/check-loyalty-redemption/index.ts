import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  member_user_id: string;
  order_amount: number;
  points_to_redeem?: number;
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

    const { member_user_id, order_amount, points_to_redeem }: RequestBody = await req.json();

    if (!member_user_id || !order_amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const statusResponse = await fetch(
      `${supabaseUrl}/rest/v1/member_loyalty_status?member_user_id=eq.${member_user_id}&select=*,current_tier:loyalty_tiers(*),loyalty_program:loyalty_programs(*)`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      }
    );

    const statusData = await statusResponse.json();

    if (!statusData || statusData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Member not enrolled in loyalty program' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const status = statusData[0];
    const tier = status.current_tier;
    const program = status.loyalty_program;

    if (!program.allow_redemption) {
      return new Response(
        JSON.stringify({
          error: 'Points redemption is not enabled',
          can_redeem: false,
          max_points: 0,
          discount_value: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let maxPoints = status.points_balance;

    if (tier.max_redemption_percent) {
      const maxByPercent = Math.floor((order_amount * tier.max_redemption_percent / 100) / tier.points_value);
      maxPoints = Math.min(maxPoints, maxByPercent);
    }

    if (tier.max_redemption_points) {
      maxPoints = Math.min(maxPoints, tier.max_redemption_points);
    }

    const pointsToUse = points_to_redeem ? Math.min(points_to_redeem, maxPoints) : maxPoints;
    const discountValue = pointsToUse * tier.points_value;

    return new Response(
      JSON.stringify({
        can_redeem: true,
        points_balance: status.points_balance,
        max_points: maxPoints,
        points_to_redeem: pointsToUse,
        discount_value: discountValue,
        points_value: tier.points_value,
        points_name: program.points_name,
        currency: program.currency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error checking redemption:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
