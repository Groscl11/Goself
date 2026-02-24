/*
  # Create Loyalty Discount Codes Table

  1. New Table
    - `loyalty_discount_codes`
      - Stores Shopify discount codes generated from loyalty point redemptions
      - Tracks usage, expiration, and associated member
      - Links to client and member for multi-tenant support
    
  2. Structure
    - `id` (uuid, primary key) - Unique identifier
    - `client_id` (uuid) - Reference to clients table
    - `member_id` (uuid) - Reference to member_users table
    - `code` (text, unique) - The actual discount code
    - `discount_type` (text) - Type: 'percentage', 'fixed_amount', 'free_shipping'
    - `discount_value` (numeric) - Value of discount (e.g., 10 for 10%)
    - `points_redeemed` (integer) - Points used to generate this code
    - `is_used` (boolean) - Whether code has been used
    - `used_at` (timestamptz) - When code was used
    - `expires_at` (timestamptz) - When code expires
    - `minimum_order_value` (numeric) - Minimum order amount to use code
    - `usage_limit` (integer) - How many times code can be used
    - `times_used` (integer) - How many times used so far
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp
    
  3. Security
    - Enable RLS
    - Admins can manage all discount codes
    - Clients can manage their own discount codes
    - Members can view their own discount codes
    
  4. Indexes
    - Index on code for fast lookups
    - Index on member_id for member queries
    - Index on client_id for client queries
    - Index on is_used and expires_at for active code queries
*/

-- Create loyalty_discount_codes table
CREATE TABLE IF NOT EXISTS loyalty_discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL,
  points_redeemed integer NOT NULL DEFAULT 0,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  expires_at timestamptz,
  minimum_order_value numeric DEFAULT 0,
  usage_limit integer DEFAULT 1,
  times_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_discount_type CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping')),
  CONSTRAINT valid_discount_value CHECK (discount_value >= 0),
  CONSTRAINT valid_points CHECK (points_redeemed >= 0),
  CONSTRAINT valid_usage CHECK (times_used <= usage_limit)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_discount_codes_code ON loyalty_discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_loyalty_discount_codes_member ON loyalty_discount_codes(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_discount_codes_client ON loyalty_discount_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_discount_codes_is_used ON loyalty_discount_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_loyalty_discount_codes_expires_at ON loyalty_discount_codes(expires_at);

-- Enable RLS
ALTER TABLE loyalty_discount_codes ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can view all discount codes"
  ON loyalty_discount_codes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert discount codes"
  ON loyalty_discount_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update discount codes"
  ON loyalty_discount_codes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete discount codes"
  ON loyalty_discount_codes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Client policies
CREATE POLICY "Clients can view own discount codes"
  ON loyalty_discount_codes
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

CREATE POLICY "Clients can insert own discount codes"
  ON loyalty_discount_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
      AND profiles.client_id IS NOT NULL
    )
  );

CREATE POLICY "Clients can update own discount codes"
  ON loyalty_discount_codes
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
      AND profiles.client_id IS NOT NULL
    )
  );

CREATE POLICY "Clients can delete own discount codes"
  ON loyalty_discount_codes
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

-- Member policies (view only their own codes)
CREATE POLICY "Members can view own discount codes"
  ON loyalty_discount_codes
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users
      WHERE email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_loyalty_discount_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER loyalty_discount_codes_updated_at
  BEFORE UPDATE ON loyalty_discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_discount_codes_updated_at();
