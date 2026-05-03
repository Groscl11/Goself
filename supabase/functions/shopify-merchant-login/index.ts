/**
 * Shopify Merchant Login - Generate Magic Link
 * 
 * Endpoint for SSO login after OAuth or when merchant opens the app
 * 1. Creates auth user if needed
 * 2. Generates magic link with redirect_to URL
 * 3. Returns magic link for immediate redirect (auto-login)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const {
      shop_domain,
      email,
      client_id,
      shop_name,
      shop_owner,
      redirect_to,
    } = await req.json();

    if (!email || !shop_domain || !redirect_to) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Generating magic link for ${email} (shop: ${shop_domain})`);

    // Generate a real magic link. If user doesn't exist yet, create them first.
    // This avoids getUserByEmail which doesn't exist in the Supabase JS SDK.
    let linkData: any;

    const tryGenerateLink = () =>
      supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: redirect_to },
      });

    let { data, error: linkError } = await tryGenerateLink();

    if (linkError) {
      // User likely doesn't exist — create them then retry
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { shop_domain, shop_name, shop_owner, client_id },
      });
      if (createError && !createError.message.toLowerCase().includes('already')) {
        throw createError;
      }
      const retry = await tryGenerateLink();
      if (retry.error) throw retry.error;
      data = retry.data;
    }

    linkData = data;
    const userId = linkData?.user?.id;
    const magicLink = linkData?.properties?.action_link;

    if (!magicLink) {
      throw new Error('Failed to generate magic link');
    }

    console.log(`Magic link generated for ${email}`);

    // Create/update profile server-side using service role BEFORE the client follows the
    // magic link. This ensures AuthContext can load the profile immediately on redirect
    // to /client — no race condition between magic link and profile creation.
    if (userId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name: shop_owner || shop_name || email.split('@')[0],
          role: 'client',
          client_id: client_id || null,
        }, { onConflict: 'id', ignoreDuplicates: false });
      if (profileError) {
        console.error(`Profile upsert failed for ${email}:`, profileError.message);
        // Non-fatal: log and continue — magic link still works
      } else {
        console.log(`Profile upserted for ${email} (userId: ${userId})`);
      }
    }

    return new Response(
      JSON.stringify({
        magic_link: magicLink,
        user_id: userId,
        email_sent: false,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Merchant login error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Login failed",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
