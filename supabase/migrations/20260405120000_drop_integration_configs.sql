-- Migration: Drop integration_configs table
-- All references have been migrated to store_installations.
-- store_installations is the single source of truth for all Shopify store data.

-- 1. Drop order_sync_log (it has a NOT NULL FK to integration_configs with no replacement path)
--    If you need order sync logging, use shopify_webhook_events instead.
DROP TABLE IF EXISTS order_sync_log CASCADE;

-- 2. Drop integration_configs and all its dependent objects (indexes, policies, triggers)
DROP TABLE IF EXISTS integration_configs CASCADE;

-- 3. Add helper RPC used by shopify-webhook to update per-topic event counters on store_webhooks
--    Called as: rpc("increment_store_webhook_event", { p_store_installation_id, p_topic })
CREATE OR REPLACE FUNCTION increment_store_webhook_event(
  p_store_installation_id uuid,
  p_topic text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE store_webhooks
  SET
    total_events_received = total_events_received + 1,
    last_event_at = now(),
    last_success_at = now(),
    consecutive_failures = 0
  WHERE store_installation_id = p_store_installation_id
    AND webhook_topic = p_topic;
END;
$$;
