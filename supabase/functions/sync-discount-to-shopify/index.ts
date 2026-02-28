/**
 * sync-discount-to-shopify
 * POST body: { discount_code_id: string }
 *
 * Takes an existing loyalty_discount_code record that has shopify_synced = false
 * and creates the corresponding price_rule + discount_code in Shopify.
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { discount_code_id } = await req.json();

    if (!discount_code_id) {
      return new Response(
        JSON.stringify({ success: false, error: "discount_code_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the discount code record + related reward + shop
    const { data: dc } = await supabase
      .from("loyalty_discount_codes")
      .select("*, reward:rewards(title, reward_type, discount_value, min_purchase_amount)")
      .eq("id", discount_code_id)
      .maybeSingle();

    if (!dc) {
      return new Response(
        JSON.stringify({ success: false, error: "Discount code not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (dc.shopify_synced) {
      return new Response(
        JSON.stringify({ success: true, message: "Already synced to Shopify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const shopDomain = dc.shop_domain;
    if (!shopDomain) {
      return new Response(
        JSON.stringify({ success: false, error: "No shop_domain on this code. Cannot sync." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: installation } = await supabase
      .from("store_installations")
      .select("access_token")
      .eq("shop_domain", shopDomain)
      .eq("installation_status", "active")
      .maybeSingle();

    if (!installation?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "No active Shopify installation found for this store" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = installation.access_token;
    const reward = dc.reward;
    const rewardTitle = reward?.title ?? "Loyalty Discount";
    const rewardType = reward?.reward_type ?? (dc.discount_type === "percentage" ? "percentage_discount" : "flat_discount");
    const discountValue = reward?.discount_value ?? dc.discount_value;
    const minPurchase = reward?.min_purchase_amount ?? dc.minimum_order_value ?? 0;
    const isPercent = rewardType === "percentage_discount" || dc.discount_type === "percentage";
    const expiresAt = dc.expires_at ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Create Shopify price rule
    const priceRulePayload = {
      price_rule: {
        title: `Loyalty: ${rewardTitle}`,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: isPercent ? "percentage" : "fixed_amount",
        value: isPercent ? `-${discountValue}.0` : `-${discountValue}.00`,
        customer_selection: "all",
        starts_at: new Date().toISOString(),
        ends_at: expiresAt,
        usage_limit: 1,
        once_per_customer: true,
        ...(minPurchase > 0 && {
          prerequisite_subtotal_range: { greater_than_or_equal_to: minPurchase.toString() },
        }),
      },
    };

    const prRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/price_rules.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify(priceRulePayload),
      },
    );

    if (!prRes.ok) {
      const err = await prRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `Shopify price_rule creation failed: ${err}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { price_rule } = await prRes.json();

    const dcRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/price_rules/${price_rule.id}/discount_codes.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({ discount_code: { code: dc.code } }),
      },
    );

    if (!dcRes.ok) {
      const err = await dcRes.text();
      // Clean up price rule
      await fetch(
        `https://${shopDomain}/admin/api/2024-01/price_rules/${price_rule.id}.json`,
        { method: "DELETE", headers: { "X-Shopify-Access-Token": accessToken } },
      );
      return new Response(
        JSON.stringify({ success: false, error: `Shopify discount_code creation failed: ${err}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { discount_code: shopifyDc } = await dcRes.json();

    // Update the record
    await supabase
      .from("loyalty_discount_codes")
      .update({
        shopify_synced: true,
        shopify_price_rule_id: price_rule.id,
        shopify_discount_code_id: shopifyDc.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", discount_code_id);

    return new Response(
      JSON.stringify({ success: true, message: "Discount code synced to Shopify", price_rule_id: price_rule.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("sync-discount-to-shopify error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
