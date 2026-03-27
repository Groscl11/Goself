-- Add min_lifetime_points to loyalty_tiers for widget tier progression display
-- This stores the cumulative points a member needs to reach/unlock this tier

ALTER TABLE loyalty_tiers
  ADD COLUMN IF NOT EXISTS min_lifetime_points INTEGER NOT NULL DEFAULT 0;

-- Set sensible defaults: tier_level 1 = 0 pts (entry), higher levels keep 0 until admin sets them
-- Admins will configure these via the dashboard tier form
