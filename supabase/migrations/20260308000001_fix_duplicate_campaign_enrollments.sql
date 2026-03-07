-- Prevent duplicate campaign enrollments: one member can only be enrolled
-- in a given program once. This eliminates the race condition where two
-- simultaneous Shopify webhook events (orders/create + orders/paid) both
-- pass the "already enrolled?" check and insert two rows.

-- Step 1: Remove duplicate member_memberships, keeping the earliest created row
DELETE FROM member_memberships
WHERE id NOT IN (
  SELECT DISTINCT ON (member_id, program_id) id
  FROM member_memberships
  ORDER BY member_id, program_id, created_at ASC
);

-- Step 2: Add unique constraint now that duplicates are cleared
ALTER TABLE member_memberships
  ADD CONSTRAINT uq_member_memberships_member_program
  UNIQUE (member_id, program_id);

-- Step 3: Remove duplicate success entries in campaign_trigger_logs,
-- keeping the earliest one per (campaign_rule_id, order_id)
DELETE FROM campaign_trigger_logs
WHERE trigger_result = 'success'
  AND id NOT IN (
    SELECT DISTINCT ON (campaign_rule_id, order_id) id
    FROM campaign_trigger_logs
    WHERE trigger_result = 'success'
    ORDER BY campaign_rule_id, order_id, created_at ASC
  );

-- Step 4: Partial unique index on campaign_trigger_logs to prevent duplicate
-- success entries for the same (campaign_rule_id, order_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_trigger_logs_success
  ON campaign_trigger_logs (campaign_rule_id, order_id)
  WHERE trigger_result = 'success';
