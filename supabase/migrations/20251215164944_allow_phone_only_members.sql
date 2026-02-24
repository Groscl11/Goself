/*
  # Allow phone-only members

  ## Changes
  
  1. Schema Updates
    - Make `email` column nullable in `member_users` table
    - Add check constraint to ensure either email or phone is provided
    - Drop old unique constraint on (client_id, email)
    - Add new unique constraint on (client_id, phone) where phone is not null
    - Add unique partial index for email when it's not null or empty
  
  2. Purpose
    - Support customers who only provide phone numbers (no email)
    - Maintain data integrity by requiring at least one contact method
    - Prevent duplicate members based on phone or email
  
  ## Notes
  - Orders from Shopify may have customers with only phone numbers
  - This allows proper member tracking for all customers
  - Unique constraints prevent duplicate entries
*/

-- Drop the existing unique constraint on (client_id, email)
ALTER TABLE member_users DROP CONSTRAINT IF EXISTS member_users_client_id_email_key;

-- Make email nullable
ALTER TABLE member_users ALTER COLUMN email DROP NOT NULL;

-- Add check constraint to ensure at least one contact method exists
ALTER TABLE member_users ADD CONSTRAINT member_users_contact_method_check 
  CHECK (
    (email IS NOT NULL AND email != '') OR 
    (phone IS NOT NULL AND phone != '')
  );

-- Add unique constraint on (client_id, phone) for phone-only members
-- Using a partial unique index to only enforce uniqueness when phone is not null
CREATE UNIQUE INDEX IF NOT EXISTS member_users_client_id_phone_key 
  ON member_users(client_id, phone) 
  WHERE phone IS NOT NULL AND phone != '';

-- Add unique constraint on (client_id, email) for email members
-- Using a partial unique index to only enforce uniqueness when email is not null
CREATE UNIQUE INDEX IF NOT EXISTS member_users_client_id_email_key 
  ON member_users(client_id, email) 
  WHERE email IS NOT NULL AND email != '';
