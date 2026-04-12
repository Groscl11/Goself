-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Fix plan entitlements check constraint + seed all data + HoumeTest
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the restrictive check constraint on plan_module_entitlements.module
--    (it was created without 'communications' in the allowed list)
ALTER TABLE plan_module_entitlements
  DROP CONSTRAINT IF EXISTS plan_module_entitlements_module_check;

-- Also drop any check on plan_feature_entitlements if it exists
ALTER TABLE plan_feature_entitlements
  DROP CONSTRAINT IF EXISTS plan_feature_entitlements_feature_check;

-- 2. Add RLS policies (idempotent)
ALTER TABLE plan_feature_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read entitlements" ON plan_feature_entitlements;
CREATE POLICY "Anyone can read entitlements" ON plan_feature_entitlements FOR SELECT USING (true);

ALTER TABLE plan_module_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read module entitlements" ON plan_module_entitlements;
CREATE POLICY "Anyone can read module entitlements" ON plan_module_entitlements FOR SELECT USING (true);

-- 3. Seed module entitlements (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO plan_module_entitlements (plan_id, module) VALUES
  ('free',       'loyalty'),
  ('starter',    'loyalty'),
  ('starter',    'campaigns'),
  ('growth',     'loyalty'),
  ('growth',     'campaigns'),
  ('growth',     'communications'),
  ('referral',   'loyalty'),
  ('referral',   'campaigns'),
  ('referral',   'communications'),
  ('referral',   'referral'),
  ('network',    'loyalty'),
  ('network',    'campaigns'),
  ('network',    'communications'),
  ('network',    'referral'),
  ('network',    'network'),
  ('enterprise', 'loyalty'),
  ('enterprise', 'campaigns'),
  ('enterprise', 'communications'),
  ('enterprise', 'referral'),
  ('enterprise', 'network')
ON CONFLICT DO NOTHING;

-- 4. Seed feature entitlements (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO plan_feature_entitlements (plan_id, feature) VALUES
  -- free
  ('free',       'loyalty.points_earn'),
  ('free',       'loyalty.points_balance'),
  ('free',       'loyalty.member_widget'),
  -- starter
  ('starter',    'loyalty.points_earn'),
  ('starter',    'loyalty.points_balance'),
  ('starter',    'loyalty.member_widget'),
  ('starter',    'loyalty.tiers'),
  ('starter',    'loyalty.redemption'),
  ('starter',    'loyalty.product_page_points'),
  ('starter',    'loyalty.thankyou_page_points'),
  ('starter',    'campaigns.order_value_trigger'),
  ('starter',    'campaigns.auto_enrollment'),
  -- growth
  ('growth',     'loyalty.points_earn'),
  ('growth',     'loyalty.points_balance'),
  ('growth',     'loyalty.member_widget'),
  ('growth',     'loyalty.tiers'),
  ('growth',     'loyalty.redemption'),
  ('growth',     'loyalty.product_page_points'),
  ('growth',     'loyalty.thankyou_page_points'),
  ('growth',     'campaigns.order_value_trigger'),
  ('growth',     'campaigns.auto_enrollment'),
  ('growth',     'campaigns.advanced_conditions'),
  ('growth',     'campaigns.analytics'),
  -- referral
  ('referral',   'loyalty.points_earn'),
  ('referral',   'loyalty.points_balance'),
  ('referral',   'loyalty.member_widget'),
  ('referral',   'loyalty.tiers'),
  ('referral',   'loyalty.redemption'),
  ('referral',   'loyalty.product_page_points'),
  ('referral',   'loyalty.thankyou_page_points'),
  ('referral',   'campaigns.order_value_trigger'),
  ('referral',   'campaigns.auto_enrollment'),
  ('referral',   'campaigns.advanced_conditions'),
  ('referral',   'campaigns.analytics'),
  ('referral',   'referral.link_generation'),
  ('referral',   'referral.tracking'),
  ('referral',   'referral.tiered_commissions'),
  ('referral',   'referral.affiliate_dashboard'),
  -- network
  ('network',    'loyalty.points_earn'),
  ('network',    'loyalty.points_balance'),
  ('network',    'loyalty.member_widget'),
  ('network',    'loyalty.tiers'),
  ('network',    'loyalty.redemption'),
  ('network',    'loyalty.product_page_points'),
  ('network',    'loyalty.thankyou_page_points'),
  ('network',    'campaigns.order_value_trigger'),
  ('network',    'campaigns.auto_enrollment'),
  ('network',    'campaigns.advanced_conditions'),
  ('network',    'campaigns.analytics'),
  ('network',    'referral.link_generation'),
  ('network',    'referral.tracking'),
  ('network',    'referral.tiered_commissions'),
  ('network',    'referral.affiliate_dashboard'),
  ('network',    'network.cross_brand_vouchers'),
  ('network',    'network.brand_marketplace'),
  ('network',    'network.analytics'),
  -- enterprise (all features)
  ('enterprise', 'loyalty.points_earn'),
  ('enterprise', 'loyalty.points_balance'),
  ('enterprise', 'loyalty.member_widget'),
  ('enterprise', 'loyalty.tiers'),
  ('enterprise', 'loyalty.redemption'),
  ('enterprise', 'loyalty.product_page_points'),
  ('enterprise', 'loyalty.thankyou_page_points'),
  ('enterprise', 'campaigns.order_value_trigger'),
  ('enterprise', 'campaigns.auto_enrollment'),
  ('enterprise', 'campaigns.advanced_conditions'),
  ('enterprise', 'campaigns.analytics'),
  ('enterprise', 'referral.link_generation'),
  ('enterprise', 'referral.tracking'),
  ('enterprise', 'referral.tiered_commissions'),
  ('enterprise', 'referral.affiliate_dashboard'),
  ('enterprise', 'network.cross_brand_vouchers'),
  ('enterprise', 'network.brand_marketplace'),
  ('enterprise', 'network.analytics')
ON CONFLICT DO NOTHING;

-- 5. Mark ALL existing clients as onboarding_completed = true
--    (so existing live clients don't get redirected to the wizard)
UPDATE clients
SET onboarding_completed = true
WHERE onboarding_completed IS NULL OR onboarding_completed = false;

-- 6. Create HoumeTest subscription if missing
--    (idempotent: ON CONFLICT updates existing record)
INSERT INTO client_subscriptions (
  client_id,
  plan_id,
  status,
  billing_cycle,
  amount_inr,
  payment_method,
  notes
)
SELECT
  c.id,
  'growth',
  'active',
  'monthly',
  4999,
  'manual',
  'HoumeTest account'
FROM clients c
WHERE LOWER(c.name) ILIKE '%houmetest%'
   OR LOWER(c.name) ILIKE '%houme%'
ON CONFLICT (client_id) DO UPDATE SET
  status      = EXCLUDED.status,
  updated_at  = now();
