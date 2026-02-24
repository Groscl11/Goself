/*
  # Add Brand Details and Analytics

  1. Changes to brands table
    - Add detailed brand information fields
    - Social media links (LinkedIn, Twitter, Facebook, Instagram)
    - Company details (founders, employees, year founded)
    - Address and location information
    - Industry and company size
  
  2. New Tables
    - `brand_analytics`
      - Track brand performance metrics
      - Reward redemptions, views, engagement
      - Time-series data for analytics dashboard
  
  3. Security
    - Maintain existing RLS policies
    - Add policies for analytics table
*/

-- Add new columns to brands table
DO $$
BEGIN
  -- Company details
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'founders'
  ) THEN
    ALTER TABLE brands ADD COLUMN founders text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'employee_count'
  ) THEN
    ALTER TABLE brands ADD COLUMN employee_count text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'year_founded'
  ) THEN
    ALTER TABLE brands ADD COLUMN year_founded integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'industry'
  ) THEN
    ALTER TABLE brands ADD COLUMN industry text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'company_size'
  ) THEN
    ALTER TABLE brands ADD COLUMN company_size text;
  END IF;

  -- Social media links
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'linkedin_url'
  ) THEN
    ALTER TABLE brands ADD COLUMN linkedin_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'twitter_url'
  ) THEN
    ALTER TABLE brands ADD COLUMN twitter_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'facebook_url'
  ) THEN
    ALTER TABLE brands ADD COLUMN facebook_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'instagram_url'
  ) THEN
    ALTER TABLE brands ADD COLUMN instagram_url text;
  END IF;

  -- Address information
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'address'
  ) THEN
    ALTER TABLE brands ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'city'
  ) THEN
    ALTER TABLE brands ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'state'
  ) THEN
    ALTER TABLE brands ADD COLUMN state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'country'
  ) THEN
    ALTER TABLE brands ADD COLUMN country text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE brands ADD COLUMN postal_code text;
  END IF;

  -- Extended description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'long_description'
  ) THEN
    ALTER TABLE brands ADD COLUMN long_description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brands' AND column_name = 'tagline'
  ) THEN
    ALTER TABLE brands ADD COLUMN tagline text;
  END IF;
END $$;

-- Create brand_analytics table
CREATE TABLE IF NOT EXISTS brand_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_rewards integer DEFAULT 0,
  active_rewards integer DEFAULT 0,
  total_redemptions integer DEFAULT 0,
  total_views integer DEFAULT 0,
  unique_members integer DEFAULT 0,
  revenue_generated numeric(12, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, date)
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_brand_analytics_brand_id ON brand_analytics(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_analytics_date ON brand_analytics(date);

-- Enable RLS on brand_analytics
ALTER TABLE brand_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brand_analytics
CREATE POLICY "Admins can manage all analytics"
  ON brand_analytics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Brands can view own analytics"
  ON brand_analytics FOR SELECT
  TO authenticated
  USING (
    brand_id IN (
      SELECT brand_id FROM profiles
      WHERE id = auth.uid() AND role = 'brand'
    )
  );

CREATE POLICY "Clients can view analytics for brands they work with"
  ON brand_analytics FOR SELECT
  TO authenticated
  USING (
    brand_id IN (
      SELECT DISTINCT r.brand_id
      FROM rewards r
      WHERE r.client_id IN (
        SELECT client_id FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    )
  );
