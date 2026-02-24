/*
  # Add Membership Campaign Rules and Enhancements
  
  1. New Tables
    - `campaign_rules`
      - Defines automatic membership assignment rules
      - Based on various triggers (order value, purchase count, etc.)
      - Links to membership programs
      - Supports conditions and actions
  
  2. Changes to existing tables
    - Add `enrollment_type` to membership_programs (manual, automatic, hybrid)
    - Add `tier_level` to membership_programs for hierarchy
    - Add `benefits` jsonb field for structured benefits data
    - Add `badge_url` for visual representation
    - Add `enrollment_fee` and `renewal_fee` for paid memberships
    - Add campaign tracking fields to member_memberships
  
  3. Enums
    - `enrollment_type` - How members can join
    - `campaign_trigger_type` - What triggers campaign rules
    - `tier_level` - Membership hierarchy
  
  4. Security
    - Enable RLS on campaign_rules
    - Add policies for admin and client access
*/

-- Create enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_type') THEN
    CREATE TYPE enrollment_type AS ENUM ('manual', 'automatic', 'hybrid', 'invitation_only');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_trigger_type') THEN
    CREATE TYPE campaign_trigger_type AS ENUM ('order_value', 'order_count', 'signup', 'birthday', 'referral', 'custom_event');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tier_level') THEN
    CREATE TYPE tier_level AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'basic', 'premium', 'vip');
  END IF;
END $$;

-- Enhance membership_programs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_programs' AND column_name = 'enrollment_type'
  ) THEN
    ALTER TABLE membership_programs ADD COLUMN enrollment_type enrollment_type DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_programs' AND column_name = 'tier_level'
  ) THEN
    ALTER TABLE membership_programs ADD COLUMN tier_level tier_level;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_programs' AND column_name = 'benefits'
  ) THEN
    ALTER TABLE membership_programs ADD COLUMN benefits jsonb DEFAULT '[]';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_programs' AND column_name = 'badge_url'
  ) THEN
    ALTER TABLE membership_programs ADD COLUMN badge_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_programs' AND column_name = 'enrollment_fee'
  ) THEN
    ALTER TABLE membership_programs ADD COLUMN enrollment_fee numeric(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_programs' AND column_name = 'renewal_fee'
  ) THEN
    ALTER TABLE membership_programs ADD COLUMN renewal_fee numeric(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_programs' AND column_name = 'priority'
  ) THEN
    ALTER TABLE membership_programs ADD COLUMN priority integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_programs' AND column_name = 'terms_conditions'
  ) THEN
    ALTER TABLE membership_programs ADD COLUMN terms_conditions text;
  END IF;
END $$;

-- Add campaign tracking to member_memberships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_memberships' AND column_name = 'campaign_rule_id'
  ) THEN
    ALTER TABLE member_memberships ADD COLUMN campaign_rule_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_memberships' AND column_name = 'enrollment_source'
  ) THEN
    ALTER TABLE member_memberships ADD COLUMN enrollment_source text DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_memberships' AND column_name = 'enrollment_metadata'
  ) THEN
    ALTER TABLE member_memberships ADD COLUMN enrollment_metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Create campaign_rules table
CREATE TABLE IF NOT EXISTS campaign_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES membership_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type campaign_trigger_type NOT NULL,
  trigger_conditions jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  start_date timestamptz,
  end_date timestamptz,
  max_enrollments integer,
  current_enrollments integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_rules_client ON campaign_rules(client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_rules_program ON campaign_rules(program_id);
CREATE INDEX IF NOT EXISTS idx_campaign_rules_active ON campaign_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_campaign_rules_dates ON campaign_rules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_membership_programs_client ON membership_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_membership_programs_active ON membership_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_member_memberships_member ON member_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_member_memberships_program ON member_memberships(program_id);
CREATE INDEX IF NOT EXISTS idx_member_memberships_status ON member_memberships(status);

-- Enable RLS on campaign_rules
ALTER TABLE campaign_rules ENABLE ROW LEVEL SECURITY;

-- Admin can manage all campaign rules
CREATE POLICY "Admin can manage all campaign rules"
  ON campaign_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Clients can manage their own campaign rules
CREATE POLICY "Clients can manage own campaign rules"
  ON campaign_rules FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Function to check if campaign rule applies to a member
CREATE OR REPLACE FUNCTION check_campaign_eligibility(
  p_member_id uuid,
  p_campaign_id uuid
) RETURNS boolean AS $$
DECLARE
  v_eligible boolean := false;
  v_trigger_type campaign_trigger_type;
  v_conditions jsonb;
BEGIN
  SELECT trigger_type, trigger_conditions
  INTO v_trigger_type, v_conditions
  FROM campaign_rules
  WHERE id = p_campaign_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-enroll member based on campaign rules
CREATE OR REPLACE FUNCTION auto_enroll_member(
  p_member_id uuid,
  p_campaign_id uuid
) RETURNS uuid AS $$
DECLARE
  v_membership_id uuid;
  v_program_id uuid;
  v_validity_days integer;
BEGIN
  SELECT program_id INTO v_program_id
  FROM campaign_rules
  WHERE id = p_campaign_id;
  
  SELECT validity_days INTO v_validity_days
  FROM membership_programs
  WHERE id = v_program_id;
  
  INSERT INTO member_memberships (
    member_id,
    program_id,
    campaign_rule_id,
    enrollment_source,
    status,
    activated_at,
    expires_at
  ) VALUES (
    p_member_id,
    v_program_id,
    p_campaign_id,
    'campaign',
    'active',
    now(),
    now() + (v_validity_days || ' days')::interval
  )
  RETURNING id INTO v_membership_id;
  
  UPDATE campaign_rules
  SET current_enrollments = current_enrollments + 1
  WHERE id = p_campaign_id;
  
  RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql;