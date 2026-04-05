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

  // Require service role key OR ADMIN_TASKS_SECRET as Bearer token
  const adminTasksSecret = Deno.env.get('ADMIN_TASKS_SECRET');
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  const isAuthorized = token === serviceRoleKey || (adminTasksSecret && token === adminTasksSecret);
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const shopDomainFilter: string | null = body.shop_domain || null;

    if (!['reregister_webhooks', 'sync_secrets', 'backfill_orders'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/shopify-webhook?apikey=${anonKey}`;

    // ── sync_secrets: update shopify_api_secret in store_installations to current env var ──
    if (action === 'sync_secrets') {
      const currentSecret = Deno.env.get('SHOPIFY_API_SECRET');
      if (!currentSecret) {
        return new Response(JSON.stringify({ error: 'SHOPIFY_API_SECRET env var not set' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let updateQuery = supabase
        .from('store_installations')
        .update({ shopify_api_secret: currentSecret })
        .eq('installation_status', 'active');
      if (shopDomainFilter) updateQuery = updateQuery.eq('shop_domain', shopDomainFilter);
      const { error: updateErr, count } = await updateQuery;
      if (updateErr) throw updateErr;
      return new Response(JSON.stringify({ success: true, updated_rows: count }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── backfill_orders: fetch recent orders from Shopify and insert into shopify_orders ──
    if (action === 'backfill_orders') {
      const orderIds: string[] = body.order_ids || [];
      const limit: number = body.limit || 20;

      let fetchAllStores = supabase
        .from('store_installations')
        .select('id, shop_domain, client_id, access_token')
        .eq('installation_status', 'active');
      if (shopDomainFilter) fetchAllStores = fetchAllStores.eq('shop_domain', shopDomainFilter);
      const { data: stores, error: storesErr } = await fetchAllStores;
      if (storesErr) throw storesErr;

      const backfillResults: Array<Record<string, unknown>> = [];
      for (const store of (stores || [])) {
        const accessToken = store.access_token;
        if (!accessToken) {
          backfillResults.push({ shop: store.shop_domain, error: 'No access token' });
          continue;
        }

        // Build Shopify orders query URL
        let ordersUrl = `https://${store.shop_domain}/admin/api/2025-01/orders.json?status=any&limit=${limit}&order=created_at+desc`;
        if (orderIds.length > 0) {
          ordersUrl = `https://${store.shop_domain}/admin/api/2025-01/orders.json?ids=${orderIds.join(',')}&status=any`;
        }

        const ordersRes = await fetch(ordersUrl, {
          headers: { 'X-Shopify-Access-Token': accessToken },
        });
        if (!ordersRes.ok) {
          backfillResults.push({ shop: store.shop_domain, error: `Shopify API ${ordersRes.status}` });
          continue;
        }
        const ordersData = await ordersRes.json();
        const orders = ordersData.orders || [];

        let upserted = 0;
        for (const order of orders) {
          let paymentMethod = 'unknown';
          if (order.gateway) {
            paymentMethod = order.gateway.toLowerCase();
          } else if (order.payment_gateway_names?.length > 0) {
            paymentMethod = order.payment_gateway_names[0].toLowerCase();
          }
          if (paymentMethod.includes('cod') || paymentMethod.includes('cash on delivery')) {
            paymentMethod = 'cod';
          } else if (paymentMethod.includes('prepaid') || order.financial_status === 'paid') {
            paymentMethod = 'prepaid';
          }

          const orderRecord = {
            client_id: store.client_id,
            order_id: order.id.toString(),
            order_number: order.order_number || order.name,
            customer_email: order.email ?? order.customer?.email ?? null,
            customer_phone: order.phone ?? order.customer?.phone ?? null,
            total_price: parseFloat(order.total_price || '0'),
            currency: order.currency || 'USD',
            payment_method: paymentMethod,
            order_status: order.fulfillment_status || 'pending',
            financial_status: order.financial_status,
            fulfillment_status: order.fulfillment_status,
            order_data: order,
            processed_at: new Date().toISOString(),
          };

          const { error: upsertErr } = await supabase.from('shopify_orders').upsert(orderRecord, {
            onConflict: 'client_id,order_id',
            ignoreDuplicates: false,
          });
          if (!upsertErr) upserted++;
          else console.error(`Upsert failed for order ${order.id}:`, upsertErr.message);
        }
        backfillResults.push({ shop: store.shop_domain, fetched: orders.length, upserted });
      }

      return new Response(JSON.stringify({ results: backfillResults }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── reregister_webhooks: delete and re-register all webhook topics ──

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
