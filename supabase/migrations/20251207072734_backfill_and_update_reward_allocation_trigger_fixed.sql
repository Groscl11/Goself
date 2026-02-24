/*
  # Backfill Missing Reward Allocations and Update Trigger (Fixed)

  1. Problem
    - Existing memberships don't have rewards allocated (trigger only runs for new records)
    - Members can't see rewards even though they have active memberships
    - Need to backfill existing memberships with rewards
    - Previous migration failed because membership_id column was missing
    
  2. Solution
    - Create a function to allocate rewards for a membership
    - Run backfill for all existing active memberships
    - Update trigger to handle both INSERT and UPDATE operations
    - Include membership_id in reward allocation
    
  3. Changes
    - Create reusable allocation function with membership_id
    - Backfill existing memberships
    - Update trigger to fire on INSERT and UPDATE
*/

-- Create a reusable function to allocate rewards for a membership
CREATE OR REPLACE FUNCTION allocate_rewards_for_membership(p_membership_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_id uuid;
  v_program_id uuid;
  v_expires_at timestamptz;
  v_status text;
  reward_record RECORD;
BEGIN
  -- Get membership details
  SELECT member_id, program_id, expires_at, status
  INTO v_member_id, v_program_id, v_expires_at, v_status
  FROM member_memberships
  WHERE id = p_membership_id;

  -- Only process active memberships
  IF v_status != 'active' THEN
    RETURN;
  END IF;

  -- Default expiry to 1 year if not set
  v_expires_at := COALESCE(v_expires_at, NOW() + INTERVAL '1 year');

  -- Get all rewards for this program
  FOR reward_record IN
    SELECT reward_id, quantity_limit
    FROM membership_program_rewards
    WHERE program_id = v_program_id
  LOOP
    -- Check if allocation already exists
    IF NOT EXISTS (
      SELECT 1 FROM member_rewards_allocation
      WHERE member_id = v_member_id 
      AND reward_id = reward_record.reward_id
      AND membership_id = p_membership_id
    ) THEN
      -- Insert reward allocation with membership_id
      INSERT INTO member_rewards_allocation (
        member_id,
        membership_id,
        reward_id,
        quantity_allocated,
        quantity_redeemed,
        allocated_at,
        expires_at
      ) VALUES (
        v_member_id,
        p_membership_id,
        reward_record.reward_id,
        COALESCE(reward_record.quantity_limit, 1),
        0,
        NOW(),
        v_expires_at
      );
    END IF;
  END LOOP;
END;
$$;

-- Update the trigger function to use the new reusable function
CREATE OR REPLACE FUNCTION allocate_membership_rewards()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- For UPDATE, only process if status changed to active
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = NEW.status AND NEW.status != 'active' THEN
      RETURN NEW;
    END IF;
    
    IF NEW.status != 'active' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- For INSERT, only process if active
  IF TG_OP = 'INSERT' AND NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Allocate rewards
  PERFORM allocate_rewards_for_membership(NEW.id);

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to handle both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_allocate_membership_rewards ON member_memberships;

CREATE TRIGGER trigger_allocate_membership_rewards
  AFTER INSERT OR UPDATE ON member_memberships
  FOR EACH ROW
  EXECUTE FUNCTION allocate_membership_rewards();

-- Backfill rewards for all existing active memberships
DO $$
DECLARE
  membership_record RECORD;
  total_processed INTEGER := 0;
BEGIN
  FOR membership_record IN
    SELECT id FROM member_memberships WHERE status = 'active'
  LOOP
    PERFORM allocate_rewards_for_membership(membership_record.id);
    total_processed := total_processed + 1;
  END LOOP;
  
  RAISE NOTICE 'Backfilled rewards for % active memberships', total_processed;
END $$;