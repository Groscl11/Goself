-- Atomic points deduction for loyalty redemption
-- Prevents double-spend under concurrent requests by using a single
-- UPDATE that checks and decrements in one operation.
CREATE OR REPLACE FUNCTION deduct_loyalty_points(
  p_status_id uuid,
  p_points integer
)
RETURNS TABLE(new_balance integer, success boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  UPDATE member_loyalty_status
  SET points_balance = points_balance - p_points
  WHERE id = p_status_id
    AND points_balance >= p_points
  RETURNING points_balance INTO v_new_balance;

  IF FOUND THEN
    RETURN QUERY SELECT v_new_balance, true;
  ELSE
    RETURN QUERY SELECT NULL::integer, false;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_loyalty_points(uuid, integer) TO service_role;

-- H-18: ensure offer_distributions has RLS enforced
-- (migration ordering issue — the table may have been created after the policy)
DO $$
BEGIN
  IF NOT (
    SELECT relrowsecurity FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE relname = 'offer_distributions' AND nspname = 'public'
  ) THEN
    ALTER TABLE offer_distributions ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Ensure the admin_audit_log table exists (H-17, H-19)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  target_entity text,
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Service role manages audit log"
  ON admin_audit_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
