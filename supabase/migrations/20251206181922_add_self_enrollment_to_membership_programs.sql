/*
  # Add Self-Enrollment Feature to Membership Programs

  ## Changes
  This migration adds support for member self-enrollment in membership programs.
  
  1. New Columns
    - `allow_self_enrollment` (boolean): Controls whether members can enroll themselves
      - Default: false (disabled by default)
    - `enrollment_url` (text): Optional custom URL for self-enrollment portal
    - `max_enrollments` (integer): Optional limit on total enrollments
    - `enrollment_start_date` (timestamptz): Optional start date for enrollment period
    - `enrollment_end_date` (timestamptz): Optional end date for enrollment period
  
  2. Purpose
    - Enables clients to allow members to join programs independently
    - Provides optional controls for enrollment periods and capacity limits
    - Supports custom branding through enrollment URLs
    
  ## Security Notes
    - Self-enrollment will be controlled by the `allow_self_enrollment` flag
    - RLS policies will allow member access to programs with self-enrollment enabled
*/

-- Add self-enrollment columns to membership_programs table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'membership_programs' AND column_name = 'allow_self_enrollment'
  ) THEN
    ALTER TABLE membership_programs 
    ADD COLUMN allow_self_enrollment boolean DEFAULT false,
    ADD COLUMN enrollment_url text,
    ADD COLUMN max_enrollments integer,
    ADD COLUMN enrollment_start_date timestamptz,
    ADD COLUMN enrollment_end_date timestamptz;
  END IF;
END $$;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Members can view programs with self-enrollment enabled" ON membership_programs;

-- Add RLS policy for members to view programs with self-enrollment enabled
CREATE POLICY "Members can view programs with self-enrollment enabled"
  ON membership_programs FOR SELECT
  TO authenticated
  USING (
    allow_self_enrollment = true 
    AND is_active = true
    AND (enrollment_start_date IS NULL OR enrollment_start_date <= now())
    AND (enrollment_end_date IS NULL OR enrollment_end_date >= now())
  );
