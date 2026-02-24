/*
  # Fix duplicate loyalty points prevention

  The check_duplicate_order_points function only checked the order_id (UUID) column,
  but Shopify order IDs are stored in reference_id (text) with order_id = NULL.
  This caused the duplicate check to always return false, allowing double-crediting
  when Shopify fires the same webhook twice (within 1 second).

  Fix: Update function to check reference_id (text) first, then order_id (UUID) as fallback.
*/

CREATE OR REPLACE FUNCTION public.check_duplicate_order_points(
  p_order_id text,
  p_member_user_id uuid,
  p_loyalty_program_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  already_processed boolean;
BEGIN
  IF p_order_id IS NULL OR p_order_id = '' THEN
    RETURN false;
  END IF;

  -- Check by reference_id (text) - this is how Shopify order IDs are stored
  SELECT EXISTS(
    SELECT 1
    FROM loyalty_points_transactions lpt
    JOIN member_loyalty_status mls ON mls.id = lpt.member_loyalty_status_id
    WHERE lpt.reference_id = p_order_id
      AND lpt.member_user_id = p_member_user_id
      AND mls.loyalty_program_id = p_loyalty_program_id
      AND lpt.transaction_type IN ('earned', 'bonus')
  ) INTO already_processed;

  IF already_processed THEN
    RETURN true;
  END IF;

  -- Also check by order_id (UUID) for backwards compatibility
  BEGIN
    DECLARE
      order_uuid uuid;
    BEGIN
      order_uuid := p_order_id::uuid;
      SELECT EXISTS(
        SELECT 1
        FROM loyalty_points_transactions lpt
        JOIN member_loyalty_status mls ON mls.id = lpt.member_loyalty_status_id
        WHERE lpt.order_id = order_uuid
          AND lpt.member_user_id = p_member_user_id
          AND mls.loyalty_program_id = p_loyalty_program_id
          AND lpt.transaction_type IN ('earned', 'bonus')
      ) INTO already_processed;
    END;
  EXCEPTION WHEN others THEN
    already_processed := false;
  END;

  RETURN already_processed;
END;
$$;
