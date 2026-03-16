-- Backfill stale loyalty order counters from existing earned transaction history.
-- Uses distinct reference_id values to avoid double-counting duplicate webhook or retry writes.

WITH order_counts AS (
  SELECT
    mls.id AS member_loyalty_status_id,
    COUNT(DISTINCT lpt.reference_id) AS earned_order_count
  FROM member_loyalty_status mls
  LEFT JOIN loyalty_points_transactions lpt
    ON lpt.member_loyalty_status_id = mls.id
   AND lpt.transaction_type = 'earned'
   AND lpt.reference_id IS NOT NULL
  GROUP BY mls.id
)
UPDATE member_loyalty_status mls
SET total_orders = COALESCE(oc.earned_order_count, 0),
    updated_at = now()
FROM order_counts oc
WHERE oc.member_loyalty_status_id = mls.id
  AND mls.total_orders IS DISTINCT FROM COALESCE(oc.earned_order_count, 0);