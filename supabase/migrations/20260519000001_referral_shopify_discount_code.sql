-- Add shopify_discount_code to loyalty_earning_rules
-- Merchants enter the Shopify discount code they created (e.g. "FRIEND500").
-- The referral widget uses it to build the referral link as:
--   /discount/{shopify_discount_code}?ref={member_referral_code}
-- This auto-applies the friend discount the moment the referred customer lands.

ALTER TABLE loyalty_earning_rules
  ADD COLUMN IF NOT EXISTS shopify_discount_code text;

COMMENT ON COLUMN loyalty_earning_rules.shopify_discount_code IS
  'Shopify discount code applied to the referred friend''s cart via /discount/{code}?ref={referral_code}';
