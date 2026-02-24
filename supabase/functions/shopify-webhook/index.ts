import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Shopify-Topic, X-Shopify-Hmac-Sha256, X-Shopify-Shop-Domain",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const shopifyTopic = req.headers.get("X-Shopify-Topic");
    const shopDomain = req.headers.get("X-Shopify-Shop-Domain");
    const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");

    console.log(`Webhook received: ${shopifyTopic} from ${shopDomain}`);

    if (!shopifyTopic || !shopDomain) {
      console.error("Missing required headers");
      return new Response(
        JSON.stringify({ error: "Missing required Shopify headers" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const rawBody = await req.text();
    const orderData = JSON.parse(rawBody);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integration } = await supabase
      .from("integration_configs")
      .select("id, client_id, shopify_api_secret")
      .eq("platform", "shopify")
      .eq("shop_domain", shopDomain)
      .eq("status", "connected")
      .maybeSingle();

    if (!integration) {
      console.error(`No connected integration found for ${shopDomain}`);
      return new Response(
        JSON.stringify({ error: "Integration not found or disconnected" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (integration.shopify_api_secret && hmacHeader) {
      const isValid = await verifyShopifyHmac(rawBody, hmacHeader, integration.shopify_api_secret);
      if (!isValid) {
        console.error("Invalid HMAC signature");
        return new Response(
          JSON.stringify({ error: "Invalid HMAC signature" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      console.log("HMAC signature verified successfully");
    } else {
      console.warn("HMAC verification skipped - no secret configured or no HMAC header");
    }

    await supabase.from("shopify_webhook_events").insert({
      integration_id: integration.id,
      shop_domain: shopDomain,
      topic: shopifyTopic,
      payload: orderData,
      processed: false,
    });

    await supabase
      .from("integration_configs")
      .update({ last_event_at: new Date().toISOString() })
      .eq("id", integration.id);

    if (shopifyTopic === "orders/create" || shopifyTopic === "orders/updated" || shopifyTopic === "orders/paid") {

      const customerEmail = orderData.customer?.email || orderData.email || null;
      const customerPhone = orderData.customer?.phone || orderData.phone || null;
      const customerFirstName = orderData.customer?.first_name || orderData.billing_address?.first_name || '';
      const customerLastName = orderData.customer?.last_name || orderData.billing_address?.last_name || '';

      if (customerEmail || customerPhone) {
        let existingMember = null;

        if (customerPhone) {
          const { data } = await supabase
            .from("member_users")
            .select("id")
            .eq("phone", customerPhone)
            .eq("client_id", integration.client_id)
            .maybeSingle();
          existingMember = data;
        }

        if (!existingMember && customerEmail) {
          const { data } = await supabase
            .from("member_users")
            .select("id")
            .eq("email", customerEmail)
            .eq("client_id", integration.client_id)
            .maybeSingle();
          existingMember = data;
        }

        if (!existingMember) {
          const fullName = `${customerFirstName} ${customerLastName}`.trim() || 'Unknown';

          const memberData: any = {
            client_id: integration.client_id,
            full_name: fullName,
            external_id: orderData.customer?.id?.toString(),
            metadata: {
              source: "shopify",
              first_name: customerFirstName,
              last_name: customerLastName,
              shopify_customer_id: orderData.customer?.id
            }
          };

          if (customerEmail) {
            memberData.email = customerEmail;
          }

          if (customerPhone) {
            memberData.phone = customerPhone;
          }

          const { error: memberError } = await supabase
            .from("member_users")
            .insert(memberData);

          if (memberError) {
            console.error("Error creating member:", memberError);
          } else {
            console.log(`New member created from Shopify order: ${customerEmail || customerPhone}`);
          }
        }
      }

      let paymentMethod = "unknown";
      if (orderData.gateway) {
        paymentMethod = orderData.gateway.toLowerCase();
      } else if (orderData.payment_gateway_names && orderData.payment_gateway_names.length > 0) {
        paymentMethod = orderData.payment_gateway_names[0].toLowerCase();
      }

      if (paymentMethod.includes("cod") || paymentMethod.includes("cash on delivery")) {
        paymentMethod = "cod";
      } else if (paymentMethod.includes("prepaid") || orderData.financial_status === "paid") {
        paymentMethod = "prepaid";
      }

      const orderRecord = {
        client_id: integration.client_id,
        order_id: orderData.id.toString(),
        order_number: orderData.order_number || orderData.name,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        total_price: parseFloat(orderData.total_price || "0"),
        currency: orderData.currency || "USD",
        payment_method: paymentMethod,
        order_status: orderData.fulfillment_status || "pending",
        financial_status: orderData.financial_status,
        fulfillment_status: orderData.fulfillment_status,
        order_data: orderData,
        processed_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from("shopify_orders")
        .upsert(orderRecord, {
          onConflict: "client_id,order_id",
          ignoreDuplicates: false,
        });

      if (insertError) {
        console.error("Error inserting order:", insertError);

        await supabase
          .from("shopify_webhook_events")
          .update({ error: insertError.message })
          .eq("shop_domain", shopDomain)
          .eq("topic", shopifyTopic)
          .order("created_at", { ascending: false })
          .limit(1);

        return new Response(
          JSON.stringify({ error: "Failed to save order", details: insertError }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      await supabase
        .from("shopify_webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("shop_domain", shopDomain)
        .eq("topic", shopifyTopic)
        .order("created_at", { ascending: false })
        .limit(1);

      console.log(`Order ${orderRecord.order_number} processed successfully via OAuth webhook`);
      console.log(`[v2] Executing campaign rules for client ${integration.client_id}`);

      await checkAndExecuteCampaignRules(supabase, integration.client_id, orderRecord);
      await checkAdvancedCampaignRules(supabase, integration.client_id, orderData, orderRecord);
      await processPendingCommunications(supabase);

      if (orderRecord.financial_status === "paid") {
        await awardLoyaltyPoints(supabase, integration.client_id, orderRecord);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Order processed successfully",
          order_id: orderRecord.order_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("shopify_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("shop_domain", shopDomain)
      .eq("topic", shopifyTopic)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ message: "Webhook received and logged", topic: shopifyTopic }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function awardLoyaltyPoints(supabase: any, clientId: string, orderRecord: any) {
  try {
    const customerEmail = orderRecord.customer_email;
    const customerPhone = orderRecord.customer_phone;
    const orderId = orderRecord.order_id;
    const orderAmount = parseFloat(orderRecord.total_price || "0");

    if (!customerEmail && !customerPhone) {
      console.log("No customer email or phone, skipping loyalty points");
      return;
    }

    const { data: program } = await supabase
      .from("loyalty_programs")
      .select("id")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .maybeSingle();

    if (!program) {
      console.log(`No active loyalty program for client ${clientId}`);
      return;
    }

    let member = null;
    if (customerPhone) {
      const { data } = await supabase
        .from("member_users")
        .select("id")
        .eq("phone", customerPhone)
        .eq("client_id", clientId)
        .maybeSingle();
      member = data;
    }
    if (!member && customerEmail) {
      const { data } = await supabase
        .from("member_users")
        .select("id")
        .eq("email", customerEmail)
        .eq("client_id", clientId)
        .maybeSingle();
      member = data;
    }

    if (!member) {
      console.log(`No member found for order ${orderId}, skipping loyalty points`);
      return;
    }

    const { data: memberStatus } = await supabase
      .from("member_loyalty_status")
      .select("*, current_tier:loyalty_tiers(*)")
      .eq("member_user_id", member.id)
      .eq("loyalty_program_id", program.id)
      .maybeSingle();

    if (!memberStatus) {
      console.log(`No loyalty status for member ${member.id}, skipping loyalty points`);
      return;
    }

    const { data: isDuplicate } = await supabase.rpc("check_duplicate_order_points", {
      p_order_id: orderId,
      p_member_user_id: member.id,
      p_loyalty_program_id: program.id,
    });

    if (isDuplicate) {
      console.log(`Points already awarded for order ${orderId}, skipping`);
      return;
    }

    const tierData = memberStatus.current_tier;
    const earnRate = tierData?.points_earn_rate || 1;
    const earnDivisor = tierData?.points_earn_divisor || 1;
    const points = Math.floor((orderAmount * earnRate) / earnDivisor);

    if (points <= 0) {
      console.log(`Calculated 0 points for order ${orderId}, skipping`);
      return;
    }

    const newBalance = (memberStatus.points_balance || 0) + points;

    const { error: updateError } = await supabase
      .from("member_loyalty_status")
      .update({
        points_balance: newBalance,
        lifetime_points_earned: (memberStatus.lifetime_points_earned || 0) + points,
        total_orders: (memberStatus.total_orders || 0) + 1,
        total_spend: parseFloat(memberStatus.total_spend || "0") + orderAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberStatus.id);

    if (updateError) {
      console.error("Error updating loyalty status:", updateError);
      return;
    }

    await supabase.from("loyalty_points_transactions").insert({
      member_loyalty_status_id: memberStatus.id,
      member_user_id: member.id,
      transaction_type: "earned",
      points_amount: points,
      balance_after: newBalance,
      order_id: null,
      order_amount: orderAmount,
      description: `Earned ${points} points from order ${orderId}`,
      reference_id: orderId,
    });

    console.log(`Awarded ${points} points to member ${member.id} for order ${orderId}. New balance: ${newBalance}`);
  } catch (error) {
    console.error("Error awarding loyalty points:", error);
  }
}

async function logCampaignTrigger(
  supabase: any,
  clientId: string,
  campaignRuleId: string,
  orderRecord: any,
  result: string,
  reason: string,
  memberId: string | null = null,
  membershipId: string | null = null,
  metadata: any = {}
) {
  try {
    await supabase.from("campaign_trigger_logs").insert({
      client_id: clientId,
      campaign_rule_id: campaignRuleId,
      order_id: orderRecord.order_id,
      order_number: orderRecord.order_number,
      order_value: parseFloat(orderRecord.total_price),
      trigger_result: result,
      member_id: memberId,
      membership_id: membershipId,
      customer_email: orderRecord.customer_email,
      customer_phone: orderRecord.customer_phone,
      reason: reason,
      metadata: metadata,
    });
  } catch (error) {
    console.error("Error logging campaign trigger:", error);
  }
}

async function checkAdvancedCampaignRules(supabase: any, clientId: string, orderData: any, orderRecord: any) {
  try {
    console.log(`Checking advanced campaign rules for client ${clientId}`);

    const { data: advancedRules, error: rulesError } = await supabase
      .from("campaign_rules")
      .select("*, membership_programs(*)")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .eq("trigger_type", "advanced")
      .eq("rule_version", 2);

    if (rulesError) {
      console.error("Error fetching advanced campaign rules:", rulesError);
      return;
    }

    if (!advancedRules || advancedRules.length === 0) {
      console.log("No active advanced campaign rules found");
      return;
    }

    console.log(`Found ${advancedRules.length} advanced campaign rules`);

    let customer = null;
    if (orderData.customer?.id) {
      const { data: integration } = await supabase
        .from("integration_configs")
        .select("shopify_access_token, shop_domain")
        .eq("client_id", clientId)
        .eq("platform", "shopify")
        .eq("status", "connected")
        .maybeSingle();

      if (integration?.shopify_access_token) {
        try {
          const customerResponse = await fetch(
            `https://${integration.shop_domain}/admin/api/2024-01/customers/${orderData.customer.id}.json`,
            {
              headers: {
                "X-Shopify-Access-Token": integration.shopify_access_token,
              },
            }
          );

          if (customerResponse.ok) {
            const customerJson = await customerResponse.json();
            customer = customerJson.customer;
            console.log(`Fetched customer data for ${customer.email}`);
          }
        } catch (error) {
          console.error("Error fetching customer from Shopify:", error);
        }
      }
    }

    for (const rule of advancedRules) {
      try {
        console.log(`Evaluating advanced rule: ${rule.name}`);

        let memberId = null;
        if (orderRecord.customer_phone) {
          const { data: member } = await supabase
            .from("member_users")
            .select("id")
            .eq("client_id", clientId)
            .eq("phone", orderRecord.customer_phone)
            .maybeSingle();
          if (member) memberId = member.id;
        }

        if (!memberId && orderRecord.customer_email) {
          const { data: member } = await supabase
            .from("member_users")
            .select("id")
            .eq("client_id", clientId)
            .eq("email", orderRecord.customer_email)
            .maybeSingle();
          if (member) memberId = member.id;
        }

        if (!memberId) {
          await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "no_member", "No member found for this order", null, null, {
            campaign_name: rule.name,
            rule_type: "advanced",
          });
          continue;
        }

        const { data: existingMembership } = await supabase
          .from("member_memberships")
          .select("id")
          .eq("member_id", memberId)
          .eq("program_id", rule.program_id)
          .maybeSingle();

        if (existingMembership) {
          await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "already_enrolled", "Member already enrolled in program", memberId, existingMembership.id, {
            campaign_name: rule.name,
            rule_type: "advanced",
          });
          continue;
        }

        const evaluationContext = {
          order: orderData,
          customer: customer || {
            email: orderRecord.customer_email,
            phone: orderRecord.customer_phone,
          },
          clientId: clientId,
        };

        const triggerMatches = evaluateConditionsLocally(rule.trigger_conditions || [], evaluationContext);
        const eligibilityMatches = evaluateConditionsLocally(rule.eligibility_conditions || [], evaluationContext);
        const locationMatches = evaluateConditionsLocally(rule.location_conditions || [], evaluationContext);
        const attributionMatches = evaluateConditionsLocally(rule.attribution_conditions || [], evaluationContext);

        const allPassed =
          triggerMatches.allPassed &&
          (rule.eligibility_conditions?.length === 0 || eligibilityMatches.allPassed) &&
          (rule.location_conditions?.length === 0 || locationMatches.allPassed) &&
          (rule.attribution_conditions?.length === 0 || attributionMatches.allPassed);

        if (allPassed) {
          console.log(`Advanced rule \"${rule.name}\" matched for order ${orderRecord.order_number}`);

          const validityDays = rule.membership_programs?.validity_days || 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + validityDays);

          const { data: newMembership, error: enrollError } = await supabase
            .from("member_memberships")
            .insert({
              member_id: memberId,
              program_id: rule.program_id,
              campaign_rule_id: rule.id,
              enrollment_source: "campaign_auto",
              status: "active",
              activated_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              enrollment_metadata: {
                order_id: orderRecord.order_id,
                order_value: orderRecord.total_price,
                triggered_by: "advanced_campaign",
                campaign_name: rule.name,
                rule_version: 2,
              },
            })
            .select()
            .single();

          if (enrollError) {
            await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "failed", `Enrollment failed: ${enrollError.message}`, memberId, null, {
              campaign_name: rule.name,
              rule_type: "advanced",
              error: enrollError.message,
            });
          } else {
            await supabase
              .from("campaign_rules")
              .update({ current_enrollments: (rule.current_enrollments || 0) + 1 })
              .eq("id", rule.id);

            await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "success", "Member successfully enrolled via advanced rule", memberId, newMembership.id, {
              campaign_name: rule.name,
              rule_type: "advanced",
              program_id: rule.program_id,
            });

            console.log(`Successfully enrolled member ${memberId} via advanced rule \"${rule.name}\"`);
          }
        } else {
          const failedConditions = [
            ...triggerMatches.failed,
            ...eligibilityMatches.failed,
            ...locationMatches.failed,
            ...attributionMatches.failed,
          ];
          await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "not_matched", `Conditions not met: ${failedConditions.join(", ")}`, memberId, null, {
            campaign_name: rule.name,
            rule_type: "advanced",
            failed_conditions: failedConditions,
          });
        }
      } catch (error) {
        console.error(`Error evaluating advanced rule ${rule.name}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in advanced campaign rule execution:", error);
  }
}

function evaluateConditionsLocally(conditions: any[], context: any): { allPassed: boolean; failed: string[] } {
  const failed: string[] = [];

  for (const condition of conditions) {
    const result = evaluateConditionLocally(condition, context);
    if (!result) {
      failed.push(`${condition.type} ${condition.operator} ${condition.value}`);
    }
  }

  return {
    allPassed: failed.length === 0 && conditions.length > 0,
    failed,
  };
}

function evaluateConditionLocally(condition: any, context: any): boolean {
  const { type, operator, value } = condition;
  const { order, customer } = context;

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
        const paymentType = order.payment_gateway_names?.[0]?.toLowerCase() || "";
        if (value === "cod") {
          return gateway.includes("cod") || paymentType.includes("cash");
        }
        if (value === "prepaid") {
          return !gateway.includes("cod") && !paymentType.includes("cash");
        }
        return false;
      }

      case "customer_type": {
        const orderCount = customer?.orders_count || 0;
        if (value === "new") return orderCount <= 1;
        if (value === "returning") return orderCount > 1;
        return false;
      }

      case "lifetime_orders": {
        const orderCount = customer?.orders_count || 0;
        if (operator === "gte") return orderCount >= parseInt(value);
        if (operator === "lte") return orderCount <= parseInt(value);
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

      default:
        return true;
    }
  } catch (error) {
    console.error(`Error evaluating condition ${type}:`, error);
    return false;
  }
}

async function checkAndExecuteCampaignRules(supabase: any, clientId: string, orderRecord: any) {
  try {
    console.log(`Checking campaign rules for client ${clientId}, order value: ${orderRecord.total_price}`);

    const { data: campaignRules, error: rulesError } = await supabase
      .from("campaign_rules")
      .select("*, membership_programs(*)")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .eq("trigger_type", "order_value");

    if (rulesError) {
      console.error("Error fetching campaign rules:", rulesError);
      return;
    }

    if (!campaignRules || campaignRules.length === 0) {
      console.log("No active order_value campaign rules found");
      return;
    }

    const sortedRules = campaignRules.sort((a, b) => {
      const aMin = a.trigger_conditions?.min_order_value || 0;
      const bMin = b.trigger_conditions?.min_order_value || 0;
      return bMin - aMin;
    });

    console.log(`Found ${sortedRules.length} campaign rules, sorted by min_order_value descending`);

    for (const rule of sortedRules) {
      const minOrderValue = rule.trigger_conditions?.min_order_value || 0;

      console.log(`Checking rule \"${rule.name}\": min_order_value=${minOrderValue}, order_value=${orderRecord.total_price}`);

      if (parseFloat(orderRecord.total_price) >= minOrderValue) {
        console.log(`Order meets rule conditions for \"${rule.name}\"`);

        let memberId = null;
        if (orderRecord.customer_phone) {
          console.log(`Looking for member by phone: ${orderRecord.customer_phone}`);
          const { data: member, error: memberError } = await supabase
            .from("member_users")
            .select("id")
            .eq("client_id", clientId)
            .eq("phone", orderRecord.customer_phone)
            .maybeSingle();
          if (memberError) {
            console.error("Error fetching member by phone:", memberError);
          }
          if (member) {
            memberId = member.id;
            console.log(`Found member by phone: ${memberId}`);
          }
        }

        if (!memberId && orderRecord.customer_email) {
          console.log(`Looking for member by email: ${orderRecord.customer_email}`);
          const { data: member, error: memberError } = await supabase
            .from("member_users")
            .select("id")
            .eq("client_id", clientId)
            .eq("email", orderRecord.customer_email)
            .maybeSingle();
          if (memberError) {
            console.error("Error fetching member by email:", memberError);
          }
          if (member) {
            memberId = member.id;
            console.log(`Found member by email: ${memberId}`);
          }
        }

        if (!memberId) {
          const reason = `No member found with phone: ${orderRecord.customer_phone || 'none'}, email: ${orderRecord.customer_email || 'none'}`;
          console.log(reason);
          await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "no_member", reason, null, null, {
            campaign_name: rule.name,
            min_order_value: minOrderValue,
          });
          continue;
        }

        console.log(`Checking if member ${memberId} is already enrolled in program ${rule.program_id}`);
        const { data: existingMembership, error: membershipCheckError } = await supabase
          .from("member_memberships")
          .select("id, campaign_rule_id, status")
          .eq("member_id", memberId)
          .eq("program_id", rule.program_id)
          .maybeSingle();

        if (membershipCheckError) {
          console.error("Error checking existing membership:", membershipCheckError);
        }

        if (existingMembership) {
          const reason = `Member already enrolled in program (membership_id: ${existingMembership.id}, via campaign: ${existingMembership.campaign_rule_id})`;
          console.log(reason);
          await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "already_enrolled", reason, memberId, existingMembership.id, {
            campaign_name: rule.name,
            existing_campaign_id: existingMembership.campaign_rule_id,
            min_order_value: minOrderValue,
          });
          continue;
        }

        console.log(`Member ${memberId} not yet enrolled in program ${rule.program_id}. Proceeding with enrollment for campaign \"${rule.name}\"`);

        if (rule.max_enrollments && rule.current_enrollments >= rule.max_enrollments) {
          const reason = `Campaign has reached max enrollments (${rule.current_enrollments}/${rule.max_enrollments})`;
          console.log(reason);
          await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "max_reached", reason, memberId, null, {
            campaign_name: rule.name,
            current_enrollments: rule.current_enrollments,
            max_enrollments: rule.max_enrollments,
            min_order_value: minOrderValue,
          });
          continue;
        }

        const validityDays = rule.membership_programs?.validity_days || 365;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + validityDays);

        console.log(`Attempting to enroll member ${memberId} in program ${rule.program_id} via campaign \"${rule.name}\"`);
        const { data: newMembership, error: enrollError } = await supabase
          .from("member_memberships")
          .insert({
            member_id: memberId,
            program_id: rule.program_id,
            campaign_rule_id: rule.id,
            enrollment_source: "campaign_auto",
            status: "active",
            activated_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            enrollment_metadata: {
              order_id: orderRecord.order_id,
              order_value: orderRecord.total_price,
              triggered_by: "order_value_campaign",
              campaign_name: rule.name,
              min_order_value: minOrderValue
            }
          })
          .select()
          .single();

        if (enrollError) {
          const reason = `Enrollment failed: ${enrollError.message}`;
          console.error(reason);
          await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "failed", reason, memberId, null, {
            campaign_name: rule.name,
            error: enrollError.message,
            min_order_value: minOrderValue,
          });
        } else {
          console.log(`Successfully auto-enrolled member ${memberId} in program ${rule.program_id} via campaign \"${rule.name}\"`);

          await supabase
            .from("campaign_rules")
            .update({ current_enrollments: (rule.current_enrollments || 0) + 1 })
            .eq("id", rule.id);

          console.log(`Updated campaign \"${rule.name}\" enrollment count to ${(rule.current_enrollments || 0) + 1}`);

          await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "success", `Member successfully enrolled in program`, memberId, newMembership.id, {
            campaign_name: rule.name,
            program_id: rule.program_id,
            min_order_value: minOrderValue,
            new_enrollment_count: (rule.current_enrollments || 0) + 1,
          });

          break;
        }
      } else {
        const reason = `Order value ${orderRecord.total_price} below minimum ${minOrderValue}`;
        console.log(reason);
        await logCampaignTrigger(supabase, clientId, rule.id, orderRecord, "below_threshold", reason, null, null, {
          campaign_name: rule.name,
          min_order_value: minOrderValue,
          order_value: orderRecord.total_price,
        });
      }
    }
  } catch (error) {
    console.error("Error in campaign rule execution:", error);
  }
}

async function processPendingCommunications(supabase: any) {
  try {
    const { data: pendingComms, error } = await supabase
      .from("communication_logs")
      .select("id")
      .eq("status", "pending")
      .limit(10);

    if (error || !pendingComms || pendingComms.length === 0) {
      return;
    }

    console.log(`Processing ${pendingComms.length} pending communications`);

    for (const comm of pendingComms) {
      try {
        await supabase
          .from("communication_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", comm.id);

        console.log(`Marked communication ${comm.id} as sent`);
      } catch (err) {
        console.error(`Failed to update communication ${comm.id}:`, err);
      }
    }
  } catch (error) {
    console.error("Error processing pending communications:", error);
  }
}

async function verifyShopifyHmac(body: string, hmacHeader: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const computedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));

    return computedHmac === hmacHeader;
  } catch (error) {
    console.error("HMAC verification error:", error);
    return false;
  }
}