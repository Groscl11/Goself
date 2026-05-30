-- Referral module — core integrity fixes
--
-- 1. Catches up schema drift on member_loyalty_status.referral_code (column exists
--    in prod but no migration ever added it). Adds backfill, uniqueness, NOT NULL,
--    and an auto-generation trigger so every member always has a stable unique code.
-- 2. Adds referee_points_reward (admin default) on loyalty_earning_rules and
--    referee_points_awarded (per-row actual paid) on member_referrals — enables
--    the "both sides earn" flow without breaking existing referrer-only rows.
-- 3. Extends member_referrals with shopify_order_id and a 'self_referral' status,
--    replacing the full UNIQUE(loyalty_program_id, referred_member_id) with
--    partial unique indexes that preserve "one legit referral per referred member"
--    while allowing one self-referral row per order.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. member_loyalty_status.referral_code: column, backfill, uniqueness, NOT NULL
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE member_loyalty_status
  ADD COLUMN IF NOT EXISTS referral_code text;

-- Backfill NULL/empty codes. Uses the same 8-char uppercase hex derivation that
-- get-loyalty-status currently falls back to at runtime, so existing referral
-- links continue to work. Collisions (extremely unlikely with UUIDv4 prefixes
-- but defended for safety) resolved by appending a 4-char random suffix.
DO $$
DECLARE
  v_row record;
  v_code text;
  v_attempts int;
BEGIN
  FOR v_row IN
    SELECT id, member_user_id
      FROM member_loyalty_status
     WHERE referral_code IS NULL OR referral_code = ''
  LOOP
    v_code := UPPER(SUBSTRING(REPLACE(v_row.member_user_id::text, '-', ''), 1, 8));
    v_attempts := 0;
    WHILE EXISTS (SELECT 1 FROM member_loyalty_status WHERE referral_code = v_code) LOOP
      v_attempts := v_attempts + 1;
      v_code := UPPER(
        SUBSTRING(REPLACE(v_row.member_user_id::text, '-', ''), 1, 4) ||
        SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4)
      );
      EXIT WHEN v_attempts > 10;
    END LOOP;
    UPDATE member_loyalty_status SET referral_code = v_code WHERE id = v_row.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_loyalty_status_referral_code
  ON member_loyalty_status (referral_code);

ALTER TABLE member_loyalty_status
  ALTER COLUMN referral_code SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BEFORE INSERT trigger: auto-generate referral_code if not provided
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_member_loyalty_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
BEGIN
  IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
    RETURN NEW;
  END IF;

  v_code := UPPER(SUBSTRING(REPLACE(NEW.member_user_id::text, '-', ''), 1, 8));

  WHILE EXISTS (SELECT 1 FROM member_loyalty_status WHERE referral_code = v_code) LOOP
    v_attempts := v_attempts + 1;
    v_code := UPPER(
      SUBSTRING(REPLACE(NEW.member_user_id::text, '-', ''), 1, 4) ||
      SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4)
    );
    EXIT WHEN v_attempts > 10;
  END LOOP;

  NEW.referral_code := v_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_member_loyalty_referral_code_trigger
  ON member_loyalty_status;

CREATE TRIGGER set_member_loyalty_referral_code_trigger
  BEFORE INSERT ON member_loyalty_status
  FOR EACH ROW
  EXECUTE FUNCTION set_member_loyalty_referral_code();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. loyalty_earning_rules: referee_points_reward (admin default for member-type
--    referrers; future per-promoter rates will override per-row).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE loyalty_earning_rules
  ADD COLUMN IF NOT EXISTS referee_points_reward integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. member_referrals: per-row reward tracking + self-referral support
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE member_referrals
  ADD COLUMN IF NOT EXISTS shopify_order_id text;

-- Existing points_awarded column stays as referrer reward (dashboards depend on
-- it). The new column captures the referee reward per row, promoter-agnostic.
ALTER TABLE member_referrals
  ADD COLUMN IF NOT EXISTS referee_points_awarded integer NOT NULL DEFAULT 0;

-- Replace status CHECK to allow 'self_referral'. The original constraint name
-- isn't guaranteed across environments, so we discover it dynamically.
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
    FROM pg_constraint
   WHERE conrelid = 'member_referrals'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE member_referrals DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE member_referrals
  ADD CONSTRAINT member_referrals_status_check
  CHECK (status IN ('pending', 'completed', 'expired', 'self_referral'));

-- Drop the original full UNIQUE constraint (one referral per referred member)
-- so we can replace it with partial unique indexes that preserve the same
-- business rule for legit referrals while allowing self-referral logging.
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
    FROM pg_constraint
   WHERE conrelid = 'member_referrals'::regclass
     AND contype = 'u'
     AND array_length(conkey, 1) = 2
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE member_referrals DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

-- Legit referrals: still one-per-referred-member (current business rule)
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_referrals_legit_unique
  ON member_referrals (loyalty_program_id, referred_member_id)
  WHERE status IN ('pending', 'completed', 'expired');

-- Self-referral: one row per order (lets the widget detect "did THIS order
-- trigger a self-referral?" without colliding with legit referral history).
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_referrals_self_referral_unique
  ON member_referrals (loyalty_program_id, referred_member_id, shopify_order_id)
  WHERE status = 'self_referral';

CREATE INDEX IF NOT EXISTS idx_member_referrals_order
  ON member_referrals (shopify_order_id);
