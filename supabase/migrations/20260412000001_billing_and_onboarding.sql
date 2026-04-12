-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Onboarding fields + invoices table
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend clients table with onboarding tracking + extra profile fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS industry            text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS website_url         text    DEFAULT NULL;

-- Mark existing clients (already live) as onboarding_completed = true
-- so onboarding only triggers for brand-new client records.
UPDATE clients SET onboarding_completed = true WHERE onboarding_completed IS DISTINCT FROM true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Plans table (GoSelf subscription plans)
--    Idempotent: only creates if it doesn't already exist.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id             text PRIMARY KEY,          -- 'free' | 'starter' | 'growth' | 'referral' | 'network' | 'enterprise'
  name           text NOT NULL,
  description    text DEFAULT '',
  price_monthly  numeric(10,2) DEFAULT 0,
  price_annual   numeric(10,2) DEFAULT 0,
  is_active      boolean DEFAULT true,
  sort_order     int DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- Seed default plans if table is empty
INSERT INTO plans (id, name, description, price_monthly, price_annual, sort_order)
VALUES
  ('free',       'Free',       'Get started with basic loyalty features', 0,       0,       0),
  ('starter',    'Starter',    'Essential tools for small stores',        1999,    19990,   1),
  ('growth',     'Growth',     'Advanced campaigns & analytics',          4999,    49990,   2),
  ('referral',   'Referral',   'Full referral + affiliate tracking',      7999,    79990,   3),
  ('network',    'Network',    'Cross-brand marketplace access',          14999,   149990,  4),
  ('enterprise', 'Enterprise', 'Custom pricing for large accounts',       0,       0,       5)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read plans" ON plans;
CREATE POLICY "Anyone can read plans" ON plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage plans" ON plans;
CREATE POLICY "Admins can manage plans" ON plans FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Client subscriptions table
--    Idempotent: only creates if it doesn't already exist.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_subscriptions (
  client_id           uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  plan_id             text NOT NULL DEFAULT 'free' REFERENCES plans(id),
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('trialing','active','past_due','suspended','cancelled')),
  billing_cycle       text NOT NULL DEFAULT 'monthly'
                        CHECK (billing_cycle IN ('monthly','annual')),
  amount_inr          numeric(10,2) DEFAULT NULL,
  trial_ends_at       timestamptz DEFAULT NULL,
  current_period_end  timestamptz DEFAULT NULL,
  payment_method      text NOT NULL DEFAULT 'manual'
                        CHECK (payment_method IN ('manual','razorpay','shopify')),
  notes               text DEFAULT NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients read own subscription" ON client_subscriptions;
CREATE POLICY "Clients read own subscription" ON client_subscriptions FOR SELECT
  USING (client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage subscriptions" ON client_subscriptions;
CREATE POLICY "Admins manage subscriptions" ON client_subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Invoices table (new)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number            text DEFAULT NULL,          -- e.g. 'GSI-2026-001'
  amount_inr                numeric(10,2) NOT NULL,
  status                    text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  billing_cycle             text DEFAULT 'monthly'
                              CHECK (billing_cycle IN ('monthly','annual')),
  plan_id                   text DEFAULT NULL REFERENCES plans(id),
  invoice_date              date NOT NULL DEFAULT CURRENT_DATE,
  due_date                  date DEFAULT NULL,
  paid_at                   timestamptz DEFAULT NULL,
  payment_method            text DEFAULT NULL,
  payment_link_url          text DEFAULT NULL,           -- Razorpay short URL or manual link
  razorpay_payment_link_id  text DEFAULT NULL,
  pdf_url                   text DEFAULT NULL,           -- optional uploaded PDF
  notes                     text DEFAULT NULL,
  created_by                uuid DEFAULT NULL REFERENCES profiles(id),
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- Auto-generate invoice number on insert
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq int;
  yr  text;
BEGIN
  yr  := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO seq FROM invoices WHERE to_char(created_at, 'YYYY') = yr;
  NEW.invoice_number := 'GSI-' || yr || '-' || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_number ON invoices;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients read own invoices" ON invoices;
CREATE POLICY "Clients read own invoices" ON invoices FOR SELECT
  USING (client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage invoices" ON invoices;
CREATE POLICY "Admins manage invoices" ON invoices FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Plan feature entitlements (idempotent create)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_feature_entitlements (
  plan_id  text NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature  text NOT NULL,
  PRIMARY KEY (plan_id, feature)
);

CREATE TABLE IF NOT EXISTS plan_module_entitlements (
  plan_id  text NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module   text NOT NULL,
  PRIMARY KEY (plan_id, module)
);

ALTER TABLE plan_feature_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read entitlements" ON plan_feature_entitlements;
CREATE POLICY "Anyone can read entitlements" ON plan_feature_entitlements FOR SELECT USING (true);

ALTER TABLE plan_module_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read module entitlements" ON plan_module_entitlements;
CREATE POLICY "Anyone can read module entitlements" ON plan_module_entitlements FOR SELECT USING (true);

-- Seed module entitlements per plan
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
