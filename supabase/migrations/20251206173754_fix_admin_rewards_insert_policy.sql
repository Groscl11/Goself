/*
  # Fix Admin Rewards Insert Policy

  ## Problem
  The "Admins can manage all rewards" policy only has a USING clause but no WITH CHECK clause.
  This prevents admins from inserting new rewards.

  ## Solution
  Drop the existing policy and recreate it with both USING and WITH CHECK clauses.
  This ensures admins can perform all operations (SELECT, INSERT, UPDATE, DELETE) on rewards.

  ## Changes
  - Drop existing admin rewards policy
  - Create new policy with both USING and WITH CHECK clauses
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can manage all rewards" ON rewards;

-- Recreate with both USING and WITH CHECK
CREATE POLICY "Admins can manage all rewards"
  ON rewards FOR ALL
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
