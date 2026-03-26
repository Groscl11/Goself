/**
 * Shopify OAuth Callback Endpoint - Auto-Registration System
 *
 * When a store installs the app, this automatically:
 * 1. Creates a client profile
 * 2. Registers store installation with full details
 * 3. Registers all required webhooks
 * 4. Creates default master admin user
 * 5. Installs default plugins (loyalty, rewards, etc.)
 * 6. Initializes store configuration
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WEBHOOK_TOPICS = [
  'orders/create',
  'orders/updated',
  'orders/paid',
  'customers/create',
  'customers/update'
];

const DEFAULT_PLUGINS = [
  { type: 'loyalty', name: 'Loyalty Points System', version: '1.0.0' },
  { type: 'rewards', name: 'Rewards Program', version: '1.0.0' },
  { type: 'referral', name: 'Referral Program', version: '1.0.0' },
  { type: 'campaigns', name: 'Campaign Management', version: '1.0.0' },
];

function getAppUrl(req: Request): string {
  const envUrl = Deno.env.get('APP_URL');
  if (envUrl) return envUrl;
  return Deno.env.get('SUPABASE_URL') || 'http://localhost:5173';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const shop = url.searchParams.get('shop');
  const state = url.searchParams.get('state');
  const dashboardUrl = Deno.env.get('DASHBOARD_URL') || 'https://goself.netlify.app';

  if (!code || !shop) {
    return new Response('Missing required parameters', { status: 400 });
  }

  // Verify Shopify HMAC signature to ensure the request is authentic
  const shopifySecret = Deno.env.get('SHOPIFY_API_SECRET');
  if (shopifySecret) {
    const hmacValid = await verifyShopifyHmac(url, shopifySecret);
    if (!hmacValid) {
      console.error('HMAC verification failed — rejecting request from', shop);
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    console.warn('SHOPIFY_API_SECRET not set — skipping HMAC verification');
  }

  console.log(`OAuth callback received from ${shop}`);

  try {
    // Decode state (optional - may contain client_id if re-installing)
    let stateData: any = {};
    if (state) {
      try {
        stateData = JSON.parse(atob(state));
      } catch (e) {
        console.warn('Invalid state parameter:', e);
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const SHOPIFY_API_KEY = Deno.env.get('SHOPIFY_API_KEY');
    const SHOPIFY_API_SECRET = Deno.env.get('SHOPIFY_API_SECRET');

    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      console.error('Missing Shopify API credentials');
      return new Response(null, {
        status: 302,
        headers: { 'Location': `${dashboardUrl}/?shop=${shop}&error=missing_credentials` }
      });
    }

    // ── STEP 1: Exchange code for access token (with 8s timeout) ──
    const tokenController = new AbortController();
    const tokenTimeout = setTimeout(() => tokenController.abort(), 8000);
    let accessToken: string;
    let scopes: string[];
    try {
      const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: SHOPIFY_API_KEY, client_secret: SHOPIFY_API_SECRET, code }),
        signal: tokenController.signal,
      });
      clearTimeout(tokenTimeout);

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${errText}`);
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
      scopes = tokenData.scope ? tokenData.scope.split(',').map((s: string) => s.trim()) : [];
      console.log(`Token exchange successful for ${shop}`);
    } catch (err) {
      clearTimeout(tokenTimeout);
      throw err;
    }

    // ── STEP 2: Get or create client (DB only — no Shopify API call) ──
    const storeName = shop.replace('.myshopify.com', '');
    const fallbackEmail = `${storeName}@shopify.com`;
    let clientId = stateData.client_id;

    if (!clientId) {
      // Check if installation already exists
      const { data: existingInstallation } = await supabase
        .from('store_installations')
        .select('client_id, shop_email')
        .eq('shop_domain', shop)
        .maybeSingle();

      if (existingInstallation) {
        clientId = existingInstallation.client_id;
        console.log(`Reusing existing client: ${clientId}`);
      } else {
        // SELECT first — avoids ON CONFLICT requiring a unique constraint to pre-exist
        const { data: existingByEmail } = await supabase
          .from('clients')
          .select('id')
          .eq('contact_email', fallbackEmail)
          .maybeSingle();

        if (existingByEmail) {
          clientId = existingByEmail.id;
          console.log(`Found existing client by email: ${clientId}`);
        } else {
          const { data: newClient, error: insertError } = await supabase
            .from('clients')
            .insert({
              name: storeName,
              description: `Shopify store: ${shop}`,
              contact_email: fallbackEmail,
              primary_color: '#3b82f6',
              is_active: true
            })
            .select('id')
            .single();

          if (insertError) {
            // Race condition: a concurrent install inserted first — retry SELECT
            const { data: raceClient } = await supabase
              .from('clients')
              .select('id')
              .eq('contact_email', fallbackEmail)
              .maybeSingle();
            if (raceClient) {
              clientId = raceClient.id;
              console.log(`Client found after race: ${clientId}`);
            } else {
              throw insertError;
            }
          } else {
            clientId = newClient.id;
            console.log(`Client created: ${clientId}`);
          }
        }
      }
    }

    // ── STEP 3: Upsert store_installation IMMEDIATELY (minimal data) ──
    // Critical: do this before any more Shopify API calls so record exists even if later calls fail
    const { data: storeInstallation, error: installError } = await supabase
      .from('store_installations')
      .upsert({
        client_id: clientId,
        shop_domain: shop,
        myshopify_domain: shop,
        shop_name: storeName,
        shop_email: fallbackEmail,

        installation_status: 'active',
        installed_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),

        access_token: accessToken,
        shopify_access_token: accessToken,
        shopify_api_secret: Deno.env.get('SHOPIFY_API_SECRET'),
        api_version: '2025-01',
        scopes: scopes,

        webhooks_registered: false,
        billing_plan: 'free',
        billing_status: 'active',

        app_settings: {
          auto_create_members: true,
          auto_assign_rewards: true,
          email_notifications: true
        }
      }, {
        onConflict: 'shop_domain',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (installError) {
      console.error('Error creating store installation:', installError);
      throw installError;
    }

    const storeInstallationId = storeInstallation.id;
    console.log(`Store installation saved: ${storeInstallationId}`);

    // ── STEP 4: Redirect to ShopifyLanding immediately ──
    // Background tasks (shop details, webhooks, plugins) run after redirect via EdgeRuntime.waitUntil
    const redirectUrl = `${dashboardUrl}/?shop=${shop}`;
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { 'Location': redirectUrl }
    });

    // ── STEP 5: Background enrichment (non-blocking) ──
    const backgroundWork = (async () => {
      try {
        console.log(`Background: fetching shop details for ${shop}`);
        const shopDetails = await fetchShopDetailsWithTimeout(shop, accessToken, 5000);

        if (shopDetails) {
          const realEmail = shopDetails.email || fallbackEmail;

          // If we got a real email, check whether an existing client already has it.
          // This handles the case where a client was created manually (e.g. "MediBuddy"
          // with groscl.ltd@gmail.com) before the Shopify install — we want the
          // store_installation to point to that real client, not a fake-email orphan.
          let resolvedClientId = clientId;
          if (realEmail !== fallbackEmail) {
            const { data: realClient } = await supabase
              .from('clients')
              .select('id')
              .eq('contact_email', realEmail)
              .maybeSingle();
            if (realClient && realClient.id !== clientId) {
              resolvedClientId = realClient.id;
              console.log(`Background: re-linking store_installation to real client ${resolvedClientId} (email: ${realEmail})`);
            }
          }

          // Update installation with full shop details + correct client_id + real email
          await supabase
            .from('store_installations')
            .update({
              client_id: resolvedClientId,
              shop_id: shopDetails.id?.toString(),
              shop_name: shopDetails.name || storeName,
              shop_email: realEmail,
              shop_owner: shopDetails.shop_owner,
              shop_phone: shopDetails.phone,
              shop_country: shopDetails.country_code || shopDetails.country_name,
              shop_currency: shopDetails.currency,
              shop_plan: shopDetails.plan_name || shopDetails.plan_display_name,
              installation_metadata: {
                shopify_plus: shopDetails.shopify_plus || false,
                domain: shopDetails.domain,
                myshopify_domain: shopDetails.myshopify_domain,
                timezone: shopDetails.timezone,
                iana_timezone: shopDetails.iana_timezone
              }
            })
            .eq('id', storeInstallationId);

          clientId = resolvedClientId; // use resolved id for subsequent steps
          console.log(`Background: store_installation enriched for ${shop}, email=${realEmail}`);

          // Create master admin if we have a real email
          if (realEmail !== fallbackEmail) {
            await createMasterAdmin(storeInstallationId, resolvedClientId, shopDetails, supabase);
          }
        }

        // integration_configs backward compat
        await supabase
          .from('integration_configs')
          .upsert({
            client_id: clientId,
            platform: 'shopify',
            platform_name: shop,
            shop_domain: shop,
            shopify_access_token: accessToken,
            access_token: accessToken,
            scopes: scopes,
            status: 'connected',
            is_active: true,
            installed_at: new Date().toISOString(),
            webhooks_registered: false,
            webhook_url: `${supabaseUrl}/functions/v1/shopify-webhook`,
            sync_frequency_minutes: 0,
            credentials: {}
          }, {
            onConflict: 'client_id,platform,shop_domain',
            ignoreDuplicates: false
          });

        // Register webhooks and install plugins
        await registerAndTrackWebhooks(shop, accessToken, storeInstallationId, clientId, supabase);
        await installDefaultPlugins(storeInstallationId, clientId, supabase);

        console.log(`Background: setup complete for ${shop}`);
      } catch (bgErr) {
        console.error(`Background setup error for ${shop}:`, bgErr);
      }
    })();

    // Use EdgeRuntime.waitUntil if available, otherwise just let it run
    try {
      (globalThis as any).EdgeRuntime?.waitUntil(backgroundWork);
    } catch (_) {
      // Not available — background promise runs but may be cut short when response completes
    }

    console.log(`OAuth complete, redirecting to: ${redirectUrl}`);
    return redirectResponse;

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    // Redirect to ShopifyLanding with error — NOT to a ProtectedRoute page
    const errorUrl = `${dashboardUrl}/?shop=${shop}&error=oauth_failed&message=${encodeURIComponent(error?.message || 'Unknown error')}`;
    return new Response(null, {
      status: 302,
      headers: { 'Location': errorUrl }
    });
  }
});

async function fetchShopDetailsWithTimeout(shop: string, accessToken: string, timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`https://${shop}/admin/api/2025-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      return data.shop || {};
    } else {
      console.warn(`Failed to fetch shop details: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching shop details:', error);
    return null;
  }
}

async function registerAndTrackWebhooks(
  shop: string,
  accessToken: string,
  storeInstallationId: string,
  clientId: string,
  supabase: any
) {
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-webhook`;
  console.log(`Registering webhooks for ${shop}`);

  let successCount = 0;

  for (const topic of WEBHOOK_TOPICS) {
    try {
      const response = await fetch(`https://${shop}/admin/api/2025-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookUrl,
            format: 'json'
          }
        })
      });

      const responseData = await response.json();

      if (response.ok && responseData.webhook) {
        console.log(`Webhook registered: ${topic} (ID: ${responseData.webhook.id})`);

        // Track webhook in database
        await supabase
          .from('store_webhooks')
          .upsert({
            store_installation_id: storeInstallationId,
            client_id: clientId,
            webhook_topic: topic,
            shopify_webhook_id: responseData.webhook.id.toString(),
            webhook_address: webhookUrl,
            status: 'active',
            registered_at: new Date().toISOString()
          }, {
            onConflict: 'store_installation_id,webhook_topic',
            ignoreDuplicates: false
          });

        successCount++;
      } else {
        console.error(`Failed to register webhook ${topic}:`, responseData);

        // Track failed webhook
        await supabase
          .from('store_webhooks')
          .upsert({
            store_installation_id: storeInstallationId,
            client_id: clientId,
            webhook_topic: topic,
            webhook_address: webhookUrl,
            status: 'failed',
            last_error: JSON.stringify(responseData),
            error_details: responseData
          }, {
            onConflict: 'store_installation_id,webhook_topic',
            ignoreDuplicates: false
          });
      }
    } catch (error) {
      console.error(`Exception registering webhook ${topic}:`, error);
    }
  }

  // Update store installation webhook status
  await supabase
    .from('store_installations')
    .update({
      webhooks_registered: successCount > 0,
      webhooks_registered_at: new Date().toISOString(),
      webhook_health_status: successCount === WEBHOOK_TOPICS.length ? 'healthy' : 'degraded'
    })
    .eq('id', storeInstallationId);

  // Update integration_configs for backward compatibility
  await supabase
    .from('integration_configs')
    .update({
      webhooks_registered: successCount > 0
    })
    .eq('client_id', clientId)
    .eq('shop_domain', shop);

  console.log(`Webhooks registered: ${successCount}/${WEBHOOK_TOPICS.length}`);
}

async function installDefaultPlugins(
  storeInstallationId: string,
  clientId: string,
  supabase: any
) {
  console.log('Installing default plugins');

  const pluginInserts = DEFAULT_PLUGINS.map(plugin => ({
    store_installation_id: storeInstallationId,
    client_id: clientId,
    plugin_type: plugin.type,
    plugin_name: plugin.name,
    plugin_version: plugin.version,
    status: 'active',
    installed_at: new Date().toISOString(),
    plugin_config: {},
    feature_flags: {}
  }));

  const { error } = await supabase
    .from('store_plugins')
    .upsert(pluginInserts, {
      onConflict: 'store_installation_id,plugin_type',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error installing plugins:', error);
  } else {
    console.log(`Installed ${pluginInserts.length} default plugins`);
  }
}

async function verifyShopifyHmac(url: URL, secret: string): Promise<boolean> {
  const hmac = url.searchParams.get('hmac');
  if (!hmac) return false;

  const sortedParams = Array.from(url.searchParams.entries())
    .filter(([key]) => key !== 'hmac')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(sortedParams));
  const computed = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computed === hmac;
}

async function createMasterAdmin(
  storeInstallationId: string,
  clientId: string,
  shopDetails: any,
  supabase: any
) {
  console.log('Creating master admin user');

  const { error } = await supabase
    .from('store_users')
    .upsert({
      store_installation_id: storeInstallationId,
      client_id: clientId,
      email: shopDetails.email,
      full_name: shopDetails.shop_owner || shopDetails.name,
      phone: shopDetails.phone,
      role: 'master_admin',
      status: 'active',
      permissions: {
        full_access: true,
        can_manage_users: true,
        can_manage_plugins: true,
        can_view_analytics: true,
        can_manage_webhooks: true
      },
      invited_at: new Date().toISOString(),
      activated_at: new Date().toISOString()
    }, {
      onConflict: 'store_installation_id,email',
      ignoreDuplicates: true
    });

  if (error) {
    console.error('Error creating master admin:', error);
  } else {
    console.log(`Master admin created: ${shopDetails.email}`);
  }
}
