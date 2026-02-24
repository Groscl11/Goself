/*
  # Add Payment Method and Order Status to Shopify Orders

  1. Changes to `shopify_orders` table
    - Add `payment_method` column (text) - stores payment type like COD, prepaid, credit_card, etc.
    - Add `order_status` column (text) - stores order status like pending, paid, fulfilled, cancelled, etc.
    - Add `financial_status` column (text) - stores Shopify financial status
    - Add `fulfillment_status` column (text) - stores Shopify fulfillment status

  2. Notes
    - These fields will be populated from Shopify webhook data
    - Helps in filtering and reporting on orders by payment type and status
*/

-- Add payment and status columns to shopify_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopify_orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE shopify_orders ADD COLUMN payment_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopify_orders' AND column_name = 'order_status'
  ) THEN
    ALTER TABLE shopify_orders ADD COLUMN order_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopify_orders' AND column_name = 'financial_status'
  ) THEN
    ALTER TABLE shopify_orders ADD COLUMN financial_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopify_orders' AND column_name = 'fulfillment_status'
  ) THEN
    ALTER TABLE shopify_orders ADD COLUMN fulfillment_status text;
  END IF;
END $$;

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_shopify_orders_status ON shopify_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_payment ON shopify_orders(payment_method);
