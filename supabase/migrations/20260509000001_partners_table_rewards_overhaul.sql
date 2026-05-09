-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: partners table + rewards schema overhaul
-- 2026-05-09
-- Applied to staging first; production after user sign-off.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: CREATE partners TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        text UNIQUE,                         -- PTR-XXXXXXXX auto-generated
  name              text NOT NULL,
  logo_url          text,
  shop_domain       text,                                -- Shopify store domain if applicable
  website_url       text,
  contact_email     text,
  contact_phone     text,
  description       text,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','active','suspended')),
  owner_client_id   uuid,                               -- which Goself client brought them in
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_partner_id      ON partners(partner_id);
CREATE INDEX IF NOT EXISTS idx_partners_owner_client_id ON partners(owner_client_id);
CREATE INDEX IF NOT EXISTS idx_partners_shop_domain     ON partners(shop_domain);
CREATE INDEX IF NOT EXISTS idx_partners_status          ON partners(status);

-- Auto-generate PTR-XXXXXXXX (mirrors pattern used by rewards.reward_id)
CREATE OR REPLACE FUNCTION generate_partner_id()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  new_id text;
  done   bool;
BEGIN
  done := false;
  WHILE NOT done LOOP
    new_id := 'PTR-' || upper(substring(md5(random()::text) from 1 for 8));
    done   := NOT EXISTS (SELECT 1 FROM partners WHERE partner_id = new_id);
  END LOOP;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_partner_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.partner_id IS NULL THEN
    NEW.partner_id := generate_partner_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_partner_id ON partners;
CREATE TRIGGER trigger_set_partner_id
  BEFORE INSERT ON partners
  FOR EACH ROW EXECUTE FUNCTION set_partner_id();

CREATE OR REPLACE FUNCTION set_partners_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_partners_updated_at ON partners;
CREATE TRIGGER trigger_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION set_partners_updated_at();

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_partners" ON partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_active_partners" ON partners
  FOR SELECT TO authenticated USING (status = 'active');

CREATE POLICY "clients_manage_own_partners" ON partners
  FOR ALL TO authenticated
  USING (owner_client_id IN (
    SELECT profiles.client_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client'
  ))
  WITH CHECK (owner_client_id IN (
    SELECT profiles.client_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: DATA CONSOLIDATION (safe UPDATEs before any drops)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE rewards SET valid_until = expiry_date
  WHERE valid_until IS NULL AND expiry_date IS NOT NULL;

UPDATE rewards SET owner_client_id = client_id
  WHERE owner_client_id IS NULL AND client_id IS NOT NULL;

UPDATE rewards SET status = 'inactive'
  WHERE is_active = false AND status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: DROP VIEW that depends on rewards.currency
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS transaction_summary_view;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: DROP RLS POLICIES that reference rewards.client_id
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients can create own rewards"               ON rewards;
DROP POLICY IF EXISTS "Clients can update own rewards"               ON rewards;
DROP POLICY IF EXISTS "Clients can delete own rewards"               ON rewards;
DROP POLICY IF EXISTS "Clients can view marketplace and own rewards" ON rewards;

-- Cross-table policies that join through rewards.client_id
DROP POLICY IF EXISTS "Clients can manage vouchers for own rewards"             ON vouchers;
DROP POLICY IF EXISTS "Clients can view analytics for brands they work with"    ON brand_analytics;
DROP POLICY IF EXISTS "Clients can view own distributions"                      ON offer_distributions;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5: ALTER rewards — rename, add new columns, drop stale columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE rewards RENAME COLUMN category TO offer_category;

ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS partner_id        uuid REFERENCES partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_priority    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_count       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_limit_total integer,
  ADD COLUMN IF NOT EXISTS starts_at         timestamptz,
  ADD COLUMN IF NOT EXISTS is_featured       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_to_tiers  text[];

ALTER TABLE rewards
  DROP COLUMN IF EXISTS client_id,
  DROP COLUMN IF EXISTS expiry_date,
  DROP COLUMN IF EXISTS is_marketplace,
  DROP COLUMN IF EXISTS is_marketplace_listed,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS redeemed_count,
  DROP COLUMN IF EXISTS value_description,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS tracking_type;

CREATE INDEX IF NOT EXISTS idx_rewards_partner_id     ON rewards(partner_id);
CREATE INDEX IF NOT EXISTS idx_rewards_offer_priority ON rewards(offer_priority DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_offer_category ON rewards(offer_category);
CREATE INDEX IF NOT EXISTS idx_rewards_is_featured    ON rewards(is_featured);
CREATE INDEX IF NOT EXISTS idx_rewards_starts_at      ON rewards(starts_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6: RECREATE RLS POLICIES using owner_client_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Clients can create own rewards" ON rewards
  FOR INSERT TO authenticated
  WITH CHECK (owner_client_id IN (
    SELECT profiles.client_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client'
  ));

CREATE POLICY "Clients can update own rewards" ON rewards
  FOR UPDATE TO authenticated
  USING (owner_client_id IN (
    SELECT profiles.client_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client'
  ))
  WITH CHECK (owner_client_id IN (
    SELECT profiles.client_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client'
  ));

CREATE POLICY "Clients can delete own rewards" ON rewards
  FOR DELETE TO authenticated
  USING (owner_client_id IN (
    SELECT profiles.client_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client'
  ));

CREATE POLICY "Clients can view marketplace and own rewards" ON rewards
  FOR SELECT TO authenticated
  USING (
    (offer_type = 'marketplace_offer')
    OR (owner_client_id IN (
      SELECT profiles.client_id FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'client'
    ))
  );

CREATE POLICY "Clients can manage vouchers for own rewards" ON vouchers
  FOR ALL TO authenticated
  USING (
    (reward_id IN (
      SELECT rewards.id FROM rewards
      WHERE
        rewards.owner_client_id IN (
          SELECT profiles.client_id FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'client'
        )
        OR rewards.brand_id IN (
          SELECT profiles.brand_id FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'brand'
        )
    ))
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Clients can view analytics for brands they work with" ON brand_analytics
  FOR SELECT TO authenticated
  USING (brand_id IN (
    SELECT DISTINCT r.brand_id FROM rewards r
    WHERE r.owner_client_id IN (
      SELECT profiles.client_id FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'client'
    )
  ));

CREATE POLICY "Clients can view own distributions" ON offer_distributions
  FOR SELECT TO authenticated
  USING (
    distributing_client_id IN (
      SELECT profiles.client_id FROM profiles WHERE profiles.id = auth.uid()
    )
    OR offer_id IN (
      SELECT rewards.id FROM rewards
      WHERE rewards.owner_client_id IN (
        SELECT profiles.client_id FROM profiles WHERE profiles.id = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 7: RECREATE transaction_summary_view without currency column
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW transaction_summary_view AS
SELECT
  rt.id                                   AS transaction_id,
  rt.created_at                           AS transaction_date,
  CASE
    WHEN rt.transaction_type = 'redemption' THEN 'redeemed'
    ELSE 'issued'
  END                                     AS transaction_type,
  mu.id                                   AS member_id,
  mu.full_name                            AS member_name,
  mu.email                                AS member_email,
  c.id                                    AS client_id,
  c.name                                  AS client_name,
  r.id                                    AS reward_id,
  r.title                                 AS reward_title,
  COALESCE(r.reward_id, r.id::text)       AS reward_code,
  b.id                                    AS brand_id,
  b.name                                  AS brand_name,
  COALESCE(rv.id::text, 'N/A')            AS voucher_id,
  COALESCE(rv.voucher_code, 'N/A')        AS voucher_code,
  COALESCE(rv.status::text, 'N/A')        AS voucher_status,
  rv.expires_at                           AS voucher_expires_at,
  NULL::text                              AS issued_by_email,
  NULL::text                              AS issued_by_type,
  'system'::text                          AS issuance_channel,
  r.reward_type,
  r.discount_value,
  'INR'::text                             AS currency,
  rv.redeemed_at
FROM reward_transactions rt
JOIN member_users        mu ON rt.member_id  = mu.id
JOIN rewards             r  ON rt.reward_id  = r.id
JOIN brands              b  ON r.brand_id    = b.id
JOIN clients             c  ON mu.client_id  = c.id
LEFT JOIN reward_vouchers rv ON rt.voucher_id = rv.id
WHERE rt.transaction_type = ANY (ARRAY[
  'allocation'::reward_transaction_type,
  'redemption'::reward_transaction_type
]);
