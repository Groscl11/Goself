-- Migration: Add extended profile fields to member_users
-- Date: 2026-03-06

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_users' AND column_name = 'gender'
  ) THEN
    ALTER TABLE member_users ADD COLUMN gender text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_users' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE member_users ADD COLUMN date_of_birth date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_users' AND column_name = 'anniversary_date'
  ) THEN
    ALTER TABLE member_users ADD COLUMN anniversary_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_users' AND column_name = 'occupation'
  ) THEN
    ALTER TABLE member_users ADD COLUMN occupation text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_users' AND column_name = 'corporate_email'
  ) THEN
    ALTER TABLE member_users ADD COLUMN corporate_email text;
  END IF;
END;
$$;
