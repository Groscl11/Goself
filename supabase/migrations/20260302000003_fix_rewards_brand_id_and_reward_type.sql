-- Fix rewards table to support client-created discount rewards and manual rewards
-- 1. Make brand_id nullable (client-created rewards don't belong to a brand)
ALTER TABLE rewards ALTER COLUMN brand_id DROP NOT NULL;

-- 2. Add 'manual' value to reward_type enum so manual rewards can be saved
ALTER TYPE reward_type ADD VALUE IF NOT EXISTS 'manual';
