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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { campaign_id, reward_ids, email, phone, order_id }: RedemptionRequest = await req.json();

    if (!campaign_id || !reward_ids || reward_ids.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "campaign_id and reward_ids are required"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!email && !phone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Either email or phone is required"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: campaign, error: campaignError } = await supabase
      .from("campaign_rules")
      .select("id, client_id, program_id, name, clients(name, communication_settings)")
      .eq("id", campaign_id)
      .eq("is_active", true)
      .maybeSingle();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campaign not found or inactive"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const clientId = campaign.client_id;
    const programId = campaign.program_id;

    let memberId: string | null = null;

    if (email) {
      const { data: existingMember } = await supabase
        .from("membership_enrollments")
        .select("member_id")
        .eq("client_id", clientId)
        .eq("program_id", programId)
        .eq("member_email", email)
        .maybeSingle();

      if (existingMember) {
        memberId = existingMember.member_id;
      } else {
        const memberName = email.split("@")[0];
        const { data: newMember, error: memberError } = await supabase
          .from("membership_enrollments")
          .insert({
            client_id: clientId,
            program_id: programId,
            member_email: email,
            member_phone: phone,
            member_name: memberName,
            enrollment_source: "campaign",
            enrollment_channel: "order",
            status: "active"
          })
          .select("member_id")
          .single();

        if (memberError) {
          console.error("Error creating member:", memberError);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Failed to create membership"
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        memberId = newMember.member_id;
      }
    }

    const { data: rewards, error: rewardsError } = await supabase
      .from("rewards")
      .select("id, title, description, reward_type, coupon_type, generic_coupon_code, redemption_link, client_id")
      .in("id", reward_ids)
      .eq("client_id", clientId)
      .eq("status", "active");

    if (rewardsError || !rewards || rewards.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Rewards not found or inactive"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const allocations = [];
    const voucherDetails = [];

    for (const reward of rewards) {
      let voucherCode = null;
      let redemptionUrl = null;

      if (reward.coupon_type === "generic" && reward.generic_coupon_code) {
        voucherCode = reward.generic_coupon_code;
      } else if (reward.coupon_type === "unique") {
        const { data: availableVoucher } = await supabase
          .from("coupon_codes")
          .select("code")
          .eq("reward_id", reward.id)
          .eq("is_used", false)
          .limit(1)
          .maybeSingle();

        if (availableVoucher) {
          voucherCode = availableVoucher.code;

          await supabase
            .from("coupon_codes")
            .update({
              is_used: true,
              used_at: new Date().toISOString(),
              used_by_email: email || null,
              used_by_phone: phone || null
            })
            .eq("code", voucherCode)
            .eq("reward_id", reward.id);
        }
      }

      if (reward.redemption_link) {
        redemptionUrl = reward.redemption_link;
      }

      if (memberId) {
        const { error: allocationError } = await supabase
          .from("reward_allocations")
          .insert({
            member_id: memberId,
            reward_id: reward.id,
            allocated_by: "system",
            allocated_via: "campaign",
            campaign_id: campaign_id,
            status: "allocated"
          });

        if (allocationError) {
          console.error("Error allocating reward:", allocationError);
        }
      }

      voucherDetails.push({
        reward_name: reward.title,
        reward_description: reward.description,
        voucher_code: voucherCode,
        redemption_url: redemptionUrl,
      });

      allocations.push({
        reward_id: reward.id,
        reward_title: reward.title,
        voucher_code: voucherCode,
        redemption_url: redemptionUrl,
      });
    }

    if (email && voucherDetails.length > 0) {
      const clientSettings = (campaign.clients as any)?.communication_settings;
      const emailEnabled = clientSettings?.email_enabled !== false;

      if (emailEnabled) {
        const emailBody = generateRewardEmail(
          email,
          campaign.name,
          (campaign.clients as any)?.name || "Rewards Hub",
          voucherDetails
        );

        console.log("Reward email would be sent:", emailBody);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully redeemed ${allocations.length} reward${allocations.length > 1 ? 's' : ''}`,
        allocations: allocations,
        member_id: memberId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error redeeming rewards:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateRewardEmail(
  email: string,
  campaignName: string,
  clientName: string,
  voucherDetails: Array<{
    reward_name: string;
    reward_description: string;
    voucher_code: string | null;
    redemption_url: string | null;
  }>
): string {
  const rewardsList = voucherDetails
    .map((v, index) => {
      let details = `${index + 1}. ${v.reward_name}\n   ${v.reward_description}`;
      if (v.voucher_code) {
        details += `\n   Code: ${v.voucher_code}`;
      }
      if (v.redemption_url) {
        details += `\n   Redeem at: ${v.redemption_url}`;
      }
      return details;
    })
    .join("\n\n");

  return `
Dear Customer,

Congratulations! You've successfully claimed your rewards from ${campaignName}.

Your Rewards:
${rewardsList}

Thank you for being a valued customer!

Best regards,
${clientName}
  `.trim();
}
