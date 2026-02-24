import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RuleCondition {
  id: string;
  type: string;
  operator: string;
  value: any;
}

interface EvaluationContext {
  order: any;
  customer: any;
  clientId: string;
}

function evaluateCondition(condition: RuleCondition, context: EvaluationContext): boolean {
  const { type, operator, value } = condition;
  const { order, customer } = context;

  try {
    switch (type) {
      case 'order_value_gte':
        return parseFloat(order.total_price || 0) >= parseFloat(value);

      case 'order_value_between': {
        const [min, max] = value.split(',').map((v: string) => parseFloat(v.trim()));
        const orderValue = parseFloat(order.total_price || 0);
        return orderValue >= min && orderValue <= max;
      }

      case 'order_item_count': {
        const itemCount = order.line_items?.length || 0;
        if (operator === 'gte') return itemCount >= parseInt(value);
        if (operator === 'eq') return itemCount === parseInt(value);
        if (operator === 'lte') return itemCount <= parseInt(value);
        return false;
      }

      case 'specific_product': {
        const productIds = order.line_items?.map((item: any) => item.product_id?.toString()) || [];
        const productHandles = order.line_items?.map((item: any) => item.sku?.toLowerCase()) || [];
        const searchValue = value.toLowerCase();

        if (operator === 'contains') {
          return productIds.includes(value) || productHandles.some((h: string) => h.includes(searchValue));
        }
        if (operator === 'not_contains') {
          return !productIds.includes(value) && !productHandles.some((h: string) => h.includes(searchValue));
        }
        return false;
      }

      case 'coupon_code': {
        const discountCodes = order.discount_codes?.map((dc: any) => dc.code) || [];
        if (discountCodes.length === 0) return false;

        if (operator === 'exact') {
          return discountCodes.some((code: string) => code === value);
        }
        if (operator === 'starts_with') {
          return discountCodes.some((code: string) => code.startsWith(value));
        }
        if (operator === 'contains') {
          return discountCodes.some((code: string) => code.includes(value));
        }
        return false;
      }

      case 'payment_method': {
        const gateway = order.gateway?.toLowerCase() || '';
        const paymentType = order.payment_gateway_names?.[0]?.toLowerCase() || '';

        if (value === 'cod') {
          return gateway.includes('cod') || paymentType.includes('cash');
        }
        if (value === 'prepaid') {
          return !gateway.includes('cod') && !paymentType.includes('cash');
        }
        return false;
      }

      case 'customer_type': {
        const orderCount = customer?.orders_count || 0;
        if (value === 'new') return orderCount <= 1;
        if (value === 'returning') return orderCount > 1;
        return false;
      }

      case 'order_number': {
        const orderNumber = customer?.orders_count || 0;
        return orderNumber === parseInt(value);
      }

      case 'lifetime_orders': {
        const orderCount = customer?.orders_count || 0;
        if (operator === 'gte') return orderCount >= parseInt(value);
        if (operator === 'lte') return orderCount <= parseInt(value);
        return false;
      }

      case 'lifetime_spend': {
        const totalSpent = parseFloat(customer?.total_spent || 0);
        if (operator === 'gte') return totalSpent >= parseFloat(value);
        if (operator === 'lte') return totalSpent <= parseFloat(value);
        return false;
      }

      case 'customer_tags': {
        const tags = customer?.tags?.split(',').map((t: string) => t.trim().toLowerCase()) || [];
        const searchTag = value.toLowerCase();
        if (operator === 'has') return tags.includes(searchTag);
        if (operator === 'not_has') return !tags.includes(searchTag);
        return false;
      }

      case 'shipping_pincode': {
        const pincode = order.shipping_address?.zip || '';
        if (operator === 'exact') return pincode === value;
        if (operator === 'starts_with') return pincode.startsWith(value);
        if (operator === 'in_list') {
          const list = value.split(',').map((v: string) => v.trim());
          return list.includes(pincode);
        }
        return false;
      }

      case 'shipping_city': {
        const city = order.shipping_address?.city?.toLowerCase() || '';
        const searchValue = value.toLowerCase();
        if (operator === 'exact') return city === searchValue;
        if (operator === 'in_list') {
          const list = value.split(',').map((v: string) => v.trim().toLowerCase());
          return list.includes(city);
        }
        return false;
      }

      case 'shipping_state': {
        const state = order.shipping_address?.province?.toLowerCase() || '';
        const searchValue = value.toLowerCase();
        if (operator === 'exact') return state === searchValue;
        if (operator === 'in_list') {
          const list = value.split(',').map((v: string) => v.trim().toLowerCase());
          return list.includes(state);
        }
        return false;
      }

      case 'shipping_country': {
        const country = order.shipping_address?.country_code?.toLowerCase() || '';
        const searchValue = value.toLowerCase();
        if (operator === 'exact') return country === searchValue;
        if (operator === 'in_list') {
          const list = value.split(',').map((v: string) => v.trim().toLowerCase());
          return list.includes(country);
        }
        return false;
      }

      case 'utm_source':
      case 'utm_medium':
      case 'utm_campaign': {
        const utmField = type.replace('utm_', '');
        const utmValue = order.note_attributes?.find((attr: any) =>
          attr.name.toLowerCase() === utmField
        )?.value || '';

        const searchValue = value.toLowerCase();
        if (operator === 'exact') return utmValue.toLowerCase() === searchValue;
        if (operator === 'contains') return utmValue.toLowerCase().includes(searchValue);
        return false;
      }

      default:
        console.warn(`Unknown condition type: ${type}`);
        return false;
    }
  } catch (error) {
    console.error(`Error evaluating condition ${type}:`, error);
    return false;
  }
}

function evaluateConditions(conditions: RuleCondition[], context: EvaluationContext): {
  allPassed: boolean;
  matched: string[];
  failed: string[];
} {
  const matched: string[] = [];
  const failed: string[] = [];

  for (const condition of conditions) {
    const result = evaluateCondition(condition, context);
    if (result) {
      matched.push(`${condition.type} ${condition.operator} ${condition.value}`);
    } else {
      failed.push(`${condition.type} ${condition.operator} ${condition.value}`);
    }
  }

  return {
    allPassed: failed.length === 0 && conditions.length > 0,
    matched,
    failed,
  };
}

function evaluateExclusionRules(rules: any, order: any): {
  excluded: boolean;
  reason?: string;
} {
  if (rules.exclude_refunded && order.financial_status === 'refunded') {
    return { excluded: true, reason: 'Order refunded' };
  }

  if (rules.exclude_cancelled && order.cancelled_at) {
    return { excluded: true, reason: 'Order cancelled' };
  }

  if (rules.exclude_test_orders && order.test === true) {
    return { excluded: true, reason: 'Test order' };
  }

  return { excluded: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { order, customer, clientId } = await req.json();

    if (!order || !clientId) {
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

    const { data: rules, error: rulesError } = await supabase
      .from("campaign_rules")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (rulesError) throw rulesError;

    const context: EvaluationContext = { order, customer, clientId };
    const results = [];

    for (const rule of rules || []) {
      const exclusion = evaluateExclusionRules(rule.exclusion_rules, order);

      if (exclusion.excluded) {
        await supabase.rpc("log_campaign_rule_evaluation", {
          p_campaign_rule_id: rule.id,
          p_client_id: clientId,
          p_order_id: order.id?.toString(),
          p_shopify_order_id: order.id?.toString(),
          p_customer_email: customer?.email || order.email,
          p_evaluation_result: "excluded",
          p_failed_conditions: { reason: exclusion.reason },
          p_reward_allocated: false,
        });

        continue;
      }

      const triggerEval = evaluateConditions(
        rule.trigger_conditions || [],
        context
      );

      const eligibilityEval = evaluateConditions(
        rule.eligibility_conditions || [],
        context
      );

      const locationEval = evaluateConditions(
        rule.location_conditions || [],
        context
      );

      const attributionEval = evaluateConditions(
        rule.attribution_conditions || [],
        context
      );

      const allConditionsPassed =
        (rule.trigger_conditions?.length === 0 || triggerEval.allPassed) &&
        (rule.eligibility_conditions?.length === 0 || eligibilityEval.allPassed) &&
        (rule.location_conditions?.length === 0 || locationEval.allPassed) &&
        (rule.attribution_conditions?.length === 0 || attributionEval.allPassed);

      const matched = [
        ...triggerEval.matched,
        ...eligibilityEval.matched,
        ...locationEval.matched,
        ...attributionEval.matched,
      ];

      const failed = [
        ...triggerEval.failed,
        ...eligibilityEval.failed,
        ...locationEval.failed,
        ...attributionEval.failed,
      ];

      if (allConditionsPassed) {
        await supabase.rpc("log_campaign_rule_evaluation", {
          p_campaign_rule_id: rule.id,
          p_client_id: clientId,
          p_order_id: order.id?.toString(),
          p_shopify_order_id: order.id?.toString(),
          p_customer_email: customer?.email || order.email,
          p_evaluation_result: "matched",
          p_matched_conditions: { conditions: matched },
          p_reward_allocated: true,
          p_metadata: { rule_version: rule.rule_version },
        });

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          programId: rule.program_id,
          matched: true,
          rewardAction: rule.reward_action,
        });
      } else {
        await supabase.rpc("log_campaign_rule_evaluation", {
          p_campaign_rule_id: rule.id,
          p_client_id: clientId,
          p_order_id: order.id?.toString(),
          p_shopify_order_id: order.id?.toString(),
          p_customer_email: customer?.email || order.email,
          p_evaluation_result: "not_matched",
          p_matched_conditions: { conditions: matched },
          p_failed_conditions: { conditions: failed },
          p_reward_allocated: false,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matchedRules: results.filter(r => r.matched),
        evaluatedCount: rules?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error evaluating rules:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
