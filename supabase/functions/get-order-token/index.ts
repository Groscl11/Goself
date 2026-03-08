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

    // Accept GET (query params) or POST (JSON body)
    let orderId: string | null = null;
    let shop: string | null = null;
    let customerEmail: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      orderId       = url.searchParams.get("order_id");
      shop          = url.searchParams.get("shop");
      customerEmail = url.searchParams.get("customer_email");
    } else {
      const body = await req.json();
      orderId       = body.order_id || null;
      shop          = body.shop || null;
      customerEmail = body.customer_email || null;
    }

    if (!shop) return json({ has_reward: false, error: "shop is required" }, 400);

    // ── 1. Resolve client_id from shop domain ─────────────────────────────────
    let clientId: string | null = null;

    // Try integration_configs.shop_domain direct column
    const { data: ic1 } = await supabase
      .from("integration_configs")
      .select("client_id")
      .eq("shop_domain", shop)
      .maybeSingle();
    if (ic1?.client_id) clientId = ic1.client_id;

    // Try integration_configs.config->>'shop_domain' JSON field
    if (!clientId) {
      const { data: ic2 } = await supabase
        .from("integration_configs")
        .select("client_id")
        .eq("platform", "shopify")
        .eq("status", "connected")
        .ilike("config->>shop_domain", shop)
        .maybeSingle();
      if (ic2?.client_id) clientId = ic2.client_id;
    }

    // Try store_installations
    if (!clientId) {
      const { data: si } = await supabase
        .from("store_installations")
        .select("client_id")
        .eq("shop_domain", shop)
        .eq("installation_status", "active")
        .maybeSingle();
      if (si?.client_id) clientId = si.client_id;
    }

    if (!clientId) {
      console.error(`No client found for shop: ${shop}`);
      return json({ has_reward: false, message: "Shop not configured in GoSelf" });
    }

    console.log(`Resolved client_id: ${clientId} for shop: ${shop}`);

    // ── 2. Find best active campaign for this client ──────────────────────────
    // Priority: highest-priority active campaign that has rewards attached
    const { data: campaigns } = await supabase
      .from("campaign_rules")
      .select("id, name, campaign_id")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (!campaigns || campaigns.length === 0) {
      console.log(`No active campaigns for client: ${clientId}`);
      return json({ has_reward: false, message: "No active campaigns available" });
    }

    // Pick first campaign that has rewards attached
    let selectedCampaign: { id: string; name: string; campaign_id: string } | null = null;
    for (const campaign of campaigns) {
      const { data: rewards, error: rErr } = await supabase
        .from("campaign_rewards")
        .select("id")
        .eq("campaign_id", campaign.id)
        .eq("is_active", true)
        .limit(1);
      if (!rErr && rewards && rewards.length > 0) {
        selectedCampaign = campaign;
        break;
      }
    }

    // Fall back to first campaign even if no rewards table entry found
    if (!selectedCampaign) selectedCampaign = campaigns[0];

    // ── 3. Resolve customer first name ────────────────────────────────────────
    let customerFirstName = "";
    if (customerEmail) {
      const { data: member } = await supabase
        .from("member_users")
        .select("first_name")
        .eq("email", customerEmail)
        .eq("client_id", clientId)
        .maybeSingle();
      if (member?.first_name) customerFirstName = member.first_name;
    }

    // ── 4. Build claim URL ─────────────────────────────────────────────────────
    // Uses the existing /claim-rewards page which reads ?campaign, ?order, ?email
    const params = new URLSearchParams({ campaign: selectedCampaign.id });
    if (orderId) params.set("order", orderId);
    if (customerEmail) params.set("email", customerEmail);
    const claimUrl = `${APP_URL}/claim-rewards?${params.toString()}`;

    // expires_at: 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`Returning claim URL for campaign: ${selectedCampaign.name}`);

    return json({
      has_reward: true,
      claim_url: claimUrl,
      campaign_name: selectedCampaign.name,
      customer_first_name: customerFirstName,
      expires_at: expiresAt,
      pre_verified: true,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("get-order-token error:", message);
    return json({ has_reward: false, error: message }, 500);
  }
});
