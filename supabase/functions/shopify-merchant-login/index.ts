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

    // Step 1: Check if user exists by email (direct lookup, avoids listUsers() 50-user cap)
    let userId: string | null = null;
    let userExists = false;

    try {
      const { data: { user: existingUser } } = await supabase.auth.admin.getUserByEmail(email);
      if (existingUser) {
        userId = existingUser.id;
        userExists = true;
        console.log(`User exists: ${userId}`);
      }
    } catch (e) {
      console.warn('Warning: Could not look up user by email:', e);
    }

    // Step 2: Create user if not found
    if (!userExists) {
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { shop_domain, shop_name, shop_owner, client_id },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        throw createError;
      }

      userId = user!.id;
      console.log(`New user created: ${userId}`);
    }

    if (!userId) {
      throw new Error('Failed to get or create user');
    }

    // Step 3: Generate a real Supabase magic link (contains a one-time token)
    // generateLink returns action_link which includes #access_token — Supabase JS SDK
    // processes this automatically when the browser navigates to it.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: redirect_to },
    });

    if (linkError) {
      console.error('Error generating magic link:', linkError);
      throw linkError;
    }

    const magicLink = linkData.properties.action_link;
    console.log(`Magic link generated for ${email}`);

    return new Response(
      JSON.stringify({
        magic_link: magicLink,
        user_id: userId,
        created: !userExists,
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
