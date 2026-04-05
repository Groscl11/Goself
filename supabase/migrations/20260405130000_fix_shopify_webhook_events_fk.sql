-- Migration: Fix shopify_webhook_events to reference store_installations
-- The old integration_id FK pointed to integration_configs (now dropped).
-- We add store_installation_id and drop the broken integration_id column.

-- 1. Add store_installation_id column (nullable to avoid breaking existing rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopify_webhook_events' AND column_name = 'store_installation_id'
  ) THEN
    ALTER TABLE shopify_webhook_events
      ADD COLUMN store_installation_id uuid REFERENCES store_installations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Backfill store_installation_id from shop_domain for existing rows
UPDATE shopify_webhook_events e
SET store_installation_id = si.id
FROM store_installations si
WHERE si.shop_domain = e.shop_domain
  AND e.store_installation_id IS NULL;

-- 3. Drop the old broken integration_id column (FK was already removed by CASCADE drop)
ALTER TABLE shopify_webhook_events
  DROP COLUMN IF EXISTS integration_id;

-- 4. Add index for the new FK
CREATE INDEX IF NOT EXISTS idx_shopify_webhook_events_store_id
  ON shopify_webhook_events(store_installation_id);
