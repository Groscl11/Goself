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
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // ── Authenticate caller ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Resolve client_id from profile ────────────────────────────────────
    const { data: profile } = await db
      .from("profiles")
      .select("client_id, role")
      .eq("id", user.id)
      .maybeSingle();

    const clientId = profile?.client_id;

    if (!clientId) {
      // Return a minimal free-plan config for non-client users
      return new Response(
        JSON.stringify({ plan: null, modules: [], features: [], locked_feature_hints: {} }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Load subscription ─────────────────────────────────────────────────
    const { data: sub } = await db
      .from("client_subscriptions")
      .select("plan_id, status, billing_cycle, amount_inr, trial_ends_at, current_period_end, payment_method, notes")
      .eq("client_id", clientId)
      .maybeSingle();

    const planId = sub?.plan_id ?? "free";

    // ── Load plan + entitlements + per-client flag overrides in parallel ──
    const [planRes, featsRes, modsRes, flagsRes] = await Promise.all([
      db.from("plans").select("id, name, description, price_monthly, price_annual").eq("id", planId).maybeSingle(),
      db.from("plan_feature_entitlements").select("feature").eq("plan_id", planId),
      db.from("plan_module_entitlements").select("module").eq("plan_id", planId),
      db.from("client_feature_flags").select("feature, is_enabled").eq("client_id", clientId),
    ]);

    const plan    = planRes.data ?? null;
    const modules = (modsRes.data ?? []).map((r: { module: string }) => r.module);

    // Merge plan features + per-client overrides
    const featureSet = new Set((featsRes.data ?? []).map((r: { feature: string }) => r.feature));
    (flagsRes.data ?? []).forEach((flag: { feature: string; is_enabled: boolean }) => {
      if (flag.is_enabled) {
        featureSet.add(flag.feature);    // override ON: grant even if not in plan
      } else {
        featureSet.delete(flag.feature); // override OFF: revoke even if in plan
      }
    });
    const features = Array.from(featureSet);

    // ── Build locked feature hints ─────────────────────────────────────────
    // Maps feature key → which plan first unlocks it, to guide upgrades
    const PLAN_ORDER = ["free", "starter", "growth", "referral", "network", "enterprise"];
    const ALL_FEATURES: Record<string, string> = {
      "loyalty.points_earn":           "starter",
      "loyalty.points_balance":        "free",
      "loyalty.tiers":                 "starter",
      "loyalty.redemption":            "starter",
      "loyalty.product_page_points":   "starter",
      "loyalty.thankyou_page_points":  "starter",
      "loyalty.member_widget":         "free",
      "campaigns.order_value_trigger": "starter",
      "campaigns.auto_enrollment":     "starter",
      "campaigns.advanced_conditions": "growth",
      "campaigns.analytics":           "growth",
      "referral.link_generation":      "referral",
      "referral.tracking":             "referral",
      "referral.tiered_commissions":   "referral",
      "referral.affiliate_dashboard":  "referral",
      "network.cross_brand_vouchers":  "network",
      "network.brand_marketplace":     "network",
      "network.analytics":             "network",
    };

    const locked_feature_hints: Record<string, string> = {};
    for (const [feat, minPlan] of Object.entries(ALL_FEATURES)) {
      if (!featureSet.has(feat)) {
        const isHigher = PLAN_ORDER.indexOf(minPlan) > PLAN_ORDER.indexOf(planId);
        if (isHigher) {
          locked_feature_hints[feat] = `Requires ${minPlan.charAt(0).toUpperCase() + minPlan.slice(1)} plan`;
        }
      }
    }

    return new Response(
      JSON.stringify({ plan, modules, features, locked_feature_hints }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
