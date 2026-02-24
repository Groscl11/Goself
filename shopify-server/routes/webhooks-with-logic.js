const express = require('express');
const router = express.Router();
const { verifyShopifyWebhook, rawBodyParser } = require('../middleware/shopify-hmac');
const loyaltyService = require('../services/loyalty-points');
const supabase = require('../services/supabase');

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || 'your-webhook-secret';
const DEFAULT_CLIENT_ID = process.env.DEFAULT_CLIENT_ID;

async function getClientIdByShopDomain(shopDomain) {
  const { data } = await supabase
    .from('integration_configs')
    .select('client_id')
    .eq('platform', 'shopify')
    .eq('shop_domain', shopDomain)
    .eq('is_active', true)
    .maybeSingle();

  return data?.client_id || DEFAULT_CLIENT_ID;
}

router.post('/orders/paid', rawBodyParser, verifyShopifyWebhook(SHOPIFY_WEBHOOK_SECRET), async (req, res) => {
  console.log('Webhook received: orders/paid');

  res.status(200).json({ success: true });

  try {
    const order = req.body;
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const clientId = await getClientIdByShopDomain(shopDomain);

    if (!clientId) {
      console.error('Client not found for shop:', shopDomain);
      return;
    }

    console.log(`Processing order ${order.id} for shop ${shopDomain}`);

    const customerData = {
      email: order.customer?.email,
      phone: order.customer?.phone || order.billing_address?.phone,
      firstName: order.customer?.first_name || order.billing_address?.first_name,
      lastName: order.customer?.last_name || order.billing_address?.last_name,
      shopifyCustomerId: order.customer?.id
    };

    const member = await loyaltyService.findOrCreateMember(clientId, customerData);
    console.log(`Member ID: ${member.id}`);

    const loyaltyProgram = await loyaltyService.getLoyaltyProgram(clientId);

    if (!loyaltyProgram) {
      console.log('No active loyalty program found for client:', clientId);
      return;
    }

    const orderTotal = parseFloat(order.total_price || 0);
    const points = await loyaltyService.calculatePointsForOrder(orderTotal, loyaltyProgram);

    if (points > 0) {
      await loyaltyService.awardPoints(
        member.id,
        points,
        `Order #${order.order_number}`,
        {
          order_id: order.id,
          order_number: order.order_number,
          order_total: orderTotal,
          shop_domain: shopDomain
        }
      );

      console.log(`Awarded ${points} points to member ${member.id}`);
    }

    await supabase.from('shopify_orders').upsert([{
      client_id: clientId,
      member_id: member.id,
      shopify_order_id: order.id.toString(),
      order_number: order.order_number,
      total_price: orderTotal,
      currency: order.currency,
      customer_email: order.customer?.email,
      customer_phone: order.customer?.phone,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      order_data: order,
      synced_at: new Date().toISOString()
    }], {
      onConflict: 'shopify_order_id'
    });

  } catch (error) {
    console.error('Error processing orders/paid webhook:', error);
  }
});

router.post('/orders/refunded', rawBodyParser, verifyShopifyWebhook(SHOPIFY_WEBHOOK_SECRET), async (req, res) => {
  console.log('Webhook received: orders/refunded');

  res.status(200).json({ success: true });

  try {
    const order = req.body;
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const clientId = await getClientIdByShopDomain(shopDomain);

    if (!clientId) {
      console.error('Client not found for shop:', shopDomain);
      return;
    }

    console.log(`Processing refund for order ${order.id}`);

    const { data: orderRecord } = await supabase
      .from('shopify_orders')
      .select('member_id')
      .eq('shopify_order_id', order.id.toString())
      .maybeSingle();

    if (!orderRecord || !orderRecord.member_id) {
      console.error('Order or member not found for refund');
      return;
    }

    const loyaltyProgram = await loyaltyService.getLoyaltyProgram(clientId);

    if (!loyaltyProgram) {
      console.log('No active loyalty program found');
      return;
    }

    const refundAmount = order.refunds?.reduce((sum, refund) => {
      return sum + parseFloat(refund.transactions?.reduce((tSum, t) => tSum + parseFloat(t.amount || 0), 0) || 0);
    }, 0) || 0;

    const pointsToDeduct = await loyaltyService.calculatePointsForOrder(refundAmount, loyaltyProgram);

    if (pointsToDeduct > 0) {
      await loyaltyService.deductPoints(
        orderRecord.member_id,
        pointsToDeduct,
        `Refund for Order #${order.order_number}`,
        {
          order_id: order.id,
          order_number: order.order_number,
          refund_amount: refundAmount,
          shop_domain: shopDomain
        }
      );

      console.log(`Deducted ${pointsToDeduct} points from member ${orderRecord.member_id}`);
    }

  } catch (error) {
    console.error('Error processing orders/refunded webhook:', error);
  }
});

router.post('/app/uninstalled', rawBodyParser, verifyShopifyWebhook(SHOPIFY_WEBHOOK_SECRET), async (req, res) => {
  console.log('Webhook received: app/uninstalled');

  res.status(200).json({ success: true });

  try {
    const shop = req.body;
    const shopDomain = shop.domain || req.get('X-Shopify-Shop-Domain');

    console.log(`App uninstalled from shop: ${shopDomain}`);

    await supabase
      .from('integration_configs')
      .update({ is_active: false, uninstalled_at: new Date().toISOString() })
      .eq('platform', 'shopify')
      .eq('shop_domain', shopDomain);

  } catch (error) {
    console.error('Error processing app/uninstalled webhook:', error);
  }
});

router.post('/gdpr/customer_data_request', rawBodyParser, verifyShopifyWebhook(SHOPIFY_WEBHOOK_SECRET), async (req, res) => {
  console.log('Webhook received: gdpr/customer_data_request');

  res.status(200).json({ success: true });

  try {
    const data = req.body;
    const shopDomain = data.shop_domain;
    const customerId = data.customer?.id;
    const customerEmail = data.customer?.email;

    console.log(`GDPR data request for customer ${customerId} from shop ${shopDomain}`);

    const clientId = await getClientIdByShopDomain(shopDomain);

    if (!clientId) {
      console.error('Client not found for shop:', shopDomain);
      return;
    }

    const { data: memberData } = await supabase
      .from('member_users')
      .select('*, loyalty_points_transactions(*)')
      .eq('client_id', clientId)
      .eq('email', customerEmail)
      .maybeSingle();

    console.log('Customer data:', JSON.stringify(memberData, null, 2));

  } catch (error) {
    console.error('Error processing GDPR data request:', error);
  }
});

router.post('/gdpr/customer_redact', rawBodyParser, verifyShopifyWebhook(SHOPIFY_WEBHOOK_SECRET), async (req, res) => {
  console.log('Webhook received: gdpr/customer_redact');

  res.status(200).json({ success: true });

  try {
    const data = req.body;
    const shopDomain = data.shop_domain;
    const customerId = data.customer?.id;
    const customerEmail = data.customer?.email;

    console.log(`GDPR customer redaction for customer ${customerId} from shop ${shopDomain}`);

    const clientId = await getClientIdByShopDomain(shopDomain);

    if (!clientId) {
      console.error('Client not found for shop:', shopDomain);
      return;
    }

    await supabase
      .from('member_users')
      .update({
        email: null,
        phone: null,
        first_name: 'REDACTED',
        last_name: 'REDACTED',
        metadata: { redacted: true, redacted_at: new Date().toISOString() }
      })
      .eq('client_id', clientId)
      .eq('email', customerEmail);

    console.log('Customer data redacted');

  } catch (error) {
    console.error('Error processing GDPR customer redaction:', error);
  }
});

router.post('/gdpr/shop_redact', rawBodyParser, verifyShopifyWebhook(SHOPIFY_WEBHOOK_SECRET), async (req, res) => {
  console.log('Webhook received: gdpr/shop_redact');

  res.status(200).json({ success: true });

  try {
    const data = req.body;
    const shopDomain = data.shop_domain;

    console.log(`GDPR shop redaction for shop ${shopDomain}`);

    const clientId = await getClientIdByShopDomain(shopDomain);

    if (!clientId) {
      console.error('Client not found for shop:', shopDomain);
      return;
    }

    await supabase
      .from('integration_configs')
      .delete()
      .eq('platform', 'shopify')
      .eq('shop_domain', shopDomain);

    console.log('Shop data redacted');

  } catch (error) {
    console.error('Error processing GDPR shop redaction:', error);
  }
});

module.exports = router;
