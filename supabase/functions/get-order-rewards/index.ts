import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { order_id, shop_domain } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the order in our database
    const { data: order, error: orderError } = await supabase
      .from("shopify_orders")
      .select("id, client_id, order_number")
      .eq("shopify_order_id", order_id.toString())
      .maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if there are any redemption tokens for this order
    const { data: tokens, error: tokensError } = await supabase
      .from("member_redemption_tokens")
      .select(`
        token,
        expires_at,
        used,
        campaign_rules (
          name,
          membership_programs (
            name,
            description
          )
        )
      `)
      .eq("order_id", order.id)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (tokensError || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          has_rewards: false,
          message: "No rewards available for this order"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the client's domain for building the redemption link
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", order.client_id)
      .single();

    // Build redemption link (use the first token)
    const token = tokens[0].token;
    const redemptionLink = `${supabaseUrl.replace('//', '//app.')}/redeem/${token}`;

    return new Response(
      JSON.stringify({
        has_rewards: true,
        redemption_link: redemptionLink,
        rewards_count: tokens.length,
        client_name: client?.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in get-order-rewards:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
