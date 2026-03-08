-- Tokens created from a Shopify purchase session are pre-verified:
-- the merchant's checkout already authenticated the customer, so no
-- additional identity check should be required on the claim page.
ALTER TABLE campaign_tokens
  ADD COLUMN IF NOT EXISTS is_pre_verified boolean NOT NULL DEFAULT false;
