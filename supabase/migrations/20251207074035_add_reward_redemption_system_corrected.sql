/*
  # Add Reward Redemption and Voucher System

  1. New Tables
    - `reward_vouchers` - Stores generated voucher codes for redeemed rewards
    - `reward_transactions` - Tracks all reward-related transactions

  2. Views
    - `transaction_summary_view` - Unified view for admin transactions page
    - `client_transaction_summary` - Client-level summary statistics

  3. Functions
    - `generate_voucher_code()` - Generates unique voucher codes
    - `redeem_reward()` - Handles reward redemption and voucher generation

  4. Security
    - Enable RLS on all new tables
    - Add appropriate policies
*/

-- Drop existing views if they exist
DROP VIEW IF EXISTS transaction_summary_view CASCADE;
DROP VIEW IF EXISTS client_transaction_summary CASCADE;

-- Create voucher status enum
DO $$ BEGIN
  CREATE TYPE voucher_status AS ENUM ('available', 'redeemed', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create transaction type enum
DO $$ BEGIN
  CREATE TYPE reward_transaction_type AS ENUM ('allocation', 'redemption', 'expiration');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create reward_vouchers table
CREATE TABLE IF NOT EXISTS reward_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES member_rewards_allocation(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  voucher_code text NOT NULL UNIQUE,
  status voucher_status NOT NULL DEFAULT 'available',
  issued_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  expires_at timestamptz,
  redemption_notes text,
  created_at timestamptz DEFAULT now()
);

-- Create reward_transactions table
CREATE TABLE IF NOT EXISTS reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type reward_transaction_type NOT NULL,
  member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES member_rewards_allocation(id) ON DELETE SET NULL,
  voucher_id uuid REFERENCES reward_vouchers(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reward_vouchers_member ON reward_vouchers(member_id);
CREATE INDEX IF NOT EXISTS idx_reward_vouchers_status ON reward_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_reward_vouchers_allocation ON reward_vouchers(allocation_id);
CREATE INDEX IF NOT EXISTS idx_reward_transactions_member ON reward_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_reward_transactions_type ON reward_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_reward_transactions_created ON reward_transactions(created_at DESC);

-- Function to generate unique voucher code
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    -- Generate code: 3 letters + 4 numbers + 3 letters (e.g., ABC1234XYZ)
    code := upper(
      substring(md5(random()::text) from 1 for 3) ||
      lpad(floor(random() * 10000)::text, 4, '0') ||
      substring(md5(random()::text) from 1 for 3)
    );
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM reward_vouchers WHERE voucher_code = code) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Function to redeem reward and generate voucher
CREATE OR REPLACE FUNCTION redeem_reward(
  p_allocation_id uuid,
  p_member_id uuid
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_voucher_id uuid;
  v_voucher_code text;
  v_reward_id uuid;
  v_quantity_allocated integer;
  v_quantity_redeemed integer;
  v_expires_at timestamptz;
BEGIN
  -- Get allocation details
  SELECT 
    reward_id,
    quantity_allocated,
    quantity_redeemed,
    expires_at
  INTO 
    v_reward_id,
    v_quantity_allocated,
    v_quantity_redeemed,
    v_expires_at
  FROM member_rewards_allocation
  WHERE id = p_allocation_id AND member_id = p_member_id;

  -- Check if allocation exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;

  -- Check if user has available rewards
  IF v_quantity_redeemed >= v_quantity_allocated THEN
    RAISE EXCEPTION 'No rewards available to redeem';
  END IF;

  -- Check if expired
  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    RAISE EXCEPTION 'Reward allocation has expired';
  END IF;

  -- Generate voucher code
  v_voucher_code := generate_voucher_code();

  -- Create voucher
  INSERT INTO reward_vouchers (
    allocation_id,
    member_id,
    reward_id,
    voucher_code,
    status,
    issued_at,
    expires_at
  ) VALUES (
    p_allocation_id,
    p_member_id,
    v_reward_id,
    v_voucher_code,
    'available',
    NOW(),
    v_expires_at
  )
  RETURNING id INTO v_voucher_id;

  -- Update allocation quantity
  UPDATE member_rewards_allocation
  SET quantity_redeemed = quantity_redeemed + 1
  WHERE id = p_allocation_id;

  -- Create transaction record
  INSERT INTO reward_transactions (
    transaction_type,
    member_id,
    reward_id,
    allocation_id,
    voucher_id,
    quantity,
    notes
  ) VALUES (
    'redemption',
    p_member_id,
    v_reward_id,
    p_allocation_id,
    v_voucher_id,
    1,
    'Reward redeemed by member'
  );

  RETURN v_voucher_id;
END;
$$;

-- Create transaction summary view for admin
CREATE VIEW transaction_summary_view AS
SELECT 
  rt.id as transaction_id,
  rt.created_at as transaction_date,
  CASE 
    WHEN rt.transaction_type = 'redemption' THEN 'redeemed'::text
    ELSE 'issued'::text
  END as transaction_type,
  mu.id as member_id,
  mu.full_name as member_name,
  mu.email as member_email,
  c.id as client_id,
  c.name as client_name,
  r.id as reward_id,
  r.title as reward_title,
  COALESCE(r.reward_id, r.id::text) as reward_code,
  b.id as brand_id,
  b.name as brand_name,
  COALESCE(rv.id::text, 'N/A') as voucher_id,
  COALESCE(rv.voucher_code, 'N/A') as voucher_code,
  COALESCE(rv.status::text, 'N/A') as voucher_status,
  rv.expires_at as voucher_expires_at,
  NULL::text as issued_by_email,
  NULL::text as issued_by_type,
  'system'::text as issuance_channel,
  r.reward_type,
  r.discount_value,
  r.currency,
  rv.redeemed_at
FROM reward_transactions rt
JOIN member_users mu ON rt.member_id = mu.id
JOIN rewards r ON rt.reward_id = r.id
JOIN brands b ON r.brand_id = b.id
JOIN clients c ON mu.client_id = c.id
LEFT JOIN reward_vouchers rv ON rt.voucher_id = rv.id
WHERE rt.transaction_type IN ('allocation', 'redemption');

-- Create client transaction summary view
CREATE VIEW client_transaction_summary AS
SELECT
  c.id as client_id,
  c.name as client_name,
  COUNT(CASE WHEN rt.transaction_type = 'allocation' THEN 1 END) as total_issued,
  COUNT(CASE WHEN rt.transaction_type = 'redemption' THEN 1 END) as total_redeemed,
  COUNT(DISTINCT rt.member_id) as unique_members,
  COUNT(DISTINCT rt.reward_id) as unique_rewards,
  COUNT(DISTINCT r.brand_id) as unique_brands,
  MIN(rt.created_at) as first_transaction,
  MAX(rt.created_at) as last_transaction
FROM clients c
LEFT JOIN member_users mu ON c.id = mu.client_id
LEFT JOIN reward_transactions rt ON mu.id = rt.member_id
LEFT JOIN rewards r ON rt.reward_id = r.id
GROUP BY c.id, c.name;

-- Enable RLS
ALTER TABLE reward_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for reward_vouchers
CREATE POLICY "Members can view own vouchers"
  ON reward_vouchers FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all vouchers"
  ON reward_vouchers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can view their members vouchers"
  ON reward_vouchers FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT mu.id FROM member_users mu
      JOIN profiles up ON up.client_id = mu.client_id
      WHERE up.id = auth.uid() AND up.role = 'client'
    )
  );

CREATE POLICY "System can insert vouchers"
  ON reward_vouchers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Members can update own vouchers"
  ON reward_vouchers FOR UPDATE
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users WHERE auth_user_id = auth.uid()
    )
  );

-- Policies for reward_transactions
CREATE POLICY "Members can view own transactions"
  ON reward_transactions FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON reward_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can view their members transactions"
  ON reward_transactions FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT mu.id FROM member_users mu
      JOIN profiles up ON up.client_id = mu.client_id
      WHERE up.id = auth.uid() AND up.role = 'client'
    )
  );

CREATE POLICY "System can insert transactions"
  ON reward_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);
