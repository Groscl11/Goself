/*
  # Fix public read policies for the claim-rewards page

  The /claim-rewards public page (SelectRewards.tsx) queries four tables
  using the anon key:
    1. campaign_rewards  → already has anon SELECT (previous migration)
    2. rewards           → missing anon SELECT  ← causes "Failed to load rewards"
    3. brands            → missing anon SELECT  ← joined from rewards.brand_id
    4. campaign_rules    → missing anon SELECT  ← for campaign name display
    5. clients           → missing anon SELECT  ← joined from campaign_rules.client_id

  This migration adds the minimum public read policies so the claim flow works
  without exposing administrative or draft data.
*/

-- ── rewards ──────────────────────────────────────────────────────────────────
-- Allow anonymous users to read approved/active rewards so they can be shown
-- on the public claim-rewards page.
DROP POLICY IF EXISTS "Public can read active rewards" ON rewards;
CREATE POLICY "Public can read active rewards"
  ON rewards FOR SELECT
  TO anon
  USING (status = 'active');

-- ── brands ───────────────────────────────────────────────────────────────────
-- Allow anonymous users to read approved brand details (name, logo) so the
-- brand name/logo shows on the claim-rewards page.
DROP POLICY IF EXISTS "Public can read approved brands" ON brands;
CREATE POLICY "Public can read approved brands"
  ON brands FOR SELECT
  TO anon
  USING (status = 'approved');

-- ── campaign_rules ────────────────────────────────────────────────────────────
-- Allow anonymous users to read active campaign rules so the campaign name
-- displays on the claim-rewards page.
DROP POLICY IF EXISTS "Public can read active campaign rules" ON campaign_rules;
CREATE POLICY "Public can read active campaign rules"
  ON campaign_rules FOR SELECT
  TO anon
  USING (is_active = true);

-- ── clients ───────────────────────────────────────────────────────────────────
-- Allow anonymous users to read client names so the brand/merchant name
-- displays on the claim-rewards page.
DROP POLICY IF EXISTS "Public can read active clients" ON clients;
CREATE POLICY "Public can read active clients"
  ON clients FOR SELECT
  TO anon
  USING (is_active = true);
