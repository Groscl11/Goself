-- ── Affiliate Partners ──────────────────────────────────────────────────────
-- Phase 1: partner CRUD, code assignment, redemption tracking via shopify_orders

-- ── 1. affiliate_partners ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_partners (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  email        text,
  phone        text,
  partner_type text        NOT NULL DEFAULT 'influencer'
                           CHECK (partner_type IN ('influencer','creator','brand','other')),
  notes        text,
  status       text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','paused','archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_partners_client_id
  ON affiliate_partners(client_id);

-- ── 2. affiliate_partner_platforms ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_partner_platforms (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid        NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
  platform        text        NOT NULL,   -- instagram, youtube, twitter, tiktok, blog, podcast, newsletter
  handle          text,
  follower_count  integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aff_platforms_partner_id
  ON affiliate_partner_platforms(partner_id);

-- ── 3. affiliate_code_assignments ────────────────────────────────────────────
-- Links a discount code string to an affiliate partner.
-- code is the raw Shopify / manual discount code.
-- reward_id optionally points to the rewards row if imported via GoSelf offers.
CREATE TABLE IF NOT EXISTS affiliate_code_assignments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id           uuid        NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
  client_id            uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  code                 text        NOT NULL,
  reward_id            uuid        REFERENCES rewards(id) ON DELETE SET NULL,
  code_source          text        NOT NULL DEFAULT 'shopify'
                                   CHECK (code_source IN ('shopify','manual')),
  discount_description text,       -- human-readable e.g. "10% off"
  status               text        NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active','paused','removed')),
  assigned_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, code)
);

CREATE INDEX IF NOT EXISTS idx_aff_code_assignments_partner_id
  ON affiliate_code_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_aff_code_assignments_client_id
  ON affiliate_code_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_aff_code_assignments_code
  ON affiliate_code_assignments(code);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE affiliate_partners          ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_partner_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_code_assignments  ENABLE ROW LEVEL SECURITY;

-- affiliate_partners: client owns their own rows
CREATE POLICY "clients manage own affiliate partners"
  ON affiliate_partners FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- affiliate_partner_platforms: access through partner ownership
CREATE POLICY "clients manage own partner platforms"
  ON affiliate_partner_platforms FOR ALL
  USING (
    partner_id IN (
      SELECT id FROM affiliate_partners
      WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
  );

-- affiliate_code_assignments: client owns their own rows
CREATE POLICY "clients manage own code assignments"
  ON affiliate_code_assignments FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Service role bypasses RLS (edge functions)
