/**
 * Manual Webhook Registration Endpoint
 * Allows manual registration of Shopify webhooks for debugging
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { shop, access_token } = await req.json();

    if (!shop || !access_token) {
      return new Response(
        JSON.stringify({ error: 'Missing shop or access_token' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-webhook`;
    const gdprUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-gdpr`;

    // Operational webhooks → shopify-webhook handler
    const webhookTopics = [
      'orders/create',
      'orders/paid',
      'customers/create',
      'customers/update',
      'app/uninstalled',
    ];

    // GDPR mandatory compliance webhooks → shopify-gdpr handler
    const gdprTopics = [
      'customers/data_request',
      'customers/redact',
      'shop/redact',
    ];

    console.log(`Starting webhook registration for ${shop}`, { webhookUrl });

    const results = [];
    const webhookIds = [];

    for (const topic of webhookTopics) {
      try {
        console.log(`Registering webhook: ${topic}`);
        const response = await fetch(`https://${shop}/admin/api/2024-10/webhooks.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': access_token,
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

        if (response.ok) {
          console.log(`Webhook registered successfully: ${topic}`, responseData.webhook?.id);
          results.push({
            topic,
            success: true,
            id: responseData.webhook.id,
            address: webhookUrl
          });
          webhookIds.push({
            topic,
            id: responseData.webhook.id,
            address: webhookUrl
          });
        } else {
          console.error(`Failed to register webhook ${topic}:`, {
            status: response.status,
            statusText: response.statusText,
            error: responseData
          });
          results.push({
            topic,
            success: false,
            status: response.status,
            error: responseData
          });
        }
      } catch (error) {
        console.error(`Exception while registering webhook ${topic}:`, error);
        results.push({
          topic,
          success: false,
          error: error.message
        });
      }
    }

    // Register the three mandatory GDPR webhooks with the dedicated GDPR handler
    for (const topic of gdprTopics) {
      try {
        console.log(`Registering GDPR webhook: ${topic}`);
        const response = await fetch(`https://${shop}/admin/api/2024-10/webhooks.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': access_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: gdprUrl,
              format: 'json'
            }
          })
        });

        const responseData = await response.json();

        if (response.ok) {
          console.log(`GDPR webhook registered: ${topic}`, responseData.webhook?.id);
          results.push({
            topic,
            success: true,
            id: responseData.webhook.id,
            address: gdprUrl
          });
          webhookIds.push({
            topic,
            id: responseData.webhook.id,
            address: gdprUrl
          });
        } else {
          console.error(`Failed to register GDPR webhook ${topic}:`, responseData);
          results.push({
            topic,
            success: false,
            status: response.status,
            error: responseData
          });
        }
      } catch (error) {
        console.error(`Exception registering GDPR webhook ${topic}:`, error);
        results.push({ topic, success: false, error: error.message });
      }
    }

    const allTopics = [...webhookTopics, ...gdprTopics];
    console.log(`Webhook registration complete. Registered ${webhookIds.length} of ${allTopics.length} webhooks`);

    return new Response(
      JSON.stringify({
        success: webhookIds.length > 0,
        registered: webhookIds.length,
        total: allTopics.length,
        webhooks: webhookIds,
        details: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Webhook registration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});