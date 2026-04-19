/**
 * shopify-fetch-discounts
 * GET/POST ?shop_domain=...  OR  { shop_domain }
 *
 * Fetches existing price rules + their discount codes from Shopify
 * so the dashboard can offer an "Import from Shopify" picker.
 *
 * Returns:
 * { price_rules: Array<{ id, title, value_type, value, starts_at, ends_at, codes: string[], total_codes: number }> }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

    // Accept shop_domain from query string or body
    let shopDomain: string | null = null;

    const url = new URL(req.url);
    shopDomain = url.searchParams.get("shop_domain");

    if (!shopDomain && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      shopDomain = body.shop_domain ?? null;
    }

    if (!shopDomain) {
      return new Response(
        JSON.stringify({ success: false, error: "shop_domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch Shopify access token from store_installations
    const { data: install, error: installErr } = await supabase
      .from("store_installations")
      .select("access_token")
      .eq("shop_domain", shopDomain)
      .eq("installation_status", "active")
      .maybeSingle();

    if (installErr || !install?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "No active Shopify installation found for this store" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = install.access_token;
    const shopifyBase = `https://${shopDomain}/admin/api/2024-01`;

    // Fetch price rules (up to 50, sorted newest first)
    const priceRulesRes = await fetch(
      `${shopifyBase}/price_rules.json?limit=50&order=created_at+DESC`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      },
    );

    if (!priceRulesRes.ok) {
      const errText = await priceRulesRes.text();
      console.error("Shopify price_rules fetch failed:", errText);
      return new Response(
        JSON.stringify({ success: false, error: `Shopify API error: ${priceRulesRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { price_rules: rawRules } = await priceRulesRes.json();

    if (!Array.isArray(rawRules) || rawRules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, price_rules: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For each price rule, fetch a sample of its discount codes (first 50)
    // Limit to 20 rules to avoid too many API calls
    const rulesToFetch = rawRules.slice(0, 20);

    const enriched = await Promise.all(
      rulesToFetch.map(async (rule: any) => {
        let codes: string[] = [];
        let totalCodes = 0;

        try {
          const codesRes = await fetch(
            `${shopifyBase}/price_rules/${rule.id}/discount_codes.json?limit=50`,
            {
              headers: { "X-Shopify-Access-Token": accessToken },
            },
          );
          if (codesRes.ok) {
            const { discount_codes } = await codesRes.json();
            if (Array.isArray(discount_codes)) {
              codes = discount_codes.map((dc: any) => dc.code);
              totalCodes = discount_codes.length;
            }
          }
        } catch (_) {
          // ignore per-rule errors
        }

        // Map Shopify value_type to our reward_type
        const rewardType =
          rule.value_type === "percentage" ? "percentage_discount" : "flat_discount";

        // Shopify percentage is stored as negative (e.g. -10.0 = 10% off)
        const discountValue = Math.abs(parseFloat(rule.value ?? "0"));

        return {
          id: rule.id,
          title: rule.title,
          value_type: rule.value_type,        // "percentage" | "fixed_amount"
          reward_type: rewardType,
          discount_value: discountValue,
          min_purchase_amount: rule.prerequisite_subtotal_range?.greater_than_or_equal_to
            ? parseFloat(rule.prerequisite_subtotal_range.greater_than_or_equal_to)
            : 0,
          starts_at: rule.starts_at,
          ends_at: rule.ends_at,
          codes,
          total_codes: totalCodes,
        };
      }),
    );

    return new Response(
      JSON.stringify({ success: true, price_rules: enriched }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("shopify-fetch-discounts error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
