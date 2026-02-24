import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderRequest {
  order_id: string;
  order_value: number;
  currency?: string;
  customer_email?: string;
  customer_phone?: string;
  shipping_address?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };
  billing_address?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };
  line_items?: Array<{
    product_id?: string;
    variant_id?: string;
    title?: string;
    quantity?: number;
    price?: number;
    sku?: string;
  }>;
  payment_method?: string;
  payment_gateway?: string;
  shop_domain: string;
  discount_codes?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const requestData: OrderRequest = await req.json();
    const {
      order_id,
      order_value,
      customer_email,
      customer_phone,
      shop_domain,
      shipping_address,
      line_items,
      payment_method,
      discount_codes,
    } = requestData;

    if (!shop_domain) {
      return new Response(
        JSON.stringify({
          qualifies: false,
          error: "shop_domain is required"
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

    // Find client by shop domain
    const { data: shopConfig } = await supabase
      .from("integration_configs")
      .select("client_id, clients(id, name)")
      .eq("integration_type", "shopify")
      .eq("is_active", true)
      .ilike("config->>shop_domain", shop_domain)
      .maybeSingle();

    if (!shopConfig || !shopConfig.client_id) {
      return new Response(
        JSON.stringify({
          qualifies: false,
          error: "Shop not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const clientId = shopConfig.client_id;
    const clientName = (shopConfig.clients as any)?.name || "Rewards Hub";

    // Check if order already exists and has rewards
    let existingOrder = null;
    if (order_id) {
      const { data: orderData } = await supabase
        .from("shopify_orders")
        .select("id, client_id")
        .eq("shopify_order_id", order_id.toString())
        .eq("client_id", clientId)
        .maybeSingle();

      existingOrder = orderData;

      // If order exists, check for existing redemption tokens
      if (existingOrder) {
        const { data: tokens } = await supabase
          .from("member_redemption_tokens")
          .select(`
            token,
            redemption_url,
            valid_until,
            is_active,
            campaign_rules(name, description),
            membership_programs:membership_id(
              program:program_id(name, description)
            )
          `)
          .eq("client_id", clientId)
          .eq("is_active", true)
          .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
          .limit(1);

        if (tokens && tokens.length > 0) {
          const token = tokens[0];
          const campaign = (token.campaign_rules as any);
          const program = (token.membership_programs as any)?.program;

          return new Response(
            JSON.stringify({
              qualifies: true,
              bannerTitle: `Congratulations! You've Earned Rewards! 🎉`,
              bannerMessage: campaign?.description || program?.description ||
                `Thank you for your purchase! You've been enrolled in our exclusive rewards program.`,
              buttonText: "Claim Your Rewards",
              rewardUrl: token.redemption_url,
              clientName: clientName,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // If no existing rewards, check campaign eligibility
    const { data: campaigns } = await supabase
      .from("campaign_rules")
      .select(`
        id,
        name,
        description,
        trigger_conditions,
        eligibility_conditions,
        location_conditions,
        attribution_conditions,
        exclusion_rules,
        is_active,
        priority,
        membership_programs:program_id(name, description)
      `)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({
          qualifies: false,
          message: "No active campaigns available",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build order context for evaluation
    const orderContext = {
      id: order_id,
      total_price: order_value,
      email: customer_email,
      phone: customer_phone,
      shipping_address: shipping_address,
      line_items: line_items || [],
      gateway: payment_method,
      discount_codes: discount_codes?.map(code => ({ code })) || [],
      financial_status: "paid",
      cancelled_at: null,
      test: false,
    };

    const customerContext = {
      email: customer_email,
      phone: customer_phone,
    };

    // Evaluate campaigns using the existing evaluate-campaign-rules logic
    for (const campaign of campaigns) {
      const isEligible = await evaluateCampaignConditions(
        campaign,
        orderContext,
        customerContext
      );

      if (isEligible) {
        const program = (campaign.membership_programs as any);

        const { data: campaignRewards } = await supabase
          .from("campaign_rewards")
          .select(`
            priority,
            rewards:reward_id(
              id,
              title,
              description,
              reward_type,
              discount_value,
              category,
              image_url,
              terms_conditions,
              brands:brand_id(name, logo_url)
            )
          `)
          .eq("campaign_id", campaign.id)
          .eq("is_active", true)
          .order("priority");

        const rewards = campaignRewards
          ?.map(cr => (cr.rewards as any))
          .filter(r => r && r.id) || [];

        const baseUrl = supabaseUrl.replace("https://", "https://app.");
        const rewardUrl = customer_email
          ? `${baseUrl}/claim-rewards?email=${encodeURIComponent(customer_email)}&campaign=${campaign.id}&order=${order_id || ''}`
          : `${baseUrl}/claim-rewards?campaign=${campaign.id}&order=${order_id || ''}`;

        return new Response(
          JSON.stringify({
            qualifies: true,
            bannerTitle: campaign.name || `You've Earned Rewards! 🎉`,
            bannerMessage: campaign.description || program?.description ||
              `Congratulations! You qualify for exclusive rewards. Click below to claim your benefits.`,
            buttonText: "Claim Your Rewards",
            rewardUrl: rewardUrl,
            clientName: clientName,
            campaignId: campaign.id,
            programName: program?.name,
            rewards: rewards,
            rewardCount: rewards.length,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // No campaigns matched
    return new Response(
      JSON.stringify({
        qualifies: false,
        message: "Order does not qualify for rewards",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error checking campaign rewards:", error);
    return new Response(
      JSON.stringify({
        qualifies: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Simplified campaign evaluation logic
function evaluateCampaignConditions(
  campaign: any,
  order: any,
  customer: any
): boolean {
  try {
    // Check exclusion rules
    if (campaign.exclusion_rules) {
      if (campaign.exclusion_rules.exclude_refunded && order.financial_status === "refunded") {
        return false;
      }
      if (campaign.exclusion_rules.exclude_cancelled && order.cancelled_at) {
        return false;
      }
      if (campaign.exclusion_rules.exclude_test_orders && order.test) {
        return false;
      }
    }

    // Evaluate trigger conditions
    if (campaign.trigger_conditions && campaign.trigger_conditions.length > 0) {
      for (const condition of campaign.trigger_conditions) {
        if (!evaluateCondition(condition, order, customer)) {
          return false;
        }
      }
    }

    // Evaluate eligibility conditions
    if (campaign.eligibility_conditions && campaign.eligibility_conditions.length > 0) {
      for (const condition of campaign.eligibility_conditions) {
        if (!evaluateCondition(condition, order, customer)) {
          return false;
        }
      }
    }

    // Evaluate location conditions
    if (campaign.location_conditions && campaign.location_conditions.length > 0) {
      for (const condition of campaign.location_conditions) {
        if (!evaluateCondition(condition, order, customer)) {
          return false;
        }
      }
    }

    // Evaluate attribution conditions
    if (campaign.attribution_conditions && campaign.attribution_conditions.length > 0) {
      for (const condition of campaign.attribution_conditions) {
        if (!evaluateCondition(condition, order, customer)) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Error evaluating campaign:", error);
    return false;
  }
}

function evaluateCondition(condition: any, order: any, customer: any): boolean {
  const { type, operator, value } = condition;

  try {
    switch (type) {
      case "order_value_gte":
        return parseFloat(order.total_price || 0) >= parseFloat(value);

      case "order_value_between": {
        const [min, max] = value.split(",").map((v: string) => parseFloat(v.trim()));
        const orderValue = parseFloat(order.total_price || 0);
        return orderValue >= min && orderValue <= max;
      }

      case "order_item_count": {
        const itemCount = order.line_items?.length || 0;
        if (operator === "gte") return itemCount >= parseInt(value);
        if (operator === "eq") return itemCount === parseInt(value);
        if (operator === "lte") return itemCount <= parseInt(value);
        return false;
      }

      case "payment_method": {
        const gateway = order.gateway?.toLowerCase() || "";
        if (value === "cod") {
          return gateway.includes("cod") || gateway.includes("cash");
        }
        if (value === "prepaid") {
          return !gateway.includes("cod") && !gateway.includes("cash");
        }
        return false;
      }

      case "shipping_pincode": {
        const pincode = order.shipping_address?.zip || "";
        if (operator === "exact") return pincode === value;
        if (operator === "starts_with") return pincode.startsWith(value);
        if (operator === "in_list") {
          const list = value.split(",").map((v: string) => v.trim());
          return list.includes(pincode);
        }
        return false;
      }

      case "shipping_city": {
        const city = order.shipping_address?.city?.toLowerCase() || "";
        const searchValue = value.toLowerCase();
        if (operator === "exact") return city === searchValue;
        if (operator === "in_list") {
          const list = value.split(",").map((v: string) => v.trim().toLowerCase());
          return list.includes(city);
        }
        return false;
      }

      case "shipping_state": {
        const state = order.shipping_address?.province?.toLowerCase() || "";
        const searchValue = value.toLowerCase();
        if (operator === "exact") return state === searchValue;
        if (operator === "in_list") {
          const list = value.split(",").map((v: string) => v.trim().toLowerCase());
          return list.includes(state);
        }
        return false;
      }

      default:
        return true;
    }
  } catch (error) {
    console.error(`Error evaluating condition ${type}:`, error);
    return false;
  }
}
