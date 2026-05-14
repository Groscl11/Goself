-- ── Marketplace Offer Governance ────────────────────────────────────────────
-- Adds admin QC + edit-approval flow for marketplace offers.
-- Existing live marketplace offers are backfilled to 'approved' so no
-- adopters' campaigns are disrupted.

-- 1. Extend rewards table with marketplace governance columns
ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS marketplace_status text
    CHECK (marketplace_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS marketplace_rejection_reason text,
  ADD COLUMN IF NOT EXISTS marketplace_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketplace_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketplace_submitted_at timestamptz;

-- 2. Backfill: existing live marketplace offers → approved (zero disruption)
UPDATE rewards
SET marketplace_status = 'approved'
WHERE offer_type = 'marketplace_offer' AND marketplace_status IS NULL;

-- 3. Index for fast admin queue lookups
CREATE INDEX IF NOT EXISTS idx_rewards_marketplace_status
  ON rewards(marketplace_status)
  WHERE offer_type = 'marketplace_offer';

-- 4. Edit-request table: captures diffs for approved offers awaiting admin sign-off
CREATE TABLE IF NOT EXISTS rewards_edit_requests (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id            uuid        NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  requesting_client_id uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  proposed_changes     jsonb       NOT NULL DEFAULT '{}',
  status               text        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason     text,
  reviewed_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewards_edit_requests_reward_id
  ON rewards_edit_requests(reward_id);

CREATE INDEX IF NOT EXISTS idx_rewards_edit_requests_status
  ON rewards_edit_requests(status);

-- 5. RLS for rewards_edit_requests
ALTER TABLE rewards_edit_requests ENABLE ROW LEVEL SECURITY;

-- Clients can only see their own edit requests
CREATE POLICY "clients_see_own_edit_requests"
  ON rewards_edit_requests
  FOR SELECT
  USING (
    requesting_client_id IN (
      SELECT client_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Clients can insert their own edit requests
CREATE POLICY "clients_insert_own_edit_requests"
  ON rewards_edit_requests
  FOR INSERT
  WITH CHECK (
    requesting_client_id IN (
      SELECT client_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "admins_full_edit_requests"
  ON rewards_edit_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
