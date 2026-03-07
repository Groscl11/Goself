/*
  # Fix campaign_rewards table: ensure it exists + add RLS policies

  The campaign_rewards table was created outside of tracked migrations and has
  no RLS policies for authenticated client users, causing INSERT/DELETE to fail
  silently from the frontend.

  1. Create table if it doesn't already exist
  2. Add missing columns defensively (priority, is_active)
  3. Enable RLS
  4. Add client CRUD policy (via campaign_rules.client_id join)
  5. Add admin policy
*/

-- ── Create table if missing ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_rewards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaign_rules(id) ON DELETE CASCADE,
  reward_id   uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  priority    integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Defensive column additions (idempotent) ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rewards' AND column_name = 'priority'
  ) THEN
    ALTER TABLE campaign_rewards ADD COLUMN priority integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rewards' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE campaign_rewards ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaign_rewards_campaign    ON campaign_rewards(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_rewards_reward      ON campaign_rewards(reward_id);
CREATE INDEX IF NOT EXISTS idx_campaign_rewards_priority    ON campaign_rewards(campaign_id, priority);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE campaign_rewards ENABLE ROW LEVEL SECURITY;

-- Drop stale policies if any before recreating
DROP POLICY IF EXISTS "Clients can manage own campaign rewards" ON campaign_rewards;
DROP POLICY IF EXISTS "Admins can manage all campaign rewards"  ON campaign_rewards;
DROP POLICY IF EXISTS "Public can read active campaign rewards" ON campaign_rewards;

-- Clients: full CRUD on rewards that belong to their own campaigns
CREATE POLICY "Clients can manage own campaign rewards"
  ON campaign_rewards FOR ALL
  TO authenticated
  USING (
    campaign_id IN (
      SELECT cr.id FROM campaign_rules cr
      JOIN profiles p ON p.client_id = cr.client_id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT cr.id FROM campaign_rules cr
      JOIN profiles p ON p.client_id = cr.client_id
      WHERE p.id = auth.uid()
    )
  );

-- Admins: full access
CREATE POLICY "Admins can manage all campaign rewards"
  ON campaign_rewards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public read: allow unauthenticated reads for widget/public reward pages
CREATE POLICY "Public can read active campaign rewards"
  ON campaign_rewards FOR SELECT
  TO anon
  USING (is_active = true);
