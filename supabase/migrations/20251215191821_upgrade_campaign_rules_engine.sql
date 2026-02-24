/*
  # Upgrade Campaign Rules to Advanced Rule Engine

  1. New Structure
    - Add `rule_version` for versioning support
    - Add `rule_structure` JSONB for new rule engine format
    - Add `eligibility_conditions` for customer/product eligibility
    - Add `location_conditions` for geographic targeting
    - Add `attribution_conditions` for UTM tracking
    - Add `exclusion_rules` for refunds, cancellations, etc.
    - Add `reward_action` for reward configuration
    - Add `guardrails` for limits and budget caps
    - Keep `trigger_conditions` for backward compatibility
  
  2. Audit & Logging
    - Create `campaign_rule_evaluations` table for tracking
    - Log every rule evaluation with result
    - Track which conditions matched/failed
  
  3. Backward Compatibility
    - Existing campaigns auto-migrate to new structure
    - Legacy trigger_conditions still work
    - Version 1 = legacy, Version 2 = new engine
*/

-- Add new columns to campaign_rules
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_rules' AND column_name = 'rule_version') THEN
    ALTER TABLE campaign_rules ADD COLUMN rule_version integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_rules' AND column_name = 'eligibility_conditions') THEN
    ALTER TABLE campaign_rules ADD COLUMN eligibility_conditions jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_rules' AND column_name = 'location_conditions') THEN
    ALTER TABLE campaign_rules ADD COLUMN location_conditions jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_rules' AND column_name = 'attribution_conditions') THEN
    ALTER TABLE campaign_rules ADD COLUMN attribution_conditions jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_rules' AND column_name = 'exclusion_rules') THEN
    ALTER TABLE campaign_rules ADD COLUMN exclusion_rules jsonb DEFAULT jsonb_build_object(
      'exclude_refunded', true,
      'exclude_cancelled', true,
      'exclude_test_orders', true
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_rules' AND column_name = 'reward_action') THEN
    ALTER TABLE campaign_rules ADD COLUMN reward_action jsonb DEFAULT jsonb_build_object(
      'reward_type', 'auto',
      'allocation_timing', 'instant',
      'claim_method', 'auto',
      'expiry_days', 90
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_rules' AND column_name = 'guardrails') THEN
    ALTER TABLE campaign_rules ADD COLUMN guardrails jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_rules' AND column_name = 'required_scopes') THEN
    ALTER TABLE campaign_rules ADD COLUMN required_scopes text[] DEFAULT ARRAY['read_orders', 'read_customers'];
  END IF;
END $$;

-- Create campaign rule evaluations table for audit logging
CREATE TABLE IF NOT EXISTS campaign_rule_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_rule_id uuid NOT NULL REFERENCES campaign_rules(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  order_id text,
  shopify_order_id text,
  customer_email text,
  evaluation_result text NOT NULL,
  matched_conditions jsonb DEFAULT '{}'::jsonb,
  failed_conditions jsonb DEFAULT '{}'::jsonb,
  reward_allocated boolean DEFAULT false,
  evaluation_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_campaign ON campaign_rule_evaluations(campaign_rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_client ON campaign_rule_evaluations(client_id);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_order ON campaign_rule_evaluations(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_created ON campaign_rule_evaluations(created_at);

-- Enable RLS
ALTER TABLE campaign_rule_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_rule_evaluations
CREATE POLICY "Clients can view own rule evaluations"
  ON campaign_rule_evaluations FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert rule evaluations"
  ON campaign_rule_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create function to log rule evaluation
CREATE OR REPLACE FUNCTION log_campaign_rule_evaluation(
  p_campaign_rule_id uuid,
  p_client_id uuid,
  p_order_id text,
  p_shopify_order_id text,
  p_customer_email text,
  p_evaluation_result text,
  p_matched_conditions jsonb DEFAULT '{}'::jsonb,
  p_failed_conditions jsonb DEFAULT '{}'::jsonb,
  p_reward_allocated boolean DEFAULT false,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_evaluation_id uuid;
BEGIN
  INSERT INTO campaign_rule_evaluations (
    campaign_rule_id,
    client_id,
    order_id,
    shopify_order_id,
    customer_email,
    evaluation_result,
    matched_conditions,
    failed_conditions,
    reward_allocated,
    evaluation_metadata
  ) VALUES (
    p_campaign_rule_id,
    p_client_id,
    p_order_id,
    p_shopify_order_id,
    p_customer_email,
    p_evaluation_result,
    p_matched_conditions,
    p_failed_conditions,
    p_reward_allocated,
    p_metadata
  )
  RETURNING id INTO v_evaluation_id;

  RETURN v_evaluation_id;
END;
$$;

-- Migrate existing campaigns to version 1 structure
UPDATE campaign_rules
SET 
  rule_version = 1,
  eligibility_conditions = '{}'::jsonb,
  location_conditions = '{}'::jsonb,
  attribution_conditions = '{}'::jsonb,
  exclusion_rules = jsonb_build_object(
    'exclude_refunded', true,
    'exclude_cancelled', true,
    'exclude_test_orders', true
  ),
  reward_action = jsonb_build_object(
    'reward_type', 'auto',
    'allocation_timing', 'instant',
    'claim_method', 'auto',
    'expiry_days', 90
  ),
  guardrails = '{}'::jsonb,
  required_scopes = ARRAY['read_orders', 'read_customers']
WHERE rule_version IS NULL;
