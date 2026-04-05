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
    let customerPhone: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      orderId       = url.searchParams.get("order_id");
      shop          = url.searchParams.get("shop");
      customerEmail = url.searchParams.get("customer_email");
      customerPhone = url.searchParams.get("customer_phone");
    } else {
      const body = await req.json();
      orderId       = body.order_id || null;
      shop          = body.shop || null;
      customerEmail = body.customer_email || null;
      customerPhone = body.customer_phone || null;
    }

    if (!shop) return json({ has_reward: false, error: "shop is required" }, 400);

    // ── 1. Resolve client_id from shop domain ─────────────────────────────────
    let clientId: string | null = null;

    // Primary lookup: store_installations (source of truth)
    const { data: si } = await supabase
      .from("store_installations")
      .select("client_id")
      .eq("shop_domain", shop)
      .eq("installation_status", "active")
      .maybeSingle();
    if (si?.client_id) clientId = si.client_id;

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
        .from("campaign_reward_pools")
        .select("id")
        .eq("campaign_rule_id", campaign.id)
        .limit(1);
      if (!rErr && rewards && rewards.length > 0) {
        selectedCampaign = campaign;
        break;
      }
    }

    // Fall back to first campaign even if no rewards table entry found
    if (!selectedCampaign) selectedCampaign = campaigns[0];

    // ── 2.5 Gate: webhook trigger log is the single source of truth ────────────
    // When an order ID is present, always use what the webhook logged.
    if (orderId) {
      const { data: triggerLog } = await supabase
        .from("campaign_trigger_logs")
        .select("trigger_result, reward_link")
        .eq("campaign_rule_id", selectedCampaign.id)
        .eq("order_id", orderId)
        .in("trigger_result", ["success", "not_matched", "below_threshold", "max_reached", "already_enrolled"])
        .maybeSingle();

      if (triggerLog) {
        if (triggerLog.trigger_result !== "success") {
          console.log(`Suppressing reward banner: campaign result is "${triggerLog.trigger_result}" for order ${orderId}`);
          return json({ has_reward: false, message: "Order does not meet campaign conditions" });
        }
        // Webhook confirmed success — return its reward_link directly (single source of truth)
        if (triggerLog.reward_link) {
          console.log(`Returning webhook-logged reward link for order ${orderId}`);
          return json({ has_reward: true, claim_url: triggerLog.reward_link, campaign_name: selectedCampaign.name, customer_first_name: customerFirstName, pre_verified: true });
        }
        // success but no reward_link = membership campaign, fall through to token flow
      } else {
        // Webhook hasn't written the trigger log yet — tell the banner to retry
        console.log(`No trigger log yet for order ${orderId} — returning pending`);
        return json({ has_reward: false, pending: true, message: "Campaign evaluation in progress" });
      }
    }

    // ── 3. Look up customer member_id + first name ───────────────────────────
    let customerFirstName = "";
    let memberId: string | null = null;
    if (customerEmail) {
      const { data: member } = await supabase
        .from("member_users")
        .select("id, first_name")
        .eq("email", customerEmail)
        .eq("client_id", clientId)
        .maybeSingle();
      if (member) {
        memberId = member.id;
        if (member.first_name) customerFirstName = member.first_name;
      }
    } else if (customerPhone) {
      const { data: member } = await supabase
        .from("member_users")
        .select("id, first_name")
        .eq("phone", customerPhone)
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
    const identifier = customerEmail || customerPhone;

    if (identifier) {
      // Reuse an existing unexpired token for the same campaign + customer identity
      let existingTokenData: { token: string } | null = null;
      if (customerEmail) {
        const { data } = await supabase.from("campaign_tokens").select("token")
          .eq("campaign_rule_id", selectedCampaign.id).eq("is_claimed", false)
          .gt("expires_at", new Date().toISOString()).eq("email", customerEmail).maybeSingle();
        existingTokenData = data;
      } else if (customerPhone) {
        const { data } = await supabase.from("campaign_tokens").select("token")
          .eq("campaign_rule_id", selectedCampaign.id).eq("is_claimed", false)
          .gt("expires_at", new Date().toISOString()).eq("phone", customerPhone).maybeSingle();
        existingTokenData = data;
      }
      if (existingTokenData) {
        const claimUrl = `${APP_URL}/claim-rewards?token=${existingTokenData.token}`;
        console.log(`Reusing existing token for campaign: ${selectedCampaign.name}`);
        return json({ has_reward: true, claim_url: claimUrl, campaign_name: selectedCampaign.name, customer_first_name: customerFirstName, expires_at: expiresAt, pre_verified: true });
      }

      const tokenUuid = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from("campaign_tokens")
        .insert({
          token: tokenUuid,
          campaign_rule_id: selectedCampaign.id,
          email: customerEmail || null,
          phone: customerPhone || null,
          member_id: memberId || null,
          expires_at: expiresAt,
          is_claimed: false,
          is_pre_verified: true,
        });

      if (!insertError) {
        const claimUrl = `${APP_URL}/claim-rewards?token=${tokenUuid}`;
        const via = customerEmail ? "email" : "phone";
        console.log(`Returning tokenized claim URL (via ${via}) for campaign: ${selectedCampaign.name}`);
        return json({
          has_reward: true,
          claim_url: claimUrl,
          campaign_name: selectedCampaign.name,
          customer_first_name: customerFirstName,
          expires_at: expiresAt,
          pre_verified: true,
        });
      }
      console.error("campaign_tokens insert failed:", insertError.message);
    }

    // Fallback: no identifier or insert failed — build URL without any PII
    const fallbackParams = new URLSearchParams({ campaign: selectedCampaign.id });
    if (orderId) fallbackParams.set("order", orderId);
    const claimUrl = `${APP_URL}/claim-rewards?${fallbackParams.toString()}`;
    console.log(`Returning non-tokenized claim URL for campaign: ${selectedCampaign.name}`);

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
