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
    const rawCodes = body.codes as string[] | undefined;
    const expiresAt = body.expires_at as string | undefined;

    if (!offerId || !shopDomain || !Array.isArray(rawCodes)) {
      return jsonResponse({ success: false, error: "offer_id, shop_domain and codes[] are required" }, 400);
    }

    if (rawCodes.length === 0 || rawCodes.length > 1000) {
      return jsonResponse({ success: false, error: "codes[] must contain between 1 and 1000 values" }, 400);
    }

    const clientId = await resolveClientId(supabase, shopDomain);
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

    const { count: totalAvailable, error: countError } = await supabase
      .from("offer_codes")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offerId)
      .eq("status", "available");

    if (countError) {
      return jsonResponse({ success: false, error: countError.message }, 500);
    }

    return jsonResponse({
      success: true,
      inserted,
      skipped_duplicates: normalizedCodes.length - inserted,
      total_available: totalAvailable ?? 0,
    });
  } catch (error: any) {
    console.error("upload-offer-codes error:", error);
    return jsonResponse({ success: false, error: error.message ?? "Internal server error" }, 500);
  }
});
