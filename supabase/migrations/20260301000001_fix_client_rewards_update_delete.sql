-- Fix: Add UPDATE and DELETE RLS policies for clients on rewards table
-- Clients could SELECT and INSERT their own rewards but not UPDATE or DELETE them

CREATE POLICY "Clients can update own rewards"
  ON rewards FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

CREATE POLICY "Clients can delete own rewards"
  ON rewards FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );
