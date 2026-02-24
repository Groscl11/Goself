/*
  # Add Phone Verifications Table

  1. New Tables
    - `phone_verifications`
      - `id` (uuid, primary key)
      - `phone_number` (text, the phone number to verify)
      - `otp` (text, the one-time password)
      - `verified` (boolean, whether OTP has been verified)
      - `expires_at` (timestamptz, when the OTP expires)
      - `created_at` (timestamptz, when the record was created)

  2. Security
    - Enable RLS on `phone_verifications` table
    - No public access - only service role can access
*/

CREATE TABLE IF NOT EXISTS phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp text NOT NULL,
  verified boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role only"
  ON phone_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add phone column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
    CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
  END IF;
END $$;
