const express = require('express');
const router = express.Router();
const { verifyShopifyProxy } = require('../middleware/shopify-hmac');
const loyaltyService = require('../services/loyalty-points');
const supabase = require('../services/supabase');

const SHOPIFY_PROXY_SECRET = process.env.SHOPIFY_PROXY_SECRET || 'your-proxy-secret';
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

    const clientId = await getClientIdByShopDomain(shopDomain);

    if (!clientId) {
      return res.status(200).json({
        success: false,
        error: 'Client not configured',
        points: 0
      });
    }

    console.log(`Fetching points for customer ${customerId} from shop ${shopDomain}`);

    const { data: member } = await supabase
      .from('member_users')
      .select('*')
      .eq('client_id', clientId)
      .eq('email', customerEmail)
      .maybeSingle();

    if (!member) {
      return res.status(200).json({
        success: true,
        points: 0,
        tier: null,
        message: 'No loyalty account found'
      });
    }

    const loyaltyProgram = await loyaltyService.getLoyaltyProgram(clientId);
    const points = await loyaltyService.getPointsBalance(member.id);
    const tier = await loyaltyService.getMemberTier(member.id, loyaltyProgram);

    const nextTier = loyaltyProgram?.tiers
      ?.filter(t => t.min_points > points)
      .sort((a, b) => a.min_points - b.min_points)[0] || null;

    const pointsToNextTier = nextTier ? nextTier.min_points - points : 0;

    const { data: history } = await supabase
      .from('loyalty_points_transactions')
      .select('*')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      success: true,
      customerId,
      points,
      tier: tier ? {
        name: tier.name,
        minPoints: tier.min_points,
        benefits: tier.benefits,
        multiplier: tier.multiplier
      } : null,
      nextTier: nextTier ? {
        name: nextTier.name,
        minPoints: nextTier.min_points
      } : null,
      pointsToNextTier,
      history: history || []
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

    const clientId = await getClientIdByShopDomain(shopDomain);

    if (!clientId) {
      return res.status(200).json({
        success: false,
        error: 'Client not configured'
      });
    }

    console.log(`Redeeming ${points} points for customer ${customerId} from shop ${shopDomain}`);

    const { data: member } = await supabase
      .from('member_users')
      .select('*')
      .eq('client_id', clientId)
      .eq('email', customerEmail)
      .maybeSingle();

    if (!member) {
      return res.status(200).json({
        success: false,
        error: 'Member not found'
      });
    }

    const currentBalance = await loyaltyService.getPointsBalance(member.id);

    if (currentBalance < points) {
      return res.status(200).json({
        success: false,
        error: 'Insufficient points'
      });
    }

    const loyaltyProgram = await loyaltyService.getLoyaltyProgram(clientId);

    if (!loyaltyProgram || !loyaltyProgram.redemption_options) {
      return res.status(200).json({
        success: false,
        error: 'No redemption options available'
      });
    }

    const redemptionOption = loyaltyProgram.redemption_options.find(
      opt => opt.points_required === points
    );

    if (!redemptionOption) {
      return res.status(200).json({
        success: false,
        error: 'Invalid redemption amount'
      });
    }

    const discountCode = await loyaltyService.createShopifyDiscountCode(
      clientId,
      member.id,
      points,
      redemptionOption.discount_value
    );

    await loyaltyService.deductPoints(
      member.id,
      points,
      `Redeemed for ${redemptionOption.discount_value}% discount`,
      {
        discount_code: discountCode.code,
        redemption_option: redemptionOption,
        shop_domain: shopDomain
      }
    );

    const remainingPoints = await loyaltyService.getPointsBalance(member.id);

    return res.status(200).json({
      success: true,
      message: 'Points redeemed successfully',
      discountCode: discountCode.code,
      discountValue: redemptionOption.discount_value,
      discountType: 'percentage',
      pointsRedeemed: points,
      remainingPoints
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

    const clientId = await getClientIdByShopDomain(shopDomain);

    if (!clientId) {
      return res.status(200).json({
        success: false,
        error: 'Client not configured'
      });
    }

    console.log(`Fetching referral link for customer ${customerId} from shop ${shopDomain}`);

    const { data: member } = await supabase
      .from('member_users')
      .select('*')
      .eq('client_id', clientId)
      .eq('email', customerEmail)
      .maybeSingle();

    if (!member) {
      return res.status(200).json({
        success: false,
        error: 'Member not found'
      });
    }

    const referralCode = `REF-${member.id.substring(0, 8).toUpperCase()}`;
    const referralLink = `https://${shopDomain}?ref=${referralCode}`;

    const { data: referrals } = await supabase
      .from('loyalty_points_transactions')
      .select('*')
      .eq('member_id', member.id)
      .eq('transaction_type', 'earn')
      .ilike('description', '%referral%');

    const referralCount = referrals?.length || 0;
    const referralPoints = referrals?.reduce((sum, t) => sum + t.points, 0) || 0;

    return res.status(200).json({
      success: true,
      customerId,
      referralCode,
      referralLink,
      referralCount,
      referralPoints,
      shareText: `Join me on ${shopDomain} and earn rewards! Use my referral code: ${referralCode}`
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
