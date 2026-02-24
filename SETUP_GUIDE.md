# Quick Setup Guide - Test Users

## Important Note
**Supabase Auth users cannot be created via SQL**. You must create them through the signup page or Supabase dashboard. However, I've prepared the database with demo data.

## Quick 4-Step Setup (5 minutes)

### Step 1: Create 4 User Accounts

Go to `/signup` and create these 4 accounts:

1. **Admin User**
   - Email: `admin@test.com`
   - Password: `Test123456!`
   - Full Name: `Admin User`
   - Account Type: Client (we'll change this)

2. **Client User**
   - Email: `client@test.com`
   - Password: `Test123456!`
   - Full Name: `Client Manager`
   - Account Type: Client

3. **Brand User**
   - Email: `brand@test.com`
   - Password: `Test123456!`
   - Full Name: `Brand Manager`
   - Account Type: Brand

4. **Member User**
   - Email: `member@test.com`
   - Password: `Test123456!`
   - Full Name: `Member User`
   - Account Type: Member

### Step 2: Run This SQL in Supabase SQL Editor

```sql
-- Get the client and brand IDs we created
DO $$
DECLARE
    demo_client_id uuid;
    demo_brand_id uuid;
BEGIN
    -- Get IDs
    SELECT id INTO demo_client_id FROM clients WHERE contact_email = 'client@example.com';
    SELECT id INTO demo_brand_id FROM brands WHERE contact_email = 'brand@example.com';

    -- Update admin user
    UPDATE profiles SET role = 'admin'
    WHERE email = 'admin@test.com';

    -- Update client user
    UPDATE profiles
    SET client_id = demo_client_id
    WHERE email = 'client@test.com';

    -- Update brand user
    UPDATE profiles
    SET brand_id = demo_brand_id
    WHERE email = 'brand@test.com';

    -- Create member_users entry and link
    INSERT INTO member_users (client_id, email, full_name, is_active)
    VALUES (demo_client_id, 'member@test.com', 'Member User', true)
    ON CONFLICT (client_id, email) DO NOTHING;

    RAISE NOTICE 'Setup complete!';
END $$;
```

### Step 3: Add Demo Data with Members

```sql
-- Get the TechStore client ID
DO $$
DECLARE
    techstore_id uuid;
    coffee_brand_id uuid;
    book_brand_id uuid;
    spa_brand_id uuid;
    movie_brand_id uuid;
    silver_program_id uuid;
    gold_program_id uuid;
    platinum_program_id uuid;
    coffee_reward_id uuid;
    book_reward_id uuid;
    spa_reward_id uuid;
    movie_reward_id uuid;
    member1_id uuid;
    member2_id uuid;
    member3_id uuid;
    membership1_id uuid;
    membership2_id uuid;
    membership3_id uuid;
BEGIN
    -- Get IDs
    SELECT id INTO techstore_id FROM clients WHERE name = 'TechStore Inc';
    SELECT id INTO coffee_brand_id FROM brands WHERE name = 'Coffee Masters';
    SELECT id INTO book_brand_id FROM brands WHERE name = 'Book Haven';
    SELECT id INTO spa_brand_id FROM brands WHERE name = 'Spa Serenity';
    SELECT id INTO movie_brand_id FROM brands WHERE name = 'Movie Magic';

    -- Create rewards
    INSERT INTO rewards (brand_id, title, description, value_description, category, status, is_marketplace, voucher_count, expiry_date)
    VALUES
        (coffee_brand_id, 'Free Coffee Upgrade', 'Upgrade any coffee to large size', '$3 value', 'food', 'active', true, 100, '2025-12-31'),
        (book_brand_id, '$10 Off Book Purchase', 'Get $10 off any book purchase over $30', '$10 value', 'entertainment', 'active', true, 75, '2025-12-31'),
        (spa_brand_id, 'Complimentary Massage', '30-minute massage session', '$50 value', 'wellness', 'active', true, 25, '2025-06-30'),
        (movie_brand_id, 'Free Movie Ticket', 'One free standard movie ticket', '$15 value', 'entertainment', 'active', true, 200, '2025-12-31')
    ON CONFLICT DO NOTHING
    RETURNING id INTO coffee_reward_id;

    SELECT id INTO coffee_reward_id FROM rewards WHERE title = 'Free Coffee Upgrade' LIMIT 1;
    SELECT id INTO book_reward_id FROM rewards WHERE title = '$10 Off Book Purchase' LIMIT 1;
    SELECT id INTO spa_reward_id FROM rewards WHERE title = 'Complimentary Massage' LIMIT 1;
    SELECT id INTO movie_reward_id FROM rewards WHERE title = 'Free Movie Ticket' LIMIT 1;

    -- Create membership programs
    INSERT INTO membership_programs (client_id, name, description, validity_days, max_rewards_total, is_active)
    VALUES
        (techstore_id, 'Silver Membership', 'Entry-level membership with 3 rewards', 365, 3, true),
        (techstore_id, 'Gold Membership', 'Mid-tier membership with 6 rewards', 365, 6, true),
        (techstore_id, 'Platinum Membership', 'Premium membership with unlimited rewards', 365, NULL, true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO silver_program_id;

    SELECT id INTO silver_program_id FROM membership_programs WHERE name = 'Silver Membership' AND client_id = techstore_id LIMIT 1;
    SELECT id INTO gold_program_id FROM membership_programs WHERE name = 'Gold Membership' AND client_id = techstore_id LIMIT 1;
    SELECT id INTO platinum_program_id FROM membership_programs WHERE name = 'Platinum Membership' AND client_id = techstore_id LIMIT 1;

    -- Link rewards to programs
    INSERT INTO membership_program_rewards (program_id, reward_id)
    VALUES
        (silver_program_id, coffee_reward_id),
        (silver_program_id, movie_reward_id),
        (gold_program_id, coffee_reward_id),
        (gold_program_id, book_reward_id),
        (gold_program_id, movie_reward_id),
        (platinum_program_id, coffee_reward_id),
        (platinum_program_id, book_reward_id),
        (platinum_program_id, spa_reward_id),
        (platinum_program_id, movie_reward_id)
    ON CONFLICT DO NOTHING;

    -- Create demo members
    INSERT INTO member_users (client_id, email, full_name, phone, is_active)
    VALUES
        (techstore_id, 'john.doe@example.com', 'John Doe', '+1-555-0101', true),
        (techstore_id, 'jane.smith@example.com', 'Jane Smith', '+1-555-0102', true),
        (techstore_id, 'bob.wilson@example.com', 'Bob Wilson', '+1-555-0103', true)
    ON CONFLICT (client_id, email) DO NOTHING
    RETURNING id INTO member1_id;

    SELECT id INTO member1_id FROM member_users WHERE email = 'john.doe@example.com' AND client_id = techstore_id LIMIT 1;
    SELECT id INTO member2_id FROM member_users WHERE email = 'jane.smith@example.com' AND client_id = techstore_id LIMIT 1;
    SELECT id INTO member3_id FROM member_users WHERE email = 'bob.wilson@example.com' AND client_id = techstore_id LIMIT 1;

    -- Assign memberships
    INSERT INTO member_memberships (member_id, program_id, status, activated_at, expires_at)
    VALUES
        (member1_id, silver_program_id, 'active', NOW(), NOW() + INTERVAL '365 days'),
        (member2_id, gold_program_id, 'active', NOW(), NOW() + INTERVAL '365 days'),
        (member3_id, platinum_program_id, 'active', NOW(), NOW() + INTERVAL '365 days')
    ON CONFLICT DO NOTHING
    RETURNING id INTO membership1_id;

    SELECT id INTO membership1_id FROM member_memberships WHERE member_id = member1_id LIMIT 1;
    SELECT id INTO membership2_id FROM member_memberships WHERE member_id = member2_id LIMIT 1;
    SELECT id INTO membership3_id FROM member_memberships WHERE member_id = member3_id LIMIT 1;

    -- Allocate rewards to members
    INSERT INTO member_rewards_allocation (member_id, membership_id, reward_id, quantity_allocated, expires_at)
    SELECT mm.member_id, mm.id, mpr.reward_id, 1, mm.expires_at
    FROM member_memberships mm
    JOIN membership_program_rewards mpr ON mpr.program_id = mm.program_id
    WHERE mm.status = 'active' AND mm.member_id IN (member1_id, member2_id, member3_id)
    ON CONFLICT DO NOTHING;

    -- Generate vouchers for allocated rewards
    INSERT INTO vouchers (reward_id, member_id, allocation_id, code, status, expires_at)
    SELECT
        mra.reward_id,
        mra.member_id,
        mra.id,
        'DEMO-' || UPPER(substring(md5(random()::text || mra.id::text), 1, 8)),
        'available',
        mra.expires_at
    FROM member_rewards_allocation mra
    WHERE mra.member_id IN (member1_id, member2_id, member3_id)
    ON CONFLICT (code) DO NOTHING;

    -- Create some sample redemptions
    INSERT INTO redemptions (voucher_id, member_id, reward_id, redemption_channel, redeemed_at)
    SELECT
        v.id,
        v.member_id,
        v.reward_id,
        'online',
        NOW() - (random() * INTERVAL '30 days')
    FROM vouchers v
    WHERE v.member_id IN (member1_id, member2_id)
    AND v.status = 'available'
    LIMIT 3;

    -- Update redeemed vouchers
    UPDATE vouchers v
    SET status = 'redeemed', redeemed_at = r.redeemed_at
    FROM redemptions r
    WHERE v.id = r.voucher_id;

    RAISE NOTICE 'Demo data created successfully!';
END $$;
```

### Step 4: Log In and Test!

Now you can log in with any of these accounts:

| Role | Email | Password | What You'll See |
|------|-------|----------|-----------------|
| **Admin** | admin@test.com | Test123456! | Platform overview, manage all clients/brands |
| **Client** | client@test.com | Test123456! | Member management with 3 demo members |
| **Brand** | brand@test.com | Test123456! | Brand dashboard, submit rewards |
| **Member** | member@test.com | Test123456! | View memberships and rewards |

## What Demo Data You'll Have

After setup:
- ✅ 2 client organizations (Demo Client Inc, TechStore Inc)
- ✅ 5 brands (Demo Brand, Coffee Masters, Book Haven, Spa Serenity, Movie Magic)
- ✅ 4 marketplace rewards
- ✅ 3 membership programs (Silver, Gold, Platinum)
- ✅ 3 demo members with active memberships
- ✅ Allocated rewards and vouchers
- ✅ Sample redemption history

## Testing Member Management

Log in as **client@test.com** and:
1. Go to "Members" in the sidebar
2. Click on any member (John Doe, Jane Smith, or Bob Wilson)
3. Explore their:
   - Active memberships
   - Allocated rewards
   - Available vouchers with codes
   - Redemption history

## Alternative: Use Supabase Dashboard

Instead of signup page, you can also create users directly in Supabase Dashboard:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Create the 4 users with the emails above
4. Then run Step 2 and 3 SQL scripts

This is faster if you have access to the Supabase dashboard!
