/*
  # Add Campaign Trigger Logs Table

  1. New Tables
    - `campaign_trigger_logs`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `campaign_rule_id` (uuid, foreign key to campaign_rules)
      - `order_id` (text) - Shopify order ID
      - `order_number` (text) - Human-readable order number
      - `order_value` (numeric) - Order total value
      - `trigger_result` (text) - success, failed, skipped, etc.
      - `member_id` (uuid) - Member ID if found
      - `membership_id` (uuid) - Resulting membership ID if enrolled
      - `customer_email` (text) - Customer email from order
      - `customer_phone` (text) - Customer phone from order
      - `reason` (text) - Detailed reason for result
      - `metadata` (jsonb) - Additional context
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `campaign_trigger_logs` table
    - Add policy for admins to view all logs
    - Add policy for clients to view their own logs

  3. Indexes
    - Index on client_id for fast filtering
    - Index on campaign_rule_id for campaign-specific queries
    - Index on created_at for time-based queries
    - Index on trigger_result for filtering by outcome
*/

CREATE TABLE IF NOT EXISTS campaign_trigger_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  campaign_rule_id uuid REFERENCES campaign_rules(id) ON DELETE SET NULL,
  order_id text,
  order_number text,
  order_value numeric(10, 2),
  trigger_result text NOT NULL CHECK (trigger_result IN ('success', 'failed', 'skipped', 'no_member', 'already_enrolled', 'max_reached', 'below_threshold')),
  member_id uuid REFERENCES member_users(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES member_memberships(id) ON DELETE SET NULL,
  customer_email text,
  customer_phone text,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE campaign_trigger_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admins can view all campaign trigger logs"
  ON campaign_trigger_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Clients can view their own logs
CREATE POLICY "Clients can view own campaign trigger logs"
  ON campaign_trigger_logs
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid()
      AND role = 'client'
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_trigger_logs_client_id ON campaign_trigger_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_trigger_logs_campaign_rule_id ON campaign_trigger_logs(campaign_rule_id);
CREATE INDEX IF NOT EXISTS idx_campaign_trigger_logs_created_at ON campaign_trigger_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_trigger_logs_result ON campaign_trigger_logs(trigger_result);
CREATE INDEX IF NOT EXISTS idx_campaign_trigger_logs_member_id ON campaign_trigger_logs(member_id);
