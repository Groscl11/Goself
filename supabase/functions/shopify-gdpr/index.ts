/**
 * Shopify GDPR Mandatory Compliance Webhooks
 *
 * Handles the three required GDPR webhook topics:
 *   customers/data_request  – customer requests copy of their data
 *   customers/redact        – customer requests data deletion
 *   shop/redact             – merchant uninstalls; requests data deletion
 *
 * Shopify requires a 200 response within a few seconds. Heavy lifting is
 * done asynchronously so we can reply fast and process in the background.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Shopify-Topic, X-Shopify-Shop-Domain, X-Shopify-Hmac-Sha256",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const topic = req.headers.get("X-Shopify-Topic") ?? "";
  const shopDomain = req.headers.get("X-Shopify-Shop-Domain") ?? "";
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256") ?? "";

  const body = await req.text();

  // Verify HMAC signature
  const webhookSecret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";
  if (webhookSecret) {
    const valid = await verifyHmac(body, hmacHeader, webhookSecret);
    if (!valid) {
      console.warn(`[GDPR] Invalid HMAC for ${topic} from ${shopDomain}`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(body);
  } catch {
    console.error("[GDPR] Failed to parse JSON body");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log(`[GDPR] Received ${topic} for shop ${shopDomain}`);

  // Log every GDPR request for audit trail
  await supabase.from("shopify_gdpr_requests").upsert(
    {
      shop_domain: shopDomain,
      topic,
      payload,
      status: "received",
      received_at: new Date().toISOString(),
    },
    { onConflict: "shop_domain,topic,received_at" }
  ).then(({ error }) => {
    if (error) console.error("[GDPR] Audit log error:", error.message);
  });

  switch (topic) {
    case "customers/data_request":
      await handleCustomerDataRequest(supabase, shopDomain, payload);
      break;

    case "customers/redact":
      await handleCustomerRedact(supabase, shopDomain, payload);
      break;

    case "shop/redact":
      await handleShopRedact(supabase, shopDomain, payload);
      break;

    default:
      console.warn(`[GDPR] Unknown topic: ${topic}`);
  }

  // Shopify requirement: always return 200 quickly
  return new Response(JSON.stringify({ received: true, topic }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// ---------------------------------------------------------------------------
// Handler: customers/data_request
// Shopify sends this when a customer requests a copy of their stored data.
// We must provide / export that data within 30 days.
// ---------------------------------------------------------------------------
async function handleCustomerDataRequest(
  supabase: ReturnType<typeof createClient>,
  shopDomain: string,
  payload: Record<string, unknown>
) {
  try {
    const customer = payload.customer as Record<string, unknown> | undefined;
    const customerEmail = customer?.email as string | undefined;
    const customerId = customer?.id as number | undefined;

    console.log(`[GDPR] Data request for customer ${customerEmail ?? customerId} from ${shopDomain}`);

    if (!customerEmail && !customerId) return;

    // Gather all data we hold for this customer
    const queries: Promise<unknown>[] = [];

    if (customerEmail) {
      queries.push(
        supabase
          .from("member_users")
          .select("*")
          .eq("email", customerEmail)
      );
      queries.push(
        supabase
          .from("shopify_orders")
          .select("*")
          .eq("customer_email", customerEmail)
          .eq("shop_domain", shopDomain)
      );
    }

    const results = await Promise.allSettled(queries);
    const collectedData: Record<string, unknown> = {
      customer_email: customerEmail,
      customer_shopify_id: customerId,
      shop_domain: shopDomain,
      data_requested_at: new Date().toISOString(),
      records: results.map((r) => (r.status === "fulfilled" ? r.value : null)),
    };

    // Persist the data export record
    await supabase.from("shopify_gdpr_requests").update({
      status: "data_collected",
      collected_data: collectedData,
      processed_at: new Date().toISOString(),
    })
      .eq("shop_domain", shopDomain)
      .eq("topic", "customers/data_request");

    console.log(`[GDPR] Data collected for ${customerEmail ?? customerId}`);
  } catch (err) {
    console.error("[GDPR] handleCustomerDataRequest error:", err);
  }
}

// ---------------------------------------------------------------------------
// Handler: customers/redact
// Shopify sends this when a customer explicitly asks to be forgotten.
// We must delete / anonymise their personally identifiable information.
// ---------------------------------------------------------------------------
async function handleCustomerRedact(
  supabase: ReturnType<typeof createClient>,
  shopDomain: string,
  payload: Record<string, unknown>
) {
  try {
    const customer = payload.customer as Record<string, unknown> | undefined;
    const customerEmail = customer?.email as string | undefined;
    const customerId = customer?.id as number | undefined;

    console.log(`[GDPR] Redact request for customer ${customerEmail ?? customerId} from ${shopDomain}`);

    if (!customerEmail && !customerId) return;

    // Find the integration for this shop so we scope deletes to the right client
    const { data: integration } = await supabase
      .from("integration_configs")
      .select("client_id")
      .eq("shop_domain", shopDomain)
      .eq("platform", "shopify")
      .maybeSingle();

    const clientId = integration?.client_id;

    if (customerEmail) {
      // Anonymise member_users record (keep analytics row but strip PII)
      if (clientId) {
        await supabase
          .from("member_users")
          .update({
            email: `redacted_${Date.now()}@deleted.invalid`,
            full_name: "Redacted Customer",
            phone: null,
            metadata: { gdpr_redacted: true, redacted_at: new Date().toISOString() },
          })
          .eq("email", customerEmail)
          .eq("client_id", clientId);
      }

      // Anonymise order records
      await supabase
        .from("shopify_orders")
        .update({
          customer_email: null,
          customer_phone: null,
          order_data: { gdpr_redacted: true },
        })
        .eq("customer_email", customerEmail)
        .eq("shop_domain", shopDomain);
    }

    await supabase.from("shopify_gdpr_requests").update({
      status: "redacted",
      processed_at: new Date().toISOString(),
    })
      .eq("shop_domain", shopDomain)
      .eq("topic", "customers/redact");

    console.log(`[GDPR] Customer ${customerEmail ?? customerId} redacted from ${shopDomain}`);
  } catch (err) {
    console.error("[GDPR] handleCustomerRedact error:", err);
  }
}

// ---------------------------------------------------------------------------
// Handler: shop/redact
// Shopify sends this 48 hours after a merchant uninstalls the app.
// We must purge all data related to that shop.
// ---------------------------------------------------------------------------
async function handleShopRedact(
  supabase: ReturnType<typeof createClient>,
  shopDomain: string,
  _payload: Record<string, unknown>
) {
  try {
    console.log(`[GDPR] Shop redact request for ${shopDomain}`);

    // Find integration record
    const { data: integration } = await supabase
      .from("integration_configs")
      .select("id, client_id")
      .eq("shop_domain", shopDomain)
      .eq("platform", "shopify")
      .maybeSingle();

    if (integration) {
      // Revoke & delete the integration (access token, etc.)
      await supabase
        .from("integration_configs")
        .update({
          status: "revoked",
          shopify_access_token: null,
          metadata: { gdpr_shop_redacted: true, redacted_at: new Date().toISOString() },
        })
        .eq("id", integration.id);

      // Delete all webhook event logs for this shop
      await supabase
        .from("shopify_webhook_events")
        .delete()
        .eq("shop_domain", shopDomain);

      // Delete all orders for this shop
      await supabase
        .from("shopify_orders")
        .delete()
        .eq("shop_domain", shopDomain);
    }

    await supabase.from("shopify_gdpr_requests").update({
      status: "shop_redacted",
      processed_at: new Date().toISOString(),
    })
      .eq("shop_domain", shopDomain)
      .eq("topic", "shop/redact");

    console.log(`[GDPR] Shop ${shopDomain} fully redacted`);
  } catch (err) {
    console.error("[GDPR] handleShopRedact error:", err);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
async function verifyHmac(
  body: string,
  hmacHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return computed === hmacHeader;
  } catch {
    return false;
  }
}
