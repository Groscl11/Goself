-- Add banner_url column to rewards table
-- Stores a wide promotional banner image (16:9 or 3:1 ratio)
-- separate from the square logo/icon stored in image_url.
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS banner_url text;
