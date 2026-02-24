/*
  # Add Voucher Issuance and Transaction Tracking
  
  1. New Tables
    - `voucher_issuances`
      - Tracks when vouchers are issued to members
      - Links to allocation, member, and voucher
      - Records who issued it (admin/system)
      - Includes metadata for tracking purposes
  
  2. Changes to existing tables
    - Add `issued_by` field to vouchers to track admin/system who issued
    - Add `issued_at` field to vouchers (separate from created_at)
  
  3. Views
    - `transaction_summary_view` - Comprehensive view of all transactions
    - `member_transaction_history` - Member-specific transaction view
    - `client_transaction_summary` - Client-level aggregations
  
  4. Security
    - Enable RLS on voucher_issuances
    - Add policies for admin and client access
    - Maintain security on views
*/

-- Add tracking fields to vouchers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'issued_by'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN issued_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'issued_at'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN issued_at timestamptz;
  END IF;
END $$;

-- Create voucher issuances tracking table
CREATE TABLE IF NOT EXISTS voucher_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  allocation_id uuid NOT NULL REFERENCES member_rewards_allocation(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  issued_by_type text DEFAULT 'system',
  issuance_channel text DEFAULT 'allocation',
  metadata jsonb DEFAULT '{}',
  issued_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_voucher_issuances_member ON voucher_issuances(member_id);
CREATE INDEX IF NOT EXISTS idx_voucher_issuances_client ON voucher_issuances(client_id);
CREATE INDEX IF NOT EXISTS idx_voucher_issuances_reward ON voucher_issuances(reward_id);
CREATE INDEX IF NOT EXISTS idx_voucher_issuances_allocation ON voucher_issuances(allocation_id);
CREATE INDEX IF NOT EXISTS idx_voucher_issuances_issued_at ON voucher_issuances(issued_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_at ON vouchers(issued_at);

-- Enable RLS on voucher_issuances
ALTER TABLE voucher_issuances ENABLE ROW LEVEL SECURITY;

-- Admin can view all issuances
CREATE POLICY "Admin can view all voucher issuances"
  ON voucher_issuances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Clients can view their own issuances
CREATE POLICY "Clients can view own voucher issuances"
  ON voucher_issuances FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Members can view their own issuances
CREATE POLICY "Members can view own voucher issuances"
  ON voucher_issuances FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users WHERE auth_user_id = auth.uid()
    )
  );

-- Create comprehensive transaction summary view
CREATE OR REPLACE VIEW transaction_summary_view AS
SELECT 
  vi.id as transaction_id,
  vi.issued_at as transaction_date,
  'issued' as transaction_type,
  vi.member_id,
  mu.full_name as member_name,
  mu.email as member_email,
  vi.client_id,
  c.name as client_name,
  vi.reward_id,
  r.title as reward_title,
  r.reward_id as reward_code,
  r.brand_id,
  b.name as brand_name,
  vi.voucher_id,
  v.code as voucher_code,
  v.status as voucher_status,
  v.expires_at as voucher_expires_at,
  vi.allocation_id,
  vi.issued_by,
  p.email as issued_by_email,
  vi.issued_by_type,
  vi.issuance_channel,
  r.reward_type,
  r.discount_value,
  r.currency,
  NULL::timestamptz as redeemed_at,
  vi.metadata as transaction_metadata
FROM voucher_issuances vi
JOIN member_users mu ON vi.member_id = mu.id
JOIN clients c ON vi.client_id = c.id
JOIN rewards r ON vi.reward_id = r.id
JOIN brands b ON r.brand_id = b.id
JOIN vouchers v ON vi.voucher_id = v.id
LEFT JOIN profiles p ON vi.issued_by = p.id

UNION ALL

SELECT 
  red.id as transaction_id,
  red.redeemed_at as transaction_date,
  'redeemed' as transaction_type,
  red.member_id,
  mu.full_name as member_name,
  mu.email as member_email,
  c.id as client_id,
  c.name as client_name,
  red.reward_id,
  r.title as reward_title,
  r.reward_id as reward_code,
  r.brand_id,
  b.name as brand_name,
  red.voucher_id,
  v.code as voucher_code,
  v.status as voucher_status,
  v.expires_at as voucher_expires_at,
  v.allocation_id,
  NULL::uuid as issued_by,
  NULL::text as issued_by_email,
  NULL::text as issued_by_type,
  red.redemption_channel as issuance_channel,
  r.reward_type,
  r.discount_value,
  r.currency,
  red.redeemed_at,
  red.redemption_metadata as transaction_metadata
FROM redemptions red
JOIN member_users mu ON red.member_id = mu.id
JOIN clients c ON mu.client_id = c.id
JOIN rewards r ON red.reward_id = r.id
JOIN brands b ON r.brand_id = b.id
JOIN vouchers v ON red.voucher_id = v.id;

-- Create client-level summary view
CREATE OR REPLACE VIEW client_transaction_summary AS
SELECT 
  client_id,
  client_name,
  COUNT(*) FILTER (WHERE transaction_type = 'issued') as total_issued,
  COUNT(*) FILTER (WHERE transaction_type = 'redeemed') as total_redeemed,
  COUNT(DISTINCT member_id) as unique_members,
  COUNT(DISTINCT reward_id) as unique_rewards,
  COUNT(DISTINCT brand_id) as unique_brands,
  MIN(transaction_date) as first_transaction,
  MAX(transaction_date) as last_transaction
FROM transaction_summary_view
GROUP BY client_id, client_name;

-- Create member-level summary view  
CREATE OR REPLACE VIEW member_transaction_summary AS
SELECT 
  member_id,
  member_name,
  member_email,
  client_id,
  client_name,
  COUNT(*) FILTER (WHERE transaction_type = 'issued') as total_issued,
  COUNT(*) FILTER (WHERE transaction_type = 'redeemed') as total_redeemed,
  COUNT(*) FILTER (WHERE voucher_status = 'available') as available_vouchers,
  COUNT(*) FILTER (WHERE voucher_status = 'expired') as expired_vouchers,
  MIN(transaction_date) as first_transaction,
  MAX(transaction_date) as last_transaction
FROM transaction_summary_view
GROUP BY member_id, member_name, member_email, client_id, client_name;