/*
  # Fix Membership Programs RLS Policies

  1. Problem
    - Admins can only SELECT membership_programs but cannot INSERT or UPDATE
    - Clients have no policies at all for managing their own programs
    
  2. Changes
    - Add INSERT and UPDATE policies for admins to manage all programs
    - Add comprehensive policies for clients to manage their own programs
    - Add policies for membership_program_rewards junction table
    
  3. Security
    - Admins can manage all programs
    - Clients can only manage programs belonging to their client_id
    - Proper authentication checks on all policies
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage all programs" ON membership_programs;
DROP POLICY IF EXISTS "Clients can view own programs" ON membership_programs;
DROP POLICY IF EXISTS "Clients can insert own programs" ON membership_programs;
DROP POLICY IF EXISTS "Clients can update own programs" ON membership_programs;
DROP POLICY IF EXISTS "Clients can delete own programs" ON membership_programs;

-- Admins can manage all programs (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all programs"
  ON membership_programs
  FOR ALL
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

-- Clients can view their own programs
CREATE POLICY "Clients can view own programs"
  ON membership_programs
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- Clients can insert programs for their organization
CREATE POLICY "Clients can insert own programs"
  ON membership_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- Clients can update their own programs
CREATE POLICY "Clients can update own programs"
  ON membership_programs
  FOR UPDATE
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

-- Clients can delete their own programs
CREATE POLICY "Clients can delete own programs"
  ON membership_programs
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- Add policies for membership_program_rewards junction table
DROP POLICY IF EXISTS "Admins can manage all program rewards" ON membership_program_rewards;
DROP POLICY IF EXISTS "Clients can manage own program rewards" ON membership_program_rewards;

CREATE POLICY "Admins can manage all program rewards"
  ON membership_program_rewards
  FOR ALL
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

CREATE POLICY "Clients can manage own program rewards"
  ON membership_program_rewards
  FOR ALL
  TO authenticated
  USING (
    program_id IN (
      SELECT id FROM membership_programs
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    )
  )
  WITH CHECK (
    program_id IN (
      SELECT id FROM membership_programs
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    )
  );