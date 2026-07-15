import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * validate-campaign-token  (Phase 1+2: identity-verified, replay-capable)
 *
 * 1. PROBE   POST { token }
 *    -> { valid: true, requires_identity: true, identity_hint, campaign_name, expires_at }
 *    -> { valid: false, reason: "already_claimed", claimed_at, claimed_rewards: [...] }
 *    -> { valid: false, reason: "not_found"|"expired"|"campaign_inactive" }
 *
 * 2. VERIFY  POST { token, identity: string }
 *    -> { valid: true, verified: true, rewards, min_rewards, max_rewards, ... }
 *    -> { valid: false, reason: "identity_mismatch" }
 *
 * 3. CLAIM   POST { token, identity: string, claim: true, reward_ids: string[] }
 *    -> { valid: true, claimed: true, allocations: [...] }
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { token, identity, claim = false, reward_ids = [] } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, reason: "missing_token" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenRow, error: tokenError } = await supabase
      .from("campaign_tokens")
      .select(`
        id, email, phone, is_claimed, claimed_at, expires_at, member_id, claimed_rewards,
        is_pre_verified,
        campaign_rule_id,
        campaign_rules (
          id, name, client_id, is_active,
          reward_selection_mode, min_rewards_choice, max_rewards_choice, reward_action
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      console.warn(`[validate] not_found token=${token} err=${tokenError?.message}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[validate] token=${token} claimed=${tokenRow.is_claimed} pre_verified=${(tokenRow as any).is_pre_verified} expires=${tokenRow.expires_at}`);

    if (tokenRow.is_claimed) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "already_claimed",
          claimed_at: tokenRow.claimed_at,
          claimed_rewards: tokenRow.claimed_rewards || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, reason: "expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaign = tokenRow.campaign_rules as any;
    if (!campaign?.is_active) {
      return new Response(
        JSON.stringify({ valid: false, reason: "campaign_inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Identity gate: skipped when the token was issued from a trusted Shopify session
    // (is_pre_verified=true set server-side by shopify-webhook or get-order-token
    // using the service_role key — the only trusted source for this flag).
    // SECURITY: body.is_pre_verified is intentionally NOT trusted — a caller
    // could pass is_pre_verified:true to bypass identity verification entirely.
    const preVerified = !!(tokenRow as any).is_pre_verified;
    if (!preVerified) {
      if (!identity) {
        const hints: string[] = [];
        if (tokenRow.email) hints.push(maskEmail(tokenRow.email));
        if (tokenRow.phone) hints.push(maskPhone(tokenRow.phone));
        return new Response(
          JSON.stringify({
            valid: true,
            requires_identity: true,
            identity_hint: hints.join(" or "),
            has_email: !!tokenRow.email,
            has_phone: !!tokenRow.phone,
            campaign_name: campaign.name,
            expires_at: tokenRow.expires_at,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!identityMatches(identity, tokenRow.email, tokenRow.phone)) {
        return new Response(
          JSON.stringify({ valid: false, reason: "identity_mismatch" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Qualifying-order gate ────────────────────────────────────────────────
    // Verify this customer has at least one order that genuinely qualified for
    // this campaign (trigger_result = 'success' in campaign_trigger_logs).
    // This is the server-side backstop that blocks tokens issued via the
    // email/phone fallback path when a previous order's success log was
    // inadvertently matched for a new non-qualifying order.
    //
    // SKIPPED for is_pre_verified tokens: those were issued by get-campaign-reward-link
    // only after it already confirmed a success trigger log exists. Re-checking here
    // creates a race condition (trigger log may not be committed yet when the user
    // clicks the banner immediately after checkout).
    if (!preVerified && (tokenRow.email || tokenRow.phone)) {
      let qualifyQuery = supabase
        .from("campaign_trigger_logs")
        .select("id")
        .eq("campaign_rule_id", campaign.id)
        .eq("trigger_result", "success");

      if (tokenRow.email && tokenRow.phone) {
        qualifyQuery = qualifyQuery.or(
          `customer_email.eq.${tokenRow.email},customer_phone.eq.${tokenRow.phone}`
        );
      } else if (tokenRow.email) {
        qualifyQuery = qualifyQuery.eq("customer_email", tokenRow.email);
      } else {
        qualifyQuery = qualifyQuery.eq("customer_phone", tokenRow.phone);
      }

      const { data: qualifyingLog } = await qualifyQuery.limit(1).maybeSingle();

      if (!qualifyingLog) {
        console.warn(`validate-campaign-token: no qualifying order for token ${token} — rejecting`);
        return new Response(
          JSON.stringify({ valid: false, reason: "no_qualifying_order" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: poolRows, error: poolError } = await supabase
      .from("campaign_reward_pools")
      .select(`
        sort_order,
        rewards (
          id, title, description, image_url, offer_category, coupon_type,
          valid_until, status, available_codes, generic_coupon_code,
          brands ( id, name, logo_url )
        )
      `)
      .eq("campaign_rule_id", campaign.id)
      .order("sort_order");

    if (poolError) {
      console.error("Pool load error:", poolError);
      return new Response(
        JSON.stringify({ valid: false, reason: "pool_load_failed", detail: poolError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: if the pool table is empty, try reward_action.reward_pool (saved by CampaignsPage drawer)
    let rawRewards: any[] = (poolRows || []).map((r: any) => r.rewards);
    if (rawRewards.length === 0) {
      const inlinePool: any[] = (campaign.reward_action as any)?.reward_pool ?? [];
      if (inlinePool.length > 0) {
        const rewardIds = inlinePool.map((r: any) => r.id).filter(Boolean);
        if (rewardIds.length > 0) {
          const { data: fullRewards } = await supabase
            .from("rewards")
            .select(`id, title, description, image_url, offer_category, coupon_type,
              valid_until, status, available_codes, generic_coupon_code,
              brands ( id, name, logo_url )`)
            .in("id", rewardIds);
          if (fullRewards) rawRewards = fullRewards;
        }
      }
    }

    const now = new Date();
    const rewards = rawRewards
      .filter((r: any) => {
        if (!r || r.status !== "active") return false;
        if (r.valid_until && new Date(r.valid_until) <= now) return false;
        return true;
      })
      .map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        image_url: r.image_url,
        category: r.offer_category,
        coupon_type: r.coupon_type,
        generic_coupon_code: r.generic_coupon_code || null,
        brand: r.brands ? { id: r.brands.id, name: r.brands.name, logo_url: r.brands.logo_url } : null,
        available_vouchers: Number(r.available_codes) || 0,
      }));

    if (!claim) {
      return new Response(
        JSON.stringify({
          valid: true,
          verified: true,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          expires_at: tokenRow.expires_at,
          reward_selection_mode: campaign.reward_selection_mode,
          min_rewards: campaign.min_rewards_choice,
          max_rewards: campaign.max_rewards_choice,
          rewards,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reward_ids || reward_ids.length === 0) {
      return new Response(
        JSON.stringify({ valid: false, reason: "no_rewards_selected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.reward_selection_mode === "choice") {
      const min = campaign.min_rewards_choice;
      const max = campaign.max_rewards_choice;
      if (reward_ids.length < min || reward_ids.length > max) {
        return new Response(
          JSON.stringify({ valid: false, reason: `select_between_${min}_and_${max}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: claimResult, error: claimError } = await supabase
      .from("campaign_tokens")
      .update({ is_claimed: true, claimed_at: new Date().toISOString() })
      .eq("id", tokenRow.id)
      .eq("is_claimed", false)
      .select("id")
      .maybeSingle();

    if (claimError || !claimResult) {
      return new Response(
        JSON.stringify({ valid: false, reason: "already_claimed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let memberId = tokenRow.member_id;
    if (!memberId && tokenRow.email) {
      const { data: existingMember } = await supabase
        .from("member_users").select("id")
        .eq("client_id", campaign.client_id).eq("email", tokenRow.email)
        .maybeSingle();
      if (existingMember) {
        memberId = existingMember.id;
      } else {
        const { data: newMember } = await supabase
          .from("member_users")
          .insert({ client_id: campaign.client_id, email: tokenRow.email, full_name: tokenRow.email })
          .select("id").single();
        memberId = newMember?.id;
      }
    }

    const selectedIds: string[] = campaign.reward_selection_mode === "fixed"
      ? rewards.map((r: any) => r.id)
      : reward_ids.filter((id: string) => rewards.some((r: any) => r.id === id));

    // ── Fetch member data for offer_codes tracking ──────────────────────────
    const { data: memberDataForTracking } = memberId
      ? await supabase
          .from("member_users")
          .select("global_user_id, email")
          .eq("id", memberId)
          .maybeSingle()
      : { data: null };

    const allocations: Array<{
      reward_id: string; reward_title: string;
      voucher_code: string | null; redemption_url: string | null;
    }> = [];

    for (const rewardId of selectedIds) {
      const reward = rewards.find((r: any) => r.id === rewardId);
      if (!reward) continue;
      let voucherCode: string | null = null;

      // For generic rewards, the code is shared — return it directly without claiming a slot
      if (reward.coupon_type === "generic" && reward.generic_coupon_code) {
        voucherCode = reward.generic_coupon_code;
      } else {
        // For unique-code rewards, claim one offer_codes slot atomically.
        // SECURITY (H-07): the previous two-step SELECT + UPDATE had a race condition
        // where concurrent requests could SELECT the same code then both set voucherCode
        // (upErr is null even when 0 rows are updated). Using UPDATE ... RETURNING gives
        // true atomic semantics: only the request that wins the DB lock gets the row back.
        const { data: claimResult, error: upErr } = await supabase
          .from("offer_codes")
          .update({
            status: "assigned",
            assigned_at: new Date().toISOString(),
            assigned_to_member_id: memberId ?? null,
            distributed_by_client_id: campaign.client_id,
            global_user_id: memberDataForTracking?.global_user_id ?? null,
            member_email: memberDataForTracking?.email ?? null,
            code_source: "campaign",
            source_rule_id: campaign.id,
          })
          .eq("offer_id", rewardId)
          .eq("status", "available")
          .select("id, code")
          .limit(1);

        if (!upErr && claimResult && claimResult.length > 0) {
          voucherCode = claimResult[0].code;
        }


      }

      if (memberId) {
        const { error: allocErr } = await supabase.from("member_rewards_allocation").insert({
          member_id: memberId, membership_id: null, reward_id: rewardId, quantity_allocated: 1,
        });
        if (allocErr) console.error("allocation error:", allocErr);
      }

      allocations.push({ reward_id: rewardId, reward_title: reward.title, voucher_code: voucherCode, redemption_url: null });
    }

    await supabase.from("campaign_tokens").update({ claimed_rewards: allocations }).eq("id", tokenRow.id);

    if (memberId) {
      const { error: logErr } = await supabase.from("communication_logs").insert({
        client_id: campaign.client_id, member_id: memberId,
        campaign_rule_id: campaign.id, communication_type: "email",
        recipient_email: tokenRow.email,
        subject: `Your rewards from ${campaign.name}`,
        message_body: `Rewards claimed: ${allocations.map((a) => a.reward_title).join(", ")}`,
        status: "sent", sent_at: new Date().toISOString(),
      });
      if (logErr) console.error("communication_log error:", logErr);
    }

    return new Response(
      JSON.stringify({ valid: true, claimed: true, allocations }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("validate-campaign-token error:", error);
    return new Response(
      JSON.stringify({ valid: false, reason: "server_error", error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return email[0] + "***" + email.slice(at);
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, 3) + "****" + phone.slice(-3);
}

function identityMatches(input: string, email: string | null, phone: string | null): boolean {
  const trimmed = input.trim().toLowerCase();
  if (email && trimmed === email.trim().toLowerCase()) return true;
  const inputDigits = input.replace(/\D/g, "");
  if (phone && inputDigits.length >= 7) {
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits === inputDigits) return true;
    if (phoneDigits.endsWith(inputDigits)) return true;
    if (inputDigits.endsWith(phoneDigits)) return true;
  }
  return false;
}