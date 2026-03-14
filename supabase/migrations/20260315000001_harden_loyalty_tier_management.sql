-- Normalize loyalty tier defaults so each program has exactly one default tier.
WITH ranked_defaults AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY loyalty_program_id
      ORDER BY tier_level ASC, created_at ASC, id ASC
    ) AS default_rank
  FROM loyalty_tiers
  WHERE is_default = true
)
UPDATE loyalty_tiers
SET is_default = false,
    updated_at = now()
WHERE id IN (
  SELECT id FROM ranked_defaults WHERE default_rank > 1
);

WITH programs_without_default AS (
  SELECT DISTINCT lt.loyalty_program_id
  FROM loyalty_tiers lt
  WHERE NOT EXISTS (
    SELECT 1
    FROM loyalty_tiers existing_default
    WHERE existing_default.loyalty_program_id = lt.loyalty_program_id
      AND existing_default.is_default = true
  )
), ranked_fallbacks AS (
  SELECT
    lt.id,
    ROW_NUMBER() OVER (
      PARTITION BY lt.loyalty_program_id
      ORDER BY lt.tier_level ASC, lt.created_at ASC, lt.id ASC
    ) AS fallback_rank
  FROM loyalty_tiers lt
  JOIN programs_without_default pwd ON pwd.loyalty_program_id = lt.loyalty_program_id
)
UPDATE loyalty_tiers
SET is_default = true,
    updated_at = now()
WHERE id IN (
  SELECT id FROM ranked_fallbacks WHERE fallback_rank = 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_tiers_single_default_per_program
  ON loyalty_tiers(loyalty_program_id)
  WHERE is_default = true;

CREATE OR REPLACE FUNCTION delete_loyalty_tier(p_tier_id uuid, p_replacement_tier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier loyalty_tiers%ROWTYPE;
  v_replacement loyalty_tiers%ROWTYPE;
  v_reassigned_count integer := 0;
  v_is_authorized boolean := false;
BEGIN
  SELECT *
  INTO v_tier
  FROM loyalty_tiers
  WHERE id = p_tier_id;

  IF v_tier.id IS NULL THEN
    RAISE EXCEPTION 'Tier not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM loyalty_programs lp
    JOIN profiles p ON p.client_id = lp.client_id
    WHERE lp.id = v_tier.loyalty_program_id
      AND p.id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to delete this tier';
  END IF;

  SELECT *
  INTO v_replacement
  FROM loyalty_tiers
  WHERE id = p_replacement_tier_id;

  IF v_replacement.id IS NULL THEN
    RAISE EXCEPTION 'Replacement tier not found';
  END IF;

  IF v_replacement.id = v_tier.id THEN
    RAISE EXCEPTION 'Replacement tier must be different from the tier being deleted';
  END IF;

  IF v_replacement.loyalty_program_id <> v_tier.loyalty_program_id THEN
    RAISE EXCEPTION 'Replacement tier must belong to the same loyalty program';
  END IF;

  UPDATE member_loyalty_status
  SET current_tier_id = v_replacement.id,
      tier_achieved_at = now(),
      updated_at = now()
  WHERE current_tier_id = v_tier.id;

  GET DIAGNOSTICS v_reassigned_count = ROW_COUNT;

  IF v_tier.is_default THEN
    UPDATE loyalty_tiers
    SET is_default = false,
        updated_at = now()
    WHERE loyalty_program_id = v_tier.loyalty_program_id
      AND id <> v_replacement.id
      AND is_default = true;

    UPDATE loyalty_tiers
    SET is_default = true,
        updated_at = now()
    WHERE id = v_replacement.id;
  END IF;

  DELETE FROM loyalty_tiers
  WHERE id = v_tier.id;

  RETURN jsonb_build_object(
    'deleted_tier_id', v_tier.id,
    'deleted_tier_name', v_tier.tier_name,
    'replacement_tier_id', v_replacement.id,
    'replacement_tier_name', v_replacement.tier_name,
    'reassigned_members', v_reassigned_count,
    'promoted_default', v_tier.is_default
  );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_loyalty_tier(uuid, uuid) TO authenticated;