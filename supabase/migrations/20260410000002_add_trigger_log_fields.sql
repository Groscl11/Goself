-- Add new columns to campaign_trigger_logs for richer observability.
--
-- transaction_id    : UUID generated once per webhook delivery; correlates all
--                     log rows that came from the same webhook event.
-- shopify_order_name: Shopify display name (#1014).  order_id already holds the
--                     numeric internal Shopify ID; this makes the human-readable
--                     name a first-class column.
-- campaign_display_id: CAMP-XXXX human identifier copied from campaign_rules.
-- reward_link       : Full claim URL issued for standalone campaigns.

ALTER TABLE campaign_trigger_logs
  ADD COLUMN IF NOT EXISTS transaction_id       TEXT,
  ADD COLUMN IF NOT EXISTS shopify_order_name   TEXT,
  ADD COLUMN IF NOT EXISTS campaign_display_id  TEXT,
  ADD COLUMN IF NOT EXISTS reward_link          TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_trigger_logs_transaction_id
  ON campaign_trigger_logs(transaction_id)
  WHERE transaction_id IS NOT NULL;
