-- ============================================================
-- Security Fix: flip "system" write policies TO authenticated
--               → TO service_role across 9 critical tables.
--
-- Findings addressed (InfoSec Audit 2026-06-02):
--   C-01  store_installations   — anon full-read + authenticated ALL
--   C-02  member_loyalty_status — authenticated ALL USING(true)
--   C-02  loyalty_points_transactions — authenticated INSERT + public UPDATE
--   C-03  store_webhooks        — authenticated ALL USING(true)
--   C-04  redemptions           — authenticated INSERT WITH CHECK(true)
--   C-04  reward_vouchers       — authenticated INSERT WITH CHECK(true)
--   C-04  reward_transactions   — authenticated INSERT WITH CHECK(true)
--   C-05  shopify_orders        — authenticated INSERT + public UPDATE
--   C-06  campaign_tokens       — anon USING(true) full-table read
--   H-05  shopify_webhook_events — authenticated INSERT WITH CHECK(true)
--   NEW-C-01 public role UPDATE on transactions + orders
--   NEW-C-02 offer_codes has NO RLS at all
-- ============================================================

BEGIN;

-- ── 1. store_installations ────────────────────────────────────────────────────
-- Drop: authenticated ALL (USING true) — any logged-in user could read/write
--        all Shopify access_tokens, billing details, app settings
DROP POLICY IF EXISTS "System can manage store installations" ON store_installations;
CREATE POLICY "System can manage store installations"
  ON store_installations FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Drop: anon USING(true) — exposed access_token, shop_email, shop_owner to public
-- All callers that need store_installations use service_role (edge functions).
DROP POLICY IF EXISTS "Anon can lookup store installation by shop domain" ON store_installations;

-- ── 2. member_loyalty_status ─────────────────────────────────────────────────
-- Drop: authenticated ALL USING(true) — any user could mint points, change tiers
DROP POLICY IF EXISTS "System can manage loyalty status" ON member_loyalty_status;
CREATE POLICY "System can manage loyalty status"
  ON member_loyalty_status FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. loyalty_points_transactions ───────────────────────────────────────────
-- Drop: authenticated INSERT WITH CHECK(true) — any user could fabricate accrual records
DROP POLICY IF EXISTS "System can create transactions" ON loyalty_points_transactions;
CREATE POLICY "System can create transactions"
  ON loyalty_points_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Drop: public UPDATE USING(true) — public role = everyone including anon
DROP POLICY IF EXISTS "System can update transactions" ON loyalty_points_transactions;
CREATE POLICY "System can update transactions"
  ON loyalty_points_transactions FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 4. store_webhooks ────────────────────────────────────────────────────────
-- Drop: authenticated ALL USING(true) — any user could redirect webhooks
DROP POLICY IF EXISTS "System can manage webhooks" ON store_webhooks;
CREATE POLICY "System can manage webhooks"
  ON store_webhooks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 5. redemptions ───────────────────────────────────────────────────────────
-- Drop: authenticated INSERT WITH CHECK(true) — any user could fabricate redemptions
DROP POLICY IF EXISTS "System can insert redemptions" ON redemptions;
CREATE POLICY "System can insert redemptions"
  ON redemptions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ── 6. reward_vouchers ───────────────────────────────────────────────────────
-- Drop: authenticated INSERT WITH CHECK(true) — any user could create vouchers
DROP POLICY IF EXISTS "System can insert vouchers" ON reward_vouchers;
CREATE POLICY "System can insert vouchers"
  ON reward_vouchers FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ── 7. reward_transactions ───────────────────────────────────────────────────
-- Drop: authenticated INSERT WITH CHECK(true) — any user could insert reward records
DROP POLICY IF EXISTS "System can insert transactions" ON reward_transactions;
CREATE POLICY "System can insert transactions"
  ON reward_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ── 8. shopify_orders ────────────────────────────────────────────────────────
-- Drop: authenticated INSERT (misleadingly named "Service role") WITH CHECK(true)
DROP POLICY IF EXISTS "Service role can insert orders" ON shopify_orders;
CREATE POLICY "Service role can insert orders"
  ON shopify_orders FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Drop: public UPDATE USING(true) — public role = everyone including anon
DROP POLICY IF EXISTS "Service role can update orders" ON shopify_orders;
CREATE POLICY "Service role can update orders"
  ON shopify_orders FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 9. shopify_webhook_events ────────────────────────────────────────────────
-- Drop: authenticated INSERT WITH CHECK(true) — any user could inject fake events
DROP POLICY IF EXISTS "System can insert webhook events" ON shopify_webhook_events;
CREATE POLICY "System can insert webhook events"
  ON shopify_webhook_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ── 10. campaign_tokens — remove anon full-table read ────────────────────────
-- Drop: anon USING(true) — all tokens (including emails, claim status) visible to public
-- Token validation is done exclusively via validate-campaign-token edge function
-- which uses service_role. No direct anon DB access is needed or safe.
DROP POLICY IF EXISTS "Anon read token by value" ON campaign_tokens;

-- ── 11. offer_codes — enable RLS (was completely disabled) ───────────────────
-- offer_codes stores all actual coupon codes for all tenants.
-- With RLS off, any authenticated user could SELECT * and get every code.
ALTER TABLE offer_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages offer codes"
  ON offer_codes FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Clients can view codes belonging to their own offers
CREATE POLICY "Clients view own offer codes"
  ON offer_codes FOR SELECT
  TO authenticated
  USING (
    offer_id IN (
      SELECT id FROM rewards
      WHERE owner_client_id IN (
        SELECT client_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

COMMIT;
