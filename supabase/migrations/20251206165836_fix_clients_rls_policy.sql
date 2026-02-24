/*
  # Fix Clients RLS Policy for INSERT Operations

  1. Changes
    - Drop existing "Admins can manage all clients" policy
    - Recreate with proper WITH CHECK clause for INSERT operations
    - Ensures admins can properly create new client records

  2. Security
    - Maintains admin-only access for all operations
    - Properly validates INSERT operations with WITH CHECK clause
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;

-- Recreate with proper WITH CHECK clause
CREATE POLICY "Admins can manage all clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );