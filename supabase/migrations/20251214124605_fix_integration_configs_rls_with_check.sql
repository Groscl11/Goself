/*
  # Fix integration_configs RLS policies

  1. Changes
    - Drop existing RLS policies for integration_configs
    - Recreate policies with proper WITH CHECK clauses for INSERT/UPDATE operations
    
  2. Security
    - Admins can manage all integrations
    - Clients can only manage integrations for their own client_id
    - Both SELECT and INSERT/UPDATE operations are properly secured
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all integrations" ON integration_configs;
DROP POLICY IF EXISTS "Clients can manage own integrations" ON integration_configs;

-- Admin policies
CREATE POLICY "Admins can view all integrations"
  ON integration_configs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert integrations"
  ON integration_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update integrations"
  ON integration_configs
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

CREATE POLICY "Admins can delete integrations"
  ON integration_configs
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
CREATE POLICY "Clients can view own integrations"
  ON integration_configs
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

CREATE POLICY "Clients can insert own integrations"
  ON integration_configs
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

CREATE POLICY "Clients can update own integrations"
  ON integration_configs
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

CREATE POLICY "Clients can delete own integrations"
  ON integration_configs
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