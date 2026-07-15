import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncOfferCounters } from "../_shared/offer-counters.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

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
  const corsHeaders = getCorsHeaders(req);

  function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    const rawCodes = body.codes as string[] | undefined;
    const expiresAt = body.expires_at as string | undefined;

    if (!offerId || !shopDomain || !Array.isArray(rawCodes)) {
      return jsonResponse({ success: false, error: "offer_id, shop_domain and codes[] are required" }, 400);
    }

    if (rawCodes.length === 0 || rawCodes.length > 1000) {
      return jsonResponse({ success: false, error: "codes[] must contain between 1 and 1000 values" }, 400);
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
      .select("id, owner_client_id, client_id")
      .eq("id", offerId)
      .or(`owner_client_id.eq.${clientId},client_id.eq.${clientId}`)
      .maybeSingle();

    if (offerError) {
      return jsonResponse({ success: false, error: offerError.message }, 500);
    }

    if (!offer) {
      return jsonResponse({ success: false, error: "Offer not found or not owned by this client" }, 403);
    }

    const normalizedCodes = Array.from(
      new Set(
        rawCodes
          .map((code) => typeof code === "string" ? code.trim() : "")
          .filter((code) => code.length > 0)
      )
    );

    if (normalizedCodes.length === 0) {
      return jsonResponse({ success: false, error: "No valid codes found" }, 400);
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("offer_codes")
      .select("code")
      .eq("offer_id", offerId)
      .in("code", normalizedCodes);

    if (existingError) {
      return jsonResponse({ success: false, error: existingError.message }, 500);
    }

    const existingSet = new Set((existingRows || []).map((row: any) => row.code));
    const codesToInsert = normalizedCodes.filter((code) => !existingSet.has(code));

    let inserted = 0;
    if (codesToInsert.length > 0) {
      const rows = codesToInsert.map((code) => ({
        offer_id: offerId,
        code,
        status: "available",
        expires_at: expiresAt || null,
      }));

      const { error: insertError } = await supabase
        .from("offer_codes")
        .upsert(rows, { onConflict: "offer_id,code", ignoreDuplicates: true });

      if (insertError) {
        return jsonResponse({ success: false, error: insertError.message }, 500);
      }

      inserted = codesToInsert.length;
    }

    const { totalAvailable, totalUploaded } = await syncOfferCounters(supabase, offerId);

    return jsonResponse({
      success: true,
      inserted,
      skipped_duplicates: normalizedCodes.length - inserted,
      total_available: totalAvailable,
      total_uploaded: totalUploaded,
    });
  } catch (error: any) {
    console.error("upload-offer-codes error:", error);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});
