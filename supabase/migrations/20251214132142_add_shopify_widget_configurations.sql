/*
  # Add Shopify Widget Configurations

  1. New Tables
    - `widget_configurations`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients) - Which merchant owns this widget
      - `widget_type` (text) - Type of widget (announcement_bar, floating, product_banner, cart, thankyou)
      - `widget_name` (text) - Display name for the widget
      - `is_enabled` (boolean) - Whether widget is active
      - `shopify_store_domain` (text) - Shopify store domain (optional)
      - `widget_settings` (jsonb) - Widget-specific settings
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `widget_configurations` table
    - Add policies for clients to manage their own widgets
    - Add policies for admins to manage all widgets

  3. Indexes
    - Index on client_id for faster lookups
    - Index on widget_type for filtering
    - Index on shopify_store_domain for store-specific queries
*/

-- Create widget_configurations table
CREATE TABLE IF NOT EXISTS widget_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  widget_type text NOT NULL CHECK (widget_type IN (
    'announcement_bar',
    'floating_widget',
    'product_banner',
    'cart_rewards',
    'thankyou_card'
  )),
  widget_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  shopify_store_domain text,
  widget_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_widget_configurations_client_id 
  ON widget_configurations(client_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_widget_type 
  ON widget_configurations(widget_type);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_shopify_domain 
  ON widget_configurations(shopify_store_domain);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_enabled 
  ON widget_configurations(is_enabled) WHERE is_enabled = true;

-- Enable RLS
ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;

-- Policies for clients - view own widgets
CREATE POLICY "Clients can view own widget configurations"
  ON widget_configurations
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'client'
    )
  );

-- Policies for clients - insert own widgets
CREATE POLICY "Clients can create own widget configurations"
  ON widget_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'client'
    )
  );

-- Policies for clients - update own widgets
CREATE POLICY "Clients can update own widget configurations"
  ON widget_configurations
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'client'
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'client'
    )
  );

-- Policies for clients - delete own widgets
CREATE POLICY "Clients can delete own widget configurations"
  ON widget_configurations
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'client'
    )
  );

-- Policies for admins - view all widgets
CREATE POLICY "Admins can view all widget configurations"
  ON widget_configurations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policies for admins - insert any widgets
CREATE POLICY "Admins can create any widget configurations"
  ON widget_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policies for admins - update any widgets
CREATE POLICY "Admins can update any widget configurations"
  ON widget_configurations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policies for admins - delete any widgets
CREATE POLICY "Admins can delete any widget configurations"
  ON widget_configurations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_widget_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_widget_configurations_updated_at
  BEFORE UPDATE ON widget_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_widget_configurations_updated_at();
