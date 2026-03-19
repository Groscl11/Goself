import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function softFail(error: string) {
  return jsonResponse({
    success: false,
    error,
    store_discounts: [],
    partner_vouchers: [],
    marketplace_offers: [],
    existing_codes: {},
  });
}

async function fetchDistributions(supabase: any, clientId: string) {
  let result = await supabase
    .from("offer_distributions")
    .select("*")
    .eq("distributing_client_id", clientId);

  if (result.error?.message?.includes("distributing_client_id")) {
    result = await supabase
      .from("offer_distributions")
      .select("*")
      .eq("client_id", clientId);
  }

  return result;
}

async function resolveClientId(supabase: any, shopDomain?: string | null, requestedClientId?: string | null) {
  if (requestedClientId) return requestedClientId;
  if (!shopDomain) return null;

  const { data: installation } = await supabase
    .from("store_installations")
    .select("client_id")
    .eq("shop_domain", shopDomain)
    .eq("installation_status", "active")
    .maybeSingle();

  if (installation?.client_id) return installation.client_id;

  const { data: integration } = await supabase
    .from("integration_configs")
    .select("client_id")
    .eq("shop_domain", shopDomain)
    .maybeSingle();

  return integration?.client_id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let shopDomain: string | null = null;
    let clientId: string | null = null;
    let memberUserId: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      shopDomain = url.searchParams.get("shop") || url.searchParams.get("shop_domain");
      clientId = url.searchParams.get("client_id");
      memberUserId = url.searchParams.get("member_user_id");
    } else {
      const body = await req.json().catch(() => ({}));
      shopDomain = body.shop_domain ?? body.shop ?? null;
      clientId = body.client_id ?? null;
      memberUserId = body.member_user_id ?? null;
    }

    if (!shopDomain && !clientId) {
      return jsonResponse({ success: false, error: "shop_domain or client_id is required" }, 400);
    }

    clientId = await resolveClientId(supabase, shopDomain, clientId);

    if (!clientId) {
      return jsonResponse({
        success: true,
        store_discounts: [],
        partner_vouchers: [],
        marketplace_offers: [],
        existing_codes: {},
      });
    }

    const { data: distributionRows, error: distributionError } = await fetchDistributions(supabase, clientId);

    if (distributionError) {
      return softFail(`Distribution data unavailable: ${distributionError.message}`);
    }

    const distributionList = distributionRows || [];
    const offerIds = Array.from(
      new Set(distributionList.map((row: any) => row.offer_id ?? row.reward_id).filter(Boolean))
    );

    const { data: rewardRows, error: rewardError } = offerIds.length > 0
      ? await supabase
          .from("rewards")
        .select("*")
          .in("id", offerIds)
      : { data: [], error: null };

    if (rewardError) {
      return softFail(rewardError.message);
    }

    const rewardMap = new Map((rewardRows || []).map((reward: any) => [reward.id, reward]));

    const activeRows = distributionList
      .map((row: any) => {
        const mappedOfferId = row.offer_id ?? row.reward_id;
        return { ...row, offer: rewardMap.get(mappedOfferId), mapped_offer_id: mappedOfferId };
      })
      .filter((row: any) => {
        const offer = row.offer;
        if (!offer) return false;

        const distributionActive = row.is_active !== false;
        const offerActive = offer.is_active !== false;
        const offerStatusOk = !offer.status || offer.status === "active";

        return distributionActive && offerActive && offerStatusOk;
      });

    const { data: existingCodeRows } =
      memberUserId && offerIds.length > 0
        ? await supabase
            .from("offer_codes")
            .select("offer_id, code, expires_at")
            .eq("assigned_to_member_id", memberUserId)
            .eq("status", "assigned")
            .in("offer_id", offerIds)
        : { data: [] };

    const existingCodes: Record<string, { code: string | null; expires_at: string | null }> = {};
    for (const row of existingCodeRows || []) {
      if (row.offer_id && !existingCodes[row.offer_id]) {
        existingCodes[row.offer_id] = { code: row.code, expires_at: row.expires_at };
      }
    }

    const issuerIds = Array.from(new Set(activeRows.map((row: any) => row.offer?.owner_client_id).filter(Boolean)));
    const issuerMap: Record<string, string> = {};

    if (issuerIds.length > 0) {
      const { data: issuers } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", issuerIds);

      for (const issuer of issuers || []) {
        issuerMap[issuer.id] = issuer.name;
      }
    }

    const normalized = activeRows.map((row: any) => {
      const offer = row.offer;
      return {
        offer_id: offer.id,
        distribution_id: row.id,
        title: offer.title,
        description: offer.description,
        value_description: offer.value_description,
        image_url: offer.image_url,
        terms_conditions: offer.terms_conditions,
        offer_type: offer.offer_type || (offer.is_marketplace_listed ? "marketplace_offer" : "store_discount"),
        reward_type: offer.reward_type,
        discount_value: offer.discount_value,
        max_discount_value: offer.max_discount_value,
        min_order_value: offer.min_purchase_amount ?? offer.min_order_value ?? 0,
        coupon_type: offer.coupon_type,
        generic_code: offer.generic_coupon_code,
        points_cost: Number(row.points_cost ?? 0),
        access_type: row.access_type ?? "points_redemption",
        max_per_member: row.max_per_member ?? null,
        available_codes: Number(offer.available_codes ?? 0),
        total_codes_uploaded: Number(offer.total_codes_uploaded ?? 0),
        tracking_type: offer.tracking_type,
        issuer_name: offer.owner_client_id ? issuerMap[offer.owner_client_id] ?? null : null,
        redeems_at_shop_domain: offer.redeems_at_shop_domain,
      };
    });

    return jsonResponse({
      success: true,
      store_discounts: normalized.filter((offer: any) => offer.offer_type === "store_discount"),
      partner_vouchers: normalized.filter((offer: any) => offer.offer_type === "partner_voucher"),
      marketplace_offers: normalized.filter((offer: any) => offer.offer_type === "marketplace_offer"),
      existing_codes: existingCodes,
    });
  } catch (error: any) {
    console.error("get-rewards-catalog error:", error);
    return softFail(error.message ?? "Internal server error");
  }
});
