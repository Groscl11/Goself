const express = require('express');
const router = express.Router();
const { verifyShopifyWebhook, rawBodyParser } = require('../middleware/shopify-hmac');

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || 'your-webhook-secret';

router.post('/orders/paid', rawBodyParser, verifyShopifyWebhook(SHOPIFY_WEBHOOK_SECRET), async (req, res) => {
  console.log('Webhook received: orders/paid');

  res.status(200).json({ success: true });

  try {
    const order = req.body;

    console.log(`Processing order ${order.id} for customer ${order.customer?.id}`);

    const customerPhone = order.customer?.phone || order.billing_address?.phone;
    const customerEmail = order.customer?.email;
    const orderTotal = parseFloat(order.total_price || 0);
    const shopDomain = req.get('X-Shopify-Shop-Domain');

    console.log({
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail,
      customerPhone,
      orderTotal,
      shopDomain
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

    console.log(`Processing refund for order ${order.id}`);

    const customerPhone = order.customer?.phone || order.billing_address?.phone;
    const customerEmail = order.customer?.email;
    const refundAmount = order.refunds?.reduce((sum, refund) => {
      return sum + parseFloat(refund.transactions?.reduce((tSum, t) => tSum + parseFloat(t.amount || 0), 0) || 0);
    }, 0) || 0;
    const shopDomain = req.get('X-Shopify-Shop-Domain');

    console.log({
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail,
      customerPhone,
      refundAmount,
      shopDomain
    });

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

  } catch (error) {
    console.error('Error processing GDPR shop redaction:', error);
  }
});

module.exports = router;
