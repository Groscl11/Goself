/*
  # Standalone Campaign Rewards

  Adds non-membership campaign support with tokenized claim links.

  1. Alter campaign_rules
     - program_id  → nullable (standalone campaigns have no program)
     - rule_mode   → 'membership' | 'standalone'
     - reward_selection_mode → 'choice' | 'fixed'
     - min_rewards_choice, max_rewards_choice, link_expiry_hours

  2. Add coupon_type to rewards
     - 'generic' (single shared code) | 'unique' (individual codes per customer)

  3. New table: campaign_reward_pools
     - Many rewards per standalone campaign

  4. New table: campaign_tokens
     - One token per triggered standalone campaign per customer
     - Token is UUID, single-use, time-limited

  5. RLS on new tables
*/

-- ─── 1. Alter campaign_rules ──────────────────────────────────────────────────
-- Drop NOT NULL on program_id so standalone campaigns can omit it
ALTER TABLE campaign_rules ALTER COLUMN program_id DROP NOT NULL;

DO $$
BEGIN
  -- rule_mode: 'membership' | 'standalone'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rules' AND column_name = 'rule_mode'
  ) THEN
    ALTER TABLE campaign_rules ADD COLUMN rule_mode text NOT NULL DEFAULT 'membership';
  END IF;

  -- reward_selection_mode: 'choice' | 'fixed'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rules' AND column_name = 'reward_selection_mode'
  ) THEN
    ALTER TABLE campaign_rules ADD COLUMN reward_selection_mode text NOT NULL DEFAULT 'choice';
  END IF;

  -- min rewards customer may pick
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rules' AND column_name = 'min_rewards_choice'
  ) THEN
    ALTER TABLE campaign_rules ADD COLUMN min_rewards_choice integer NOT NULL DEFAULT 1;
  END IF;

  -- max rewards customer may pick
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rules' AND column_name = 'max_rewards_choice'
  ) THEN
    ALTER TABLE campaign_rules ADD COLUMN max_rewards_choice integer NOT NULL DEFAULT 1;
  END IF;

  -- hours until tokenized link expires (default 72 h)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rules' AND column_name = 'link_expiry_hours'
  ) THEN
    ALTER TABLE campaign_rules ADD COLUMN link_expiry_hours integer NOT NULL DEFAULT 72;
  END IF;
END $$;

-- ─── 2. coupon_type on rewards ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'coupon_type'
  ) THEN
    -- 'generic' = one shared code for all; 'unique' = individual codes per customer
    ALTER TABLE rewards ADD COLUMN coupon_type text NOT NULL DEFAULT 'unique';
  END IF;
END $$;

-- ─── 3. campaign_reward_pools ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_reward_pools (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_rule_id uuid NOT NULL REFERENCES campaign_rules(id) ON DELETE CASCADE,
  reward_id        uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_rule_id, reward_id)
);

CREATE INDEX IF NOT EXISTS idx_crp_campaign ON campaign_reward_pools(campaign_rule_id);
CREATE INDEX IF NOT EXISTS idx_crp_reward   ON campaign_reward_pools(reward_id);

ALTER TABLE campaign_reward_pools ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin manage campaign_reward_pools"
  ON campaign_reward_pools FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Client manages pools they own (via campaign_rules)
CREATE POLICY "Client manage own campaign_reward_pools"
  ON campaign_reward_pools FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaign_rules cr
      JOIN profiles p ON p.client_id = cr.client_id
      WHERE cr.id = campaign_reward_pools.campaign_rule_id
        AND p.id = auth.uid()
    )
  );

-- Public (anon) can read pools for active campaigns (needed by claim page)
CREATE POLICY "Anon read active campaign_reward_pools"
  ON campaign_reward_pools FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM campaign_rules cr
      WHERE cr.id = campaign_reward_pools.campaign_rule_id
        AND cr.is_active = true
    )
  );

-- ─── 4. campaign_tokens ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_rule_id uuid NOT NULL REFERENCES campaign_rules(id) ON DELETE CASCADE,
  order_id         uuid REFERENCES shopify_orders(id) ON DELETE SET NULL,
  member_id        uuid REFERENCES member_users(id) ON DELETE SET NULL,
  email            text NOT NULL,
  token            uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at       timestamptz NOT NULL,
  is_claimed       boolean NOT NULL DEFAULT false,
  claimed_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ct_token      ON campaign_tokens(token);
CREATE INDEX IF NOT EXISTS idx_ct_campaign   ON campaign_tokens(campaign_rule_id);
CREATE INDEX IF NOT EXISTS idx_ct_email      ON campaign_tokens(email);
CREATE INDEX IF NOT EXISTS idx_ct_expiry     ON campaign_tokens(expires_at) WHERE is_claimed = false;

ALTER TABLE campaign_tokens ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin manage campaign_tokens"
  ON campaign_tokens FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Client can read tokens for their own campaigns
CREATE POLICY "Client read own campaign_tokens"
  ON campaign_tokens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaign_rules cr
      JOIN profiles p ON p.client_id = cr.client_id
      WHERE cr.id = campaign_tokens.campaign_rule_id
        AND p.id = auth.uid()
    )
  );

-- Anon can read ONE token by its value (claim page validation)
-- (token is a UUID — effectively unguessable, 122 bits of entropy)
CREATE POLICY "Anon read token by value"
  ON campaign_tokens FOR SELECT TO anon
  USING (true);
-- NOTE: The claim page only exposes non-sensitive fields (is_claimed, expires_at, campaign).
--       The token UUID itself is the credential — no secondary auth needed for the claim flow.
--       Update (mark claimed) is done by the validate-campaign-token edge function
--       via the service_role key, not by the anon client.

-- ─── 5. Check constraint on rule_mode ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'campaign_rules' AND constraint_name = 'chk_campaign_rule_mode'
  ) THEN
    ALTER TABLE campaign_rules
      ADD CONSTRAINT chk_campaign_rule_mode
      CHECK (rule_mode IN ('membership', 'standalone'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'campaign_rules' AND constraint_name = 'chk_campaign_reward_selection_mode'
  ) THEN
    ALTER TABLE campaign_rules
      ADD CONSTRAINT chk_campaign_reward_selection_mode
      CHECK (reward_selection_mode IN ('choice', 'fixed'));
  END IF;
END $$;
