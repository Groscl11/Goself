/*
  # Add Client Shopify Credentials Storage

  1. New Columns
    - `shopify_api_key` (text) - Client's Shopify API Key (Client ID)
    - `shopify_api_secret` (text) - Client's Shopify API Secret (encrypted)
    - `credentials_configured` (boolean) - Whether client has submitted their credentials

  2. Changes
    - Add columns to integration_configs table
    - These credentials are client-specific, not platform-wide
    - Allows each client to connect their own Shopify app

  3. Security
    - Credentials should be encrypted at application level before storage
    - RLS policies ensure clients can only access their own credentials
*/

-- Add columns for client-specific Shopify credentials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'shopify_api_key'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN shopify_api_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'shopify_api_secret'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN shopify_api_secret text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'credentials_configured'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN credentials_configured boolean DEFAULT false;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN integration_configs.shopify_api_key IS 'Client-specific Shopify API Key (Client ID) for OAuth';
COMMENT ON COLUMN integration_configs.shopify_api_secret IS 'Client-specific Shopify API Secret - encrypted at application level';
COMMENT ON COLUMN integration_configs.credentials_configured IS 'Whether client has configured their Shopify app credentials';
