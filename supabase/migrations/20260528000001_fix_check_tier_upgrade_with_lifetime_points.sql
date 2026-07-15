-- Fix check_tier_upgrade to also consider min_lifetime_points as a qualification
-- criterion, alongside the existing min_orders and min_spend thresholds.
-- A value of 0 or NULL for any threshold means "no requirement" for that criterion.
-- Existing backfill: run recalculate-member-tiers edge function or call
-- check_tier_upgrade() for all members after deploying this migration.

CREATE OR REPLACE FUNCTION check_tier_upgrade(p_member_loyalty_status_id uuid)
RETURNS void AS $$
DECLARE
  v_status record;
  v_new_tier record;
BEGIN
  SELECT mls.*, lt.tier_level as current_tier_level
  INTO v_status
  FROM member_loyalty_status mls
  LEFT JOIN loyalty_tiers lt ON lt.id = mls.current_tier_id
  WHERE mls.id = p_member_loyalty_status_id;

  -- Find highest eligible tier considering all three qualification criteria.
  -- A threshold of 0 or NULL means "no requirement" for that criterion.
  SELECT *
  INTO v_new_tier
  FROM loyalty_tiers
  WHERE loyalty_program_id = v_status.loyalty_program_id
    AND (min_orders = 0 OR min_orders IS NULL OR v_status.total_orders >= min_orders)
    AND (min_spend = 0 OR min_spend IS NULL OR v_status.total_spend >= min_spend)
    AND (min_lifetime_points = 0 OR min_lifetime_points IS NULL OR v_status.lifetime_points_earned >= min_lifetime_points)
  ORDER BY tier_level DESC
  LIMIT 1;

  -- Only upgrade, never downgrade
  IF v_new_tier.id IS NOT NULL AND
     (v_status.current_tier_id IS NULL OR v_new_tier.tier_level > v_status.current_tier_level) THEN
    UPDATE member_loyalty_status
    SET current_tier_id = v_new_tier.id,
        tier_achieved_at = now()
    WHERE id = p_member_loyalty_status_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
