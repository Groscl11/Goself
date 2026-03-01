/**
 * redeem-brand-reward
 * ─────────────────────────────────────────────────────────────────────────────
 * Redeems a brand/partner voucher for a loyalty member.
 * - Validates member has enough points
 * - Returns existing issued voucher if the member already has one (idempotent)
 * - Picks an unassigned voucher from the `vouchers` pool and assigns it
 * - Deducts points from member_loyalty_status
 * - Records the transaction in loyalty_point_transactions
 *
 * ── Request ──────────────────────────────────────────────────────────────────
 * POST /redeem-brand-reward
 * {
 *   member_user_id : string,
 *   reward_id      : string,   // brand reward id (from rewards table)
 *   config_id      : string,   // client_brand_reward_configs.id
 *   shop_domain    : string,
 *   client_id?     : string,
 * }
 *
 * ── Response ─────────────────────────────────────────────────────────────────
 * {
 *   success           : true,
 *   voucher_code      : string,
 *   expires_at        : string | null,
 *   brand_name        : string | null,
 *   brand_website_url : string | null,
 *   new_points_balance: number,
 *   already_exists    : boolean,
 * }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const body = await req.json().catch(() => ({}));
    const {
      member_user_id,
      reward_id,
      config_id,
      shop_domain,
      client_id: clientIdInput,
    } = body;

    if (!member_user_id || !reward_id || (!shop_domain && !clientIdInput)) {
      return json({ error: "member_user_id, reward_id, and shop_domain are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Resolve client_id ──────────────────────────────────────────────────
    let clientId = clientIdInput ?? null;
    if (!clientId && shop_domain) {
      const { data: inst } = await supabase
        .from("store_installations")
        .select("client_id")
        .eq("shop_domain", shop_domain)
        .maybeSingle();
      clientId = inst?.client_id ?? null;

      if (!clientId) {
        const { data: intg } = await supabase
          .from("integration_configs")
          .select("client_id")
          .eq("shop_domain", shop_domain)
          .maybeSingle();
        clientId = intg?.client_id ?? null;
      }
    }

    if (!clientId) {
      return json({ error: "Could not resolve client for this shop" }, 400);
    }

    // ── 2. Load config — points_cost ─────────────────────────────────────────
    // Try config_id first, fall back to querying by reward_id + client_id
    let pointsCost: number | null = null;

    if (config_id) {
      const { data: cfg } = await supabase
        .from("client_brand_reward_configs")
        .select("points_cost")
        .eq("id", config_id)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .maybeSingle();
      pointsCost = cfg?.points_cost ?? null;
    }

    if (pointsCost === null) {
      const { data: cfg } = await supabase
        .from("client_brand_reward_configs")
        .select("points_cost")
        .eq("reward_id", reward_id)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .maybeSingle();
      pointsCost = cfg?.points_cost ?? null;
    }

    if (pointsCost === null) {
      return json({ error: "Reward config not found or inactive" }, 404);
    }

    // ── 3. Load brand info ────────────────────────────────────────────────────
    const { data: rewardRow } = await supabase
      .from("rewards")
      .select("id, title, brands!brand_id(name, website_url)")
      .eq("id", reward_id)
      .maybeSingle();

    const brandName: string | null = (rewardRow as any)?.brands?.name ?? null;
    const brandWebsiteUrl: string | null = (rewardRow as any)?.brands?.website_url ?? null;

    // ── 4. Get member's current points ────────────────────────────────────────
    // member_loyalty_status has NO client_id column — query by member_user_id only
    const { data: statusRows } = await supabase
      .from("member_loyalty_status")
      .select("id, points_balance, lifetime_points_redeemed")
      .eq("member_user_id", member_user_id)
      .order("points_balance", { ascending: false })
      .limit(5);

    const status = (statusRows ?? [])[0] ?? null;

    if (!status) {
      return json({ error: "Member loyalty status not found" }, 404);
    }

    // ── 5. Check for an already-issued but unused voucher ─────────────────────
    const { data: existingVoucher } = await supabase
      .from("vouchers")
      .select("id, code, expires_at")
      .eq("member_id", member_user_id)
      .eq("reward_id", reward_id)
      .eq("status", "available")
      .maybeSingle();

    if (existingVoucher) {
      return json({
        success: true,
        voucher_code: existingVoucher.code,
        expires_at: existingVoucher.expires_at,
        brand_name: brandName,
        brand_website_url: brandWebsiteUrl,
        new_points_balance: status.points_balance,
        already_exists: true,
      });
    }

    // ── 6. Validate points ────────────────────────────────────────────────────
    if (status.points_balance < pointsCost) {
      return json({
        error: `Insufficient points. You have ${status.points_balance} but need ${pointsCost}.`,
        points_balance: status.points_balance,
        points_required: pointsCost,
      }, 400);
    }

    // ── 7. Claim an unassigned voucher ────────────────────────────────────────
    const { data: availableVouchers } = await supabase
      .from("vouchers")
      .select("id, code, expires_at")
      .eq("reward_id", reward_id)
      .is("member_id", null)
      .eq("status", "available")
      .limit(1);

    if (!availableVouchers || availableVouchers.length === 0) {
      return json({ error: "No vouchers are currently available for this reward. Please try again later." }, 409);
    }

    const voucher = availableVouchers[0];

    // ── 8. Assign voucher to member (atomic-ish) ──────────────────────────────
    const { error: assignError } = await supabase
      .from("vouchers")
      .update({
        member_id: member_user_id,
        issued_at: new Date().toISOString(),
      })
      .eq("id", voucher.id)
      .is("member_id", null); // guard against race condition

    if (assignError) {
      return json({ error: "Failed to assign voucher. Please try again." }, 500);
    }

    // ── 9. Deduct points ──────────────────────────────────────────────────────
    const newBalance = status.points_balance - pointsCost;

    await supabase
      .from("member_loyalty_status")
      .update({
        points_balance: newBalance,
        lifetime_points_redeemed: (status as any).lifetime_points_redeemed != null
          ? (status as any).lifetime_points_redeemed + pointsCost
          : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", status.id);

    // ── 10. Log transaction ───────────────────────────────────────────────────
    await supabase.from("loyalty_points_transactions").insert({
      member_loyalty_status_id: status.id,
      member_user_id,
      transaction_type: "redeemed",
      points_amount: -pointsCost,
      balance_after: newBalance,
      description: `Redeemed brand reward: ${rewardRow?.title ?? reward_id}`,
      reference_id: reward_id,
      metadata: { reward_type: "brand_voucher", voucher_code: voucher.code },
    });

    return json({
      success: true,
      voucher_code: voucher.code,
      expires_at: voucher.expires_at,
      brand_name: brandName,
      brand_website_url: brandWebsiteUrl,
      new_points_balance: newBalance,
      already_exists: false,
    });
  } catch (err: any) {
    console.error("redeem-brand-reward error:", err);
    return json({ error: err.message ?? "Internal server error" }, 500);
  }
});
