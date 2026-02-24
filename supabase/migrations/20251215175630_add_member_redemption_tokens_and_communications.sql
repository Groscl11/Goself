/*
  # Member Redemption Tokens and Campaign Communications

  1. New Tables
    - `member_redemption_tokens` - Individual member redemption tokens
      - Supports auth-required and one-click temporary links
      - Links to specific members and campaigns
      - Tracks usage and expiration
    
    - `communication_logs` - Track all communications sent
      - SMS, Email, WhatsApp support
      - Links to campaigns and members
      - Tracks delivery status and clicks

  2. Functions
    - Generate secure tokens
    - Create redemption links for members
    - Validate and track token usage
    - Prepare and log communications
    - Auto-trigger on campaign enrollment

  3. Security
    - Enable RLS on all tables
    - Clients can manage their own data
    - Public validation for tokens
*/

-- Create member_redemption_tokens table
CREATE TABLE IF NOT EXISTS member_redemption_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  member_id uuid REFERENCES member_users(id) ON DELETE CASCADE,
  campaign_rule_id uuid REFERENCES campaign_rules(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES member_memberships(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  link_type text NOT NULL DEFAULT 'auth_required' CHECK (link_type IN ('auth_required', 'one_click', 'temporary')),
  redemption_url text NOT NULL,
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  access_count integer DEFAULT 0,
  last_accessed_at timestamptz,
  redeemed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create communication_logs table
CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  member_id uuid REFERENCES member_users(id) ON DELETE SET NULL,
  campaign_rule_id uuid REFERENCES campaign_rules(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES member_memberships(id) ON DELETE SET NULL,
  communication_type text NOT NULL CHECK (communication_type IN ('sms', 'email', 'whatsapp')),
  recipient_email text,
  recipient_phone text,
  subject text,
  message_body text NOT NULL,
  redemption_token_id uuid REFERENCES member_redemption_tokens(id) ON DELETE SET NULL,
  personalized_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'clicked')),
  sent_at timestamptz,
  delivered_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  provider_response jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_member_redemption_tokens_client ON member_redemption_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_member_redemption_tokens_member ON member_redemption_tokens(member_id);
CREATE INDEX IF NOT EXISTS idx_member_redemption_tokens_token ON member_redemption_tokens(token);
CREATE INDEX IF NOT EXISTS idx_member_redemption_tokens_campaign ON member_redemption_tokens(campaign_rule_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_client ON communication_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_member ON communication_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_campaign_rule ON communication_logs(campaign_rule_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_status ON communication_logs(status);

-- Enable RLS
ALTER TABLE member_redemption_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for member_redemption_tokens
CREATE POLICY "Clients can view own redemption tokens"
  ON member_redemption_tokens
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id IS NOT NULL
    )
  );

CREATE POLICY "Clients can insert redemption tokens"
  ON member_redemption_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id IS NOT NULL
    )
  );

CREATE POLICY "Clients can update own redemption tokens"
  ON member_redemption_tokens
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- RLS Policies for communication_logs
CREATE POLICY "Clients can view own communication logs"
  ON communication_logs
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id IS NOT NULL
    )
  );

CREATE POLICY "Clients can insert communication logs"
  ON communication_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.client_id IS NOT NULL
    )
  );

CREATE POLICY "Clients can update own communication logs"
  ON communication_logs
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Function to generate secure redemption token
CREATE OR REPLACE FUNCTION generate_secure_token()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(v_token, '/', '_');
  v_token := replace(v_token, '+', '-');
  v_token := replace(v_token, '=', '');
  RETURN v_token;
END;
$$;

-- Function to create member redemption token
CREATE OR REPLACE FUNCTION create_member_redemption_token(
  p_client_id uuid,
  p_member_id uuid,
  p_membership_id uuid,
  p_campaign_rule_id uuid DEFAULT NULL,
  p_link_type text DEFAULT 'auth_required',
  p_valid_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_token_id uuid;
  v_url text;
  v_valid_until timestamptz;
  v_base_url text;
BEGIN
  v_token := generate_secure_token();
  
  IF p_link_type IN ('one_click', 'temporary') THEN
    v_valid_until := now() + (p_valid_days || ' days')::interval;
  END IF;
  
  v_base_url := current_setting('app.base_url', true);
  IF v_base_url IS NULL OR v_base_url = '' THEN
    v_base_url := 'https://yourdomain.com';
  END IF;
  
  IF p_link_type = 'auth_required' THEN
    v_url := v_base_url || '/member/rewards?ref=' || v_token;
  ELSE
    v_url := v_base_url || '/claim/' || v_token;
  END IF;
  
  INSERT INTO member_redemption_tokens (
    client_id,
    member_id,
    membership_id,
    campaign_rule_id,
    token,
    link_type,
    redemption_url,
    valid_until,
    is_active,
    metadata
  ) VALUES (
    p_client_id,
    p_member_id,
    p_membership_id,
    p_campaign_rule_id,
    v_token,
    p_link_type,
    v_url,
    v_valid_until,
    true,
    jsonb_build_object('created_at', now(), 'valid_days', p_valid_days)
  )
  RETURNING id INTO v_token_id;
  
  RETURN jsonb_build_object(
    'token_id', v_token_id,
    'token', v_token,
    'url', v_url,
    'link_type', p_link_type,
    'valid_until', v_valid_until
  );
END;
$$;

-- Function to validate redemption token
CREATE OR REPLACE FUNCTION validate_redemption_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token member_redemption_tokens;
  v_member member_users;
  v_client clients;
  v_campaign campaign_rules;
  v_membership member_memberships;
BEGIN
  SELECT * INTO v_token
  FROM member_redemption_tokens
  WHERE token = p_token
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid or inactive token'
    );
  END IF;
  
  IF v_token.link_type IN ('one_click', 'temporary') THEN
    IF v_token.valid_until IS NOT NULL AND v_token.valid_until < now() THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'Token has expired'
      );
    END IF;
  END IF;
  
  SELECT * INTO v_member FROM member_users WHERE id = v_token.member_id;
  SELECT * INTO v_client FROM clients WHERE id = v_token.client_id;
  SELECT * INTO v_membership FROM member_memberships WHERE id = v_token.membership_id;
  
  IF v_token.campaign_rule_id IS NOT NULL THEN
    SELECT * INTO v_campaign FROM campaign_rules WHERE id = v_token.campaign_rule_id;
  END IF;
  
  UPDATE member_redemption_tokens
  SET 
    last_accessed_at = now(),
    access_count = COALESCE(access_count, 0) + 1
  WHERE id = v_token.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'token_id', v_token.id,
    'link_type', v_token.link_type,
    'member', jsonb_build_object(
      'id', v_member.id,
      'email', v_member.email,
      'phone', v_member.phone,
      'name', v_member.full_name
    ),
    'client', jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name
    ),
    'membership', jsonb_build_object(
      'id', v_membership.id,
      'program_id', v_membership.program_id,
      'status', v_membership.status
    ),
    'campaign', CASE 
      WHEN v_campaign.id IS NOT NULL THEN
        jsonb_build_object('id', v_campaign.id, 'name', v_campaign.name)
      ELSE NULL
    END,
    'requires_auth', (v_token.link_type = 'auth_required')
  );
END;
$$;

-- Function to prepare campaign communication
CREATE OR REPLACE FUNCTION prepare_campaign_communication(
  p_client_id uuid,
  p_member_id uuid,
  p_membership_id uuid,
  p_campaign_rule_id uuid,
  p_communication_type text,
  p_message_template text,
  p_link_type text DEFAULT 'one_click',
  p_valid_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member member_users;
  v_client clients;
  v_campaign campaign_rules;
  v_program membership_programs;
  v_token_result jsonb;
  v_personalized_message text;
  v_communication_id uuid;
  v_subject text;
BEGIN
  SELECT * INTO v_member FROM member_users WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;
  
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;
  
  SELECT cr.*, mp.name as program_name, mp.description as program_description
  INTO v_campaign
  FROM campaign_rules cr
  JOIN membership_programs mp ON mp.id = cr.program_id
  WHERE cr.id = p_campaign_rule_id;
  
  v_token_result := create_member_redemption_token(
    p_client_id,
    p_member_id,
    p_membership_id,
    p_campaign_rule_id,
    p_link_type,
    p_valid_days
  );
  
  v_personalized_message := p_message_template;
  v_personalized_message := replace(v_personalized_message, '{name}', COALESCE(v_member.full_name, 'Valued Customer'));
  v_personalized_message := replace(v_personalized_message, '{client}', v_client.name);
  v_personalized_message := replace(v_personalized_message, '{program}', v_campaign.name);
  v_personalized_message := replace(v_personalized_message, '{link}', v_token_result->>'url');
  v_personalized_message := replace(v_personalized_message, '{validity}', p_valid_days::text || ' days');
  
  v_subject := 'Welcome to ' || v_client.name;
  IF v_campaign.name IS NOT NULL THEN
    v_subject := v_subject || ' - ' || v_campaign.name;
  END IF;
  
  INSERT INTO communication_logs (
    client_id,
    member_id,
    membership_id,
    campaign_rule_id,
    communication_type,
    recipient_email,
    recipient_phone,
    subject,
    message_body,
    redemption_token_id,
    personalized_url,
    status,
    metadata
  ) VALUES (
    p_client_id,
    p_member_id,
    p_membership_id,
    p_campaign_rule_id,
    p_communication_type,
    v_member.email,
    v_member.phone,
    v_subject,
    v_personalized_message,
    (v_token_result->>'token_id')::uuid,
    v_token_result->>'url',
    'pending',
    jsonb_build_object(
      'link_type', p_link_type,
      'valid_days', p_valid_days,
      'campaign_name', v_campaign.name,
      'program_name', v_campaign.program_name
    )
  )
  RETURNING id INTO v_communication_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'communication_id', v_communication_id,
    'redemption_token', v_token_result,
    'personalized_message', v_personalized_message,
    'subject', v_subject,
    'recipient', jsonb_build_object(
      'email', v_member.email,
      'phone', v_member.phone,
      'name', v_member.full_name
    )
  );
END;
$$;

-- Trigger function to auto-generate communication on campaign enrollment
CREATE OR REPLACE FUNCTION auto_generate_campaign_communication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign campaign_rules;
  v_communication_config jsonb;
  v_result jsonb;
  v_default_template text;
BEGIN
  IF NEW.campaign_rule_id IS NULL OR NEW.enrollment_source != 'campaign_auto' THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO v_campaign FROM campaign_rules WHERE id = NEW.campaign_rule_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  v_communication_config := v_campaign.trigger_conditions->'communication';
  
  IF v_communication_config IS NULL THEN
    v_default_template := 'Hi {name}! Congratulations on being enrolled in {program} at {client}! ' ||
                         'Click here to access your exclusive rewards and benefits: {link} ' ||
                         '(This link is valid for {validity})';
    
    v_communication_config := jsonb_build_object(
      'enabled', true,
      'type', 'email',
      'link_type', 'one_click',
      'valid_days', 30,
      'template', v_default_template
    );
  END IF;
  
  IF COALESCE((v_communication_config->>'enabled')::boolean, true) = true THEN
    v_result := prepare_campaign_communication(
      v_campaign.client_id,
      NEW.member_id,
      NEW.id,
      NEW.campaign_rule_id,
      COALESCE(v_communication_config->>'type', 'email'),
      COALESCE(v_communication_config->>'template', v_default_template),
      COALESCE(v_communication_config->>'link_type', 'one_click'),
      COALESCE((v_communication_config->>'valid_days')::integer, 30)
    );
    
    RAISE NOTICE 'Auto-generated communication for member % membership %: %', 
      NEW.member_id, NEW.id, v_result->>'communication_id';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_campaign_communication ON member_memberships;
CREATE TRIGGER trigger_auto_campaign_communication
  AFTER INSERT ON member_memberships
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_campaign_communication();