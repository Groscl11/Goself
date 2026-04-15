import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncOfferCounters } from "../_shared/offer-counters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RedeemRequest {
  reward_id: string;
  member_user_id?: string;
  shop_domain: string;
  customer_email?: string;
  email?: string;
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

    const priceRuleController = new AbortController();
    const priceRuleTimeout = setTimeout(() => priceRuleController.abort(), 10000);

    const priceRuleRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/price_rules.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify(priceRuleBody),
        signal: priceRuleController.signal,
      },
    );
    clearTimeout(priceRuleTimeout);

    if (!priceRuleRes.ok) {
      const err = await priceRuleRes.text();
      console.error("Price rule creation failed:", err);
      return null;
    }

    const { price_rule } = await priceRuleRes.json();

    const discountController = new AbortController();
    const discountTimeout = setTimeout(() => discountController.abort(), 10000);

    const discountRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/price_rules/${price_rule.id}/discount_codes.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ discount_code: { code } }),
        signal: discountController.signal,
      },
    );
    clearTimeout(discountTimeout);

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
    let { reward_id, member_user_id, shop_domain, customer_email, email } = body;

    // Validate required fields
    if (!reward_id || !shop_domain || (!member_user_id && !customer_email && !email)) {
      return new Response(
        JSON.stringify({ success: false, error: "shop_domain, (member_user_id or email), and reward_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── STEP 0: Resolve member_user_id from email if not provided ──
    if (!member_user_id && (customer_email || email)) {
      const emailToUse = customer_email || email;
      const { data: memberData, error: memberError } = await supabase
        .from("member_users")
        .select("id")
        .eq("email", emailToUse)
        .maybeSingle();

      if (memberError || !memberData) {
        return new Response(
          JSON.stringify({ success: false, error: "Member not found with provided email" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      member_user_id = memberData.id;
    }

    // Step 1: resolve client from shop_domain
    const { data: installation } = await supabase
      .from("store_installations")
      .select("client_id")
      .eq("shop_domain", shop_domain)
      .eq("installation_status", "active")
      .maybeSingle();

    const { data: integration } = !installation?.client_id
      ? await supabase
          .from("integration_configs")
          .select("client_id")
          .eq("shop_domain", shop_domain)
          .maybeSingle()
      : { data: null };

    const clientId = installation?.client_id ?? integration?.client_id ?? null;

    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: "Store not found for shop_domain" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: fetch offer + distribution config
    const { data: offerRow } = await supabase
      .from("offer_distributions")
      .select(
        "id, offer_id, points_cost, max_per_member, access_type, distributing_client_id, " +
        "offer:rewards(id, title, discount_value, reward_type, min_purchase_amount, coupon_type, generic_coupon_code, available_codes, offer_type, redeems_at_shop_domain, is_active, status, client_id)"
      )
      .eq("offer_id", reward_id)
      .eq("distributing_client_id", clientId)
      .eq("is_active", true)
      .in("access_type", ["points_redemption", "both"])
      .maybeSingle();

    if (!offerRow || !offerRow.offer || offerRow.offer.is_active !== true || offerRow.offer.status !== "active") {
      return new Response(
        JSON.stringify({ success: false, error: "Offer not available for your store" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reward = offerRow.offer;
    const pointsCost = Number(offerRow.points_cost ?? 0);

    if (pointsCost <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Offer points cost is not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    // Step 5: idempotent return of existing assigned code
    const { data: existing } = await supabase
      .from("offer_codes")
      .select("id, code, expires_at")
      .eq("offer_id", reward_id)
      .eq("assigned_to_member_id", member_user_id)
      .eq("distributed_by_client_id", clientId)
      .eq("status", "assigned")
      .maybeSingle();

    if (existing) {
      const existingCode = reward.coupon_type === "generic"
        ? reward.generic_coupon_code
        : existing.code;

      return new Response(
        JSON.stringify({
          success: true,
          discount_code: existingCode,
          discount_value: reward.discount_value,
          discount_type: reward.reward_type,
          expires_at: existing.expires_at,
          new_points_balance: loyaltyStatus.points_balance,
          already_exists: true,
          offer_type: reward.offer_type,
          coupon_type: reward.coupon_type,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 4: per-member usage limit (after idempotent assigned lookup)
    const { count: usageCount, error: usageError } = await supabase
      .from("offer_codes")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", reward_id)
      .eq("assigned_to_member_id", member_user_id)
      .eq("distributed_by_client_id", clientId)
      .in("status", ["assigned", "redeemed"]);

    if (usageError) {
      return new Response(
        JSON.stringify({ success: false, error: usageError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const maxPerMember = Number(offerRow.max_per_member ?? 1);
    if (usageCount !== null && usageCount >= maxPerMember) {
      return new Response(
        JSON.stringify({ success: false, error: "You've already claimed this offer" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Step 5B: Fetch member data (global_user_id, email) ───────────────────
    const { data: memberData } = await supabase
      .from("member_users")
      .select("global_user_id, email")
      .eq("id", member_user_id)
      .maybeSingle();

    // ── Step 5C: Determine receiving_client_id (marketplace offers only) ──────
    const receivingClientId =
      reward.offer_type === "marketplace_offer"
        ? reward.client_id ?? null
        : null;

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    let claimedOfferCodeId: string | null = null;
    let code: string | null = null;

    // Step 6: assign code based on coupon_type
    if (reward.coupon_type === "generic") {
      if (!reward.generic_coupon_code) {
        return new Response(
          JSON.stringify({ success: false, error: "Generic code not configured for this offer" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: insertedGenericCode, error: insertGenericError } = await supabase
        .from("offer_codes")
        .insert({
          offer_id: reward_id,
          distribution_id: offerRow.id,
          code: null,
          status: "assigned",
          assigned_to_member_id: member_user_id,
          assigned_at: new Date().toISOString(),
          assignment_channel: "points_redemption",
          distributed_by_client_id: clientId,
          global_user_id: memberData?.global_user_id ?? null,
          member_email: memberData?.email ?? null,
          receiving_client_id: receivingClientId,
          code_source: "generic",
          shopify_synced: false,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insertGenericError) {
        return new Response(
          JSON.stringify({ success: false, error: insertGenericError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      claimedOfferCodeId = insertedGenericCode?.id ?? null;
      code = reward.generic_coupon_code;
    } else {
      // Unique code claim with race-safe locking.
      const { data: claimedCode, error: claimError } = await supabase.rpc("claim_next_offer_code", {
        p_offer_id: reward_id,
        p_distribution_id: offerRow.id,
        p_member_user_id: member_user_id,
        p_distributed_by_client_id: clientId,
      });

      if (claimError) {
        return new Response(
          JSON.stringify({ success: false, error: claimError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!claimedCode?.id) {
        return new Response(
          JSON.stringify({ success: false, error: "No codes available for this offer" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      claimedOfferCodeId = claimedCode.id;
      code = claimedCode.code;
    }

    // Step 6B: optional Shopify sync for unique store discounts
    let shopifyCreated = false;
    let priceRuleId: number | null = null;
    let shopifyDiscountCodeId: number | null = null;
    let shopifyAccessToken: string | null = null;

    const { data: storeInstall } = await supabase
      .from("store_installations")
      .select("access_token")
      .eq("shop_domain", shop_domain)
      .maybeSingle();

    shopifyAccessToken = storeInstall?.access_token ?? null;

    if (shopifyAccessToken && reward.coupon_type === "unique" && reward.offer_type === "store_discount" && code) {
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

        // INSERT into offer_codes to track Shopify-generated code
        await supabase.from("offer_codes").insert({
          offer_id: reward_id,
          distribution_id: offerRow.id,
          code: code,
          status: "assigned",
          assigned_to_member_id: member_user_id,
          assigned_at: new Date().toISOString(),
          distributed_by_client_id: clientId,
          global_user_id: memberData?.global_user_id ?? null,
          member_email: memberData?.email ?? null,
          receiving_client_id: receivingClientId,
          code_source: "shopify_generated",
          shopify_price_rule_id: priceRuleId,
          shopify_discount_code_id: shopifyDiscountCodeId,
          shopify_synced: true,
          expires_at: expiresAt,
        }).catch((err) => console.error("offer_codes insert for Shopify failed:", err));
      } else {
        console.warn("Shopify discount creation failed — DB only");
      }
    } else {
      console.warn(`No active Shopify installation for ${shop_domain}`);
    }

    if (claimedOfferCodeId) {
      await supabase
        .from("offer_codes")
        .update({
          status: "assigned",
          distributed_by_client_id: clientId,
          global_user_id: memberData?.global_user_id ?? null,
          member_email: memberData?.email ?? null,
          receiving_client_id: receivingClientId,
          code_source: "uploaded_pool",
          shopify_synced: shopifyCreated,
          shopify_price_rule_id: priceRuleId,
          shopify_discount_code_id: shopifyDiscountCodeId,
          expires_at: expiresAt,
        })
        .eq("id", claimedOfferCodeId);
    }

    // Step 7: deduct points + transaction
    const newBalance = loyaltyStatus.points_balance - pointsCost;

    await supabase.from("loyalty_points_transactions").insert({
      member_loyalty_status_id: loyaltyStatus.id,
      member_user_id,
      transaction_type: "redeemed",
      points_amount: -pointsCost,
      balance_after: newBalance,
      description: `Redeemed for ${reward.title} (${code})`,
      reference_id: code,
      metadata: { reward_id, distribution_id: offerRow.id, shop_domain, shopify_synced: shopifyCreated },
    });

    await supabase
      .from("member_loyalty_status")
      .update({
        points_balance: newBalance,
        lifetime_points_redeemed: (loyaltyStatus.lifetime_points_redeemed ?? 0) + pointsCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loyaltyStatus.id);

    if (reward.coupon_type === "unique") {
      await syncOfferCounters(supabase, reward_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        discount_code: code,
        discount_value: reward.discount_value,
        discount_type: reward.reward_type,
        expires_at: expiresAt,
        new_points_balance: newBalance,
        shopify_synced: shopifyCreated,
        offer_type: reward.offer_type,
        coupon_type: reward.coupon_type,
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
