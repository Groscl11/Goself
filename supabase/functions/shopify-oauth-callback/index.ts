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

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.origin;
    } catch (e) {
      // Invalid referer
    }
  }

  // Default to Supabase URL for production
  return Deno.env.get('SUPABASE_URL') || 'http://localhost:5173';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop');
    const state = url.searchParams.get('state');

    if (!code || !shop) {
      return new Response('Missing required parameters', { status: 400 });
    }

    console.log(`OAuth callback received from ${shop}`);

    // Decode state (optional - may contain client_id if re-installing)
    let stateData: any = {};
    if (state) {
      try {
        stateData = JSON.parse(atob(state));
      } catch (e) {
        console.warn('Invalid state parameter:', e);
      }
    }

    const APP_URL = stateData.app_url || getAppUrl(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API credentials from environment (for now - later can be per-install)
    const SHOPIFY_API_KEY = Deno.env.get('SHOPIFY_API_KEY');
    const SHOPIFY_API_SECRET = Deno.env.get('SHOPIFY_API_SECRET');

    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      console.error('Missing Shopify API credentials');
      return new Response(null, {
        status: 302,
        headers: { 'Location': `${APP_URL}/client/integrations?error=missing_credentials` }
      });
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scopes = tokenData.scope ? tokenData.scope.split(',').map((s: string) => s.trim()) : [];

    console.log(`Token exchange successful for ${shop}`);

    // Fetch shop details from Shopify
    const shopDetails = await fetchShopDetails(shop, accessToken);
    console.log(`Shop details fetched:`, shopDetails);

    // Auto-create or get client
    let clientId = stateData.client_id;

    if (!clientId) {
      // Check if client exists for this shop
      const { data: existingInstallation } = await supabase
        .from('store_installations')
        .select('client_id')
        .eq('shop_domain', shop)
        .maybeSingle();

      if (existingInstallation) {
        clientId = existingInstallation.client_id;
      } else {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: shopDetails.name || shop.replace('.myshopify.com', ''),
            email: shopDetails.email || `${shop.split('.')[0]}@shopify.com`,
            phone: shopDetails.phone || null,
            company_name: shopDetails.name,
            status: 'active',
            metadata: {
              source: 'shopify_auto_install',
              shop_domain: shop,
              shop_id: shopDetails.id
            }
          })
          .select('id')
          .single();

        if (clientError) {
          console.error('Error creating client:', clientError);
          throw clientError;
        }

        clientId = newClient.id;
        console.log(`New client created: ${clientId}`);
      }
    }

    // Create or update store installation
    const { data: storeInstallation, error: installError } = await supabase
      .from('store_installations')
      .upsert({
        client_id: clientId,
        shop_domain: shop,
        shop_id: shopDetails.id?.toString(),
        shop_name: shopDetails.name,
        shop_email: shopDetails.email,
        shop_owner: shopDetails.shop_owner,
        shop_phone: shopDetails.phone,
        shop_country: shopDetails.country_code || shopDetails.country_name,
        shop_currency: shopDetails.currency,
        shop_plan: shopDetails.plan_name || shopDetails.plan_display_name,

        installation_status: 'active',
        installed_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),

        access_token: accessToken,
        api_version: '2024-01',
        scopes: scopes,

        webhooks_registered: false,

        billing_plan: 'free',
        billing_status: 'active',

        installation_metadata: {
          shopify_plus: shopDetails.shopify_plus || false,
          domain: shopDetails.domain,
          myshopify_domain: shopDetails.myshopify_domain,
          timezone: shopDetails.timezone,
          iana_timezone: shopDetails.iana_timezone
        },

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
    console.log(`Store installation created/updated: ${storeInstallationId}`);

    // Create/update integration_configs for backward compatibility
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

    // Register webhooks and track them
    await registerAndTrackWebhooks(shop, accessToken, storeInstallationId, clientId, supabase);

    // Install default plugins
    await installDefaultPlugins(storeInstallationId, clientId, supabase);

    // Create master admin user (if email is available)
    if (shopDetails.email) {
      await createMasterAdmin(storeInstallationId, clientId, shopDetails, supabase);
    }

    console.log(`Auto-registration complete for ${shop}`);

    // Redirect to embedded app interface edge function
    const redirectUrl = `${supabaseUrl}/functions/v1/shopify-app?shop=${shop}&client_id=${clientId}&status=success`;
    return new Response(null, {
      status: 302,
      headers: { 'Location': redirectUrl }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    const fallbackUrl = getAppUrl(req);
    const errorUrl = `${fallbackUrl}/client/integrations?error=oauth_failed&message=${encodeURIComponent(error.message)}`;
    return new Response(null, {
      status: 302,
      headers: { 'Location': errorUrl }
    });
  }
});

async function fetchShopDetails(shop: string, accessToken: string) {
  try {
    const response = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.shop || {};
    }
  } catch (error) {
    console.error('Error fetching shop details:', error);
  }

  return {
    name: shop.replace('.myshopify.com', ''),
    domain: shop
  };
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
      const response = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
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
