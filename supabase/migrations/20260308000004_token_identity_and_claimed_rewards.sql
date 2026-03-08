-- Phase 1 + 2: identity verification & claimed-rewards replay
-- Adds phone (optional second verifier) and claimed_rewards (replay store) to campaign_tokens

ALTER TABLE campaign_tokens
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS claimed_rewards jsonb;

-- Index for phone lookups (manual CSV flow will use this)
CREATE INDEX IF NOT EXISTS idx_ct_phone ON campaign_tokens(phone) WHERE phone IS NOT NULL;

COMMENT ON COLUMN campaign_tokens.phone          IS 'Optional phone number bound to token at generation — used as alternate identity verifier';
COMMENT ON COLUMN campaign_tokens.claimed_rewards IS 'JSONB snapshot of allocations written at claim time — enables already-claimed replay without extra lookup';
