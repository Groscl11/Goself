/*
  # Add unique index to prevent duplicate loyalty points per order

  Prevents double-crediting at the database level when Shopify fires
  the same webhook twice. Ensures only one earned/bonus transaction
  can exist per (member, reference_id) combination.
*/

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_order_loyalty_points
  ON loyalty_points_transactions (member_user_id, reference_id)
  WHERE transaction_type IN ('earned', 'bonus')
    AND reference_id IS NOT NULL
    AND reference_id != '';
