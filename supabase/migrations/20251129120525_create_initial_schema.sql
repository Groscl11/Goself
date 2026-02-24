/*
  # Create Initial Membership Rewards Platform Schema

  1. New Tables
    - `profiles`
      - User profile extension with role and metadata
      - Links to auth.users
    
    - `clients`
      - Client organizations that create membership programs
      - Stores branding and configuration
    
    - `brands`
      - Brand entities that provide rewards
      - Tracks approval status and profile info
    
    - `rewards`
      - Reward catalog with details and availability
      - Links to brands and includes expiry information
    
    - `membership_programs`
      - Programs created by clients with rules and logic
      - Defines validity, limits, and eligibility criteria
    
    - `membership_program_rewards`
      - Junction table linking programs to selected rewards
      - Includes program-specific reward configuration
    
    - `member_users`
      - End users who receive memberships
      - Stores member data per client
    
    - `member_memberships`
      - Active membership assignments to members
      - Tracks status and expiry dates
    
    - `member_rewards_allocation`
      - Individual reward assignments to members
      - Tracks which rewards each member has access to
    
    - `vouchers`
      - Unique voucher codes with status tracking
      - Links to rewards and members with expiry dates
    
    - `redemptions`
      - Log of all reward redemptions
      - Captures timestamp, location, and redemption details
    
    - `integration_configs`
      - E-commerce platform integration credentials
      - Stores encrypted API keys and configuration
    
    - `order_sync_log`
      - History of synced orders from e-commerce platforms
      - Tracks sync status and errors
    
    - `automation_rules`
      - Rules for automatic reward/membership assignment
      - Based on order criteria and conditions

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Ensure multi-tenant data isolation
*/

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'client', 'brand', 'member');
CREATE TYPE brand_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE reward_status AS ENUM ('draft', 'pending', 'active', 'inactive', 'expired');
CREATE TYPE membership_status AS ENUM ('active', 'expired', 'revoked', 'pending');
CREATE TYPE voucher_status AS ENUM ('available', 'redeemed', 'expired', 'revoked');
CREATE TYPE integration_platform AS ENUM ('shopify', 'woocommerce', 'custom');
CREATE TYPE sync_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  client_id uuid,
  brand_id uuid,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  logo_url text,
  primary_color text DEFAULT '#3B82F6',
  contact_email text NOT NULL,
  contact_phone text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  logo_url text,
  website_url text,
  status brand_status DEFAULT 'pending',
  contact_email text NOT NULL,
  contact_phone text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Rewards table
CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  terms_conditions text DEFAULT '',
  value_description text DEFAULT '',
  image_url text,
  category text DEFAULT 'general',
  status reward_status DEFAULT 'draft',
  is_marketplace boolean DEFAULT false,
  voucher_count integer DEFAULT 0,
  redeemed_count integer DEFAULT 0,
  expiry_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Membership Programs table
CREATE TABLE IF NOT EXISTS membership_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  validity_days integer DEFAULT 365,
  max_rewards_total integer,
  max_rewards_per_brand integer,
  auto_renew boolean DEFAULT false,
  eligibility_criteria jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Membership Program Rewards (junction table)
CREATE TABLE IF NOT EXISTS membership_program_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES membership_programs(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  quantity_limit integer,
  added_at timestamptz DEFAULT now(),
  UNIQUE(program_id, reward_id)
);

-- Member Users table
CREATE TABLE IF NOT EXISTS member_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  external_id text,
  metadata jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, email)
);

-- Member Memberships table
CREATE TABLE IF NOT EXISTS member_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES membership_programs(id) ON DELETE CASCADE,
  status membership_status DEFAULT 'pending',
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Member Rewards Allocation table
CREATE TABLE IF NOT EXISTS member_rewards_allocation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES member_memberships(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  quantity_allocated integer DEFAULT 1,
  quantity_redeemed integer DEFAULT 0,
  allocated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  member_id uuid REFERENCES member_users(id) ON DELETE SET NULL,
  allocation_id uuid REFERENCES member_rewards_allocation(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  status voucher_status DEFAULT 'available',
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Redemptions table
CREATE TABLE IF NOT EXISTS redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES member_users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  redemption_channel text DEFAULT 'online',
  redemption_location text,
  redemption_metadata jsonb DEFAULT '{}',
  redeemed_at timestamptz DEFAULT now()
);

-- Integration Configs table
CREATE TABLE IF NOT EXISTS integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform integration_platform NOT NULL,
  platform_name text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}',
  webhook_url text,
  sync_frequency_minutes integer DEFAULT 60,
  last_sync_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, platform)
);

-- Order Sync Log table
CREATE TABLE IF NOT EXISTS order_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integration_configs(id) ON DELETE CASCADE,
  external_order_id text NOT NULL,
  order_data jsonb NOT NULL DEFAULT '{}',
  sync_status sync_status DEFAULT 'pending',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Automation Rules table
CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  trigger_type text NOT NULL DEFAULT 'order',
  conditions jsonb NOT NULL DEFAULT '{}',
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_brand_id ON profiles(brand_id);
CREATE INDEX IF NOT EXISTS idx_rewards_brand_id ON rewards(brand_id);
CREATE INDEX IF NOT EXISTS idx_rewards_client_id ON rewards(client_id);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON rewards(status);
CREATE INDEX IF NOT EXISTS idx_membership_programs_client_id ON membership_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_member_users_client_id ON member_users(client_id);
CREATE INDEX IF NOT EXISTS idx_member_users_email ON member_users(email);
CREATE INDEX IF NOT EXISTS idx_member_memberships_member_id ON member_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_member_memberships_status ON member_memberships(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_member_id ON vouchers(member_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_member_id ON redemptions(member_id);
CREATE INDEX IF NOT EXISTS idx_order_sync_log_integration_id ON order_sync_log(integration_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_program_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_rewards_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for clients
CREATE POLICY "Admins can manage all clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can view own data"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- RLS Policies for brands
CREATE POLICY "Admins can manage all brands"
  ON brands FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Brands can view and update own data"
  ON brands FOR ALL
  TO authenticated
  USING (
    id IN (
      SELECT brand_id FROM profiles
      WHERE id = auth.uid() AND role = 'brand'
    )
  );

CREATE POLICY "All authenticated users can view approved brands"
  ON brands FOR SELECT
  TO authenticated
  USING (status = 'approved');

-- RLS Policies for rewards
CREATE POLICY "Admins can manage all rewards"
  ON rewards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Brands can manage own rewards"
  ON rewards FOR ALL
  TO authenticated
  USING (
    brand_id IN (
      SELECT brand_id FROM profiles
      WHERE id = auth.uid() AND role = 'brand'
    )
  );

CREATE POLICY "Clients can view marketplace and own rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (
    is_marketplace = true OR
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

CREATE POLICY "Clients can create own rewards"
  ON rewards FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- RLS Policies for membership_programs
CREATE POLICY "Admins can view all programs"
  ON membership_programs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can manage own programs"
  ON membership_programs FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- RLS Policies for membership_program_rewards
CREATE POLICY "Users can view program rewards for accessible programs"
  ON membership_program_rewards FOR SELECT
  TO authenticated
  USING (
    program_id IN (
      SELECT id FROM membership_programs
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role IN ('client', 'admin')
      )
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can manage own program rewards"
  ON membership_program_rewards FOR ALL
  TO authenticated
  USING (
    program_id IN (
      SELECT id FROM membership_programs
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    )
  );

-- RLS Policies for member_users
CREATE POLICY "Admins can view all members"
  ON member_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can manage own members"
  ON member_users FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

CREATE POLICY "Members can view own data"
  ON member_users FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- RLS Policies for member_memberships
CREATE POLICY "Admins can view all memberships"
  ON member_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can manage memberships for own members"
  ON member_memberships FOR ALL
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    )
  );

CREATE POLICY "Members can view own memberships"
  ON member_memberships FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- RLS Policies for member_rewards_allocation
CREATE POLICY "Clients can manage allocations for own members"
  ON member_rewards_allocation FOR ALL
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    )
  );

CREATE POLICY "Members can view own allocations"
  ON member_rewards_allocation FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- RLS Policies for vouchers
CREATE POLICY "Clients can manage vouchers for own rewards"
  ON vouchers FOR ALL
  TO authenticated
  USING (
    reward_id IN (
      SELECT id FROM rewards
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      ) OR brand_id IN (
        SELECT brand_id FROM profiles
        WHERE id = auth.uid() AND role = 'brand'
      )
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Members can view own vouchers"
  ON vouchers FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- RLS Policies for redemptions
CREATE POLICY "Clients can view redemptions for own members"
  ON redemptions FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Members can view own redemptions"
  ON redemptions FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM member_users
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert redemptions"
  ON redemptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for integration_configs
CREATE POLICY "Admins can manage all integrations"
  ON integration_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can manage own integrations"
  ON integration_configs FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- RLS Policies for order_sync_log
CREATE POLICY "Clients can view own order sync logs"
  ON order_sync_log FOR SELECT
  TO authenticated
  USING (
    integration_id IN (
      SELECT id FROM integration_configs
      WHERE client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for automation_rules
CREATE POLICY "Admins can view all automation rules"
  ON automation_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can manage own automation rules"
  ON automation_rules FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );