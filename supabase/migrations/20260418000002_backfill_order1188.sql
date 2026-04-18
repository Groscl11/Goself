-- Backfill order #1188 for Houmetest
-- Customer: groscl.ltd+889900@gmail.com (upadhya sharma) — new user
-- Shopify Order ID: 6550450995379
-- Total: 1722.68 INR, financial_status: paid
-- Points: floor(1722.68 * 15 / 100) = 258

DO $$
DECLARE
  v_client_id         uuid    := '5baeb773-9fc6-4ef4-8333-68ebba4c2e5d';
  v_order_id          text    := '6550450995379';
  v_order_number      text    := '1188';
  v_email             text    := 'groscl.ltd+889900@gmail.com';
  v_total_price       numeric := 1722.68;
  v_earn_rate         numeric := 15;
  v_earn_divisor      numeric := 100;

  v_program_id        uuid;
  v_member_id         uuid;
  v_status_id         uuid;
  v_tier_id           uuid;
  v_old_balance       integer;
  v_old_lifetime      integer;
  v_old_total_orders  integer;
  v_old_total_spend   numeric;
  v_points            integer;
  v_new_balance       integer;
BEGIN
  -- 1. Get loyalty program
  SELECT id INTO v_program_id
    FROM loyalty_programs
   WHERE client_id = v_client_id AND is_active = true
   LIMIT 1;

  IF v_program_id IS NULL THEN
    RAISE NOTICE 'No active loyalty program — skipping';
    RETURN;
  END IF;

  -- 2. Idempotency: skip if order already processed
  IF EXISTS (
    SELECT 1 FROM loyalty_points_transactions
     WHERE reference_id = v_order_id
       AND transaction_type = 'earned'
  ) THEN
    RAISE NOTICE 'Order % already has points awarded — skipping', v_order_id;
    RETURN;
  END IF;

  -- 3. Find or create member
  SELECT id INTO v_member_id
    FROM member_users
   WHERE email = v_email AND client_id = v_client_id
   LIMIT 1;

  IF v_member_id IS NULL THEN
    INSERT INTO member_users (client_id, email, full_name, metadata)
    VALUES (
      v_client_id,
      v_email,
      'upadhya sharma',
      jsonb_build_object('source', 'shopify', 'shopify_customer_id', 9143234199731)
    )
    RETURNING id INTO v_member_id;
    RAISE NOTICE 'Created new member: %', v_member_id;
  END IF;

  -- 4. Find default tier
  SELECT id INTO v_tier_id
    FROM loyalty_tiers
   WHERE loyalty_program_id = v_program_id
   ORDER BY tier_level ASC
   LIMIT 1;

  -- 5. Find or create loyalty status
  SELECT id, points_balance, lifetime_points_earned, total_orders, total_spend
    INTO v_status_id, v_old_balance, v_old_lifetime, v_old_total_orders, v_old_total_spend
    FROM member_loyalty_status
   WHERE member_user_id = v_member_id AND loyalty_program_id = v_program_id
   LIMIT 1;

  IF v_status_id IS NULL THEN
    INSERT INTO member_loyalty_status (
      member_user_id, loyalty_program_id, current_tier_id,
      points_balance, lifetime_points_earned, lifetime_points_redeemed,
      total_orders, total_spend, tier_achieved_at
    ) VALUES (
      v_member_id, v_program_id, v_tier_id,
      0, 0, 0, 0, 0, now()
    )
    RETURNING id, points_balance, lifetime_points_earned, total_orders, total_spend
         INTO v_status_id, v_old_balance, v_old_lifetime, v_old_total_orders, v_old_total_spend;
    RAISE NOTICE 'Auto-enrolled member % in program %', v_member_id, v_program_id;
  END IF;

  -- 6. Calculate points
  v_points := floor(v_total_price * v_earn_rate / v_earn_divisor);

  IF v_points <= 0 THEN
    RAISE NOTICE 'Calculated 0 points for order % — skipping', v_order_id;
    RETURN;
  END IF;

  v_new_balance := COALESCE(v_old_balance, 0) + v_points;

  -- 7. Insert order record
  INSERT INTO shopify_orders (
    client_id, order_id, order_number, customer_email,
    total_price, currency, payment_method,
    order_status, financial_status, fulfillment_status,
    processed_at
  ) VALUES (
    v_client_id, v_order_id, v_order_number, v_email,
    v_total_price, 'INR', 'prepaid',
    'pending', 'paid', null,
    now()
  )
  ON CONFLICT (client_id, order_id) DO NOTHING;

  -- 8. Award points
  UPDATE member_loyalty_status
     SET points_balance         = v_new_balance,
         lifetime_points_earned = COALESCE(v_old_lifetime, 0) + v_points,
         total_orders           = COALESCE(v_old_total_orders, 0) + 1,
         total_spend            = COALESCE(v_old_total_spend, 0) + v_total_price,
         updated_at             = now()
   WHERE id = v_status_id;

  -- 9. Record transaction
  INSERT INTO loyalty_points_transactions (
    member_loyalty_status_id, member_user_id,
    transaction_type, points_amount, balance_after,
    order_amount, description, reference_id
  ) VALUES (
    v_status_id, v_member_id,
    'earned', v_points, v_new_balance,
    v_total_price,
    'Earned ' || v_points || ' points from order ' || v_order_id,
    v_order_id
  );

  RAISE NOTICE 'Awarded % points to member % for order #%. New balance: %',
    v_points, v_member_id, v_order_number, v_new_balance;
END;
$$;
