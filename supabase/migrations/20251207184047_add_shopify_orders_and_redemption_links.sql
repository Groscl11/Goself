/*
  # Add Shopify Orders and Redemption Links System

  1. New Tables
    - `shopify_orders`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `order_id` (text, Shopify order ID)
      - `order_number` (text, human-readable order number)
      - `customer_email` (text)
      - `customer_phone` (text)
      - `total_price` (decimal)
      - `currency` (text)
      - `order_data` (jsonb, full order payload)
      - `processed_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `redemption_links`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `program_id` (uuid, foreign key to membership_programs)
      - `unique_code` (text, unique redemption code)
      - `redemption_url` (text, full redemption URL)
      - `max_uses` (integer, null = unlimited)
      - `uses_count` (integer, default 0)
      - `expires_at` (timestamptz, nullable)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `redemption_tracking`
      - `id` (uuid, primary key)
      - `link_id` (uuid, foreign key to redemption_links)
      - `member_id` (uuid, foreign key to member_users, nullable)
      - `email` (text)
      - `phone` (text)
      - `ip_address` (text)
      - `user_agent` (text)
      - `redeemed_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated client users
    - Add policies for public redemption access
    - Add policies for webhook handling

  3. Indexes
    - Add index on shopify_orders (client_id, order_id)
    - Add index on redemption_links (unique_code)
    - Add index on redemption_tracking (link_id)
*/

-- Create shopify_orders table
CREATE TABLE IF NOT EXISTS shopify_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  order_id text NOT NULL,
  order_number text,
  customer_email text,
  customer_phone text,
  total_price decimal(10,2),
  currency text DEFAULT 'USD',
  order_data jsonb DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, order_id)
);

-- Create redemption_links table
CREATE TABLE IF NOT EXISTS redemption_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  program_id uuid REFERENCES membership_programs(id) ON DELETE CASCADE NOT NULL,
  unique_code text UNIQUE NOT NULL,
  redemption_url text NOT NULL,
  max_uses integer,
  uses_count integer DEFAULT 0,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create redemption_tracking table
CREATE TABLE IF NOT EXISTS redemption_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES redemption_links(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES member_users(id) ON DELETE SET NULL,
  email text NOT NULL,
  phone text,
  ip_address text,
  user_agent text,
  redeemed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shopify_orders_client_order 
  ON shopify_orders(client_id, order_id);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_email 
  ON shopify_orders(customer_email);

CREATE INDEX IF NOT EXISTS idx_redemption_links_code 
  ON redemption_links(unique_code);

CREATE INDEX IF NOT EXISTS idx_redemption_links_program 
  ON redemption_links(program_id);

CREATE INDEX IF NOT EXISTS idx_redemption_tracking_link 
  ON redemption_tracking(link_id);

CREATE INDEX IF NOT EXISTS idx_redemption_tracking_email 
  ON redemption_tracking(email);

-- Enable RLS
ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shopify_orders

-- Clients can view their own orders
CREATE POLICY "Clients can view own orders"
  ON shopify_orders FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Service role can insert orders (for webhook)
CREATE POLICY "Service role can insert orders"
  ON shopify_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for redemption_links

-- Clients can view their own redemption links
CREATE POLICY "Clients can view own redemption links"
  ON redemption_links FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Clients can create redemption links
CREATE POLICY "Clients can create redemption links"
  ON redemption_links FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Clients can update their own redemption links
CREATE POLICY "Clients can update own redemption links"
  ON redemption_links FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Anon users can view active redemption links by code (for public redemption)
CREATE POLICY "Public can view redemption links by code"
  ON redemption_links FOR SELECT
  TO anon
  USING (is_active = true);

-- RLS Policies for redemption_tracking

-- Clients can view tracking for their links
CREATE POLICY "Clients can view own redemption tracking"
  ON redemption_tracking FOR SELECT
  TO authenticated
  USING (
    link_id IN (
      SELECT id FROM redemption_links 
      WHERE client_id IN (
        SELECT client_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Public can insert tracking records (for redemption)
CREATE POLICY "Public can create redemption tracking"
  ON redemption_tracking FOR INSERT
  TO anon
  WITH CHECK (true);

-- Function to update redemption link uses
CREATE OR REPLACE FUNCTION increment_redemption_uses()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE redemption_links
  SET uses_count = uses_count + 1,
      updated_at = now()
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment uses on new redemption
DROP TRIGGER IF EXISTS trigger_increment_redemption_uses ON redemption_tracking;
CREATE TRIGGER trigger_increment_redemption_uses
  AFTER INSERT ON redemption_tracking
  FOR EACH ROW
  EXECUTE FUNCTION increment_redemption_uses();
