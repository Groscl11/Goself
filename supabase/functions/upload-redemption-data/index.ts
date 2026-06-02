import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncOfferCounters } from "../_shared/offer-counters.ts";

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

    // SECURITY (H-15): verify the caller owns the store they claim to upload for.
    // Resolving clientId from caller-supplied shop_domain alone allows an attacker
    // to upload codes to any tenant's offer by supplying a foreign shop_domain.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerJwt = authHeader.replace("Bearer ", "").trim();
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();

    if (!callerJwt || callerJwt === anonKey) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, callerJwt);
    const { data: { user: callerUser }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !callerUser) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }
    const { data: callerProfile } = await supabase
      .from("profiles").select("client_id, role").eq("id", callerUser.id).maybeSingle();
    if (!callerProfile) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }
    const isAdmin = callerProfile.role === "admin";

    const body = await req.json().catch(() => ({}));
    const offerId = body.offer_id as string | undefined;
    const shopDomain = (body.shop_domain ?? body.shop) as string | undefined;
    const redemptions = body.redemptions as Array<{ code: string; redeemed_at: string }> | undefined;

    if (!offerId || !shopDomain || !Array.isArray(redemptions)) {
      return jsonResponse({ success: false, error: "offer_id, shop_domain and redemptions[] are required" }, 400);
    }

    const clientId = await resolveClientId(supabase, shopDomain);
    // Verify caller owns this client (non-admins can only upload to their own store)
    if (!isAdmin && callerProfile.client_id !== clientId) {
      return jsonResponse({ success: false, error: "Forbidden — you do not have access to this store" }, 403);
    }
    if (!clientId) {
      return jsonResponse({ success: false, error: "Store not found" }, 404);
    }

    const { data: offer, error: offerError } = await supabase
      .from("rewards")
      .select("id, owner_client_id, client_id, tracking_type")
      .eq("id", offerId)
      .or(`owner_client_id.eq.${clientId},client_id.eq.${clientId}`)
      .maybeSingle();

    if (offerError) {
      return jsonResponse({ success: false, error: offerError.message }, 500);
    }

    if (!offer) {
      return jsonResponse({ success: false, error: "Offer not found or not owned by this client" }, 403);
    }

    if (offer.tracking_type !== "manual") {
      return jsonResponse({ success: false, error: "Only manual tracking offers accept redemption upload" }, 400);
    }

    let updated = 0;
    const notFound: string[] = [];

    for (const entry of redemptions) {
      const code = typeof entry?.code === "string" ? entry.code.trim() : "";
      if (!code) continue;

      const redeemedAt = entry?.redeemed_at ? new Date(entry.redeemed_at).toISOString() : new Date().toISOString();

      const { data: updatedRows, error: updateError } = await supabase
        .from("offer_codes")
        .update({
          status: "redeemed",
          redeemed_at: redeemedAt,
          redemption_source: "manual_upload",
          updated_at: new Date().toISOString(),
        })
        .eq("offer_id", offerId)
        .eq("code", code)
        .in("status", ["available", "assigned"])
        .select("id");

      if (updateError) {
        return jsonResponse({ success: false, error: updateError.message }, 500);
      }

      if (updatedRows && updatedRows.length > 0) {
        updated += updatedRows.length;
      } else {
        notFound.push(code);
      }
    }

    await syncOfferCounters(supabase, offerId);

    return jsonResponse({ success: true, updated, not_found: notFound });
  } catch (error: any) {
    console.error("upload-redemption-data error:", error);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});
