-- Prevent duplicate terminal-result rows for same campaign+order at DB level
-- This makes idempotency atomic: concurrent webhooks cannot both insert a
-- terminal result row for the same (campaign_rule_id, order_id) pair.

-- Step 1: Remove pre-existing duplicates, keeping the earliest row per pair.
DELETE FROM campaign_trigger_logs
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY campaign_rule_id, order_id
             ORDER BY created_at ASC
           ) AS rn
    FROM campaign_trigger_logs
    WHERE trigger_result IN (
      'success', 'already_enrolled', 'max_reached',
      'below_threshold', 'not_matched'
    )
  ) sub
  WHERE rn > 1
);

-- Step 2: Add a partial unique index to block future duplicates at DB level.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_trigger_logs_terminal_unique
  ON campaign_trigger_logs (campaign_rule_id, order_id)
  WHERE trigger_result IN (
    'success', 'already_enrolled', 'max_reached',
    'below_threshold', 'not_matched'
  );
