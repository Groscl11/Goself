-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: prod reconciliation — partners table + rewards partner columns
-- 2026-07-09
--
-- Applied directly to PRODUCTION (lizgppzyyljqbmzdytia) on 2026-07-09 to fix a
-- "Could not find the table 'public.partners' in the schema cache" error in the
-- partner-voucher wizard. Prod's offers schema had drifted behind staging: it
-- lacked the `partners` table and the `rewards.offer_category` / `rewards.partner_id`
-- columns that the frontend (PartnerPickerField / PartnerWizard) requires.
--
-- ADDITIVE ONLY — no destructive drops. Legacy `rewards.category` / `client_id`
-- are left intact. All statements are idempotent (IF NOT EXISTS) and safe to run
-- after 20260509000001_partners_table_rewards_overhaul.sql on a fresh DB.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── partners table (mirrors 20260509000001 PART 1) ─────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        text UNIQUE,
  name              text NOT NULL,
  logo_url          text,
  shop_domain       text,
  website_url       text,
  contact_email     text,
  contact_phone     text,
  description       text,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','active','suspended')),
  owner_client_id   uuid,
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_partner_id      ON partners(partner_id);
CREATE INDEX IF NOT EXISTS idx_partners_owner_client_id ON partners(owner_client_id);
CREATE INDEX IF NOT EXISTS idx_partners_shop_domain     ON partners(shop_domain);
CREATE INDEX IF NOT EXISTS idx_partners_status          ON partners(status);

CREATE OR REPLACE FUNCTION generate_partner_id()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE new_id text; done bool;
BEGIN
  done := false;
  WHILE NOT done LOOP
    new_id := 'PTR-' || upper(substring(md5(random()::text) from 1 for 8));
    done   := NOT EXISTS (SELECT 1 FROM partners WHERE partner_id = new_id);
  END LOOP;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION set_partner_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.partner_id IS NULL THEN NEW.partner_id := generate_partner_id(); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_set_partner_id ON partners;
CREATE TRIGGER trigger_set_partner_id
  BEFORE INSERT ON partners FOR EACH ROW EXECUTE FUNCTION set_partner_id();

CREATE OR REPLACE FUNCTION set_partners_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trigger_partners_updated_at ON partners;
CREATE TRIGGER trigger_partners_updated_at
  BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION set_partners_updated_at();

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_partners" ON partners;
CREATE POLICY "service_role_all_partners" ON partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_active_partners" ON partners;
CREATE POLICY "authenticated_read_active_partners" ON partners
  FOR SELECT TO authenticated USING (status = 'active');

DROP POLICY IF EXISTS "clients_manage_own_partners" ON partners;
CREATE POLICY "clients_manage_own_partners" ON partners
  FOR ALL TO authenticated
  USING (owner_client_id IN (
    SELECT profiles.client_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client'))
  WITH CHECK (owner_client_id IN (
    SELECT profiles.client_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client'));

-- ── rewards columns needed by the partner-voucher save (additive) ──────────────
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS offer_category text;

-- Backfill only if the legacy `category` column still exists (guarded so this is
-- safe to run AFTER the overhaul migration which renames category -> offer_category).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='rewards' AND column_name='category')
     AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='rewards' AND column_name='offer_category') THEN
    UPDATE rewards SET offer_category = category
      WHERE offer_category IS NULL AND category IS NOT NULL;
  END IF;
END $$;

ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rewards_partner_id ON rewards(partner_id);
