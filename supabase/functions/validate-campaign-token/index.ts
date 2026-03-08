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
        campaign_rule_id,
        campaign_rules (
          id, name, client_id, is_active,
          reward_selection_mode, min_rewards_choice, max_rewards_choice
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ valid: false, reason: "not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const { data: poolRows, error: poolError } = await supabase
      .from("campaign_reward_pools")
      .select(`
        sort_order,
        rewards (
          id, title, description, value_description, image_url, category, coupon_type,
          expiry_date, status,
          brands ( id, name, logo_url ),
          vouchers ( id, status )
        )
      `)
      .eq("campaign_rule_id", campaign.id)
      .order("sort_order");

    if (poolError) console.error("Pool load error:", poolError);

    const now = new Date();
    const rewards = (poolRows || [])
      .map((r: any) => r.rewards)
      .filter((r: any) =>
        r && r.status === "active" &&
        (!r.expiry_date || new Date(r.expiry_date) > now) &&
        (r.vouchers || []).some((v: any) => v.status === "available")
      )
      .map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        value_description: r.value_description,
        image_url: r.image_url,
        category: r.category,
        coupon_type: r.coupon_type,
        brand: r.brands ? { id: r.brands.id, name: r.brands.name, logo_url: r.brands.logo_url } : null,
        available_vouchers: (r.vouchers || []).filter((v: any) => v.status === "available").length,
      }));

    if (!claim) {
      return new Response(
        JSON.stringify({
          valid: true,
          verified: true,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          email: tokenRow.email,
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

    const allocations: Array<{
      reward_id: string; reward_title: string;
      voucher_code: string | null; redemption_url: string | null;
    }> = [];

    for (const rewardId of selectedIds) {
      const reward = rewards.find((r: any) => r.id === rewardId);
      if (!reward) continue;
      let voucherCode: string | null = null;

      const { data: voucher } = await supabase
        .from("vouchers").select("id, code")
        .eq("reward_id", rewardId).eq("status", "available")
        .limit(1).maybeSingle();

      if (voucher) {
        const { error: upErr } = await supabase
          .from("vouchers")
          .update({ status: "redeemed", redeemed_at: new Date().toISOString(), member_id: memberId })
          .eq("id", voucher.id).eq("status", "available");
        if (!upErr) voucherCode = voucher.code;
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