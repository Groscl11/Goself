import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RedeemRequest {
  reward_id: string;
  member_user_id: string;
  shop_domain: string;
  customer_email?: string;
}

function generateCode(): string {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick3 = () =>
    Array.from({ length: 3 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join("");
  const num4 = () => Math.floor(1000 + Math.random() * 9000).toString();
  return `${pick3()}${num4()}${pick3()}`;
}

async function createShopifyDiscount(
  shopDomain: string,
  accessToken: string,
  rewardTitle: string,
  rewardType: string,
  discountValue: number,
  minPurchaseAmount: number,
  code: string,
  expiresAt: string,
): Promise<{ price_rule_id: number; discount_code_id: number } | null> {
  try {
    const isPercentage = rewardType === "percentage_discount";

    const priceRuleBody = {
      price_rule: {
        title: `Loyalty: ${rewardTitle}`,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: isPercentage ? "percentage" : "fixed_amount",
        value: isPercentage
          ? `-${discountValue}.0`
          : `-${discountValue}.00`,
        customer_selection: "all",
        starts_at: new Date().toISOString(),
        ends_at: expiresAt,
        usage_limit: 1,
        once_per_customer: true,
        ...(minPurchaseAmount > 0 && {
          prerequisite_subtotal_range: {
            greater_than_or_equal_to: minPurchaseAmount.toString(),
          },
        }),
      },
    };

    const priceRuleRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/price_rules.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify(priceRuleBody),
      },
    );

    if (!priceRuleRes.ok) {
      const err = await priceRuleRes.text();
      console.error("Price rule creation failed:", err);
      return null;
    }

    const { price_rule } = await priceRuleRes.json();

    const discountRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/price_rules/${price_rule.id}/discount_codes.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ discount_code: { code } }),
      },
    );

    if (!discountRes.ok) {
      const err = await discountRes.text();
      console.error("Discount code creation failed:", err);
      // Clean up price rule
      await fetch(
        `https://${shopDomain}/admin/api/2024-01/price_rules/${price_rule.id}.json`,
        {
          method: "DELETE",
          headers: { "X-Shopify-Access-Token": accessToken },
        },
      );
      return null;
    }

    const { discount_code } = await discountRes.json();

    return {
      price_rule_id: price_rule.id,
      discount_code_id: discount_code.id,
    };
  } catch (err) {
    console.error("Shopify API error:", err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: RedeemRequest = await req.json();
    const { reward_id, member_user_id, shop_domain, customer_email } = body;

    if (!reward_id || !member_user_id || !shop_domain) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. Fetch reward ────────────────────────────────────────────────────
    const { data: reward } = await supabase
      .from("rewards")
      .select("id, title, discount_value, reward_type, points_cost, min_purchase_amount, is_active, client_id")
      .eq("id", reward_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!reward) {
      return new Response(
        JSON.stringify({ success: false, error: "Reward not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pointsCost = reward.points_cost ?? 500;

    // ── 2. Fetch member loyalty status (member_user_id = member_users.id) ──
    const { data: loyaltyStatus } = await supabase
      .from("member_loyalty_status")
      .select("id, points_balance, lifetime_points_redeemed")
      .eq("member_user_id", member_user_id)
      .maybeSingle();

    if (!loyaltyStatus) {
      return new Response(
        JSON.stringify({ success: false, error: "Member not enrolled in loyalty program" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (loyaltyStatus.points_balance < pointsCost) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Insufficient points. Need ${pointsCost}, have ${loyaltyStatus.points_balance}.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Check for existing unused code for this reward+member ───────────
    const { data: existing } = await supabase
      .from("loyalty_discount_codes")
      .select("id, code, expires_at")
      .eq("reward_id", reward_id)
      .eq("member_id", member_user_id)
      .eq("is_used", false)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          discount_code: existing.code,
          discount_value: reward.discount_value,
          discount_type: reward.reward_type,
          expires_at: existing.expires_at,
          new_points_balance: loyaltyStatus.points_balance,
          already_exists: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Generate unique code ─────────────────────────────────────────────
    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const { data: col } = await supabase
        .from("loyalty_discount_codes")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!col) break;
      code = generateCode();
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // ── 5. Create actual Shopify discount code ──────────────────────────────
    let shopifyCreated = false;
    let priceRuleId: number | null = null;
    let shopifyDiscountCodeId: number | null = null;
    let shopifyAccessToken: string | null = null;

    const { data: installation } = await supabase
      .from("store_installations")
      .select("access_token")
      .eq("shop_domain", shop_domain)
      .maybeSingle();

    shopifyAccessToken = installation?.access_token ?? null;

    if (shopifyAccessToken) {
      const shopifyResult = await createShopifyDiscount(
        shop_domain,
        shopifyAccessToken,
        reward.title,
        reward.reward_type,
        reward.discount_value,
        reward.min_purchase_amount ?? 0,
        code,
        expiresAt,
      );
      if (shopifyResult) {
        shopifyCreated = true;
        priceRuleId = shopifyResult.price_rule_id;
        shopifyDiscountCodeId = shopifyResult.discount_code_id;
        console.log(`Shopify discount created: pr=${priceRuleId}, dc=${shopifyDiscountCodeId}`);
      } else {
        console.warn("Shopify discount creation failed — DB only");
      }
    } else {
      console.warn(`No active Shopify installation for ${shop_domain}`);
    }

    // ── 6. Store in loyalty_discount_codes ──────────────────────────────────
    const discType = reward.reward_type === "percentage_discount" ? "percentage" : "fixed_amount";

    const { error: insertErr } = await supabase
      .from("loyalty_discount_codes")
      .insert({
        client_id: reward.client_id,
        member_id: member_user_id,           // FK → member_users.id
        member_email: customer_email ?? null,
        reward_id,
        code,
        discount_type: discType,
        discount_value: reward.discount_value,
        points_redeemed: pointsCost,
        minimum_order_value: reward.min_purchase_amount ?? 0,
        is_used: false,
        expires_at: expiresAt,
        shop_domain,
        shopify_price_rule_id: priceRuleId,
        shopify_discount_code_id: shopifyDiscountCodeId,
        shopify_synced: shopifyCreated,
      });

    if (insertErr) {
      console.error("DB insert error:", insertErr);
      if (shopifyCreated && priceRuleId && shopifyAccessToken) {
        await fetch(
          `https://${shop_domain}/admin/api/2024-01/price_rules/${priceRuleId}.json`,
          { method: "DELETE", headers: { "X-Shopify-Access-Token": shopifyAccessToken } },
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save discount code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 7. Record transaction & update balance ─────────────────────────────
    const newBalance = loyaltyStatus.points_balance - pointsCost;

    await supabase.from("loyalty_points_transactions").insert({
      member_loyalty_status_id: loyaltyStatus.id,
      member_user_id,
      transaction_type: "redeemed",
      points_amount: -pointsCost,
      balance_after: newBalance,
      description: `Redeemed for ${reward.title} (${code})`,
      reference_id: code,
      metadata: { reward_id, shop_domain, shopify_synced: shopifyCreated },
    });

    await supabase
      .from("member_loyalty_status")
      .update({
        points_balance: newBalance,
        lifetime_points_redeemed: (loyaltyStatus.lifetime_points_redeemed ?? 0) + pointsCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loyaltyStatus.id);

    return new Response(
      JSON.stringify({
        success: true,
        discount_code: code,
        discount_value: reward.discount_value,
        discount_type: reward.reward_type,
        expires_at: expiresAt,
        new_points_balance: newBalance,
        shopify_synced: shopifyCreated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("redeem-reward error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
