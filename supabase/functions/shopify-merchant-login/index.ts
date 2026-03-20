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

    // Step 1: Check if user exists
    const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
    let userId: string;
    const existingUser = existingUsers?.find((u: any) => u.email === email);

    if (existingUser) {
      userId = existingUser.id;
      console.log(`User exists: ${userId}`);
    } else {
      // Step 2: Create auth user with email
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // Auto-confirm so they can login immediately
        user_metadata: {
          shop_domain,
          shop_name,
          shop_owner,
          client_id,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        throw createError;
      }

      userId = user!.id;
      console.log(`New user created: ${userId}`);
    }

    // Step 3: Generate magic link
    // Using generateLink to create a magic link that auto-logs in
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: redirect_to,
      },
    });

    if (linkError) {
      console.error("Error generating magic link:", linkError);
      throw linkError;
    }

    const magicLink = linkData?.properties?.action_link;

    if (!magicLink) {
      throw new Error("No magic link generated");
    }

    console.log(`Magic link generated for ${email}`);

    return new Response(
      JSON.stringify({
        magic_link: magicLink, // Immediate redirect URL with token
        user_id: userId,
        created: !existingUser,
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
