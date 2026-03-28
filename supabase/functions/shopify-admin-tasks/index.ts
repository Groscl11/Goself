/**
 * shopify-admin-tasks — Internal admin utility endpoint
 *
 * Protected by service role key (Bearer token).
 * Used for one-off operational tasks like re-registering webhooks for existing stores.
 *
 * POST /functions/v1/shopify-admin-tasks
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 * Body: { action: 'reregister_webhooks', shop_domain?: string }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WEBHOOK_TOPICS = [
  'orders/create',
  'orders/updated',
  'orders/paid',
  'customers/create',
  'customers/update',
  'app/uninstalled',
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Require service role key as Bearer token
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const shopDomainFilter: string | null = body.shop_domain || null;

    if (action !== 'reregister_webhooks') {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/shopify-webhook?apikey=${anonKey}`;

    // Fetch active stores (optionally filtered by shop_domain)
    let query = supabase
      .from('store_installations')
      .select('id, shop_domain, client_id, access_token, shopify_api_secret')
      .eq('installation_status', 'active');

    if (shopDomainFilter) {
      query = query.eq('shop_domain', shopDomainFilter);
    }

    const { data: stores, error: storesError } = await query;
    if (storesError) throw storesError;
    if (!stores || stores.length === 0) {
      return new Response(JSON.stringify({ error: 'No active stores found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const store of stores) {
      const shopDomain = store.shop_domain;
      const accessToken = store.access_token;

      if (!accessToken) {
        results.push({ shop: shopDomain, success: false, error: 'No access token' });
        continue;
      }

      // Ensure integration_configs row exists with correct secret
      await supabase.from('integration_configs').upsert({
        client_id: store.client_id,
        platform: 'shopify',
        platform_name: shopDomain,
        shop_domain: shopDomain,
        shopify_access_token: accessToken,
        access_token: accessToken,
        shopify_api_secret: store.shopify_api_secret ?? Deno.env.get('SHOPIFY_API_SECRET'),
        status: 'connected',
        is_active: true,
        installed_at: new Date().toISOString(),
        webhooks_registered: false,
        webhook_url: webhookUrl,
        sync_frequency_minutes: 0,
        credentials: {}
      }, {
        onConflict: 'client_id,platform,shop_domain',
        ignoreDuplicates: false
      });

      // First: delete existing webhooks at Shopify to avoid duplicates
      try {
        const listRes = await fetch(
          `https://${shopDomain}/admin/api/2025-01/webhooks.json?limit=50`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          for (const wh of (listData.webhooks || [])) {
            if (wh.address === webhookUrl) {
              await fetch(
                `https://${shopDomain}/admin/api/2025-01/webhooks/${wh.id}.json`,
                { method: 'DELETE', headers: { 'X-Shopify-Access-Token': accessToken } }
              );
              console.log(`Deleted old webhook ${wh.id} (${wh.topic}) for ${shopDomain}`);
            }
          }
        }
      } catch (e) {
        console.warn(`Could not clean old webhooks for ${shopDomain}:`, e);
      }

      // Register fresh webhooks
      let successCount = 0;
      const topicResults: Array<Record<string, unknown>> = [];

      for (const topic of WEBHOOK_TOPICS) {
        try {
          const res = await fetch(
            `https://${shopDomain}/admin/api/2025-01/webhooks.json`,
            {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ webhook: { topic, address: webhookUrl, format: 'json' } }),
            }
          );
          const data = await res.json();
          if (res.ok && data.webhook) {
            // Track in store_webhooks
            await supabase.from('store_webhooks').upsert({
              store_installation_id: store.id,
              client_id: store.client_id,
              webhook_topic: topic,
              shopify_webhook_id: data.webhook.id.toString(),
              webhook_address: webhookUrl,
              status: 'active',
              registered_at: new Date().toISOString(),
            }, {
              onConflict: 'store_installation_id,webhook_topic',
              ignoreDuplicates: false,
            });
            successCount++;
            topicResults.push({ topic, success: true, id: data.webhook.id });
          } else {
            topicResults.push({ topic, success: false, error: data });
          }
        } catch (e: any) {
          topicResults.push({ topic, success: false, error: e.message });
        }
      }

      // Update store_installations webhook status
      await supabase
        .from('store_installations')
        .update({
          webhooks_registered: successCount > 0,
          webhooks_registered_at: new Date().toISOString(),
          webhook_health_status: successCount === WEBHOOK_TOPICS.length ? 'healthy' : 'degraded',
        })
        .eq('id', store.id);

      results.push({
        shop: shopDomain,
        success: successCount === WEBHOOK_TOPICS.length,
        webhooks_registered: successCount,
        total: WEBHOOK_TOPICS.length,
        topics: topicResults,
      });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('shopify-admin-tasks error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
