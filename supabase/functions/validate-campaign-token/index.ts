import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * validate-campaign-token
 *
 * Called by the public /claim-rewards page when accessed via a tokenized link.
 *
 * POST { token: string }
 *
 * Returns:
 *   { valid: true, campaign_id, campaign_name, min_rewards, max_rewards, rewards: [...] }
 *   or { valid: false, reason: "expired" | "already_claimed" | "not_found" }
 *
 * Token is a UUID (122 bits entropy) — acts as the credential.
 * Uses service_role for DB access — no user JWT required.
 * Mark-as-claimed is atomic to prevent double-claim race conditions.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { token, claim = false, reward_ids = [] } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, reason: "missing_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Load token ─────────────────────────────────────────────────────────
    const { data: tokenRow, error: tokenError } = await supabase
      .from("campaign_tokens")
      .select(`
        id, email, is_claimed, claimed_at, expires_at, member_id,
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
        JSON.stringify({ valid: false, reason: "already_claimed" }),
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

    // ── 2. Load reward pool ───────────────────────────────────────────────────
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

    if (poolError) {
      console.error("Pool load error:", poolError);
    }

    // Filter: active, not expired, has at least one available voucher
    const now = new Date();
    const rewards = (poolRows || [])
      .map((r: any) => r.rewards)
      .filter((r: any) =>
        r &&
        r.status === "active" &&
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

    // ── 3. If claim=true, mark token claimed + assign vouchers ────────────────
    if (claim) {
      if (!reward_ids || reward_ids.length === 0) {
        return new Response(
          JSON.stringify({ valid: false, reason: "no_rewards_selected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { min, max } = { min: campaign.min_rewards_choice, max: campaign.max_rewards_choice };
      if (campaign.reward_selection_mode === "choice") {
        if (reward_ids.length < min || reward_ids.length > max) {
          return new Response(
            JSON.stringify({ valid: false, reason: `select_between_${min}_and_${max}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Atomic claim — prevents double-claim race: only update if still unclaimed
      const { data: claimResult, error: claimError } = await supabase
        .from("campaign_tokens")
        .update({ is_claimed: true, claimed_at: new Date().toISOString() })
        .eq("id", tokenRow.id)
        .eq("is_claimed", false)   // ← optimistic lock
        .select("id")
        .maybeSingle();

      if (claimError || !claimResult) {
        return new Response(
          JSON.stringify({ valid: false, reason: "already_claimed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find/create member_user
      let memberId = tokenRow.member_id;
      if (!memberId) {
        const { data: existingMember } = await supabase
          .from("member_users")
          .select("id")
          .eq("client_id", campaign.client_id)
          .eq("email", tokenRow.email)
          .maybeSingle();

        if (existingMember) {
          memberId = existingMember.id;
        } else {
          const { data: newMember } = await supabase
            .from("member_users")
            .insert({ client_id: campaign.client_id, email: tokenRow.email, full_name: tokenRow.email })
            .select("id")
            .single();
          memberId = newMember?.id;
        }
      }

      // Determine final reward list
      const selectedIds: string[] = campaign.reward_selection_mode === "fixed"
        ? rewards.map((r: any) => r.id)
        : reward_ids.filter((id: string) => rewards.some((r: any) => r.id === id));

      // Assign vouchers atomically
      const allocations: Array<{ reward_id: string; reward_title: string; voucher_code: string | null; redemption_url: string | null }> = [];

      for (const rewardId of selectedIds) {
        const reward = rewards.find((r: any) => r.id === rewardId);
        if (!reward) continue;

        let voucherCode: string | null = null;
        let redemptionUrl: string | null = null;

        // Get available voucher — atomic update
        const { data: voucher } = await supabase
          .from("vouchers")
          .select("id, code")
          .eq("reward_id", rewardId)
          .eq("status", "available")
          .limit(1)
          .maybeSingle();

        if (voucher) {
          await supabase
            .from("vouchers")
            .update({ status: "redeemed", redeemed_at: new Date().toISOString(), member_id: memberId })
            .eq("id", voucher.id)
            .eq("status", "available"); // optimistic lock

          voucherCode = voucher.code;
        }

        // Insert allocation record (membership_id is nullable for standalone)
        if (memberId) {
          await supabase.from("member_rewards_allocation").insert({
            member_id: memberId,
            membership_id: null,
            reward_id: rewardId,
            quantity_allocated: 1,
          });
        }

        allocations.push({
          reward_id: rewardId,
          reward_title: reward.title,
          voucher_code: voucherCode,
          redemption_url: redemptionUrl,
        });
      }

      // Log communication
      if (memberId) {
        await supabase.from("communication_logs").insert({
          client_id: campaign.client_id,
          member_id: memberId,
          campaign_rule_id: campaign.id,
          communication_type: "email",
          recipient_email: tokenRow.email,
          subject: `Your rewards from ${campaign.name}`,
          message_body: `Rewards claimed: ${allocations.map((a) => a.reward_title).join(", ")}`,
          status: "sent",
          sent_at: new Date().toISOString(),
        }).catch(console.error);
      }

      return new Response(
        JSON.stringify({ valid: true, claimed: true, allocations }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Read-only validation response ─────────────────────────────────────
    return new Response(
      JSON.stringify({
        valid: true,
        claimed: false,
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
  } catch (error: any) {
    console.error("validate-campaign-token error:", error);
    return new Response(
      JSON.stringify({ valid: false, reason: "server_error", error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
