/**
 * get-cross-client-vouchers
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns marketplace vouchers a member received while shopping at OTHER
 * GoSelf stores, which are now redeemable at the CURRENT store.
 *
 * Only fires for clients on network or enterprise plans.
 * Used to power the cross-client popup in the loyalty widget.
 *
 * ── Request ──────────────────────────────────────────────────────────────────
 * GET /get-cross-client-vouchers
 *   ?shop_domain=houmetest.myshopify.com
 *   &email=member@email.com
 *
 * ── Response ─────────────────────────────────────────────────────────────────
 * {
 *   eligible: boolean,        // false if plan doesn't support this
 *   count: number,
 *   vouchers: [
 *     {
 *       offer_code_id: string,
 *       code: string,
 *       offer_title: string,
 *       from_store: string,   // name of the client who gave the voucher
 *       expires_at: string | null,
 *       discount_value: number,
 *       reward_type: string,
 *     }
 *   ]
 * }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Plans that have access to cross-client network vouchers
const NETWORK_PLANS = ["network", "enterprise"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url       = new URL(req.url);
    const shopDomain = url.searchParams.get("shop_domain") ?? url.searchParams.get("shop");
    const email      = url.searchParams.get("email") ?? url.searchParams.get("customer_email");

    if (!shopDomain) {
      return json({ error: "shop_domain is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Resolve shop_domain → client_id ────────────────────────────────────
    const { data: installation } = await supabase
      .from("store_installations")
      .select("client_id")
      .eq("shop_domain", shopDomain)
      .maybeSingle();

    const clientId = installation?.client_id ?? null;

    if (!clientId) {
      return json({ eligible: false, count: 0, vouchers: [] });
    }

    // ── 2. Check subscription plan — network/enterprise only ──────────────────
    const { data: subscription } = await supabase
      .from("client_subscriptions")
      .select("plan_id")
      .eq("client_id", clientId)
      .eq("status", "active")
      .maybeSingle();

    const planId = subscription?.plan_id ?? "free";
    const isEligible = NETWORK_PLANS.includes(planId);

    if (!isEligible) {
      // Silent empty — don't reveal plan restriction to widget
      return json({ eligible: false, count: 0, vouchers: [] });
    }

    // ── 3. Resolve email → global_user_id ─────────────────────────────────────
    if (!email) {
      return json({ eligible: true, count: 0, vouchers: [] });
    }

    const { data: memberUser } = await supabase
      .from("member_users")
      .select("id, global_user_id")
      .eq("email", email)
      .not("global_user_id", "is", null)
      .maybeSingle();

    const globalUserId = memberUser?.global_user_id ?? null;

    if (!globalUserId) {
      // Member not in global identity system yet — no cross-client vouchers
      return json({ eligible: true, count: 0, vouchers: [] });
    }

    // ── 4. Fetch cross-client marketplace vouchers ────────────────────────────
    const { data: vouchers, error } = await supabase
      .from("offer_codes")
      .select(`
        id,
        code,
        expires_at,
        distributed_by_client_id,
        offer:rewards (
          id,
          title,
          reward_type,
          discount_value,
          offer_type
        ),
        from_client:clients!distributed_by_client_id (
          id,
          name
        )
      `)
      .eq("global_user_id", globalUserId)
      .eq("receiving_client_id", clientId)
      .eq("status", "assigned")
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

    if (error) throw error;

    // Filter to marketplace offers only (belt and suspenders)
    const marketplaceVouchers = (vouchers ?? []).filter(
      (v: any) => v.offer?.offer_type === "marketplace_offer"
    );

    const result = marketplaceVouchers.map((v: any) => ({
      offer_code_id: v.id,
      code:          v.code,
      offer_title:   v.offer?.title ?? "Reward",
      from_store:    v.from_client?.name ?? "Another store",
      expires_at:    v.expires_at ?? null,
      discount_value: v.offer?.discount_value ?? null,
      reward_type:   v.offer?.reward_type ?? null,
    }));

    return json({
      eligible: true,
      count:    result.length,
      vouchers: result,
    });

  } catch (err: any) {
    console.error("get-cross-client-vouchers error:", err);
    return json({ error: err.message ?? "Internal server error" }, 500);
  }
});
