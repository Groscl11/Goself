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

async function resolveClientId(supabase: any, shopDomain?: string | null, requestedClientId?: string | null) {
  if (requestedClientId) return requestedClientId;
  if (!shopDomain) return null;

  const { data: installation } = await supabase
    .from("store_installations")
    .select("client_id")
    .eq("shop_domain", shopDomain)
    .eq("installation_status", "active")
    .maybeSingle();

  return installation?.client_id ?? null;
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
    let clientId: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      shopDomain = url.searchParams.get("shop") ?? url.searchParams.get("shop_domain");
      clientId = url.searchParams.get("client_id");
    } else {
      const body = await req.json().catch(() => ({}));
      shopDomain = body.shop_domain ?? body.shop ?? null;
      clientId = body.client_id ?? null;
    }

    clientId = await resolveClientId(supabase, shopDomain, clientId);

    if (!clientId) {
      return jsonResponse({ success: false, error: "Unable to resolve client" }, 400);
    }

    const { data: rewards, error: rewardsError } = await supabase
      .from("rewards")
      .select(
        "id, title, description, image_url, offer_type, reward_type, discount_value, coupon_type, " +
        "available_codes, total_codes_uploaded, valid_until, tags, owner_client_id, is_marketplace_listed, is_active, status"
      )
      .eq("is_marketplace_listed", true)
      .eq("is_active", true)
      .eq("status", "active")
      .neq("owner_client_id", clientId)
      .order("created_at", { ascending: false });

    if (rewardsError) {
      return jsonResponse({ success: false, error: rewardsError.message }, 500);
    }

    const rewardRows = rewards || [];
    const now = new Date();

    const filteredRewards = rewardRows.filter((reward: any) => {
      const validUntil = reward.valid_until ? new Date(reward.valid_until) : null;
      const notExpired = !validUntil || validUntil > now;
      const hasAvailability = reward.coupon_type === "generic" || Number(reward.available_codes || 0) > 0;
      return notExpired && hasAvailability;
    });

    const offerIds = filteredRewards.map((reward: any) => reward.id);
    const issuerIds = Array.from(new Set(filteredRewards.map((reward: any) => reward.owner_client_id).filter(Boolean)));

    const [{ data: issuers, error: issuerError }, { data: adoptedRows, error: adoptedError }] = await Promise.all([
      issuerIds.length > 0
        ? supabase.from("clients").select("id, name, logo_url").in("id", issuerIds)
        : Promise.resolve({ data: [], error: null }),
      offerIds.length > 0
        ? supabase
            .from("offer_distributions")
            .select("offer_id, points_cost")
            .eq("distributing_client_id", clientId)
            .in("offer_id", offerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (issuerError) {
      return jsonResponse({ success: false, error: issuerError.message }, 500);
    }

    if (adoptedError) {
      return jsonResponse({ success: false, error: adoptedError.message }, 500);
    }

    const issuerMap = new Map((issuers || []).map((issuer: any) => [issuer.id, issuer]));
    const adoptedMap = new Map((adoptedRows || []).map((row: any) => [row.offer_id, row.points_cost]));

    const offers = filteredRewards.map((reward: any) => {
      const issuer = reward.owner_client_id ? (issuerMap.get(reward.owner_client_id) as any) : null;
      const adoptedPointsCost = adoptedMap.has(reward.id) ? Number(adoptedMap.get(reward.id)) : null;

      return {
        id: reward.id,
        title: reward.title,
        description: reward.description,
        image_url: reward.image_url,
        offer_type: reward.offer_type,
        reward_type: reward.reward_type,
        discount_value: reward.discount_value,
        coupon_type: reward.coupon_type,
        available_codes: Number(reward.available_codes || 0),
        total_codes_uploaded: Number(reward.total_codes_uploaded || 0),
        valid_until: reward.valid_until,
        tags: reward.tags,
        issuer_name: issuer?.name ?? null,
        issuer_logo: issuer?.logo_url ?? null,
        already_adopted: adoptedMap.has(reward.id),
        my_points_cost: adoptedPointsCost,
      };
    });

    return jsonResponse({ success: true, offers, total: offers.length });
  } catch (error: any) {
    console.error("get-marketplace-offers error:", error);
    return jsonResponse({ success: false, error: error.message ?? "Internal server error" }, 500);
  }
});
