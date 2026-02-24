/*
  # Campaign Management and Messaging System

  1. New Tables
    - `message_templates`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key)
      - `name` (text)
      - `template_type` (enum: 'sms', 'email', 'whatsapp')
      - `subject` (text, nullable) - for email
      - `body` (text) - template content with variables
      - `variables` (jsonb) - available variables like {name}, {link}, etc.
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `message_campaigns`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text)
      - `campaign_type` (enum: 'membership_enrollment', 'reward_distribution', 'general')
      - `message_type` (enum: 'sms', 'email', 'whatsapp', 'all')
      - `template_id` (uuid, foreign key, nullable)
      - `custom_message` (text, nullable)
      - `target_audience` (enum: 'all_members', 'specific_members', 'new_upload')
      - `status` (enum: 'draft', 'scheduled', 'sending', 'completed', 'failed')
      - `scheduled_at` (timestamp, nullable)
      - `sent_at` (timestamp, nullable)
      - `total_recipients` (integer)
      - `sent_count` (integer)
      - `failed_count` (integer)
      - `created_by` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `campaign_recipients`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `member_id` (uuid, foreign key, nullable)
      - `email` (text)
      - `phone` (text, nullable)
      - `full_name` (text)
      - `unique_link` (text) - personalized link
      - `status` (enum: 'pending', 'sent', 'failed', 'clicked')
      - `sent_at` (timestamp, nullable)
      - `clicked_at` (timestamp, nullable)
      - `error_message` (text, nullable)
      - `metadata` (jsonb)
    
    - `member_sources`
      - `id` (uuid, primary key)
      - `member_id` (uuid, foreign key)
      - `source_type` (enum: 'organic', 'campaign', 'import', 'referral', 'api')
      - `source_campaign_id` (uuid, foreign key, nullable)
      - `source_metadata` (jsonb)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Policies for clients to manage their own data
*/

-- Create enums
CREATE TYPE template_type AS ENUM ('sms', 'email', 'whatsapp');
CREATE TYPE campaign_type AS ENUM ('membership_enrollment', 'reward_distribution', 'general');
CREATE TYPE message_type AS ENUM ('sms', 'email', 'whatsapp', 'all');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'failed');
CREATE TYPE recipient_status AS ENUM ('pending', 'sent', 'failed', 'clicked');
CREATE TYPE source_type AS ENUM ('organic', 'campaign', 'import', 'referral', 'api');

-- Create message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_type template_type NOT NULL,
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '["name", "link", "program", "client"]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create message_campaigns table
CREATE TABLE IF NOT EXISTS message_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  campaign_type campaign_type NOT NULL,
  message_type message_type NOT NULL,
  template_id uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  custom_message text,
  target_audience text NOT NULL DEFAULT 'all_members',
  status campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create campaign_recipients table
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES message_campaigns(id) ON DELETE CASCADE,
  member_id uuid REFERENCES member_users(id) ON DELETE SET NULL,
  email text NOT NULL,
  phone text,
  full_name text NOT NULL,
  unique_link text NOT NULL,
  status recipient_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Create member_sources table
CREATE TABLE IF NOT EXISTS member_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  source_type source_type NOT NULL,
  source_campaign_id uuid REFERENCES message_campaigns(id) ON DELETE SET NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, source_campaign_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_message_templates_client ON message_templates(client_id);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_client ON message_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_status ON message_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_member ON campaign_recipients(member_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_member_sources_member ON member_sources(member_id);
CREATE INDEX IF NOT EXISTS idx_member_sources_campaign ON member_sources(source_campaign_id);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_templates

CREATE POLICY "Clients can view own templates"
  ON message_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_templates.client_id
    )
  );

CREATE POLICY "Clients can create templates"
  ON message_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_templates.client_id
    )
  );

CREATE POLICY "Clients can update own templates"
  ON message_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_templates.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_templates.client_id
    )
  );

CREATE POLICY "Clients can delete own templates"
  ON message_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_templates.client_id
    )
  );

-- RLS Policies for message_campaigns

CREATE POLICY "Clients can view own campaigns"
  ON message_campaigns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_campaigns.client_id
    )
  );

CREATE POLICY "Clients can create campaigns"
  ON message_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_campaigns.client_id
    )
  );

CREATE POLICY "Clients can update own campaigns"
  ON message_campaigns FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_campaigns.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id = message_campaigns.client_id
    )
  );

-- RLS Policies for campaign_recipients

CREATE POLICY "Clients can view campaign recipients"
  ON campaign_recipients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM message_campaigns mc
      JOIN profiles p ON p.client_id = mc.client_id
      WHERE mc.id = campaign_recipients.campaign_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert campaign recipients"
  ON campaign_recipients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM message_campaigns mc
      JOIN profiles p ON p.client_id = mc.client_id
      WHERE mc.id = campaign_recipients.campaign_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Clients can update campaign recipients"
  ON campaign_recipients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM message_campaigns mc
      JOIN profiles p ON p.client_id = mc.client_id
      WHERE mc.id = campaign_recipients.campaign_id
      AND p.id = auth.uid()
    )
  );

-- RLS Policies for member_sources

CREATE POLICY "Clients can view member sources"
  ON member_sources FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_users mu
      JOIN profiles p ON p.client_id = mu.client_id
      WHERE mu.id = member_sources.member_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert member sources"
  ON member_sources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM member_users mu
      JOIN profiles p ON p.client_id = mu.client_id
      WHERE mu.id = member_sources.member_id
      AND p.id = auth.uid()
    )
  );

-- Function to generate unique link for recipient
CREATE OR REPLACE FUNCTION generate_unique_link(
  p_campaign_id uuid,
  p_member_id uuid,
  p_recipient_email text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_base_url text;
BEGIN
  -- Generate unique token
  v_token := encode(digest(p_campaign_id::text || p_recipient_email || NOW()::text || random()::text, 'sha256'), 'hex');
  
  -- Get base URL from environment or use default
  v_base_url := current_setting('app.base_url', true);
  IF v_base_url IS NULL THEN
    v_base_url := 'https://yourdomain.com';
  END IF;
  
  -- Return personalized link
  RETURN v_base_url || '/enroll/' || v_token;
END;
$$;

-- Function to track link clicks
CREATE OR REPLACE FUNCTION track_link_click(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient campaign_recipients;
  v_campaign message_campaigns;
BEGIN
  -- Find recipient by unique link
  SELECT * INTO v_recipient
  FROM campaign_recipients
  WHERE unique_link LIKE '%' || p_token
  LIMIT 1;
  
  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  -- Update click status
  UPDATE campaign_recipients
  SET 
    status = 'clicked',
    clicked_at = NOW()
  WHERE id = v_recipient.id
  AND clicked_at IS NULL;
  
  -- Get campaign details
  SELECT * INTO v_campaign
  FROM message_campaigns
  WHERE id = v_recipient.campaign_id;
  
  -- Return campaign and recipient info
  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', v_campaign.id,
    'campaign_type', v_campaign.campaign_type,
    'member_id', v_recipient.member_id,
    'email', v_recipient.email,
    'full_name', v_recipient.full_name
  );
END;
$$;
