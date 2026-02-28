/*
  # Extend loyalty_discount_codes for Shopify auto-creation

  Adds:
  - member_email  — denormalised email for easy lookup / display
  - reward_id     — links back to the rewards catalog entry
  - shop_domain   — which Shopify store the code belongs to
  - shopify_price_rule_id  — Shopify price rule ID (bigint, nullable)
  - shopify_discount_code_id — Shopify discount code ID (bigint, nullable)
  - shopify_synced — whether the code has been created in Shopify
*/

-- member_email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_discount_codes' AND column_name = 'member_email'
  ) THEN
    ALTER TABLE loyalty_discount_codes ADD COLUMN member_email text;
  END IF;
END $$;

-- reward_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_discount_codes' AND column_name = 'reward_id'
  ) THEN
    ALTER TABLE loyalty_discount_codes ADD COLUMN reward_id uuid REFERENCES rewards(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_loyalty_discount_codes_reward ON loyalty_discount_codes(reward_id);
  END IF;
END $$;

-- shop_domain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_discount_codes' AND column_name = 'shop_domain'
  ) THEN
    ALTER TABLE loyalty_discount_codes ADD COLUMN shop_domain text;
  END IF;
END $$;

-- shopify_price_rule_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_discount_codes' AND column_name = 'shopify_price_rule_id'
  ) THEN
    ALTER TABLE loyalty_discount_codes ADD COLUMN shopify_price_rule_id bigint;
  END IF;
END $$;

-- shopify_discount_code_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_discount_codes' AND column_name = 'shopify_discount_code_id'
  ) THEN
    ALTER TABLE loyalty_discount_codes ADD COLUMN shopify_discount_code_id bigint;
  END IF;
END $$;

-- shopify_synced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_discount_codes' AND column_name = 'shopify_synced'
  ) THEN
    ALTER TABLE loyalty_discount_codes ADD COLUMN shopify_synced boolean DEFAULT false;
  END IF;
END $$;
