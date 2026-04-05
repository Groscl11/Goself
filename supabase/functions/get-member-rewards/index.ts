import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveClientId(supabase: any, shopDomain?: string | null, requestedClientId?: string | null) {
  if (requestedClientId) return requestedClientId;
  if (!shopDomain) return null;

  const { data: install } = await supabase
    .from("store_installations")
    .select("client_id")
    .eq("shop_domain", shopDomain)
    .eq("installation_status", "active")
    .maybeSingle();

  return install?.client_id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let shopDomain: string | null = null;
    let memberUserId: string | null = null;
    let email: string | null = null;
    let clientId: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      shopDomain = url.searchParams.get("shop") ?? url.searchParams.get("shop_domain");
      memberUserId = url.searchParams.get("member_user_id");
      email = url.searchParams.get("email") ?? url.searchParams.get("customer_email");
      clientId = url.searchParams.get("client_id");
    } else {
      const body = await req.json().catch(() => ({}));
      shopDomain = body.shop_domain ?? body.shop ?? null;
      memberUserId = body.member_user_id ?? null;
      email = body.email ?? body.customer_email ?? null;
      clientId = body.client_id ?? null;
    }

    if (!shopDomain && !clientId) {
      return jsonResponse({ success: false, error: "shop_domain or client_id is required" }, 400);
    }

    clientId = await resolveClientId(supabase, shopDomain, clientId);

    if (!clientId) {
      return jsonResponse({
        customer_id: null,
        member_user_id: null,
        client_id: null,
        shop_domain: shopDomain,
        points_balance: 0,
        offers: [],
        discount_rewards: [],
        brand_rewards: [],
        existing_codes: {},
      });
    }

    // Resolve member from email when member_user_id is not provided.
    let memberRow: any = null;
    if (!memberUserId && email) {
      const { data } = await supabase
        .from("member_users")
        .select("id, email, client_id")
        .eq("client_id", clientId)
        .eq("email", email)
        .maybeSingle();
      memberRow = data;
      memberUserId = data?.id ?? null;
    } else if (memberUserId) {
      const { data } = await supabase
        .from("member_users")
        .select("id, email, client_id")
        .eq("id", memberUserId)
        .maybeSingle();
      memberRow = data;
    }

    if (!memberUserId) {
      return jsonResponse({ success: false, error: "Member not found" }, 404);
    }

    const { data: loyaltyStatus } = await supabase
      .from("member_loyalty_status")
      .select("points_balance")
      .eq("member_user_id", memberUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pointsBalance = loyaltyStatus?.points_balance ?? 0;

    const { data: distRows, error: distError } = await supabase
      .from("offer_distributions")
      .select(
        "id, offer_id, points_cost, access_type, max_per_member, distributing_client_id, " +
        "offer:rewards(id, title, description, image_url, terms_conditions, reward_type, discount_value, max_discount_value, min_purchase_amount, coupon_type, generic_coupon_code, available_codes, offer_type, tracking_type, redeems_at_shop_domain, owner_client_id, is_active, status)"
      )
      .eq("distributing_client_id", clientId)
      .eq("is_active", true)
      .in("access_type", ["points_redemption", "both"]);

    if (distError) {
      return jsonResponse({ success: false, error: distError.message }, 500);
    }

    const distributionRows = (distRows ?? []).filter((row: any) => {
      const offer = row.offer;
      return offer && offer.is_active === true && offer.status === "active";
    });

    const offerIds = distributionRows.map((row: any) => row.offer_id);

    const { data: assignedRows } = offerIds.length > 0
      ? await supabase
          .from("offer_codes")
          .select("offer_id, code, expires_at")
          .eq("assigned_to_member_id", memberUserId)
          .eq("status", "assigned")
          .in("offer_id", offerIds)
      : { data: [] };

    const existingCodes: Record<string, { code: string | null; expires_at: string | null }> = {};
    for (const row of (assignedRows ?? [])) {
      if (row.offer_id && !existingCodes[row.offer_id]) {
        existingCodes[row.offer_id] = {
          code: row.code,
          expires_at: row.expires_at,
        };
      }
    }

    const ownerIds = Array.from(
      new Set(
        distributionRows
          .map((row: any) => row.offer?.owner_client_id)
          .filter((id: string | null) => !!id)
      )
    );

    const ownerMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: ownerRows } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", ownerIds);

      for (const owner of (ownerRows ?? [])) {
        ownerMap[owner.id] = owner.name;
      }
    }

    const offers = distributionRows
      .filter((row: any) => {
        const offer = row.offer;
        if (!offer) return false;

        if (offer.coupon_type === "unique") {
          return Number(offer.available_codes ?? 0) > 0;
        }

        return !!offer.generic_coupon_code;
      })
      .map((row: any) => {
        const offer = row.offer;
        const pointsCost = Number(row.points_cost ?? 0);

        return {
          offer_id: offer.id,
          title: offer.title,
          description: offer.description,
          image_url: offer.image_url,
          terms_conditions: offer.terms_conditions,
          offer_type: offer.offer_type,
          reward_type: offer.reward_type,
          discount_value: offer.discount_value,
          max_discount_value: offer.max_discount_value,
          min_order_value: offer.min_purchase_amount ?? offer.min_order_value ?? 0,
          coupon_type: offer.coupon_type,
          generic_code: offer.coupon_type === "generic" ? offer.generic_coupon_code : null,
          points_cost: pointsCost,
          access_type: row.access_type,
          max_per_member: row.max_per_member,
          distribution_id: row.id,
          available_codes: Number(offer.available_codes ?? 0),
          can_redeem: pointsBalance >= pointsCost,
          existing_code: existingCodes[offer.id]
            ? {
                code: existingCodes[offer.id].code,
                expires_at: existingCodes[offer.id].expires_at,
              }
            : null,
          owner_name: offer.owner_client_id ? ownerMap[offer.owner_client_id] ?? null : null,
          redeems_at_shop_domain: offer.redeems_at_shop_domain ?? shopDomain,
          tracking_type: offer.tracking_type ?? "automatic",
        };
      })
      .sort((a: any, b: any) => a.points_cost - b.points_cost);

    return jsonResponse({
      customer_id: memberRow?.id ?? memberUserId,
      member_user_id: memberUserId,
      client_id: clientId,
      shop_domain: shopDomain,
      points_balance: pointsBalance,
      offers,
      // Backward compatibility fields for old widgets.
      discount_rewards: offers.filter((offer: any) => offer.offer_type === "store_discount"),
      brand_rewards: offers.filter((offer: any) => ["partner_voucher", "marketplace_offer"].includes(offer.offer_type)),
      existing_codes: Object.fromEntries(
        Object.entries(existingCodes).map(([offerId, codeData]) => [
          offerId,
          { code: codeData.code, expires_at: codeData.expires_at },
        ])
      ) as Record<string, { code: string | null; expires_at: string | null }>,
    });
  } catch (error: any) {
    console.error("get-member-rewards error:", error);
    return jsonResponse({ success: false, error: error.message ?? "Internal server error" }, 500);
  }
});
