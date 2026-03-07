import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_URL = Deno.env.get("DASHBOARD_URL") || "https://goself.netlify.app";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Support both GET (query-params) and POST (body)
    let shopifyOrderId: string | null = null;
    let orderName: string | null = null;
    let shopDomain: string | null = null;
    let campaignId: string | null = null;
    let email: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      shopifyOrderId = url.searchParams.get("shopify_order_id");
      orderName      = url.searchParams.get("order_name");
      shopDomain     = url.searchParams.get("shop_domain");
      campaignId     = url.searchParams.get("campaign_id");
      email          = url.searchParams.get("email");
    } else {
      const body = await req.json();
      shopifyOrderId = body.shopify_order_id || null;
      orderName      = body.order_name || null;
      shopDomain     = body.shop_domain || null;
      campaignId     = body.campaign_id || null;
      email          = body.email || null;
    }

    if (!shopDomain) return json({ error: "shop_domain is required" }, 400);
    if (!shopifyOrderId && !orderName) return json({ error: "shopify_order_id or order_name is required" }, 400);

    // ── 1. Resolve client_id from shop_domain ─────────────────────────────────
    let clientId: string | null = null;
    const { data: ic } = await supabase
      .from("integration_configs")
      .select("client_id")
      .eq("shop_domain", shopDomain)
      .maybeSingle();
    if (ic?.client_id) clientId = ic.client_id;

    if (!clientId) {
      const { data: si } = await supabase
        .from("store_installations")
        .select("client_id")
        .eq("shop_domain", shopDomain)
        .eq("installation_status", "active")
        .maybeSingle();
      if (si?.client_id) clientId = si.client_id;
    }

    if (!clientId) return json({ has_rewards: false, error: "Shop not configured" });

    // ── 2. Find the internal order record ─────────────────────────────────────
    let orderQuery = supabase
      .from("shopify_orders")
      .select("id, order_number, customer_email")
      .eq("client_id", clientId);

    if (shopifyOrderId) {
      orderQuery = orderQuery.eq("shopify_order_id", shopifyOrderId);
    } else if (orderName) {
      // order_name can be "#BSC2002999942" or just "BSC2002999942"
      const cleanName = orderName.replace(/^#/, "");
      orderQuery = orderQuery.ilike("order_number", cleanName);
    }

    const { data: order } = await orderQuery.maybeSingle();

    if (!order) {
      return json({ has_rewards: false, message: "Order not found in loyalty system" });
    }

    // ── 3. Find active redemption tokens for this order ───────────────────────
    let tokenQuery = supabase
      .from("member_redemption_tokens")
      .select("token, expires_at, used, campaign_rules(id, name)")
      .eq("order_id", order.id)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    // If campaign_id provided, filter to that campaign only
    if (campaignId) {
      tokenQuery = tokenQuery.eq("campaign_rule_id", campaignId);
    }

    const { data: tokens } = await tokenQuery.limit(1);

    if (!tokens || tokens.length === 0) {
      return json({ has_rewards: false, message: "No active rewards for this order" });
    }

    const token = tokens[0];
    const redemptionLink = `${APP_URL}/redeem/${token.token}`;

    // ── 4. Resolve customer first name ────────────────────────────────────────
    let customerFirstName = "";
    const lookupEmail = email || order.customer_email;
    if (lookupEmail) {
      const { data: member } = await supabase
        .from("member_users")
        .select("first_name")
        .eq("email", lookupEmail)
        .eq("client_id", clientId)
        .maybeSingle();
      if (member?.first_name) customerFirstName = member.first_name;
    }

    return json({
      has_rewards: true,
      redemption_link: redemptionLink,
      campaign_name: (token.campaign_rules as any)?.name || "",
      customer_first_name: customerFirstName,
      expires_at: token.expires_at,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("get-campaign-reward-link error:", message);
    return json({ error: message }, 500);
  }
});
