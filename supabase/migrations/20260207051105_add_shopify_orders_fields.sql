/*
  # Add Fields to Shopify Orders Table

  1. Changes
    - Add `shopify_order_id` field for Shopify's order ID
    - Add `member_id` field to link orders to members
    - Add `synced_at` field to track when order was synced
    - Add unique constraint on shopify_order_id
    - Add index on member_id for fast member queries
    
  2. Purpose
    - Enable proper order tracking from Shopify webhooks
    - Link orders to loyalty program members
    - Track synchronization timing
    - Prevent duplicate order processing
*/

-- Add shopify_order_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopify_orders' AND column_name = 'shopify_order_id'
  ) THEN
    ALTER TABLE shopify_orders ADD COLUMN shopify_order_id text;
  END IF;
END $$;

-- Add member_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopify_orders' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE shopify_orders ADD COLUMN member_id uuid REFERENCES member_users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add synced_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopify_orders' AND column_name = 'synced_at'
  ) THEN
    ALTER TABLE shopify_orders ADD COLUMN synced_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add unique constraint on shopify_order_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shopify_orders_shopify_order_id_unique'
  ) THEN
    ALTER TABLE shopify_orders ADD CONSTRAINT shopify_orders_shopify_order_id_unique UNIQUE (shopify_order_id);
  END IF;
END $$;

-- Create index on member_id
CREATE INDEX IF NOT EXISTS idx_shopify_orders_member ON shopify_orders(member_id);

-- Create index on shopify_order_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_shopify_orders_shopify_order_id ON shopify_orders(shopify_order_id);
