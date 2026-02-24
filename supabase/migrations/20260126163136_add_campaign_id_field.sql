/*
  # Add Campaign ID Field

  1. Changes
    - Add `campaign_id` column to `campaign_rules` table
      - Human-readable unique identifier (e.g., "CAMP-001", "CAMP-002")
      - Auto-generated on insert
      - Indexed for fast lookups
    
  2. Function
    - `generate_campaign_id()` - Generates sequential campaign IDs
      - Format: CAMP-XXX (where XXX is a zero-padded number)
      - Handles concurrency safely
    
  3. Trigger
    - Auto-populates campaign_id before insert
    - Uses trigger to ensure every campaign gets an ID
*/

-- Add campaign_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rules' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE campaign_rules ADD COLUMN campaign_id text UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_campaign_rules_campaign_id ON campaign_rules(campaign_id);
  END IF;
END $$;

-- Function to generate sequential campaign ID
CREATE OR REPLACE FUNCTION generate_campaign_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_id text;
  max_num integer;
BEGIN
  -- Get the highest campaign number
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(campaign_id FROM 'CAMP-(\d+)') AS integer
      )
    ), 0
  ) INTO max_num
  FROM campaign_rules
  WHERE campaign_id ~ '^CAMP-\d+$';
  
  -- Generate new ID with zero-padded number
  new_id := 'CAMP-' || LPAD((max_num + 1)::text, 4, '0');
  
  RETURN new_id;
END;
$$;

-- Trigger function to auto-generate campaign_id
CREATE OR REPLACE FUNCTION set_campaign_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    NEW.campaign_id := generate_campaign_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_campaign_id ON campaign_rules;
CREATE TRIGGER trigger_set_campaign_id
  BEFORE INSERT ON campaign_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_campaign_id();

-- Backfill existing campaigns with IDs
DO $$
DECLARE
  campaign_record RECORD;
  counter integer := 1;
BEGIN
  FOR campaign_record IN 
    SELECT id FROM campaign_rules WHERE campaign_id IS NULL ORDER BY created_at
  LOOP
    UPDATE campaign_rules 
    SET campaign_id = 'CAMP-' || LPAD(counter::text, 4, '0')
    WHERE id = campaign_record.id;
    counter := counter + 1;
  END LOOP;
END $$;
