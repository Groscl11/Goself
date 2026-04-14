-- Backfill referral for order #1184
-- Referrer: groscl.ltd+40@gmail.com (used referral link ?ref=EFF2D85A)
-- Buyer:    milikharya662+889@gmail.com
-- Client:   houmetest (5baeb773-9fc6-4ef4-8333-68ebba4c2e5d)

DO $$
DECLARE
  v_client_id       uuid    := '5baeb773-9fc6-4ef4-8333-68ebba4c2e5d';
  v_referral_code   text    := 'EFF2D85A';
  v_buyer_email     text    := 'milikharya662+889@gmail.com';

  v_program_id              uuid;
  v_referrer_member_id      uuid;
  v_referrer_status_id      uuid;
  v_referrer_balance        integer;
  v_referrer_lifetime       integer;
  v_referrer_ref_pts        integer;
  v_referred_member_id      uuid;
  v_referral_points         integer := 0;
  v_new_balance             integer;
  v_new_lifetime            integer;
  v_new_ref_pts             integer;
BEGIN
  -- 1. Get loyalty program
  SELECT id INTO v_program_id
    FROM loyalty_programs
   WHERE client_id = v_client_id AND is_active = true
   LIMIT 1;
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'No active loyalty program for houmetest — skipping backfill';
    RETURN;
  END IF;

  -- 2. Find referrer by referral code
  SELECT member_user_id, id, points_balance, lifetime_points_earned, referral_points_earned
    INTO v_referrer_member_id, v_referrer_status_id, v_referrer_balance, v_referrer_lifetime, v_referrer_ref_pts
    FROM member_loyalty_status
   WHERE referral_code = v_referral_code
     AND loyalty_program_id = v_program_id
   LIMIT 1;

  IF v_referrer_member_id IS NULL THEN
    RAISE NOTICE 'No member found with referral_code=% in program % — skipping', v_referral_code, v_program_id;
    RETURN;
  END IF;

  -- 3. Find referred (buyer) member
  SELECT id INTO v_referred_member_id
    FROM member_users
   WHERE email = v_buyer_email AND client_id = v_client_id
   LIMIT 1;

  IF v_referred_member_id IS NULL THEN
    RAISE NOTICE 'Buyer % not found as member — skipping', v_buyer_email;
    RETURN;
  END IF;

  -- 4. Prevent self-referral
  IF v_referred_member_id = v_referrer_member_id THEN
    RAISE NOTICE 'Self-referral detected — skipping';
    RETURN;
  END IF;

  -- 5. Idempotency check
  IF EXISTS (
    SELECT 1 FROM member_referrals
     WHERE loyalty_program_id = v_program_id
       AND referred_member_id = v_referred_member_id
  ) THEN
    RAISE NOTICE 'Referral for buyer % already recorded — skipping', v_buyer_email;
    RETURN;
  END IF;

  -- 6. Get referral earning rule points
  SELECT COALESCE(points_reward, 0) INTO v_referral_points
    FROM loyalty_earning_rules
   WHERE client_id = v_client_id
     AND rule_type = 'referral'
     AND is_active = true
   ORDER BY created_at
   LIMIT 1;

  -- 7. Insert member_referrals record
  INSERT INTO member_referrals (
    loyalty_program_id, referrer_member_id, referred_member_id,
    referral_code, referred_email, status, points_awarded, completed_at
  ) VALUES (
    v_program_id, v_referrer_member_id, v_referred_member_id,
    v_referral_code, v_buyer_email, 'completed', v_referral_points, NOW()
  );

  RAISE NOTICE 'Inserted member_referrals record: referrer=%, referred=%, points=%',
    v_referrer_member_id, v_referred_member_id, v_referral_points;

  -- 8. Award points to referrer (if any)
  IF v_referral_points > 0 THEN
    v_new_balance  := COALESCE(v_referrer_balance, 0)  + v_referral_points;
    v_new_lifetime := COALESCE(v_referrer_lifetime, 0) + v_referral_points;
    v_new_ref_pts  := COALESCE(v_referrer_ref_pts, 0)  + v_referral_points;

    UPDATE member_loyalty_status
       SET points_balance        = v_new_balance,
           lifetime_points_earned = v_new_lifetime,
           referral_points_earned = v_new_ref_pts,
           updated_at             = NOW()
     WHERE id = v_referrer_status_id;

    INSERT INTO loyalty_points_transactions (
      member_loyalty_status_id, member_user_id, transaction_type,
      points_amount, balance_after, description, reference_id
    ) VALUES (
      v_referrer_status_id, v_referrer_member_id, 'earned',
      v_referral_points, v_new_balance,
      'Referral bonus — backfill order #1184',
      v_referred_member_id::text
    );

    RAISE NOTICE 'Awarded % pts to referrer %. New balance: %',
      v_referral_points, v_referrer_member_id, v_new_balance;
  ELSE
    RAISE NOTICE 'Referral recorded but no earning rule configured (0 pts)';
  END IF;
END $$;
