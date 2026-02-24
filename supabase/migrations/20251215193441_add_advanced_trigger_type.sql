/*
  # Add 'advanced' to campaign_trigger_type enum

  1. Changes
    - Adds 'advanced' value to the campaign_trigger_type enum
    - This supports the advanced rule builder functionality which uses complex, multi-condition triggers

  2. Notes
    - The 'advanced' trigger type allows for sophisticated rule conditions beyond simple triggers
    - Compatible with the rule_version 2 advanced rules system
*/

DO $$ 
BEGIN
  -- Add 'advanced' to campaign_trigger_type enum if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'advanced' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'campaign_trigger_type')
  ) THEN
    ALTER TYPE campaign_trigger_type ADD VALUE 'advanced';
  END IF;
END $$;
