-- Fix: campaign_trigger_logs client SELECT policy required role = 'client' exactly.
-- Any authenticated user with a matching client_id (admin, brand, client) was blocked.
-- Replace with a broader policy: any authenticated user whose profile.client_id matches.

DROP POLICY IF EXISTS "Clients can view own campaign trigger logs" ON campaign_trigger_logs;

CREATE POLICY "Users can view campaign trigger logs for their client"
  ON campaign_trigger_logs
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid()
      AND client_id IS NOT NULL
    )
  );
