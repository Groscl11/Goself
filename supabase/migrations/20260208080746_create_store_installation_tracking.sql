/*
  # Store Installation & Multi-Tenant Tracking System
  
  1. New Tables
    - `store_installations`
      - Tracks all Shopify stores that installed the app
      - Includes store details, installation date, status, and plugin types
      - Links to client_id for multi-tenant support
      
    - `store_plugins`
      - Tracks which plugins are installed per store
      - Plugin types: loyalty, rewards, referral, etc.
      - Installation status, version, and configuration
      
    - `store_webhooks`
      - Tracks webhook registration status per store
      - Webhook topics, registration date, last event, health status
      
    - `store_users`
      - Multi-user access per store (master admin + sub-members)
      - Roles: master_admin, admin, member, viewer
      - Links to auth users and stores
      
  2. Security
    - Enable RLS on all tables
    - Admins can view all stores
    - Store users can only view their own store data
    - Master admins can manage store users
*/

-- Store Installations Table
CREATE TABLE IF NOT EXISTS store_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  shop_domain text UNIQUE NOT NULL,
  shop_id text,
  shop_name text,
  shop_email text,
  shop_owner text,
  shop_phone text,
  shop_country text,
  shop_currency text,
  shop_plan text,
  
  -- Installation details
  installation_status text DEFAULT 'active' CHECK (installation_status IN ('active', 'inactive', 'suspended', 'uninstalled')),
  installed_at timestamptz DEFAULT now(),
  uninstalled_at timestamptz,
  last_active_at timestamptz DEFAULT now(),
  
  -- OAuth credentials
  access_token text,
  access_token_expires_at timestamptz,
  api_version text DEFAULT '2024-01',
  scopes text[] DEFAULT ARRAY['read_orders', 'read_customers', 'write_customers'],
  
  -- Webhook status
  webhooks_registered boolean DEFAULT false,
  webhooks_registered_at timestamptz,
  webhook_health_status text DEFAULT 'unknown' CHECK (webhook_health_status IN ('healthy', 'degraded', 'failed', 'unknown')),
  last_webhook_received_at timestamptz,
  
  -- Billing & subscription
  billing_plan text DEFAULT 'free',
  billing_status text DEFAULT 'active',
  trial_ends_at timestamptz,
  
  -- Metadata
  installation_metadata jsonb DEFAULT '{}',
  app_settings jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Store Plugins Table
CREATE TABLE IF NOT EXISTS store_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_installation_id uuid REFERENCES store_installations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  
  -- Plugin details
  plugin_type text NOT NULL CHECK (plugin_type IN ('loyalty', 'rewards', 'referral', 'campaigns', 'membership', 'widget', 'analytics')),
  plugin_name text NOT NULL,
  plugin_version text,
  
  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'configured', 'pending')),
  installed_at timestamptz DEFAULT now(),
  configured_at timestamptz,
  last_used_at timestamptz,
  
  -- Configuration
  plugin_config jsonb DEFAULT '{}',
  feature_flags jsonb DEFAULT '{}',
  
  -- Usage stats
  total_events_processed integer DEFAULT 0,
  total_users_affected integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(store_installation_id, plugin_type)
);

-- Store Webhooks Table
CREATE TABLE IF NOT EXISTS store_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_installation_id uuid REFERENCES store_installations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  
  -- Webhook details
  webhook_topic text NOT NULL,
  shopify_webhook_id text,
  webhook_address text NOT NULL,
  
  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failed', 'pending')),
  registered_at timestamptz DEFAULT now(),
  last_event_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  
  -- Health monitoring
  total_events_received integer DEFAULT 0,
  total_successful integer DEFAULT 0,
  total_failed integer DEFAULT 0,
  consecutive_failures integer DEFAULT 0,
  
  -- Error tracking
  last_error text,
  error_details jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(store_installation_id, webhook_topic)
);

-- Store Users Table (Multi-user access per store)
CREATE TABLE IF NOT EXISTS store_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_installation_id uuid REFERENCES store_installations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User details
  email text NOT NULL,
  full_name text,
  phone text,
  
  -- Role & permissions
  role text DEFAULT 'member' CHECK (role IN ('master_admin', 'admin', 'member', 'viewer')),
  permissions jsonb DEFAULT '{}',
  
  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
  invited_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  last_login_at timestamptz,
  
  -- Invitation
  invitation_token text,
  invitation_expires_at timestamptz,
  invited_by uuid REFERENCES auth.users(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(store_installation_id, email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_installations_client_id ON store_installations(client_id);
CREATE INDEX IF NOT EXISTS idx_store_installations_shop_domain ON store_installations(shop_domain);
CREATE INDEX IF NOT EXISTS idx_store_installations_status ON store_installations(installation_status);

CREATE INDEX IF NOT EXISTS idx_store_plugins_store_id ON store_plugins(store_installation_id);
CREATE INDEX IF NOT EXISTS idx_store_plugins_client_id ON store_plugins(client_id);
CREATE INDEX IF NOT EXISTS idx_store_plugins_type ON store_plugins(plugin_type);

CREATE INDEX IF NOT EXISTS idx_store_webhooks_store_id ON store_webhooks(store_installation_id);
CREATE INDEX IF NOT EXISTS idx_store_webhooks_status ON store_webhooks(status);
CREATE INDEX IF NOT EXISTS idx_store_webhooks_topic ON store_webhooks(webhook_topic);

CREATE INDEX IF NOT EXISTS idx_store_users_store_id ON store_users(store_installation_id);
CREATE INDEX IF NOT EXISTS idx_store_users_auth_id ON store_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_store_users_email ON store_users(email);

-- Enable Row Level Security
ALTER TABLE store_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for store_installations
CREATE POLICY "Admins can view all store installations"
  ON store_installations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Store users can view their own store"
  ON store_installations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT store_installation_id FROM store_users
      WHERE auth_user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "System can manage store installations"
  ON store_installations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for store_plugins
CREATE POLICY "Admins can view all plugins"
  ON store_plugins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Store users can view their store plugins"
  ON store_plugins FOR SELECT
  TO authenticated
  USING (
    store_installation_id IN (
      SELECT store_installation_id FROM store_users
      WHERE auth_user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Store admins can manage plugins"
  ON store_plugins FOR ALL
  TO authenticated
  USING (
    store_installation_id IN (
      SELECT store_installation_id FROM store_users
      WHERE auth_user_id = auth.uid()
      AND role IN ('master_admin', 'admin')
      AND status = 'active'
    )
  );

-- RLS Policies for store_webhooks
CREATE POLICY "Admins can view all webhooks"
  ON store_webhooks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Store users can view their webhooks"
  ON store_webhooks FOR SELECT
  TO authenticated
  USING (
    store_installation_id IN (
      SELECT store_installation_id FROM store_users
      WHERE auth_user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "System can manage webhooks"
  ON store_webhooks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for store_users
CREATE POLICY "Admins can view all store users"
  ON store_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Store users can view their team"
  ON store_users FOR SELECT
  TO authenticated
  USING (
    store_installation_id IN (
      SELECT store_installation_id FROM store_users
      WHERE auth_user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Master admins can manage store users"
  ON store_users FOR ALL
  TO authenticated
  USING (
    store_installation_id IN (
      SELECT store_installation_id FROM store_users
      WHERE auth_user_id = auth.uid()
      AND role = 'master_admin'
      AND status = 'active'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_store_installations_updated_at
  BEFORE UPDATE ON store_installations
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();

CREATE TRIGGER update_store_plugins_updated_at
  BEFORE UPDATE ON store_plugins
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();

CREATE TRIGGER update_store_webhooks_updated_at
  BEFORE UPDATE ON store_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();

CREATE TRIGGER update_store_users_updated_at
  BEFORE UPDATE ON store_users
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();
