CREATE OR REPLACE FUNCTION claim_next_offer_code(
  p_offer_id uuid,
  p_distribution_id uuid,
  p_member_user_id uuid,
  p_distributed_by_client_id uuid
)
RETURNS TABLE (id uuid, code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE offer_codes oc
  SET
    status = 'assigned',
    distribution_id = p_distribution_id,
    assigned_to_member_id = p_member_user_id,
    assigned_at = now(),
    assignment_channel = 'points_redemption',
    distributed_by_client_id = p_distributed_by_client_id,
    updated_at = now()
  WHERE oc.id = (
    SELECT candidate.id
    FROM offer_codes candidate
    WHERE candidate.offer_id = p_offer_id
      AND candidate.status = 'available'
      AND (candidate.expires_at IS NULL OR candidate.expires_at > now())
    ORDER BY candidate.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING oc.id, oc.code, oc.expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_next_offer_code(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_next_offer_code(uuid, uuid, uuid, uuid) TO anon;