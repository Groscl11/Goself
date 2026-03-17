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

async function resolveClientId(supabase: any, shopDomain?: string | null) {
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

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const offerId = body.offer_id as string | undefined;
    const shopDomain = (body.shop_domain ?? body.shop) as string | undefined;
    const clientIdFromBody = body.client_id as string | undefined;
    const rawPointsCost = body.points_cost;
    const accessType = body.access_type as string | undefined;
    const maxPerMemberRaw = body.max_per_member;

    if (!offerId || !accessType || (!shopDomain && !clientIdFromBody)) {
      return jsonResponse({ success: false, error: "offer_id, access_type and either shop_domain or client_id are required" }, 400);
    }

    const allowedAccess = ["points_redemption", "campaign_reward", "both"];
    if (!allowedAccess.includes(accessType)) {
      return jsonResponse({ success: false, error: "Invalid access_type" }, 400);
    }

    const clientId = clientIdFromBody ?? await resolveClientId(supabase, shopDomain);
    if (!clientId) {
      return jsonResponse({ success: false, error: "Store not found" }, 404);
    }

    const { data: offer, error: offerError } = await supabase
      .from("rewards")
      .select("id, title, is_marketplace_listed, is_active, status")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) {
      return jsonResponse({ success: false, error: offerError.message }, 500);
    }

    if (!offer || !offer.is_marketplace_listed || offer.is_active !== true || offer.status !== "active") {
      return jsonResponse({ success: false, error: "Marketplace offer not available" }, 404);
    }

    const { data: existingDistribution, error: existingError } = await supabase
      .from("offer_distributions")
      .select("id")
      .eq("offer_id", offerId)
      .eq("distributing_client_id", clientId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ success: false, error: existingError.message }, 500);
    }

    if (existingDistribution?.id) {
      return jsonResponse({
        success: true,
        already_adopted: true,
        distribution_id: existingDistribution.id,
        message: "Offer already added to your store",
      });
    }

    const pointsCost = rawPointsCost === null || rawPointsCost === undefined || rawPointsCost === ""
      ? null
      : Number(rawPointsCost);

    if ((accessType === "points_redemption" || accessType === "both") && (!pointsCost || pointsCost <= 0)) {
      return jsonResponse({ success: false, error: "points_cost must be > 0 for points redemption" }, 400);
    }

    const maxPerMember = maxPerMemberRaw === null || maxPerMemberRaw === undefined || maxPerMemberRaw === ""
      ? 1
      : Number(maxPerMemberRaw);

    if (!Number.isFinite(maxPerMember) || maxPerMember <= 0) {
      return jsonResponse({ success: false, error: "max_per_member must be a positive number" }, 400);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("offer_distributions")
      .insert({
        offer_id: offerId,
        distributing_client_id: clientId,
        access_type: accessType,
        points_cost: pointsCost,
        max_per_member: maxPerMember,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError) {
      return jsonResponse({ success: false, error: insertError.message }, 500);
    }

    return jsonResponse({
      success: true,
      distribution_id: inserted.id,
      message: "Offer added to your store",
    });
  } catch (error: any) {
    console.error("adopt-marketplace-offer error:", error);
    return jsonResponse({ success: false, error: error.message ?? "Internal server error" }, 500);
  }
});
