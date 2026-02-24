/*
  # Add Automatic Reward Allocation When Membership is Assigned

  1. Problem
    - When members are assigned to membership programs, rewards are not automatically allocated
    - Members cannot see or redeem rewards even though they have active memberships
    
  2. Solution
    - Create a trigger function that runs when a new membership is created
    - Automatically allocate rewards from membership_program_rewards to member_rewards_allocation
    - Set appropriate expiry dates based on membership expiration
    
  3. Security
    - Function runs with security definer to ensure it has proper permissions
    - Only triggers for new active memberships
*/

-- Function to allocate rewards when membership is assigned
CREATE OR REPLACE FUNCTION allocate_membership_rewards()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  reward_record RECORD;
  expiry_date timestamptz;
BEGIN
  -- Only process if membership is active
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Use membership expiry date for reward expiry, or default to 1 year
  expiry_date := COALESCE(NEW.expires_at, NOW() + INTERVAL '1 year');

  -- Get all rewards associated with this membership program
  FOR reward_record IN
    SELECT reward_id, quantity_limit
    FROM membership_program_rewards
    WHERE program_id = NEW.program_id
  LOOP
    -- Check if allocation already exists for this member and reward
    IF NOT EXISTS (
      SELECT 1 FROM member_rewards_allocation
      WHERE member_id = NEW.member_id 
      AND reward_id = reward_record.reward_id
      AND (expires_at IS NULL OR expires_at > NOW())
    ) THEN
      -- Insert reward allocation
      INSERT INTO member_rewards_allocation (
        member_id,
        reward_id,
        quantity_allocated,
        quantity_redeemed,
        allocated_at,
        expires_at
      ) VALUES (
        NEW.member_id,
        reward_record.reward_id,
        COALESCE(reward_record.quantity_limit, 1),
        0,
        NOW(),
        expiry_date
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_allocate_membership_rewards ON member_memberships;

-- Create trigger to run after membership insert
CREATE TRIGGER trigger_allocate_membership_rewards
  AFTER INSERT ON member_memberships
  FOR EACH ROW
  EXECUTE FUNCTION allocate_membership_rewards();