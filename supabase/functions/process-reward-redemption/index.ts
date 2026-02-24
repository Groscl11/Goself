import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { token, contact_method, contact_value } = await req.json();

    if (!token || !contact_method || !contact_value) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch token details
    const { data: tokenData, error: tokenError } = await supabase
      .from("member_redemption_tokens")
      .select(`
        id,
        member_id,
        campaign_rule_id,
        used,
        expires_at,
        campaign_rules (
          membership_program_id,
          client_id
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (tokenData.used) {
      return new Response(
        JSON.stringify({ error: "Token already used" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expired" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update or create member with contact info
    let memberId = tokenData.member_id;

    if (!memberId) {
      // Create new member
      const memberData: any = {
        client_id: tokenData.campaign_rules.client_id,
      };

      if (contact_method === "email") {
        memberData.email = contact_value;
      } else {
        memberData.phone = contact_value;
      }

      const { data: newMember, error: memberError } = await supabase
        .from("members")
        .insert(memberData)
        .select()
        .single();

      if (memberError) {
        console.error("Error creating member:", memberError);
        return new Response(
          JSON.stringify({ error: "Failed to create member" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      memberId = newMember.id;

      // Update token with member_id
      await supabase
        .from("member_redemption_tokens")
        .update({ member_id: memberId })
        .eq("id", tokenData.id);
    }

    // Get rewards for this program
    const { data: rewards } = await supabase
      .from("reward_allocations")
      .select(`
        id,
        rewards (
          id,
          name,
          description,
          type,
          brands (
            name
          )
        )
      `)
      .eq("membership_program_id", tokenData.campaign_rules.membership_program_id);

    // Create vouchers for each reward
    if (rewards && rewards.length > 0) {
      const vouchersToCreate = rewards.map((allocation: any) => ({
        member_id: memberId,
        reward_id: allocation.rewards.id,
        issued_by: tokenData.campaign_rules.client_id,
        status: "active",
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      }));

      await supabase.from("vouchers").insert(vouchersToCreate);
    }

    // Mark token as used
    await supabase
      .from("member_redemption_tokens")
      .update({
        used: true,
        used_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    // Send notification (call the communication function)
    try {
      await supabase.functions.invoke("send-campaign-communication", {
        body: {
          member_id: memberId,
          client_id: tokenData.campaign_rules.client_id,
          message_type: "reward_redemption",
          subject: "Your Rewards Have Been Delivered!",
          message: `Congratulations! Your rewards have been successfully redeemed. Check your member portal to view and use your vouchers.`,
          contact_method: contact_method,
          contact_value: contact_value,
        },
      });
    } catch (commError) {
      console.error("Error sending communication:", commError);
      // Don't fail the redemption if communication fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Rewards redeemed successfully",
        member_id: memberId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-reward-redemption:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
