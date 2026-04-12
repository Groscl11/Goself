-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Run this FIRST — apply the billing/onboarding migration
-- (if tables already exist the IF NOT EXISTS guards make it safe to re-run)
-- ─────────────────────────────────────────────────────────────────────────────

-- Run the full migration file in Supabase SQL editor:
--   supabase/migrations/20260412000001_billing_and_onboarding.sql
-- OR paste it directly into Supabase > SQL Editor and run.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Mark ALL existing clients as onboarding_completed = true
-- (so existing clients aren't redirected to the onboarding wizard)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE clients
SET onboarding_completed = true
WHERE onboarding_completed IS DISTINCT FROM true;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Create a starter subscription for HoumeTest
-- Replace 'growth' with the actual plan if different.
-- ─────────────────────────────────────────────────────────────────────────────
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
  'growth',          -- change to actual plan: 'free' | 'starter' | 'growth' | 'referral' | 'network' | 'enterprise'
  'active',
  'monthly',
  4999,
  'manual',
  'HoumeTest account'
FROM clients c
WHERE LOWER(c.name) LIKE '%houmetest%'
   OR LOWER(c.name) LIKE '%houme%'
ON CONFLICT (client_id) DO UPDATE SET
  plan_id        = EXCLUDED.plan_id,
  status         = EXCLUDED.status,
  billing_cycle  = EXCLUDED.billing_cycle,
  amount_inr     = EXCLUDED.amount_inr,
  updated_at     = now();

-- Verify:
SELECT c.name, cs.*
FROM client_subscriptions cs
JOIN clients c ON c.id = cs.client_id
WHERE LOWER(c.name) LIKE '%houmetest%' OR LOWER(c.name) LIKE '%houme%';
