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
    let shopDomain: string | null = null;
    let campaignId: string | null = null;   // human-readable e.g. "CAMP-0004" OR UUID
    let email: string | null = null;
    let phone: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      shopifyOrderId = url.searchParams.get("shopify_order_id");
      shopDomain     = url.searchParams.get("shop_domain");
      campaignId     = url.searchParams.get("campaign_id");
      email          = url.searchParams.get("email");
      phone          = url.searchParams.get("phone");
    } else {
      const body = await req.json();
      shopifyOrderId = body.shopify_order_id || null;
      shopDomain     = body.shop_domain || null;
      campaignId     = body.campaign_id || null;
      email          = body.email || null;
      phone          = body.phone || null;
    }

    if (!shopDomain) return json({ error: "shop_domain is required" }, 400);

    // ── 1. Resolve client_id from shop_domain ─────────────────────────────────
    let clientId: string | null = null;

    // Primary lookup: store_installations (source of truth)
    const { data: si1 } = await supabase
      .from("store_installations")
      .select("client_id")
      .eq("shop_domain", shopDomain)
      .eq("installation_status", "active")
      .maybeSingle();
    if (si1?.client_id) clientId = si1.client_id;

    if (!clientId) {
      console.error(`No client found for shop_domain: ${shopDomain}`);
      return json({ has_rewards: false, error: "Shop not configured" });
    }

    console.log(`Resolved client_id: ${clientId} for shop: ${shopDomain}`);

    // ── 2. Resolve campaign — by UUID or human-readable campaign_id field ─────
    let campaignUuid: string | null = null;
    let campaignName  = "";

    if (campaignId) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidPattern.test(campaignId)) {
        // Already a UUID — verify it belongs to this client and is active
        const { data: cr } = await supabase
          .from("campaign_rules")
          .select("id, name, is_active")
          .eq("id", campaignId)
          .eq("client_id", clientId)
          .maybeSingle();
        if (cr?.is_active) { campaignUuid = cr.id; campaignName = cr.name; }
      } else {
        // Human-readable code like "CAMP-0004"
        const { data: cr } = await supabase
          .from("campaign_rules")
          .select("id, name, is_active")
          .eq("campaign_id", campaignId)
          .eq("client_id", clientId)
          .maybeSingle();
        if (cr?.is_active) { campaignUuid = cr.id; campaignName = cr.name; }
      }

      if (!campaignUuid) {
        console.warn(`Campaign not found or inactive: ${campaignId} for client ${clientId}`);
        return json({ has_rewards: false, message: "Campaign not found or is not active" });
      }
    } else {
      // No campaign_id provided — fall back to first active campaign for this client
      const { data: cr } = await supabase
        .from("campaign_rules")
        .select("id, name")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cr) { campaignUuid = cr.id; campaignName = cr.name; }
    }

    if (!campaignUuid) {
      return json({ has_rewards: false, message: "No active campaigns for this shop" });
    }

    // ── 2.5 Gate: webhook trigger log is the single source of truth ────────────
    // When an order ID is present, always use what the webhook logged.
    // This ensures the banner always shows the exact same link as the trigger log.
    let customerFirstName = "";
    if (shopifyOrderId) {
      const { data: triggerLog } = await supabase
        .from("campaign_trigger_logs")
        .select("trigger_result, reward_link")
        .eq("campaign_rule_id", campaignUuid)
        .eq("order_id", shopifyOrderId)
        .in("trigger_result", ["success", "not_matched", "below_threshold", "max_reached", "already_enrolled"])
        .maybeSingle();

      if (triggerLog) {
        if (triggerLog.trigger_result !== "success") {
          console.log(`Suppressing reward banner: campaign result is "${triggerLog.trigger_result}" for order ${shopifyOrderId}`);
          return json({ has_rewards: false, message: "Order does not meet campaign conditions" });
        }
        // Webhook confirmed success — return its reward_link directly (single source of truth)
        if (triggerLog.reward_link) {
          console.log(`Returning webhook-logged reward link for order ${shopifyOrderId}`);
          return json({ has_rewards: true, redemption_link: triggerLog.reward_link, campaign_name: campaignName, customer_first_name: customerFirstName });
        }
        // success but no reward_link = membership campaign, fall through to token flow
      } else {
        // Webhook hasn't written the trigger log yet — tell the banner to retry
        console.log(`No trigger log yet for order ${shopifyOrderId} — returning pending`);
        return json({ has_rewards: false, pending: true, message: "Campaign evaluation in progress" });
      }
    }

    // ── 3. Look up customer member_id + first name ───────────────────────────
    let memberId: string | null = null;
    if (email) {
      const { data: member } = await supabase
        .from("member_users")
        .select("id, first_name")
        .eq("email", email)
        .eq("client_id", clientId)
        .maybeSingle();
      if (member) {
        memberId = member.id;
        if (member.first_name) customerFirstName = member.first_name;
      }
    } else if (phone) {
      const { data: member } = await supabase
        .from("member_users")
        .select("id, first_name")
        .eq("phone", phone)
        .eq("client_id", clientId)
        .maybeSingle();
      if (member) {
        memberId = member.id;
        if (member.first_name) customerFirstName = member.first_name;
      }
    }

    // ── 4. Generate tokenized claim link ──────────────────────────────────────
    // email column is nullable (migration 20260308000005). Tokenize with email OR phone.
    // Fallback to ?campaign= URL only when neither is available.
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const identifier = email || phone;

    if (identifier) {
      // Reuse an existing unexpired token for the same campaign + customer identity
      let existingTokenData: { token: string } | null = null;
      if (email) {
        const { data } = await supabase.from("campaign_tokens").select("token")
          .eq("campaign_rule_id", campaignUuid).eq("is_claimed", false)
          .gt("expires_at", new Date().toISOString()).eq("email", email).maybeSingle();
        existingTokenData = data;
      } else if (phone) {
        const { data } = await supabase.from("campaign_tokens").select("token")
          .eq("campaign_rule_id", campaignUuid).eq("is_claimed", false)
          .gt("expires_at", new Date().toISOString()).eq("phone", phone).maybeSingle();
        existingTokenData = data;
      }
      if (existingTokenData) {
        const redemptionLink = `${APP_URL}/claim-rewards?token=${existingTokenData.token}`;
        console.log(`Reusing existing token for campaign: ${campaignName}`);
        return json({ has_rewards: true, redemption_link: redemptionLink, campaign_name: campaignName, customer_first_name: customerFirstName });
      }

      const tokenUuid = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from("campaign_tokens")
        .insert({
          token: tokenUuid,
          campaign_rule_id: campaignUuid,
          email: email || null,
          phone: phone || null,
          member_id: memberId || null,
          expires_at: expiresAt,
          is_claimed: false,
          is_pre_verified: true,
        });

      if (!insertError) {
        const redemptionLink = `${APP_URL}/claim-rewards?token=${tokenUuid}`;
        const via = email ? "email" : "phone";
        console.log(`Returning tokenized claim URL (via ${via}) for campaign: ${campaignName}`);
        return json({
          has_rewards: true,
          redemption_link: redemptionLink,
          campaign_name: campaignName,
          customer_first_name: customerFirstName,
        });
      }
      console.error("campaign_tokens insert failed:", insertError.message);
    }

    // No identifier or insert failed — return campaign+order URL (no PII)
    const fallbackParams = new URLSearchParams({ campaign: campaignUuid });
    if (shopifyOrderId) fallbackParams.set("order", shopifyOrderId);
    const redemptionLink = `${APP_URL}/claim-rewards?${fallbackParams.toString()}`;
    console.log(`Returning non-tokenized claim URL for campaign: ${campaignName}`);

    return json({
      has_rewards: true,
      redemption_link: redemptionLink,
      campaign_name: campaignName,
      customer_first_name: customerFirstName,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("get-campaign-reward-link error:", message);
    return json({ error: message }, 500);
  }
});
