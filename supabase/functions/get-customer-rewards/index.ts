import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { customer_email, widget_id } = await req.json();

    if (!customer_email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Customer email is required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Import Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find customer by email
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, client_id')
      .eq('email', customer_email)
      .maybeSingle();

    if (customerError) {
      throw new Error(`Failed to fetch customer: ${customerError.message}`);
    }

    if (!customers) {
      return new Response(
        JSON.stringify({
          success: true,
          rewards: [],
          message: 'Customer not found',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get available rewards for this customer
    const { data: rewards, error: rewardsError } = await supabase
      .from('reward_allocations')
      .select(`
        id,
        quantity,
        redeemed_count,
        allocated_at,
        expires_at,
        rewards (
          id,
          name,
          description,
          reward_type,
          value_type,
          value_amount
        )
      `)
      .eq('customer_id', customers.id)
      .gt('quantity', supabase.raw('redeemed_count'))
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('allocated_at', { ascending: false });

    if (rewardsError) {
      throw new Error(`Failed to fetch rewards: ${rewardsError.message}`);
    }

    // Generate redemption links for each reward
    const rewardsWithLinks = await Promise.all(
      (rewards || []).map(async (allocation) => {
        const { data: tokenData } = await supabase
          .from('member_redemption_tokens')
          .select('token')
          .eq('customer_id', customers.id)
          .eq('reward_allocation_id', allocation.id)
          .eq('used', false)
          .or('expires_at.is.null,expires_at.gt.now()')
          .maybeSingle();

        let redemptionToken = tokenData?.token;

        // Create token if doesn't exist
        if (!redemptionToken) {
          const token = crypto.randomUUID();
          const { error: tokenError } = await supabase
            .from('member_redemption_tokens')
            .insert({
              token,
              customer_id: customers.id,
              reward_allocation_id: allocation.id,
              expires_at: allocation.expires_at,
            });

          if (!tokenError) {
            redemptionToken = token;
          }
        }

        const availableQty = allocation.quantity - allocation.redeemed_count;

        return {
          id: allocation.id,
          name: allocation.rewards.name,
          description: allocation.rewards.description,
          reward_type: allocation.rewards.reward_type,
          value_type: allocation.rewards.value_type,
          value_amount: allocation.rewards.value_amount,
          available_quantity: availableQty,
          allocated_at: allocation.allocated_at,
          expires_at: allocation.expires_at,
          redemption_link: redemptionToken
            ? `${req.headers.get('origin') || ''}/redeem/${redemptionToken}`
            : null,
        };
      })
    );

    // Track widget view
    if (widget_id) {
      const { data: widgetConfig } = await supabase
        .from('widget_configurations')
        .select('id')
        .eq('widget_id', widget_id)
        .eq('client_id', customers.client_id)
        .maybeSingle();

      if (widgetConfig) {
        await supabase.from('widget_analytics').insert({
          widget_config_id: widgetConfig.id,
          event_type: 'view',
          metadata: { customer_email },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rewards: rewardsWithLinks,
        customer_id: customers.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-customer-rewards:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
