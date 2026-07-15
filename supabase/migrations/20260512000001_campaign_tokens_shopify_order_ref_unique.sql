-- Add shopify_order_ref to campaign_tokens for idempotent webhook token creation
ALTER TABLE campaign_tokens ADD COLUMN IF NOT EXISTS shopify_order_ref text;

-- Partial unique index: one token per campaign per Shopify order
-- Partial so manually-created tokens (shopify_order_ref IS NULL) are unaffected
CREATE UNIQUE INDEX IF NOT EXISTS campaign_tokens_rule_shopify_order_uniq
  ON campaign_tokens (campaign_rule_id, shopify_order_ref)
  WHERE shopify_order_ref IS NOT NULL;
