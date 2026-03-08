import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RedemptionRequest {
  campaign_id: string;
  reward_ids: string[];
  email?: string;
  phone?: string;
  order_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { campaign_id, reward_ids, email, phone, order_id }: RedemptionRequest = await req.json();

    if (!campaign_id || !reward_ids || reward_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "campaign_id and reward_ids are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Either email or phone is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Load campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaign_rules")
      .select("id, client_id, program_id, name, clients(name)")
      .eq("id", campaign_id)
      .eq("is_active", true)
      .maybeSingle();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign not found or inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = campaign.client_id;
    const programId = campaign.program_id;
    const clientName = (campaign.clients as any)?.name || "Rewards Hub";

    // 2. Validate reward_ids belong to this campaign
    const { data: campaignRewards } = await supabase
      .from("campaign_rewards")
      .select("reward_id")
      .eq("campaign_id", campaign_id)
      .in("reward_id", reward_ids)
      .eq("is_active", true);

    const validRewardIds = (campaignRewards || []).map((cr: any) => cr.reward_id);

    if (validRewardIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid rewards found for this campaign" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Load reward details (no client_id filter - rewards can be brand-owned)
    const { data: rewards, error: rewardsError } = await supabase
      .from("rewards")
      .select("id, title, description, reward_type, coupon_type, generic_coupon_code, redemption_link")
      .in("id", validRewardIds)
      .eq("status", "active");

    if (rewardsError || !rewards || rewards.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Rewards not found or inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Find or create member_users
    let memberId: string | null = null;

    if (email) {
      const { data: existingMember } = await supabase
        .from("member_users")
        .select("id")
        .eq("client_id", clientId)
        .eq("email", email)
        .maybeSingle();

      if (existingMember) {
        memberId = existingMember.id;
      } else {
        const { data: newMember, error: memberError } = await supabase
          .from("member_users")
          .insert({
            client_id: clientId,
            email: email,
            phone: phone || "",
            full_name: email.split("@")[0],
          })
          .select("id")
          .single();

        if (memberError) {
          console.error("Error creating member:", memberError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to create member record" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        memberId = newMember.id;
      }
    }

    // 5. Find or create member_memberships
    let membershipId: string | null = null;

    if (memberId && programId) {
      const { data: existingMembership } = await supabase
        .from("member_memberships")
        .select("id")
        .eq("member_id", memberId)
        .eq("program_id", programId)
        .maybeSingle();

      if (existingMembership) {
        membershipId = existingMembership.id;
      } else {
        const { data: newMembership, error: membershipError } = await supabase
          .from("member_memberships")
          .insert({
            member_id: memberId,
            program_id: programId,
            status: "active",
            activated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (!membershipError) {
          membershipId = newMembership.id;
        }
      }
    }

    // 6. Process each reward - assign voucher & allocate
    const allocations: Array<{
      reward_id: string;
      reward_title: string;
      voucher_code: string | null;
      redemption_url: string | null;
    }> = [];

    for (const reward of rewards) {
      let voucherCode: string | null = null;
      const redemptionUrl: string | null = reward.redemption_link || null;

      if (reward.coupon_type === "generic" && reward.generic_coupon_code) {
        voucherCode = reward.generic_coupon_code;
      } else {
        const { data: availableVoucher } = await supabase
          .from("vouchers")
          .select("id, code")
          .eq("reward_id", reward.id)
          .eq("status", "available")
          .limit(1)
          .maybeSingle();

        if (availableVoucher) {
          voucherCode = availableVoucher.code;
          await supabase
            .from("vouchers")
            .update({
              status: "redeemed",
              redeemed_at: new Date().toISOString(),
              member_id: memberId,
            })
            .eq("id", availableVoucher.id);
        }
      }

      if (memberId && membershipId) {
        await supabase.from("member_rewards_allocation").insert({
          member_id: memberId,
          membership_id: membershipId,
          reward_id: reward.id,
          quantity_allocated: 1,
        });
      }

      allocations.push({
        reward_id: reward.id,
        reward_title: reward.title,
        voucher_code: voucherCode,
        redemption_url: redemptionUrl,
      });
    }

    // 7. Log communication
    if (email && clientId) {
      const messageBody = buildEmailBody(campaign.name, clientName, allocations);
      try {
        await supabase.from("communication_logs").insert({
          client_id: clientId,
          member_id: memberId,
          campaign_rule_id: campaign_id,
          communication_type: "email",
          recipient_email: email,
          subject: `Your rewards from ${campaign.name}`,
          message_body: messageBody,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.error("Failed to log communication:", logErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully redeemed ${allocations.length} reward${allocations.length !== 1 ? "s" : ""}`,
        allocations,
        member_id: memberId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error redeeming rewards:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildEmailBody(
  campaignName: string,
  clientName: string,
  allocations: Array<{
    reward_title: string;
    voucher_code: string | null;
    redemption_url: string | null;
  }>
): string {
  const lines = allocations.map((a, i) => {
    let line = `${i + 1}. ${a.reward_title}`;
    if (a.voucher_code) line += `\n   Coupon Code: ${a.voucher_code}`;
    if (a.redemption_url) line += `\n   Redeem at: ${a.redemption_url}`;
    return line;
  });
  return `Dear Customer,

Congratulations! You have successfully claimed your rewards from ${campaignName}.

Your Rewards:
${lines.join("\n\n")}

Thank you for being a valued customer!

Best regards,
${clientName}`.trim();
}
