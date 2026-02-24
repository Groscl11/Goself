/*
  # Brand Interactions and Collaboration System

  1. New Tables
    - `brand_interactions`
      - `id` (uuid, primary key)
      - `requester_brand_id` (uuid, foreign key to brands)
      - `target_brand_id` (uuid, foreign key to brands)
      - `interaction_type` (enum: 'offer_request', 'campaign_request')
      - `request_type` (text) - specific type like 'exclusive_coupon', 'social_barter', 'offline_distribution'
      - `message` (text) - request message
      - `status` (enum: 'pending', 'accepted', 'rejected', 'expired')
      - `response_message` (text, nullable)
      - `responded_at` (timestamp, nullable)
      - `created_at` (timestamp)
      - `expires_at` (timestamp)
    
    - `brand_interaction_limits`
      - `id` (uuid, primary key)
      - `brand_id` (uuid, foreign key to brands)
      - `date` (date)
      - `requests_sent` (integer) - count of requests sent today
      - `max_daily_requests` (integer) - default 3

  2. Security
    - Enable RLS on both tables
    - Policies for brands to manage their own interactions
*/

-- Create interaction type enum
CREATE TYPE interaction_type AS ENUM ('offer_request', 'campaign_request');

-- Create interaction status enum
CREATE TYPE interaction_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- Create brand_interactions table
CREATE TABLE IF NOT EXISTS brand_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  target_brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  interaction_type interaction_type NOT NULL,
  request_type text NOT NULL DEFAULT 'exclusive_coupon',
  message text NOT NULL,
  status interaction_status NOT NULL DEFAULT 'pending',
  response_message text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  CONSTRAINT different_brands CHECK (requester_brand_id != target_brand_id)
);

-- Create brand_interaction_limits table
CREATE TABLE IF NOT EXISTS brand_interaction_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  requests_sent integer NOT NULL DEFAULT 0,
  max_daily_requests integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_brand_interactions_requester ON brand_interactions(requester_brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_interactions_target ON brand_interactions(target_brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_interactions_status ON brand_interactions(status);
CREATE INDEX IF NOT EXISTS idx_brand_interaction_limits_brand_date ON brand_interaction_limits(brand_id, date);

-- Enable RLS
ALTER TABLE brand_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_interaction_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brand_interactions

-- Brands can view interactions where they are requester or target
CREATE POLICY "Brands can view own interactions"
  ON brand_interactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.brand_id = requester_brand_id OR profiles.brand_id = target_brand_id)
    )
  );

-- Brands can create interactions as requester
CREATE POLICY "Brands can create interactions"
  ON brand_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.brand_id = requester_brand_id
    )
  );

-- Brands can update interactions they received (respond)
CREATE POLICY "Brands can respond to received interactions"
  ON brand_interactions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.brand_id = target_brand_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.brand_id = target_brand_id
    )
  );

-- Admins can view all interactions
CREATE POLICY "Admins can view all interactions"
  ON brand_interactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for brand_interaction_limits

-- Brands can view own limits
CREATE POLICY "Brands can view own limits"
  ON brand_interaction_limits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.brand_id = brand_id
    )
  );

-- Brands can insert own limits
CREATE POLICY "Brands can insert own limits"
  ON brand_interaction_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.brand_id = brand_id
    )
  );

-- Brands can update own limits
CREATE POLICY "Brands can update own limits"
  ON brand_interaction_limits
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.brand_id = brand_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.brand_id = brand_id
    )
  );

-- Function to check and update daily request limits
CREATE OR REPLACE FUNCTION check_daily_request_limit(p_brand_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_requests_sent integer;
  v_max_requests integer;
BEGIN
  -- Get or create today's limit record
  INSERT INTO brand_interaction_limits (brand_id, date, requests_sent, max_daily_requests)
  VALUES (p_brand_id, CURRENT_DATE, 0, 3)
  ON CONFLICT (brand_id, date) DO NOTHING;

  -- Get current count
  SELECT requests_sent, max_daily_requests
  INTO v_requests_sent, v_max_requests
  FROM brand_interaction_limits
  WHERE brand_id = p_brand_id AND date = CURRENT_DATE;

  -- Check if under limit
  RETURN v_requests_sent < v_max_requests;
END;
$$;

-- Function to increment request count
CREATE OR REPLACE FUNCTION increment_request_count(p_brand_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO brand_interaction_limits (brand_id, date, requests_sent, max_daily_requests)
  VALUES (p_brand_id, CURRENT_DATE, 1, 3)
  ON CONFLICT (brand_id, date) 
  DO UPDATE SET requests_sent = brand_interaction_limits.requests_sent + 1;
END;
$$;

-- Function to automatically expire old pending interactions
CREATE OR REPLACE FUNCTION expire_old_interactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE brand_interactions
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < now();
END;
$$;
