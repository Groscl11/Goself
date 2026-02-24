const supabase = require('./supabase');

async function findOrCreateMember(clientId, customerData) {
  const { email, phone, firstName, lastName, shopifyCustomerId } = customerData;

  let member = null;

  if (email) {
    const { data } = await supabase
      .from('member_users')
      .select('*')
      .eq('client_id', clientId)
      .eq('email', email)
      .maybeSingle();
    member = data;
  }

  if (!member && phone) {
    const { data } = await supabase
      .from('member_users')
      .select('*')
      .eq('client_id', clientId)
      .eq('phone', phone)
      .maybeSingle();
    member = data;
  }

  if (!member) {
    const { data, error } = await supabase
      .from('member_users')
      .insert([{
        client_id: clientId,
        email: email || null,
        phone: phone || null,
        first_name: firstName || '',
        last_name: lastName || '',
        metadata: {
          shopify_customer_id: shopifyCustomerId,
          source: 'shopify_webhook'
        }
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating member:', error);
      throw error;
    }

    member = data;
  }

  return member;
}

async function getLoyaltyProgram(clientId) {
  const { data, error } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching loyalty program:', error);
    return null;
  }

  return data;
}

async function calculatePointsForOrder(orderAmount, loyaltyProgram) {
  if (!loyaltyProgram || !loyaltyProgram.points_per_currency) {
    return 0;
  }

  const points = Math.floor(orderAmount * loyaltyProgram.points_per_currency);
  return points;
}

async function awardPoints(memberId, points, description, metadata = {}) {
  const { data, error } = await supabase
    .from('loyalty_points_transactions')
    .insert([{
      member_id: memberId,
      points,
      transaction_type: 'earn',
      description,
      metadata
    }])
    .select()
    .single();

  if (error) {
    console.error('Error awarding points:', error);
    throw error;
  }

  return data;
}

async function deductPoints(memberId, points, description, metadata = {}) {
  const { data, error } = await supabase
    .from('loyalty_points_transactions')
    .insert([{
      member_id: memberId,
      points: -points,
      transaction_type: 'redeem',
      description,
      metadata
    }])
    .select()
    .single();

  if (error) {
    console.error('Error deducting points:', error);
    throw error;
  }

  return data;
}

async function getPointsBalance(memberId) {
  const { data, error } = await supabase
    .rpc('get_loyalty_balance', { p_member_id: memberId });

  if (error) {
    console.error('Error fetching points balance:', error);
    return 0;
  }

  return data || 0;
}

async function getMemberTier(memberId, loyaltyProgram) {
  if (!loyaltyProgram || !loyaltyProgram.tiers || loyaltyProgram.tiers.length === 0) {
    return null;
  }

  const balance = await getPointsBalance(memberId);

  const sortedTiers = [...loyaltyProgram.tiers].sort((a, b) => b.min_points - a.min_points);

  for (const tier of sortedTiers) {
    if (balance >= tier.min_points) {
      return tier;
    }
  }

  return sortedTiers[sortedTiers.length - 1];
}

async function createShopifyDiscountCode(clientId, memberId, points, discountValue) {
  const code = `LOYALTY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const { data, error } = await supabase
    .from('loyalty_discount_codes')
    .insert([{
      client_id: clientId,
      member_id: memberId,
      code,
      discount_type: 'percentage',
      discount_value: discountValue,
      points_redeemed: points,
      is_used: false,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating discount code:', error);
    throw error;
  }

  return data;
}

module.exports = {
  findOrCreateMember,
  getLoyaltyProgram,
  calculatePointsForOrder,
  awardPoints,
  deductPoints,
  getPointsBalance,
  getMemberTier,
  createShopifyDiscountCode
};
