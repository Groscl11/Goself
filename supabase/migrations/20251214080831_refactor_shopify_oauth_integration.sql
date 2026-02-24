/*
  # Refactor Shopify Integration for OAuth 2.0 Flow

  1. Changes to integration_configs
    - Add shop_domain column (extracted from platform_name)
    - Add access_token column (encrypted OAuth token)
    - Add status column (connected/disconnected/error)
    - Add webhooks_registered boolean
    - Add installed_at timestamp
    - Add last_event_at timestamp (last webhook received)
    - Add scopes column (granted OAuth scopes)
    - Deprecate old manual credential fields

  2. Security
    - RLS policies remain unchanged
    - access_token should be encrypted at application level

  3. Backward Compatibility
    - Existing credentials structure preserved (but deprecated)
    - Migration gracefully handles existing data
*/

-- Add new OAuth-specific columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'shop_domain'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN shop_domain text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'access_token'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'status'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN status text DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'webhooks_registered'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN webhooks_registered boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'installed_at'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN installed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'last_event_at'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN last_event_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'scopes'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN scopes text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'webhook_ids'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN webhook_ids jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create index for shop_domain lookups (OAuth callback)
CREATE INDEX IF NOT EXISTS idx_integration_configs_shop_domain
ON integration_configs(shop_domain)
WHERE platform = 'shopify';

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_integration_configs_status
ON integration_configs(status)
WHERE platform = 'shopify';

-- Migrate existing Shopify integrations to new format
UPDATE integration_configs
SET
  shop_domain = credentials->>'shop_domain',
  status = CASE WHEN is_active THEN 'connected' ELSE 'disconnected' END,
  installed_at = created_at
WHERE platform = 'shopify'
  AND shop_domain IS NULL;

-- Create webhook events table for tracking incoming events
CREATE TABLE IF NOT EXISTS shopify_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integration_configs(id) ON DELETE CASCADE,
  shop_domain text NOT NULL,
  topic text NOT NULL,
  webhook_id text,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shopify_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook events
CREATE POLICY "Clients can view own webhook events"
  ON shopify_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    integration_id IN (
      SELECT id FROM integration_configs
      WHERE client_id IN (
        SELECT client_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Admins can view all webhook events
CREATE POLICY "Admins can view all webhook events"
  ON shopify_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- System can insert webhook events (service role)
CREATE POLICY "System can insert webhook events"
  ON shopify_webhook_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_integration
ON shopify_webhook_events(integration_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_shop_domain
ON shopify_webhook_events(shop_domain);

CREATE INDEX IF NOT EXISTS idx_webhook_events_topic
ON shopify_webhook_events(topic);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed
ON shopify_webhook_events(processed, created_at);

-- Add comment explaining OAuth flow
COMMENT ON COLUMN integration_configs.shop_domain IS 'Shopify shop domain (e.g., mystore.myshopify.com) - used for OAuth';
COMMENT ON COLUMN integration_configs.access_token IS 'OAuth access token - should be encrypted at application level';
COMMENT ON COLUMN integration_configs.status IS 'Integration status: connected (OAuth complete), disconnected, error, pending';
COMMENT ON COLUMN integration_configs.webhooks_registered IS 'Whether Shopify webhooks have been automatically registered';
COMMENT ON COLUMN integration_configs.installed_at IS 'Timestamp when OAuth flow completed';
COMMENT ON COLUMN integration_configs.last_event_at IS 'Timestamp of last webhook event received';
COMMENT ON COLUMN integration_configs.scopes IS 'OAuth scopes granted (e.g., read_orders, read_customers)';
COMMENT ON COLUMN integration_configs.webhook_ids IS 'Shopify webhook IDs registered for this integration';
