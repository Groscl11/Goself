const express = require('express');
const router = express.Router();
const { verifyShopifyProxy } = require('../middleware/shopify-hmac');

const SHOPIFY_PROXY_SECRET = process.env.SHOPIFY_PROXY_SECRET || 'your-proxy-secret';

router.get('/points', verifyShopifyProxy(SHOPIFY_PROXY_SECRET), async (req, res) => {
  console.log('Proxy request: GET /points');

  try {
    const customerId = req.query.logged_in_customer_id;
    const customerEmail = req.query.customer_email;
    const shopDomain = req.query.shop;

    if (!customerId) {
      return res.status(200).json({
        success: false,
        error: 'Not logged in',
        points: 0,
        tier: null
      });
    }

    console.log(`Fetching points for customer ${customerId} from shop ${shopDomain}`);

    const points = 0;
    const tier = null;
    const nextTier = null;
    const pointsToNextTier = 0;

    return res.status(200).json({
      success: true,
      customerId,
      points,
      tier,
      nextTier,
      pointsToNextTier,
      history: []
    });

  } catch (error) {
    console.error('Error fetching points:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch points'
    });
  }
});

router.post('/redeem', express.json(), verifyShopifyProxy(SHOPIFY_PROXY_SECRET), async (req, res) => {
  console.log('Proxy request: POST /redeem');

  try {
    const customerId = req.query.logged_in_customer_id;
    const customerEmail = req.query.customer_email;
    const shopDomain = req.query.shop;
    const { points, rewardId } = req.body;

    if (!customerId) {
      return res.status(200).json({
        success: false,
        error: 'Not logged in'
      });
    }

    if (!points || points <= 0) {
      return res.status(200).json({
        success: false,
        error: 'Invalid points amount'
      });
    }

    console.log(`Redeeming ${points} points for customer ${customerId} from shop ${shopDomain}`);

    const discountCode = null;
    const discountValue = 0;
    const discountType = 'percentage';

    return res.status(200).json({
      success: true,
      message: 'Points redeemed successfully',
      discountCode,
      discountValue,
      discountType,
      pointsRedeemed: points,
      remainingPoints: 0
    });

  } catch (error) {
    console.error('Error redeeming points:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to redeem points'
    });
  }
});

router.get('/referral', verifyShopifyProxy(SHOPIFY_PROXY_SECRET), async (req, res) => {
  console.log('Proxy request: GET /referral');

  try {
    const customerId = req.query.logged_in_customer_id;
    const customerEmail = req.query.customer_email;
    const shopDomain = req.query.shop;

    if (!customerId) {
      return res.status(200).json({
        success: false,
        error: 'Not logged in'
      });
    }

    console.log(`Fetching referral link for customer ${customerId} from shop ${shopDomain}`);

    const referralCode = `REF-${customerId}`;
    const referralLink = `https://${shopDomain}?ref=${referralCode}`;
    const referralCount = 0;
    const referralPoints = 0;

    return res.status(200).json({
      success: true,
      customerId,
      referralCode,
      referralLink,
      referralCount,
      referralPoints,
      shareText: `Join me on ${shopDomain} and get rewards!`
    });

  } catch (error) {
    console.error('Error fetching referral link:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch referral link'
    });
  }
});

module.exports = router;
