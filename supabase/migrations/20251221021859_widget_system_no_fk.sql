/*
  # Widget System - Clean Setup

  Creates widget configuration system without strict foreign keys
  to non-essential tables.
*/

-- Drop old tables
DROP TABLE IF EXISTS widget_analytics CASCADE;
DROP TABLE IF EXISTS widget_configurations CASCADE;
DROP TABLE IF EXISTS widget_templates CASCADE;
DROP FUNCTION IF EXISTS update_widget_analytics_counters() CASCADE;
DROP FUNCTION IF EXISTS get_widget_config(TEXT, TEXT) CASCADE;

-- Widget templates
CREATE TABLE widget_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  widget_type TEXT NOT NULL,
  default_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Widget configurations
CREATE TABLE widget_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  widget_id TEXT NOT NULL,
  widget_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  styles JSONB DEFAULT '{"primaryColor": "#2563eb", "secondaryColor": "#10b981"}',
  content JSONB DEFAULT '{"title": "", "subtitle": "", "description": "", "buttonText": ""}',
  placement JSONB DEFAULT '{"position": "bottom-right", "target": "purchase.thank-you.block.render", "order": 10}',
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  ab_test_variant TEXT,
  ab_test_traffic_split INTEGER DEFAULT 100,
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, widget_id)
);

-- Widget analytics (no FK to members/orders to avoid dependency issues)
CREATE TABLE widget_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_config_id UUID NOT NULL REFERENCES widget_configurations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  order_id TEXT,
  member_id TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE widget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_analytics ENABLE ROW LEVEL SECURITY;

-- Templates policies
CREATE POLICY "Anyone can view templates"
  ON widget_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage templates"
  ON widget_templates FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Configurations policies
CREATE POLICY "Clients view own configs"
  ON widget_configurations FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Clients create own configs"
  ON widget_configurations FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Clients update own configs"
  ON widget_configurations FOR UPDATE
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Clients delete own configs"
  ON widget_configurations FOR DELETE
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Analytics policies  
CREATE POLICY "Clients view own analytics"
  ON widget_analytics FOR SELECT
  TO authenticated
  USING (
    widget_config_id IN (
      SELECT id FROM widget_configurations
      WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone inserts analytics"
  ON widget_analytics FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Analytics counter function
CREATE FUNCTION update_widget_analytics_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'view' THEN
    UPDATE widget_configurations SET view_count = view_count + 1 WHERE id = NEW.widget_config_id;
  ELSIF NEW.event_type = 'click' THEN
    UPDATE widget_configurations SET click_count = click_count + 1 WHERE id = NEW.widget_config_id;
  ELSIF NEW.event_type = 'conversion' THEN
    UPDATE widget_configurations SET conversion_count = conversion_count + 1 WHERE id = NEW.widget_config_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_widget_analytics_counters
  AFTER INSERT ON widget_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_widget_analytics_counters();

-- Get config function
CREATE FUNCTION get_widget_config(p_widget_id TEXT, p_shop_domain TEXT)
RETURNS TABLE (
  id UUID,
  widget_type TEXT,
  config JSONB,
  styles JSONB,
  content JSONB,
  placement JSONB,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT wc.id, wc.widget_type, wc.config, wc.styles, wc.content, wc.placement, wc.is_active
  FROM widget_configurations wc
  JOIN clients c ON wc.client_id = c.id
  LEFT JOIN integration_configs ic ON c.id = ic.client_id AND ic.integration_type = 'shopify'
  WHERE wc.widget_id = p_widget_id
    AND wc.is_active = true
    AND (wc.start_date IS NULL OR wc.start_date <= now())
    AND (wc.end_date IS NULL OR wc.end_date >= now())
    AND (ic.config->>'shop_domain' = p_shop_domain OR p_shop_domain IS NULL)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert templates
INSERT INTO widget_templates (name, widget_type, description, default_config) VALUES
('Thank You Page Banner', 'thank-you', 'Display rewards on thank you page', '{"showRewards": true}'),
('Order Status Rewards', 'order-status', 'Show rewards on order status', '{"showRewards": true}'),
('Cart Rewards', 'cart', 'Display rewards in cart', '{"showPointsEarned": true}'),
('Product Badge', 'product', 'Show badges on products', '{"badgePosition": "top-right"}'),
('Announcement Bar', 'announcement', 'Loyalty announcements', '{"position": "top"}');

-- Indexes
CREATE INDEX idx_widget_configurations_client_id ON widget_configurations(client_id);
CREATE INDEX idx_widget_configurations_widget_id ON widget_configurations(widget_id);
CREATE INDEX idx_widget_configurations_active ON widget_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_widget_analytics_widget_config_id ON widget_analytics(widget_config_id);
CREATE INDEX idx_widget_analytics_created_at ON widget_analytics(created_at);
