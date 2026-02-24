/*
  # Add Priority and Is Active Fields to Campaign Rewards

  1. Changes
    - Add `priority` column to campaign_rewards
      - Integer field to control display order
      - Default to 0
    - Add `is_active` column to campaign_rewards
      - Boolean field to control if reward is active in campaign
      - Default to true
    
  2. Purpose
    - Allow ordering of rewards within a campaign
    - Allow temporarily disabling rewards without removing them
    - Match frontend expectations for campaign reward management
*/

-- Add priority column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rewards' AND column_name = 'priority'
  ) THEN
    ALTER TABLE campaign_rewards ADD COLUMN priority integer DEFAULT 0;
  END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_rewards' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE campaign_rewards ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Create index on campaign_id + priority for efficient ordering
CREATE INDEX IF NOT EXISTS idx_campaign_rewards_campaign_priority ON campaign_rewards(campaign_id, priority);
