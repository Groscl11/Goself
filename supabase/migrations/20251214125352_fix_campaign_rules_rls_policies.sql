/*
  # Fix campaign_rules RLS policies

  1. Changes
    - Drop existing RLS policies for campaign_rules
    - Recreate policies with proper WITH CHECK clauses for INSERT/UPDATE operations
    
  2. Security
    - Admins can manage all campaign rules
    - Clients can only manage campaign rules for their own client_id
    - Both SELECT and INSERT/UPDATE operations are properly secured
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all campaign rules" ON campaign_rules;
DROP POLICY IF EXISTS "Clients can manage own campaign rules" ON campaign_rules;

-- Admin policies
CREATE POLICY "Admins can view all campaign rules"
  ON campaign_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert campaign rules"
  ON campaign_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update campaign rules"
  ON campaign_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete campaign rules"
  ON campaign_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Client policies
CREATE POLICY "Clients can view own campaign rules"
  ON campaign_rules
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

CREATE POLICY "Clients can insert own campaign rules"
  ON campaign_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
      AND profiles.client_id IS NOT NULL
    )
  );

CREATE POLICY "Clients can update own campaign rules"
  ON campaign_rules
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
      AND profiles.client_id IS NOT NULL
    )
  );

CREATE POLICY "Clients can delete own campaign rules"
  ON campaign_rules
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT profiles.client_id
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );