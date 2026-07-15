/**
 * Shopify OAuth Connect Endpoint
 * Initiates OAuth 2.0 flow by redirecting merchant to Shopify authorization page
 *
 * Flow:
 * 1. Client calls this endpoint with shop domain
 * 2. Generates OAuth authorization URL
 * 3. Redirects merchant to Shopify
 * 4. Shopify redirects back to callback endpoint
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SHOPIFY_SCOPES = 'read_customers,read_orders,read_discounts,write_discounts';
const CALLBACK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-oauth-callback`;
const APP_URL_ENV = Deno.env.get('APP_URL')?.trim() || '';
const ALLOWED_APP_URLS = (Deno.env.get('ALLOWED_APP_URLS') || '').split(',').map((item) => item.trim()).filter(Boolean);

function normalizeOrigin(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function resolveSafeAppUrl(appUrl?: string): string | null {
  const allowedOrigins = [APP_URL_ENV, ...ALLOWED_APP_URLS]
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));

  if (!appUrl) return null;
  const origin = normalizeOrigin(appUrl);
  if (origin && allowedOrigins.includes(origin)) {
    return appUrl;
  }

  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { shop, client_id, user_id, app_url } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate shop domain
    if (!shop || !shop.includes('myshopify.com')) {
      return new Response(
        JSON.stringify({ error: 'Invalid shop domain' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate client_id and user_id
    if (!client_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing client_id or user_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: integrationConfig, error: configError } = await supabase
      .from('integration_configs')
      .select('shopify_api_key, shopify_api_secret, credentials_configured')
      .eq('client_id', client_id)
      .eq('platform', 'shopify')
      .maybeSingle();

    if (configError) {
      console.error('Error fetching integration config:', configError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch integration configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!integrationConfig || !integrationConfig.credentials_configured) {
      return new Response(
        JSON.stringify({ error: 'Shopify credentials not configured. Please configure your API credentials first.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const SHOPIFY_API_KEY = integrationConfig.shopify_api_key;

    if (!SHOPIFY_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Invalid Shopify API credentials' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate state parameter for CSRF protection
    const safeAppUrl = resolveSafeAppUrl(app_url) || APP_URL_ENV || 'http://localhost:5173';
    const state = btoa(JSON.stringify({
      client_id,
      user_id,
      app_url: safeAppUrl,
      timestamp: Date.now(),
      nonce: crypto.randomUUID()
    }));

    // Build Shopify OAuth URL
    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.append('client_id', SHOPIFY_API_KEY);
    authUrl.searchParams.append('scope', SHOPIFY_SCOPES);
    authUrl.searchParams.append('redirect_uri', CALLBACK_URL);
    authUrl.searchParams.append('state', state);

    return new Response(
      JSON.stringify({
        authorization_url: authUrl.toString(),
        state
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Shopify OAuth connect error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to initiate OAuth flow' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
