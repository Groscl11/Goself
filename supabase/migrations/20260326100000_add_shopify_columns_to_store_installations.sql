-- Add missing columns to store_installations that the OAuth callback requires
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_installations' AND column_name = 'shopify_access_token'
  ) THEN
    ALTER TABLE store_installations ADD COLUMN shopify_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_installations' AND column_name = 'shopify_api_secret'
  ) THEN
    ALTER TABLE store_installations ADD COLUMN shopify_api_secret text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_installations' AND column_name = 'myshopify_domain'
  ) THEN
    ALTER TABLE store_installations ADD COLUMN myshopify_domain text;
  END IF;
END $$;
