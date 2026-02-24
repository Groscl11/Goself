/*
  # Fix Duplicate Order Check Function
  
  1. Changes
    - Update check_duplicate_order_points to handle text order_id and convert to UUID
    - Add null check for order_id
*/

-- Drop and recreate the function with proper type handling
DROP FUNCTION IF EXISTS check_duplicate_order_points(text, uuid, uuid);

CREATE OR REPLACE FUNCTION check_duplicate_order_points(
  p_order_id text,
  p_member_user_id uuid,
  p_loyalty_program_id uuid
)
RETURNS boolean AS $$
DECLARE
  already_processed boolean;
  order_uuid uuid;
BEGIN
  -- Return false if order_id is null or empty
  IF p_order_id IS NULL OR p_order_id = '' THEN
    RETURN false;
  END IF;
  
  -- Try to cast order_id to UUID, return false if invalid
  BEGIN
    order_uuid := p_order_id::uuid;
  EXCEPTION WHEN others THEN
    -- If it's not a valid UUID, still check as text
    SELECT EXISTS(
      SELECT 1 
      FROM loyalty_points_transactions lpt
      JOIN member_loyalty_status mls ON mls.id = lpt.member_loyalty_status_id
      WHERE lpt.order_id::text = p_order_id
        AND lpt.member_user_id = p_member_user_id
        AND mls.loyalty_program_id = p_loyalty_program_id
        AND lpt.transaction_type IN ('earned', 'bonus')
    ) INTO already_processed;
    
    RETURN already_processed;
  END;
  
  -- Check if this order has already been processed for this member and program
  SELECT EXISTS(
    SELECT 1 
    FROM loyalty_points_transactions lpt
    JOIN member_loyalty_status mls ON mls.id = lpt.member_loyalty_status_id
    WHERE lpt.order_id = order_uuid
      AND lpt.member_user_id = p_member_user_id
      AND mls.loyalty_program_id = p_loyalty_program_id
      AND lpt.transaction_type IN ('earned', 'bonus')
  ) INTO already_processed;
  
  RETURN already_processed;
END;
$$ LANGUAGE plpgsql;
