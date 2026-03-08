-- Allow phone-only campaign tokens: remove NOT NULL from email column.
-- validate-campaign-token already supports phone-based identity verification
-- (identityMatches checks both email and phone).
ALTER TABLE campaign_tokens ALTER COLUMN email DROP NOT NULL;
