-- Create member_referrals table (tracks who referred whom)
CREATE TABLE IF NOT EXISTS member_referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loyalty_program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  referrer_member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  referred_member_id uuid REFERENCES member_users(id) ON DELETE SET NULL,
  referral_code text NOT NULL,
  referred_email text,
  referred_phone text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'expired')),
  points_awarded integer DEFAULT 0,
  completed_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (loyalty_program_id, referred_member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_referrals_referrer ON member_referrals (referrer_member_id);
CREATE INDEX IF NOT EXISTS idx_member_referrals_program ON member_referrals (loyalty_program_id);

-- Create loyalty_program_earning_rules (per-program rules, used by ReferralTracking page)
CREATE TABLE IF NOT EXISTS loyalty_program_earning_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loyalty_program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (loyalty_program_id, rule_type)
);

-- Add referral_points_earned to member_loyalty_status if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_loyalty_status' AND column_name = 'referral_points_earned'
  ) THEN
    ALTER TABLE member_loyalty_status ADD COLUMN referral_points_earned integer DEFAULT 0;
  END IF;
END $$;

-- RLS for member_referrals
ALTER TABLE member_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own referrals"
  ON member_referrals FOR SELECT
  TO authenticated
  USING (
    loyalty_program_id IN (
      SELECT lp.id FROM loyalty_programs lp
      JOIN profiles p ON p.client_id = lp.client_id
      WHERE p.id = auth.uid() AND p.role = 'client'
    )
  );

CREATE POLICY "Service role can manage referrals"
  ON member_referrals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS for loyalty_program_earning_rules
ALTER TABLE loyalty_program_earning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own program earning rules"
  ON loyalty_program_earning_rules FOR SELECT
  TO authenticated
  USING (
    loyalty_program_id IN (
      SELECT lp.id FROM loyalty_programs lp
      JOIN profiles p ON p.client_id = lp.client_id
      WHERE p.id = auth.uid() AND p.role = 'client'
    )
  );

CREATE POLICY "Service role can manage program earning rules"
  ON loyalty_program_earning_rules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
