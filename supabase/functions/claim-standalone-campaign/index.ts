import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * claim-standalone-campaign
 *
 * Handles the /claim-rewards?campaign=RULE_ID&email=EMAIL direct-URL flow
 * for standalone campaign rules (reward pool stored in campaign_reward_pools).
 *
 * POST { campaign_rule_id: string }
 *   → Returns campaign metadata + reward pool (read-only)
 *
 * POST { campaign_rule_id: string, email: string, reward_ids: string[], claim: true }
 *   → Validates, allocates vouchers, returns allocations
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { campaign_rule_id, email, reward_ids = [], claim = false } = body;

    if (!campaign_rule_id) {
      return new Response(
        JSON.stringify({ success: false, reason: "missing_campaign_rule_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Load campaign rule ─────────────────────────────────────────────────
    const { data: campaign, error: campError } = await supabase
      .from("campaign_rules")
      .select(`
        id, name, client_id, is_active, rule_mode,
        reward_selection_mode, min_rewards_choice, max_rewards_choice,
        start_date, end_date
      `)
      .eq("id", campaign_rule_id)
      .maybeSingle();

    if (campError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, reason: "campaign_not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!campaign.is_active) {
      return new Response(
        JSON.stringify({ success: false, reason: "campaign_inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.rule_mode !== "standalone") {
      return new Response(
        JSON.stringify({ success: false, reason: "not_standalone" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check date range
    const now = new Date();
    if (campaign.start_date && new Date(campaign.start_date) > now) {
      return new Response(
        JSON.stringify({ success: false, reason: "campaign_not_started" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (campaign.end_date && new Date(campaign.end_date) < now) {
      return new Response(
        JSON.stringify({ success: false, reason: "campaign_ended" }),
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
      .eq("campaign_rule_id", campaign_rule_id)
      .order("sort_order");

    if (poolError) {
      console.error("Pool load error:", poolError);
      return new Response(
        JSON.stringify({ success: false, reason: "pool_load_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build rewards list — show all active, flag availability count
    const allPoolRewards = (poolRows || [])
      .map((r: any) => r.rewards)
      .filter((r: any) => r && r.status === "active" && (!r.expiry_date || new Date(r.expiry_date) > now))
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

    // Only rewards with available vouchers can actually be claimed
    const claimableRewards = allPoolRewards.filter((r: any) => r.available_vouchers > 0);

    // ── 3. Read-only response ─────────────────────────────────────────────────
    if (!claim) {
      return new Response(
        JSON.stringify({
          success: true,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          reward_selection_mode: campaign.reward_selection_mode,
          min_rewards: campaign.min_rewards_choice,
          max_rewards: campaign.max_rewards_choice,
          rewards: claimableRewards,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Claim: validate inputs ────────────────────────────────────────────
    if (!email) {
      return new Response(
        JSON.stringify({ success: false, reason: "missing_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reward_ids || reward_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: false, reason: "no_rewards_selected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.reward_selection_mode === "choice") {
      const { min_rewards_choice: min, max_rewards_choice: max } = campaign;
      if (reward_ids.length < min || reward_ids.length > max) {
        return new Response(
          JSON.stringify({ success: false, reason: `select_between_${min}_and_${max}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 5. Find or create member_user ────────────────────────────────────────
    let memberId: string | null = null;
    const { data: existingMember } = await supabase
      .from("member_users")
      .select("id")
      .eq("client_id", campaign.client_id)
      .eq("email", email)
      .maybeSingle();

    if (existingMember) {
      memberId = existingMember.id;
    } else {
      const { data: newMember } = await supabase
        .from("member_users")
        .insert({ client_id: campaign.client_id, email, full_name: email })
        .select("id")
        .single();
      memberId = newMember?.id || null;
    }

    // ── 6. Determine which reward IDs to process ──────────────────────────────
    const validIds = reward_ids.filter((id: string) => claimableRewards.some((r: any) => r.id === id));
    const selectedIds: string[] =
      campaign.reward_selection_mode === "fixed"
        ? claimableRewards.map((r: any) => r.id)
        : validIds;

    // ── 7. Allocate vouchers ──────────────────────────────────────────────────
    const allocations: Array<{
      reward_id: string;
      reward_title: string;
      voucher_code: string | null;
      redemption_url: string | null;
    }> = [];

    for (const rewardId of selectedIds) {
      const reward = claimableRewards.find((r: any) => r.id === rewardId);
      if (!reward) continue;

      // Atomically grab an available voucher
      const { data: voucher } = await supabase
        .from("vouchers")
        .select("id, code")
        .eq("reward_id", rewardId)
        .eq("status", "available")
        .limit(1)
        .maybeSingle();

      let voucherCode: string | null = null;
      if (voucher) {
        const { error: updateError } = await supabase
          .from("vouchers")
          .update({
            status: "redeemed",
            redeemed_at: new Date().toISOString(),
            ...(memberId ? { member_id: memberId } : {}),
          })
          .eq("id", voucher.id)
          .eq("status", "available"); // optimistic lock

        if (!updateError) {
          voucherCode = voucher.code;
        }
      }

      // Record allocation
      if (memberId) {
        await supabase.from("member_rewards_allocation").insert({
          member_id: memberId,
          membership_id: null,
          reward_id: rewardId,
          quantity_allocated: 1,
        }).catch(console.error);
      }

      allocations.push({
        reward_id: rewardId,
        reward_title: reward.title,
        voucher_code: voucherCode,
        redemption_url: null,
      });
    }

    // ── 8. Log communication ─────────────────────────────────────────────────
    if (memberId && allocations.length > 0) {
      await supabase.from("communication_logs").insert({
        client_id: campaign.client_id,
        member_id: memberId,
        campaign_rule_id: campaign.id,
        communication_type: "email",
        recipient_email: email,
        subject: `Your rewards from ${campaign.name}`,
        message_body: `Rewards claimed: ${allocations.map((a) => a.reward_title).join(", ")}`,
        status: "sent",
        sent_at: new Date().toISOString(),
      }).catch(console.error);
    }

    return new Response(
      JSON.stringify({ success: true, allocations }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("claim-standalone-campaign error:", error);
    return new Response(
      JSON.stringify({ success: false, reason: "server_error", error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
