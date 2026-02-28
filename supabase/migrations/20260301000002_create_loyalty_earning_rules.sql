-- Create loyalty_earning_rules table
-- Merchants define how customers can earn loyalty points

CREATE TABLE IF NOT EXISTS loyalty_earning_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  loyalty_program_id uuid REFERENCES loyalty_programs(id) ON DELETE SET NULL,
  rule_type text NOT NULL CHECK (rule_type IN (
    'referral', 'birthday', 'social_follow', 'signup',
    'profile_complete', 'review', 'custom'
  )),
  name text NOT NULL,
  description text,
  -- Points configuration
  points_reward integer NOT NULL DEFAULT 0,
  -- Referral-specific
  referral_discount_type text CHECK (referral_discount_type IN ('flat', 'percentage')),
  referral_discount_value numeric(10,2),
  referral_min_order_value numeric(10,2),
  max_referrals_per_day integer,
  -- Social follow specific
  social_platform text CHECK (social_platform IN (
    'instagram', 'facebook', 'youtube', 'twitter', 'tiktok', 'linkedin', 'pinterest'
  )),
  social_url text,
  -- General limits
  max_times_per_customer integer, -- NULL = unlimited
  cooldown_days integer,          -- days before same customer can earn again
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookup by client
CREATE INDEX IF NOT EXISTS idx_loyalty_earning_rules_client_id
  ON loyalty_earning_rules (client_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_earning_rules_type
  ON loyalty_earning_rules (client_id, rule_type);

-- RLS
ALTER TABLE loyalty_earning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage own earning rules"
  ON loyalty_earning_rules FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

CREATE POLICY "Admins can manage all earning rules"
  ON loyalty_earning_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_loyalty_earning_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_loyalty_earning_rules_updated_at
  BEFORE UPDATE ON loyalty_earning_rules
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_earning_rules_updated_at();
