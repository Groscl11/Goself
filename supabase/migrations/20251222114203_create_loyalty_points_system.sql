/*
  # Loyalty Points System

  1. New Tables
    - `loyalty_programs`
      - Main configuration for each client's loyalty program
      - Customizable points name and program settings
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients)
      - `program_name` (text) - e.g., "VIP Rewards"
      - `points_name` (text) - e.g., "Stars", "Coins"
      - `points_name_singular` (text) - e.g., "Star", "Coin"
      - `is_active` (boolean)
      - `currency` (text) - for spend calculations
      - `created_at`, `updated_at` (timestamptz)

    - `loyalty_tiers`
      - Different membership tiers within a program
      - `id` (uuid, primary key)
      - `loyalty_program_id` (uuid, references loyalty_programs)
      - `tier_name` (text) - e.g., "Basic", "Silver", "Gold"
      - `tier_level` (integer) - for ordering (1, 2, 3...)
      - `min_orders` (integer) - minimum orders to reach this tier
      - `min_spend` (numeric) - minimum spend to reach this tier
      - `points_earn_rate` (numeric) - points per currency unit
      - `points_earn_divisor` (integer) - e.g., 1 point per Rs 10 = divisor 10
      - `max_redemption_percent` (integer) - max % of order that can be paid with points
      - `points_value` (numeric) - currency value of 1 point when redeeming
      - `benefits_description` (text)
      - `is_default` (boolean) - starting tier
      - `created_at`, `updated_at` (timestamptz)

    - `member_loyalty_status`
      - Current loyalty status for each member
      - `id` (uuid, primary key)
      - `member_user_id` (uuid, references member_users)
      - `loyalty_program_id` (uuid, references loyalty_programs)
      - `current_tier_id` (uuid, references loyalty_tiers)
      - `points_balance` (integer) - current available points
      - `lifetime_points_earned` (integer)
      - `lifetime_points_redeemed` (integer)
      - `total_orders` (integer)
      - `total_spend` (numeric)
      - `tier_achieved_at` (timestamptz)
      - `created_at`, `updated_at` (timestamptz)

    - `loyalty_points_transactions`
      - Ledger of all points activity
      - `id` (uuid, primary key)
      - `member_loyalty_status_id` (uuid, references member_loyalty_status)
      - `member_user_id` (uuid, references member_users)
      - `transaction_type` (text) - 'earned', 'redeemed', 'expired', 'adjusted'
      - `points_amount` (integer) - positive for earned, negative for redeemed
      - `balance_after` (integer)
      - `order_id` (uuid, references shopify_orders) - if applicable
      - `order_amount` (numeric) - order value if earned from purchase
      - `description` (text)
      - `reference_id` (text) - external reference
      - `expires_at` (timestamptz) - for point expiration
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Clients can manage their own loyalty programs
    - Members can view their own points and transactions
    - Admin has full access

  3. Functions
    - Function to calculate tier eligibility
    - Function to award points on order
    - Function to check redemption limits
    - Trigger to update member status on transaction
*/

-- Create loyalty_programs table
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  program_name text NOT NULL,
  points_name text NOT NULL DEFAULT 'Points',
  points_name_singular text NOT NULL DEFAULT 'Point',
  is_active boolean DEFAULT true,
  currency text DEFAULT 'INR',
  allow_redemption boolean DEFAULT true,
  points_expiry_days integer,
  welcome_bonus_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

-- Create loyalty_tiers table
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  tier_name text NOT NULL,
  tier_level integer NOT NULL,
  min_orders integer DEFAULT 0,
  min_spend numeric(10,2) DEFAULT 0,
  points_earn_rate numeric(10,4) NOT NULL DEFAULT 1,
  points_earn_divisor integer NOT NULL DEFAULT 1,
  max_redemption_percent integer DEFAULT 100,
  max_redemption_points integer,
  points_value numeric(10,4) NOT NULL DEFAULT 1,
  benefits_description text,
  color_code text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(loyalty_program_id, tier_level),
  UNIQUE(loyalty_program_id, tier_name)
);

-- Create member_loyalty_status table
CREATE TABLE IF NOT EXISTS member_loyalty_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_user_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  loyalty_program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  current_tier_id uuid REFERENCES loyalty_tiers(id),
  points_balance integer DEFAULT 0,
  lifetime_points_earned integer DEFAULT 0,
  lifetime_points_redeemed integer DEFAULT 0,
  total_orders integer DEFAULT 0,
  total_spend numeric(10,2) DEFAULT 0,
  tier_achieved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_user_id, loyalty_program_id)
);

-- Create loyalty_points_transactions table
CREATE TABLE IF NOT EXISTS loyalty_points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_loyalty_status_id uuid NOT NULL REFERENCES member_loyalty_status(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted', 'bonus')),
  points_amount integer NOT NULL,
  balance_after integer NOT NULL,
  order_id uuid REFERENCES shopify_orders(id),
  order_amount numeric(10,2),
  description text NOT NULL,
  reference_id text,
  metadata jsonb DEFAULT '{}',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_client ON loyalty_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_program ON loyalty_tiers(loyalty_program_id);
CREATE INDEX IF NOT EXISTS idx_member_loyalty_member ON member_loyalty_status(member_user_id);
CREATE INDEX IF NOT EXISTS idx_member_loyalty_program ON member_loyalty_status(loyalty_program_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_member ON loyalty_points_transactions(member_user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_status ON loyalty_points_transactions(member_loyalty_status_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created ON loyalty_points_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_loyalty_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_programs
CREATE POLICY "Clients can view own loyalty programs"
  ON loyalty_programs FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can create own loyalty programs"
  ON loyalty_programs FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can update own loyalty programs"
  ON loyalty_programs FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for loyalty_tiers
CREATE POLICY "Users can view loyalty tiers"
  ON loyalty_tiers FOR SELECT
  TO authenticated
  USING (
    loyalty_program_id IN (
      SELECT id FROM loyalty_programs WHERE client_id IN (
        SELECT client_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM member_loyalty_status 
      WHERE loyalty_program_id = loyalty_tiers.loyalty_program_id
      AND member_user_id IN (SELECT id FROM member_users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Clients can manage loyalty tiers"
  ON loyalty_tiers FOR ALL
  TO authenticated
  USING (
    loyalty_program_id IN (
      SELECT id FROM loyalty_programs WHERE client_id IN (
        SELECT client_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    loyalty_program_id IN (
      SELECT id FROM loyalty_programs WHERE client_id IN (
        SELECT client_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for member_loyalty_status
CREATE POLICY "Members can view own loyalty status"
  ON member_loyalty_status FOR SELECT
  TO authenticated
  USING (
    member_user_id IN (
      SELECT id FROM member_users WHERE auth_user_id = auth.uid()
    )
    OR
    loyalty_program_id IN (
      SELECT id FROM loyalty_programs WHERE client_id IN (
        SELECT client_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can manage loyalty status"
  ON member_loyalty_status FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for loyalty_points_transactions
CREATE POLICY "Members can view own transactions"
  ON loyalty_points_transactions FOR SELECT
  TO authenticated
  USING (
    member_user_id IN (
      SELECT id FROM member_users WHERE auth_user_id = auth.uid()
    )
    OR
    member_loyalty_status_id IN (
      SELECT mls.id FROM member_loyalty_status mls
      JOIN loyalty_programs lp ON lp.id = mls.loyalty_program_id
      WHERE lp.client_id IN (
        SELECT client_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can create transactions"
  ON loyalty_points_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_loyalty_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamps
DROP TRIGGER IF EXISTS loyalty_programs_updated_at ON loyalty_programs;
CREATE TRIGGER loyalty_programs_updated_at
  BEFORE UPDATE ON loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_timestamp();

DROP TRIGGER IF EXISTS loyalty_tiers_updated_at ON loyalty_tiers;
CREATE TRIGGER loyalty_tiers_updated_at
  BEFORE UPDATE ON loyalty_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_timestamp();

DROP TRIGGER IF EXISTS member_loyalty_status_updated_at ON member_loyalty_status;
CREATE TRIGGER member_loyalty_status_updated_at
  BEFORE UPDATE ON member_loyalty_status
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_timestamp();

-- Function to check and upgrade tier
CREATE OR REPLACE FUNCTION check_tier_upgrade(p_member_loyalty_status_id uuid)
RETURNS void AS $$
DECLARE
  v_status record;
  v_new_tier record;
BEGIN
  -- Get current status
  SELECT mls.*, lt.tier_level as current_tier_level
  INTO v_status
  FROM member_loyalty_status mls
  LEFT JOIN loyalty_tiers lt ON lt.id = mls.current_tier_id
  WHERE mls.id = p_member_loyalty_status_id;

  -- Find highest eligible tier
  SELECT *
  INTO v_new_tier
  FROM loyalty_tiers
  WHERE loyalty_program_id = v_status.loyalty_program_id
    AND (v_status.total_orders >= min_orders OR min_orders IS NULL)
    AND (v_status.total_spend >= min_spend OR min_spend IS NULL)
  ORDER BY tier_level DESC
  LIMIT 1;

  -- Update if new tier is higher
  IF v_new_tier.id IS NOT NULL AND 
     (v_status.current_tier_id IS NULL OR v_new_tier.tier_level > v_status.current_tier_level) THEN
    UPDATE member_loyalty_status
    SET current_tier_id = v_new_tier.id,
        tier_achieved_at = now()
    WHERE id = p_member_loyalty_status_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to award points on order
CREATE OR REPLACE FUNCTION award_order_points(
  p_member_user_id uuid,
  p_order_id uuid,
  p_order_amount numeric
)
RETURNS jsonb AS $$
DECLARE
  v_status record;
  v_tier record;
  v_program record;
  v_points_earned integer;
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  -- Get member's loyalty status
  SELECT mls.*, lp.points_expiry_days
  INTO v_status
  FROM member_loyalty_status mls
  JOIN loyalty_programs lp ON lp.id = mls.loyalty_program_id
  WHERE mls.member_user_id = p_member_user_id
  LIMIT 1;

  IF v_status.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Member not enrolled in loyalty program');
  END IF;

  -- Get current tier
  SELECT * INTO v_tier
  FROM loyalty_tiers
  WHERE id = v_status.current_tier_id;

  IF v_tier.id IS NULL THEN
    RETURN jsonb_build_object('error', 'No tier found');
  END IF;

  -- Calculate points: (order_amount * earn_rate) / divisor
  v_points_earned := FLOOR((p_order_amount * v_tier.points_earn_rate) / v_tier.points_earn_divisor);

  IF v_points_earned <= 0 THEN
    RETURN jsonb_build_object('points_earned', 0, 'message', 'No points earned');
  END IF;

  -- Update member status
  UPDATE member_loyalty_status
  SET points_balance = points_balance + v_points_earned,
      lifetime_points_earned = lifetime_points_earned + v_points_earned,
      total_orders = total_orders + 1,
      total_spend = total_spend + p_order_amount,
      updated_at = now()
  WHERE id = v_status.id
  RETURNING points_balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO loyalty_points_transactions (
    member_loyalty_status_id,
    member_user_id,
    transaction_type,
    points_amount,
    balance_after,
    order_id,
    order_amount,
    description,
    expires_at
  ) VALUES (
    v_status.id,
    p_member_user_id,
    'earned',
    v_points_earned,
    v_new_balance,
    p_order_id,
    p_order_amount,
    'Points earned from order',
    CASE WHEN v_status.points_expiry_days IS NOT NULL 
      THEN now() + (v_status.points_expiry_days || ' days')::interval 
      ELSE NULL END
  ) RETURNING id INTO v_transaction_id;

  -- Check for tier upgrade
  PERFORM check_tier_upgrade(v_status.id);

  RETURN jsonb_build_object(
    'success', true,
    'points_earned', v_points_earned,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to redeem points
CREATE OR REPLACE FUNCTION redeem_points(
  p_member_user_id uuid,
  p_points_to_redeem integer,
  p_order_amount numeric,
  p_reference_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_status record;
  v_tier record;
  v_max_points integer;
  v_discount_value numeric;
  v_new_balance integer;
BEGIN
  -- Get member's loyalty status with tier
  SELECT mls.*, lt.max_redemption_percent, lt.max_redemption_points, lt.points_value, lp.allow_redemption
  INTO v_status
  FROM member_loyalty_status mls
  JOIN loyalty_tiers lt ON lt.id = mls.current_tier_id
  JOIN loyalty_programs lp ON lp.id = mls.loyalty_program_id
  WHERE mls.member_user_id = p_member_user_id
  LIMIT 1;

  IF v_status.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Member not enrolled in loyalty program');
  END IF;

  IF NOT v_status.allow_redemption THEN
    RETURN jsonb_build_object('error', 'Points redemption is not enabled');
  END IF;

  -- Check if member has enough points
  IF v_status.points_balance < p_points_to_redeem THEN
    RETURN jsonb_build_object('error', 'Insufficient points balance');
  END IF;

  -- Calculate max redeemable points based on percentage
  IF v_status.max_redemption_percent IS NOT NULL THEN
    v_max_points := FLOOR((p_order_amount * v_status.max_redemption_percent / 100) / v_status.points_value);
  END IF;

  -- Apply tier-specific max redemption limit
  IF v_status.max_redemption_points IS NOT NULL THEN
    v_max_points := LEAST(COALESCE(v_max_points, v_status.max_redemption_points), v_status.max_redemption_points);
  END IF;

  -- Check redemption limits
  IF v_max_points IS NOT NULL AND p_points_to_redeem > v_max_points THEN
    RETURN jsonb_build_object('error', 'Exceeds maximum redeemable points', 'max_points', v_max_points);
  END IF;

  -- Calculate discount value
  v_discount_value := p_points_to_redeem * v_status.points_value;

  -- Update member status
  UPDATE member_loyalty_status
  SET points_balance = points_balance - p_points_to_redeem,
      lifetime_points_redeemed = lifetime_points_redeemed + p_points_to_redeem,
      updated_at = now()
  WHERE id = v_status.id
  RETURNING points_balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO loyalty_points_transactions (
    member_loyalty_status_id,
    member_user_id,
    transaction_type,
    points_amount,
    balance_after,
    order_amount,
    description,
    reference_id
  ) VALUES (
    v_status.id,
    p_member_user_id,
    'redeemed',
    -p_points_to_redeem,
    v_new_balance,
    p_order_amount,
    'Points redeemed for discount',
    p_reference_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_redeemed', p_points_to_redeem,
    'discount_value', v_discount_value,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
