/*
  # Add Reward Enhancements

  1. Changes to rewards table
    - Add unique reward_id field for easy identification
    - Add coupon_type field (unique, generic)
    - Add redemption_link field for redirecting users
    - Add reward_type field (flat_discount, percentage_discount, upto_discount, fixed_value, free_item)
    - Add discount_value and max_discount_value fields
    - Add currency field
  
  2. Changes to vouchers table
    - Add redemption_link field
    - Update to support both unique and generic codes
  
  3. Security
    - Maintain existing RLS policies
*/

-- Create enum types for new fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_type') THEN
    CREATE TYPE coupon_type AS ENUM ('unique', 'generic');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_type') THEN
    CREATE TYPE reward_type AS ENUM ('flat_discount', 'percentage_discount', 'upto_discount', 'fixed_value', 'free_item', 'other');
  END IF;
END $$;

-- Add new columns to rewards table
DO $$
BEGIN
  -- Reward ID for easy identification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'reward_id'
  ) THEN
    ALTER TABLE rewards ADD COLUMN reward_id text UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_rewards_reward_id ON rewards(reward_id);
  END IF;

  -- Coupon type (unique or generic)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'coupon_type'
  ) THEN
    ALTER TABLE rewards ADD COLUMN coupon_type coupon_type DEFAULT 'unique';
  END IF;

  -- Generic coupon code (for generic type)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'generic_coupon_code'
  ) THEN
    ALTER TABLE rewards ADD COLUMN generic_coupon_code text;
  END IF;

  -- Redemption/redirection link
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'redemption_link'
  ) THEN
    ALTER TABLE rewards ADD COLUMN redemption_link text;
  END IF;

  -- Reward type (discount type)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'reward_type'
  ) THEN
    ALTER TABLE rewards ADD COLUMN reward_type reward_type DEFAULT 'other';
  END IF;

  -- Discount value (amount or percentage)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE rewards ADD COLUMN discount_value numeric(12, 2);
  END IF;

  -- Max discount value (for upto_discount and percentage_discount)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'max_discount_value'
  ) THEN
    ALTER TABLE rewards ADD COLUMN max_discount_value numeric(12, 2);
  END IF;

  -- Currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'currency'
  ) THEN
    ALTER TABLE rewards ADD COLUMN currency text DEFAULT 'USD';
  END IF;

  -- Minimum purchase amount (for discounts)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'min_purchase_amount'
  ) THEN
    ALTER TABLE rewards ADD COLUMN min_purchase_amount numeric(12, 2);
  END IF;
END $$;

-- Add redemption_link to vouchers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'redemption_link'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN redemption_link text;
  END IF;
END $$;

-- Function to generate unique reward IDs
CREATE OR REPLACE FUNCTION generate_reward_id()
RETURNS text AS $$
DECLARE
  new_id text;
  done bool;
BEGIN
  done := false;
  WHILE NOT done LOOP
    new_id := 'RWD-' || upper(substring(md5(random()::text) from 1 for 8));
    done := NOT EXISTS(SELECT 1 FROM rewards WHERE reward_id = new_id);
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate reward_id for new rewards
CREATE OR REPLACE FUNCTION set_reward_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reward_id IS NULL THEN
    NEW.reward_id := generate_reward_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_reward_id ON rewards;
CREATE TRIGGER trigger_set_reward_id
  BEFORE INSERT ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION set_reward_id();

-- Update existing rewards to have reward_id
UPDATE rewards SET reward_id = generate_reward_id() WHERE reward_id IS NULL;
