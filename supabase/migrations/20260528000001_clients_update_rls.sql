-- Allow client users to update their own clients row.
-- Previously only admins had UPDATE permission, causing onboarding saves
-- and Settings page saves to be silently blocked by RLS.

CREATE POLICY "Clients can update own data"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT client_id FROM profiles
    WHERE id = auth.uid() AND role = 'client'
  )
)
WITH CHECK (
  id IN (
    SELECT client_id FROM profiles
    WHERE id = auth.uid() AND role = 'client'
  )
);
