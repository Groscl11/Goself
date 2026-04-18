-- Add missing updated_at column to offer_codes table
-- Required by claim_next_offer_code RPC function

ALTER TABLE offer_codes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
