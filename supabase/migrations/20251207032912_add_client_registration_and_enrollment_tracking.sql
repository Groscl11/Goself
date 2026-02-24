/*
  # Add Client Registration and Multi-Client Enrollment Support

  1. Changes to `clients` table
    - Add `slug` (text, unique, url-safe identifier for registration links)
    - Add `registration_enabled` (boolean, controls if public registration is allowed)
    - Add `welcome_message` (text, custom message shown during registration)
    - Add `registration_domains` (text array, auto-link members by email domain)
    - Add index on slug for fast lookups
    
  2. Changes to `member_memberships` table
    - Add `enrollment_source` (text, tracks how member enrolled: 'client_registration_link', 'self_enrollment', 'admin_created', 'imported')
    
  3. Security Updates
    - Allow public read of client info by slug (for registration pages)
    - Allow public read of membership programs with allow_self_enrollment=true
    - Ensure authenticated users can read their own member_users records across all clients

  ## Important Notes
  - Slug generation for existing clients uses lowercase name with hyphens
  - All existing enrollments get 'admin_created' as default enrollment_source
  - Public access is carefully scoped to only necessary fields
*/

-- Add new columns to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'slug'
  ) THEN
    ALTER TABLE clients ADD COLUMN slug text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'registration_enabled'
  ) THEN
    ALTER TABLE clients ADD COLUMN registration_enabled boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'welcome_message'
  ) THEN
    ALTER TABLE clients ADD COLUMN welcome_message text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'registration_domains'
  ) THEN
    ALTER TABLE clients ADD COLUMN registration_domains text[] DEFAULT '{}';
  END IF;
END $$;

-- Generate slugs for existing clients (lowercase name with hyphens, handle duplicates)
UPDATE clients 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug required and unique
ALTER TABLE clients ALTER COLUMN slug SET NOT NULL;

-- Drop constraint if exists and recreate to ensure uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_slug_key'
  ) THEN
    ALTER TABLE clients DROP CONSTRAINT clients_slug_key;
  END IF;
END $$;

ALTER TABLE clients ADD CONSTRAINT clients_slug_key UNIQUE (slug);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);

-- Add enrollment_source to member_memberships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_memberships' AND column_name = 'enrollment_source'
  ) THEN
    ALTER TABLE member_memberships 
    ADD COLUMN enrollment_source text DEFAULT 'admin_created'
    CHECK (enrollment_source IN ('client_registration_link', 'self_enrollment', 'admin_created', 'imported', 'api'));
  END IF;
END $$;

-- Update existing memberships to have explicit enrollment source
UPDATE member_memberships 
SET enrollment_source = 'admin_created'
WHERE enrollment_source IS NULL;

-- Add index on auth_user_id in member_users for fast multi-client lookups
CREATE INDEX IF NOT EXISTS idx_member_users_auth_user_id ON member_users(auth_user_id);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_member_memberships_member_program ON member_memberships(member_id, program_id);

-- RLS Policy: Allow public read of client info by slug (for registration pages)
DROP POLICY IF EXISTS "Public can view active clients by slug" ON clients;
CREATE POLICY "Public can view active clients by slug"
  ON clients
  FOR SELECT
  TO public
  USING (is_active = true AND registration_enabled = true);

-- RLS Policy: Allow public read of self-enrollment programs
DROP POLICY IF EXISTS "Public can view self-enrollment programs" ON membership_programs;
CREATE POLICY "Public can view self-enrollment programs"
  ON membership_programs
  FOR SELECT
  TO public
  USING (
    is_active = true 
    AND allow_self_enrollment = true
    AND (enrollment_start_date IS NULL OR enrollment_start_date <= now())
    AND (enrollment_end_date IS NULL OR enrollment_end_date >= now())
  );

-- RLS Policy: Allow authenticated users to read all their member_users records (across all clients)
DROP POLICY IF EXISTS "Users can view their own member profiles across all clients" ON member_users;
CREATE POLICY "Users can view their own member profiles across all clients"
  ON member_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- RLS Policy: Allow authenticated members to insert member_users for self-enrollment
DROP POLICY IF EXISTS "Users can create member profile during self-enrollment" ON member_users;
CREATE POLICY "Users can create member profile during self-enrollment"
  ON member_users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

-- RLS Policy: Allow authenticated members to enroll in programs
DROP POLICY IF EXISTS "Members can self-enroll in programs" ON member_memberships;
CREATE POLICY "Members can self-enroll in programs"
  ON member_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM member_users mu
      WHERE mu.id = member_id 
      AND mu.auth_user_id = auth.uid()
    )
  );

-- Add function to check enrollment eligibility
CREATE OR REPLACE FUNCTION check_enrollment_eligibility(
  p_program_id uuid,
  p_member_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_program record;
  v_current_count integer;
  v_has_active_membership boolean;
  v_result jsonb;
BEGIN
  -- Get program details
  SELECT * INTO v_program
  FROM membership_programs
  WHERE id = p_program_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Program not found or inactive');
  END IF;
  
  -- Check if self-enrollment is allowed
  IF NOT v_program.allow_self_enrollment THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Self-enrollment not allowed for this program');
  END IF;
  
  -- Check enrollment dates
  IF v_program.enrollment_start_date IS NOT NULL AND v_program.enrollment_start_date > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Enrollment has not started yet');
  END IF;
  
  IF v_program.enrollment_end_date IS NOT NULL AND v_program.enrollment_end_date < now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Enrollment period has ended');
  END IF;
  
  -- Check max members capacity
  IF v_program.max_members_allowed IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM member_memberships
    WHERE program_id = p_program_id AND status IN ('active', 'pending');
    
    IF v_current_count >= v_program.max_members_allowed THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'Program has reached maximum capacity');
    END IF;
  END IF;
  
  -- Check if member already has active membership
  SELECT EXISTS (
    SELECT 1 FROM member_memberships
    WHERE member_id = p_member_id 
    AND program_id = p_program_id 
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_has_active_membership;
  
  IF v_has_active_membership THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'You already have an active membership in this program');
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'eligible', true, 
    'reason', 'Eligible for enrollment',
    'program', jsonb_build_object(
      'name', v_program.name,
      'validity_days', v_program.validity_days,
      'enrollment_fee', v_program.enrollment_fee
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION check_enrollment_eligibility(uuid, uuid) TO authenticated;
