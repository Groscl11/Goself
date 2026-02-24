/*
  # Fix Reward Allocation to Respect Max Limits

  1. Problem
    - Reward allocation doesn't respect max_rewards_total limit
    - Reward allocation doesn't respect max_rewards_per_brand limit
    - Missing membership_id in allocation records

  2. Solution
    - Update trigger to check and enforce max_rewards_total
    - Update trigger to check and enforce max_rewards_per_brand
    - Add membership_id to allocation records
    - Clean up existing over-allocations (optional manual step)

  3. Changes
    - Modify allocate_membership_rewards() function
    - Add logic to count existing allocations
    - Stop allocating when limits are reached
*/

-- Updated function to allocate rewards respecting max limits
CREATE OR REPLACE FUNCTION allocate_membership_rewards()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  reward_record RECORD;
  expiry_date timestamptz;
  max_rewards_total integer;
  max_rewards_per_brand integer;
  current_total_allocated integer;
  current_brand_allocated integer;
  reward_brand_id uuid;
BEGIN
  -- Only process if membership is active
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Get max limits from membership program
  SELECT mp.max_rewards_total, mp.max_rewards_per_brand
  INTO max_rewards_total, max_rewards_per_brand
  FROM membership_programs mp
  WHERE mp.id = NEW.program_id;

  -- Use membership expiry date for reward expiry, or default to 1 year
  expiry_date := COALESCE(NEW.expires_at, NOW() + INTERVAL '1 year');

  -- Count currently allocated rewards for this membership
  SELECT COALESCE(COUNT(*), 0)
  INTO current_total_allocated
  FROM member_rewards_allocation
  WHERE membership_id = NEW.id;

  -- Get all rewards associated with this membership program
  FOR reward_record IN
    SELECT mpr.reward_id, mpr.quantity_limit, r.brand_id
    FROM membership_program_rewards mpr
    JOIN rewards r ON mpr.reward_id = r.id
    WHERE mpr.program_id = NEW.program_id
    ORDER BY mpr.added_at
  LOOP
    -- Check if we've reached max_rewards_total
    IF max_rewards_total IS NOT NULL AND current_total_allocated >= max_rewards_total THEN
      EXIT; -- Stop allocating more rewards
    END IF;

    -- Check if allocation already exists for this membership and reward
    IF EXISTS (
      SELECT 1 FROM member_rewards_allocation
      WHERE membership_id = NEW.id
      AND reward_id = reward_record.reward_id
    ) THEN
      CONTINUE; -- Skip this reward
    END IF;

    -- Get brand_id for this reward
    reward_brand_id := reward_record.brand_id;

    -- Count existing allocations from this brand for this membership
    IF max_rewards_per_brand IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO current_brand_allocated
      FROM member_rewards_allocation mra
      JOIN rewards r ON mra.reward_id = r.id
      WHERE mra.membership_id = NEW.id
      AND r.brand_id = reward_brand_id;

      -- Skip if we've reached max per brand
      IF current_brand_allocated >= max_rewards_per_brand THEN
        CONTINUE;
      END IF;
    END IF;

    -- Insert reward allocation
    INSERT INTO member_rewards_allocation (
      member_id,
      membership_id,
      reward_id,
      quantity_allocated,
      quantity_redeemed,
      allocated_at,
      expires_at
    ) VALUES (
      NEW.member_id,
      NEW.id,
      reward_record.reward_id,
      COALESCE(reward_record.quantity_limit, 1),
      0,
      NOW(),
      expiry_date
    );

    -- Increment counter
    current_total_allocated := current_total_allocated + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recreate trigger (it still uses same function, just updated)
DROP TRIGGER IF EXISTS trigger_allocate_membership_rewards ON member_memberships;

CREATE TRIGGER trigger_allocate_membership_rewards
  AFTER INSERT ON member_memberships
  FOR EACH ROW
  EXECUTE FUNCTION allocate_membership_rewards();
