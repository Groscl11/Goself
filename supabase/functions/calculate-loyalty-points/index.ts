import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

interface RequestBody {
  order_amount: number;
  shop_domain: string;
  customer_email?: string;
  order_id?: string;
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_amount, shop_domain, customer_email, order_id }: RequestBody = await req.json();

    if (!order_amount || !shop_domain) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: order_amount and shop_domain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find the client by shop domain
    const { data: integration, error: integrationError } = await supabase
      .from('integration_configs')
      .select('client_id')
      .eq('shop_domain', shop_domain)
      .maybeSingle();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Shop not found or not integrated' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const clientId = integration.client_id;

    // Get loyalty program configuration
    const { data: program, error: programError } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();

    if (programError || !program) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active loyalty program found',
          points: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get default tier or find member's tier
    let tierData: any = null;
    let memberStatus: any = null;

    if (customer_email) {
      // Find member
      const { data: member } = await supabase
        .from('member_users')
        .select('id')
        .eq('email', customer_email)
        .eq('client_id', clientId)
        .maybeSingle();

      if (member) {
        // Get member loyalty status with tier
        const { data: status } = await supabase
          .from('member_loyalty_status')
          .select('*, current_tier:loyalty_tiers(*)')
          .eq('member_user_id', member.id)
          .eq('loyalty_program_id', program.id)
          .maybeSingle();

        if (status) {
          memberStatus = status;
          tierData = status.current_tier;
        }
      }
    }

    // If no tier found, get default tier
    if (!tierData) {
      const { data: defaultTier } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .eq('loyalty_program_id', program.id)
        .eq('is_default', true)
        .maybeSingle();

      tierData = defaultTier;
    }

    // Calculate points using tier settings
    let points = 0;
    let tierName = 'Base';
    let earnRate = 1;
    let earnDivisor = 1;

    if (tierData) {
      tierName = tierData.tier_name;
      earnRate = tierData.points_earn_rate || 1;
      earnDivisor = tierData.points_earn_divisor || 1;

      // Formula: (order_amount * earn_rate) / earn_divisor
      points = Math.floor((order_amount * earnRate) / earnDivisor);
    }

    // If customer_email and order_id are provided, automatically add the points
    let pointsAdded = false;
    let transactionReferenceId = null;
    let newBalance = null;

    if (customer_email && order_id && points > 0 && memberStatus) {
      // Check for duplicate order processing
      const { data: isDuplicate } = await supabase
        .rpc('check_duplicate_order_points', {
          p_order_id: order_id,
          p_member_user_id: memberStatus.member_user_id,
          p_loyalty_program_id: program.id,
        });

      if (!isDuplicate) {
        // Add points to member's account
        const currentBalance = memberStatus.points_balance || 0;
        newBalance = currentBalance + points;

        // Update loyalty status
        const { error: updateError } = await supabase
          .from('member_loyalty_status')
          .update({
            points_balance: newBalance,
            lifetime_points_earned: (memberStatus.lifetime_points_earned || 0) + points,
            total_orders: (memberStatus.total_orders || 0) + 1,
            total_spend: (memberStatus.total_spend || 0) + order_amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', memberStatus.id);

        if (!updateError) {
          // Log transaction (order_id column is UUID, so use reference_id for text order IDs)
          const { data: txData } = await supabase
            .from('loyalty_points_transactions')
            .insert({
              member_loyalty_status_id: memberStatus.id,
              member_user_id: memberStatus.member_user_id,
              transaction_type: 'earned',
              points_amount: points,
              balance_after: newBalance,
              order_id: null, // Set to null since external order IDs aren't UUIDs
              order_amount: order_amount,
              description: `Earned ${points} points from order ${order_id}`,
              reference_id: order_id, // Use reference_id for external order IDs
            })
            .select('transaction_reference_id')
            .single();

          if (txData) {
            transactionReferenceId = txData.transaction_reference_id;
            pointsAdded = true;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        points: points,
        points_added: pointsAdded,
        transaction_reference_id: transactionReferenceId,
        new_balance: newBalance,
        order_amount: order_amount,
        tier_name: tierName,
        earn_rate: earnRate,
        earn_divisor: earnDivisor,
        order_id: order_id || null,
        note: pointsAdded
          ? 'Points calculated and added to member account'
          : customer_email && order_id
            ? 'Points calculated but not added (member not found or duplicate order)'
            : 'Points calculated only (provide customer_email and order_id to auto-add points)'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error calculating loyalty points:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
