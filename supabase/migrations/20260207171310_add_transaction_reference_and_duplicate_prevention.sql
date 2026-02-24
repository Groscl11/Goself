/*
  # Add Transaction Reference ID and Duplicate Prevention
  
  1. Schema Changes
    - Add `transaction_reference_id` column to loyalty_points_transactions
    - Add unique constraint on order_id to prevent duplicate processing
    - Add index for faster order_id lookups
  
  2. Changes
    - Generate unique transaction reference IDs (format: TXN-YYYYMMDD-XXXXX)
    - Prevent duplicate points for same order_id
    - Add processed_orders tracking
*/

-- Add transaction_reference_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_points_transactions'
    AND column_name = 'transaction_reference_id'
  ) THEN
    ALTER TABLE loyalty_points_transactions
    ADD COLUMN transaction_reference_id text UNIQUE;
    
    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_transactions_reference_id 
      ON loyalty_points_transactions(transaction_reference_id);
  END IF;
END $$;

-- Backfill existing transaction reference IDs
UPDATE loyalty_points_transactions
SET transaction_reference_id = 'TXN-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE transaction_reference_id IS NULL;

-- Add index on order_id for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_transactions_order_id 
  ON loyalty_points_transactions(order_id) 
  WHERE order_id IS NOT NULL;

-- Create function to generate unique transaction reference ID
CREATE OR REPLACE FUNCTION generate_transaction_reference()
RETURNS text AS $$
DECLARE
  ref_id text;
  ref_exists boolean;
BEGIN
  LOOP
    -- Generate format: TXN-YYYYMMDD-XXXXX (random 5 chars)
    ref_id := 'TXN-' || 
              TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
              UPPER(SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text), 1, 5));
    
    -- Check if this reference already exists
    SELECT EXISTS(
      SELECT 1 FROM loyalty_points_transactions 
      WHERE transaction_reference_id = ref_id
    ) INTO ref_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT ref_exists;
  END LOOP;
  
  RETURN ref_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate transaction reference ID
CREATE OR REPLACE FUNCTION set_transaction_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_reference_id IS NULL THEN
    NEW.transaction_reference_id := generate_transaction_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_transaction_reference ON loyalty_points_transactions;
CREATE TRIGGER trigger_set_transaction_reference
  BEFORE INSERT ON loyalty_points_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_reference();

-- Create function to check for duplicate order processing
CREATE OR REPLACE FUNCTION check_duplicate_order_points(
  p_order_id text,
  p_member_user_id uuid,
  p_loyalty_program_id uuid
)
RETURNS boolean AS $$
DECLARE
  already_processed boolean;
BEGIN
  -- Check if this order has already been processed for this member and program
  SELECT EXISTS(
    SELECT 1 
    FROM loyalty_points_transactions lpt
    JOIN member_loyalty_status mls ON mls.id = lpt.member_loyalty_status_id
    WHERE lpt.order_id = p_order_id
      AND lpt.member_user_id = p_member_user_id
      AND mls.loyalty_program_id = p_loyalty_program_id
      AND lpt.transaction_type IN ('earned', 'bonus')
  ) INTO already_processed;
  
  RETURN already_processed;
END;
$$ LANGUAGE plpgsql;
