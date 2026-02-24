-- Sample Loyalty Program Setup Script
-- This creates a sample loyalty program with 4 tiers for testing

-- Note: Replace 'YOUR_CLIENT_ID' with your actual client ID

DO $$
DECLARE
  v_program_id uuid;
  v_basic_tier_id uuid;
  v_silver_tier_id uuid;
  v_gold_tier_id uuid;
  v_platinum_tier_id uuid;
  v_client_id uuid;
BEGIN
  -- Get the first client (or specify your client_id)
  SELECT id INTO v_client_id FROM clients LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'No client found. Please create a client first.';
  END IF;

  -- Create Loyalty Program
  INSERT INTO loyalty_programs (
    client_id,
    program_name,
    points_name,
    points_name_singular,
    is_active,
    currency,
    allow_redemption,
    points_expiry_days,
    welcome_bonus_points
  ) VALUES (
    v_client_id,
    'VIP Rewards',
    'Stars',
    'Star',
    true,
    'INR',
    true,
    365,
    100
  ) RETURNING id INTO v_program_id;

  RAISE NOTICE 'Created loyalty program with ID: %', v_program_id;

  -- Create Basic Tier (Default)
  INSERT INTO loyalty_tiers (
    loyalty_program_id,
    tier_name,
    tier_level,
    min_orders,
    min_spend,
    points_earn_rate,
    points_earn_divisor,
    max_redemption_percent,
    max_redemption_points,
    points_value,
    benefits_description,
    color_code,
    is_default
  ) VALUES (
    v_program_id,
    'Basic',
    1,
    0,
    0,
    1,
    10,
    25,
    NULL,
    0.25,
    'Welcome to our loyalty program! Earn 1 Star for every ₹10 spent. Redeem up to 25% of your order value.',
    '#3B82F6',
    true
  ) RETURNING id INTO v_basic_tier_id;

  RAISE NOTICE 'Created Basic tier with ID: %', v_basic_tier_id;

  -- Create Silver Tier
  INSERT INTO loyalty_tiers (
    loyalty_program_id,
    tier_name,
    tier_level,
    min_orders,
    min_spend,
    points_earn_rate,
    points_earn_divisor,
    max_redemption_percent,
    max_redemption_points,
    points_value,
    benefits_description,
    color_code,
    is_default
  ) VALUES (
    v_program_id,
    'Silver',
    2,
    5,
    5000,
    1,
    8,
    50,
    NULL,
    0.30,
    'Enhanced earning rate! Earn 1 Star for every ₹8 spent. Redeem up to 50% of your order value with better point value.',
    '#C0C0C0',
    false
  ) RETURNING id INTO v_silver_tier_id;

  RAISE NOTICE 'Created Silver tier with ID: %', v_silver_tier_id;

  -- Create Gold Tier
  INSERT INTO loyalty_tiers (
    loyalty_program_id,
    tier_name,
    tier_level,
    min_orders,
    min_spend,
    points_earn_rate,
    points_earn_divisor,
    max_redemption_percent,
    max_redemption_points,
    points_value,
    benefits_description,
    color_code,
    is_default
  ) VALUES (
    v_program_id,
    'Gold',
    3,
    15,
    20000,
    1,
    5,
    75,
    NULL,
    0.40,
    'Premium tier! Earn 1 Star for every ₹5 spent. Redeem up to 75% with even better point value. Priority support included.',
    '#FFD700',
    false
  ) RETURNING id INTO v_gold_tier_id;

  RAISE NOTICE 'Created Gold tier with ID: %', v_gold_tier_id;

  -- Create Platinum Tier
  INSERT INTO loyalty_tiers (
    loyalty_program_id,
    tier_name,
    tier_level,
    min_orders,
    min_spend,
    points_earn_rate,
    points_earn_divisor,
    max_redemption_percent,
    max_redemption_points,
    points_value,
    benefits_description,
    color_code,
    is_default
  ) VALUES (
    v_program_id,
    'Platinum',
    4,
    30,
    50000,
    1,
    3,
    100,
    NULL,
    0.50,
    'Elite status! Earn 1 Star for every ₹3 spent. Redeem up to 100% with maximum point value. VIP treatment and exclusive events.',
    '#E5E4E2',
    false
  ) RETURNING id INTO v_platinum_tier_id;

  RAISE NOTICE 'Created Platinum tier with ID: %', v_platinum_tier_id;

  -- Create sample member loyalty status (optional - if you have test members)
  -- Uncomment and modify if needed:
  /*
  INSERT INTO member_loyalty_status (
    member_user_id,
    loyalty_program_id,
    current_tier_id,
    points_balance,
    lifetime_points_earned,
    lifetime_points_redeemed,
    total_orders,
    total_spend
  )
  SELECT
    mu.id,
    v_program_id,
    v_basic_tier_id,
    100, -- welcome bonus
    100,
    0,
    0,
    0
  FROM member_users mu
  WHERE mu.client_id = v_client_id
  LIMIT 5;
  */

  RAISE NOTICE 'Loyalty program setup complete!';
  RAISE NOTICE 'Program ID: %', v_program_id;
  RAISE NOTICE 'Tiers created: Basic, Silver, Gold, Platinum';

END $$;
