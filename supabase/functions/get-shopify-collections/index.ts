import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * get-shopify-collections
 *
 * Secure server-side proxy for Shopify Collections API.
 * - Verifies caller's Supabase JWT → resolves client_id
 * - Fetches shopify_access_token + shop_domain from integration_configs using service_role
 *   (credentials NEVER reach the browser)
 * - Queries Shopify Admin API for matching custom + smart collections
 * - Returns [{id, title, handle, type}] for autocomplete
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify JWT with anon client (user-scoped)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve client_id from profiles using service_role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("client_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.client_id) {
      return new Response(
        JSON.stringify({ error: "Client profile not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = profile.client_id;

    // Fetch Shopify credentials — service_role only, never client-side
    const { data: integration, error: integrationError } = await adminClient
      .from("store_installations")
      .select("access_token, shop_domain")
      .eq("client_id", clientId)
      .eq("installation_status", "active")
      .maybeSingle();

    if (integrationError || !integration?.access_token || !integration?.shop_domain) {
      return new Response(
        JSON.stringify({ error: "Shopify integration not connected", collections: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query } = await req.json().catch(() => ({ query: "" }));
    const searchQuery = (query || "").trim();

    // Query both custom_collections and smart_collections in parallel
    const baseUrl = `https://${integration.shop_domain}/admin/api/2024-01`;
    const shopifyHeaders = {
      "X-Shopify-Access-Token": integration.access_token,
      "Content-Type": "application/json",
    };

    const params = searchQuery
      ? `?title=${encodeURIComponent(searchQuery)}&limit=20`
      : "?limit=20";

    const [customRes, smartRes] = await Promise.all([
      fetch(`${baseUrl}/custom_collections.json${params}`, { headers: shopifyHeaders }),
      fetch(`${baseUrl}/smart_collections.json${params}`, { headers: shopifyHeaders }),
    ]);

    const collections: Array<{ id: string; title: string; handle: string; type: string }> = [];

    if (customRes.ok) {
      const data = await customRes.json();
      const custom = (data.custom_collections || []).map((c: any) => ({
        id: String(c.id),
        title: c.title,
        handle: c.handle,
        type: "custom",
      }));
      collections.push(...custom);
    }

    if (smartRes.ok) {
      const data = await smartRes.json();
      const smart = (data.smart_collections || []).map((c: any) => ({
        id: String(c.id),
        title: c.title,
        handle: c.handle,
        type: "smart",
      }));
      collections.push(...smart);
    }

    // Sort by title for consistent display
    collections.sort((a, b) => a.title.localeCompare(b.title));

    return new Response(
      JSON.stringify({ collections }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("get-shopify-collections error:", error);
    return new Response(
      JSON.stringify({ error: error.message, collections: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
