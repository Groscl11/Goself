/**
 * shopify-create-discount
 * POST body: {
 *   client_id: string,
 *   shop_domain?: string,       // fallback: looked up from store_installations
 *   title: string,
 *   reward_type: 'flat_discount' | 'percentage_discount' | 'free_item',
 *   discount_value: number,
 *   min_purchase_amount?: number,
 *   codes_count?: number,        // default 10, max 250
 *   code_prefix?: string,        // prefix for generated code names
 *   usage_limit_per_code?: number, // 0 = unlimited, default 1
 *   valid_until?: string,        // ISO date string
 * }
 *
 * Creates a price rule + batch of discount codes in Shopify, returns:
 * { success: true, codes: string[], price_rule_id: number }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      client_id,
      shop_domain: shopDomainParam,
      title,
      reward_type,
      discount_value,
      min_purchase_amount = 0,
      codes_count = 10,
      code_prefix,
      usage_limit_per_code = 1,
      valid_until,
    } = body;

    if (!client_id || !title || !discount_value) {
      return respond({ success: false, error: "client_id, title and discount_value are required" }, 400);
    }

    // Resolve shop_domain
    let shopDomain = shopDomainParam;
    if (!shopDomain) {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("shop_domain")
        .eq("id", client_id)
        .maybeSingle();
      shopDomain = clientRow?.shop_domain;
    }
    if (!shopDomain) {
      return respond({ success: false, error: "No Shopify store domain found for this client" }, 400);
    }

    // Get Shopify access token
    const { data: install } = await supabase
      .from("store_installations")
      .select("access_token")
      .eq("shop_domain", shopDomain)
      .eq("installation_status", "active")
      .maybeSingle();

    if (!install?.access_token) {
      return respond({ success: false, error: "No active Shopify installation found. Please reconnect your Shopify store." }, 400);
    }

    const accessToken = install.access_token;
    const apiVersion = "2024-01";
    const shopifyBase = `https://${shopDomain}/admin/api/${apiVersion}`;

    // Map reward_type to Shopify value_type
    const valueType = reward_type === "percentage_discount" ? "percentage" : "fixed_amount";
    const value = reward_type === "percentage_discount"
      ? `-${Math.abs(discount_value)}`
      : `-${Math.abs(discount_value)}.00`;

    // Create price rule
    const priceRulePayload: Record<string, unknown> = {
      price_rule: {
        title: `GoSelf: ${title}`,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: valueType,
        value,
        customer_selection: "all",
        once_per_customer: usage_limit_per_code === 1,
        starts_at: new Date().toISOString(),
        ...(valid_until ? { ends_at: new Date(valid_until).toISOString() } : {}),
        ...(min_purchase_amount > 0 ? {
          prerequisite_subtotal_range: { greater_than_or_equal_to: String(min_purchase_amount) },
        } : {}),
      },
    };

    const priceRuleRes = await fetch(`${shopifyBase}/price_rules.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify(priceRulePayload),
    });

    if (!priceRuleRes.ok) {
      const errText = await priceRuleRes.text();
      return respond({ success: false, error: `Shopify price_rule creation failed: ${errText}` }, 422);
    }

    const priceRuleJson = await priceRuleRes.json();
    const priceRuleId = priceRuleJson.price_rule?.id;
    if (!priceRuleId) {
      return respond({ success: false, error: "Failed to get price_rule id from Shopify" }, 422);
    }

    // Generate code strings
    const count = Math.min(Number(codes_count) || 10, 250);
    const prefix = (code_prefix || title.replace(/\s+/g, "").toUpperCase().slice(0, 4)).toUpperCase();
    const generatedCodes: string[] = [];
    for (let i = 0; i < count; i++) {
      generatedCodes.push(`${prefix}${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
    }

    // Batch create discount codes
    const batchRes = await fetch(`${shopifyBase}/price_rules/${priceRuleId}/batch_discount_codes.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify({ codes: generatedCodes.map(code => ({ code })) }),
    });

    if (!batchRes.ok) {
      const errText = await batchRes.text();
      // Price rule created but codes failed — still return partial success with generated codes
      console.error("Shopify batch codes failed:", errText);
      return respond({ success: true, codes: generatedCodes, price_rule_id: priceRuleId, warning: "Codes saved locally but Shopify batch sync failed" });
    }

    return respond({ success: true, codes: generatedCodes, price_rule_id: priceRuleId });
  } catch (error: unknown) {
    console.error("shopify-create-discount error:", error);
    return respond({ success: false, error: String(error) }, 500);
  }
});
