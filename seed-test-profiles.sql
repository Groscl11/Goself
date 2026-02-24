-- Comprehensive Seed Data for Testing Profile Switching
-- This script creates proper member_users and memberships for existing test profiles

-- ============================================================================
-- PART 1: Link existing test profiles to member_users
-- ============================================================================

-- First, create or update member_users for the test profiles
-- Member 1: Link memeber@test.com (John Smith) to TechCorp
INSERT INTO member_users (id, client_id, email, full_name, phone, is_active)
VALUES (
  '11111111-aaaa-aaaa-aaaa-111111111111',
  '11111111-1111-1111-1111-111111111111', -- TechCorp
  'memeber@test.com',
  'John Smith',
  '+1-555-0101',
  true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  client_id = EXCLUDED.client_id;

-- Member 2: Link memeber1@test.com (Sarah Johnson) to FashionHub
INSERT INTO member_users (id, client_id, email, full_name, phone, is_active)
VALUES (
  '22222222-aaaa-aaaa-aaaa-222222222222',
  '22222222-2222-2222-2222-222222222222', -- FashionHub
  'memeber1@test.com',
  'Sarah Johnson',
  '+1-555-0102',
  true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  client_id = EXCLUDED.client_id;

-- ============================================================================
-- PART 2: Create memberships for test profiles
-- ============================================================================

-- Create membership for John Smith (TechCorp Gold)
INSERT INTO member_memberships (id, member_id, program_id, status, activated_at, expires_at)
SELECT
  '11111111-bbbb-bbbb-bbbb-111111111111',
  '11111111-aaaa-aaaa-aaaa-111111111111', -- John Smith
  mp.id,
  'active',
  NOW() - INTERVAL '30 days',
  NOW() + INTERVAL '335 days'
FROM membership_programs mp
WHERE mp.name = 'TechCorp Gold Membership'
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  activated_at = EXCLUDED.activated_at,
  expires_at = EXCLUDED.expires_at;

-- Create membership for Sarah Johnson (Fashion VIP)
INSERT INTO member_memberships (id, member_id, program_id, status, activated_at, expires_at)
SELECT
  '22222222-bbbb-bbbb-bbbb-222222222222',
  '22222222-aaaa-aaaa-aaaa-222222222222', -- Sarah Johnson
  mp.id,
  'active',
  NOW() - INTERVAL '15 days',
  NOW() + INTERVAL '350 days'
FROM membership_programs mp
WHERE mp.name = 'Fashion VIP Program'
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  activated_at = EXCLUDED.activated_at,
  expires_at = EXCLUDED.expires_at;

-- ============================================================================
-- PART 3: Allocate rewards to test members
-- ============================================================================

-- Allocate Nike reward to John Smith (TechCorp member)
INSERT INTO member_rewards_allocation (id, member_id, membership_id, reward_id, quantity_allocated, quantity_redeemed, allocated_at, expires_at)
SELECT
  '11111111-cccc-cccc-cccc-111111111111',
  '11111111-aaaa-aaaa-aaaa-111111111111', -- John Smith
  '11111111-bbbb-bbbb-bbbb-111111111111', -- His membership
  r.id,
  3,
  1,
  NOW() - INTERVAL '25 days',
  NOW() + INTERVAL '340 days'
FROM rewards r
WHERE r.title = '20% Off Nike Purchase'
ON CONFLICT (id) DO UPDATE SET
  quantity_allocated = EXCLUDED.quantity_allocated,
  quantity_redeemed = EXCLUDED.quantity_redeemed;

-- Allocate Starbucks reward to Sarah Johnson (FashionHub member)
INSERT INTO member_rewards_allocation (id, member_id, membership_id, reward_id, quantity_allocated, quantity_redeemed, allocated_at, expires_at)
SELECT
  '22222222-cccc-cccc-cccc-222222222222',
  '22222222-aaaa-aaaa-aaaa-222222222222', -- Sarah Johnson
  '22222222-bbbb-bbbb-bbbb-222222222222', -- Her membership
  r.id,
  5,
  2,
  NOW() - INTERVAL '10 days',
  NOW() + INTERVAL '355 days'
FROM rewards r
WHERE r.title = 'Free Drink with Purchase'
ON CONFLICT (id) DO UPDATE SET
  quantity_allocated = EXCLUDED.quantity_allocated,
  quantity_redeemed = EXCLUDED.quantity_redeemed;

-- ============================================================================
-- PART 4: Create vouchers for test members
-- ============================================================================

-- Create vouchers for John Smith's Nike reward
INSERT INTO vouchers (id, reward_id, member_id, allocation_id, code, status, expires_at, issued_at)
SELECT
  '11111111-dddd-dddd-dddd-111111111111',
  r.id,
  '11111111-aaaa-aaaa-aaaa-111111111111',
  '11111111-cccc-cccc-cccc-111111111111',
  'NIKE-TEST-001',
  'available',
  NOW() + INTERVAL '340 days',
  NOW() - INTERVAL '25 days'
FROM rewards r
WHERE r.title = '20% Off Nike Purchase'
ON CONFLICT (id) DO NOTHING;

INSERT INTO vouchers (id, reward_id, member_id, allocation_id, code, status, expires_at, issued_at, redeemed_at)
SELECT
  '11111111-eeee-eeee-eeee-111111111111',
  r.id,
  '11111111-aaaa-aaaa-aaaa-111111111111',
  '11111111-cccc-cccc-cccc-111111111111',
  'NIKE-TEST-002',
  'redeemed',
  NOW() + INTERVAL '340 days',
  NOW() - INTERVAL '25 days',
  NOW() - INTERVAL '5 days'
FROM rewards r
WHERE r.title = '20% Off Nike Purchase'
ON CONFLICT (id) DO NOTHING;

-- Create vouchers for Sarah Johnson's Starbucks reward
INSERT INTO vouchers (id, reward_id, member_id, allocation_id, code, status, expires_at, issued_at)
SELECT
  '22222222-dddd-dddd-dddd-222222222222',
  r.id,
  '22222222-aaaa-aaaa-aaaa-222222222222',
  '22222222-cccc-cccc-cccc-222222222222',
  'SBUX-TEST-001',
  'available',
  NOW() + INTERVAL '355 days',
  NOW() - INTERVAL '10 days'
FROM rewards r
WHERE r.title = 'Free Drink with Purchase'
ON CONFLICT (id) DO NOTHING;

INSERT INTO vouchers (id, reward_id, member_id, allocation_id, code, status, expires_at, issued_at, redeemed_at)
SELECT
  '22222222-eeee-eeee-eeee-222222222222',
  r.id,
  '22222222-aaaa-aaaa-aaaa-222222222222',
  '22222222-cccc-cccc-cccc-222222222222',
  'SBUX-TEST-002',
  'redeemed',
  NOW() + INTERVAL '355 days',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '3 days'
FROM rewards r
WHERE r.title = 'Free Drink with Purchase'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 5: Create redemption records
-- ============================================================================

-- Redemption for John Smith's Nike voucher
INSERT INTO redemptions (id, voucher_id, member_id, reward_id, redemption_channel, redeemed_at)
SELECT
  '11111111-ffff-ffff-ffff-111111111111',
  '11111111-eeee-eeee-eeee-111111111111',
  '11111111-aaaa-aaaa-aaaa-111111111111',
  r.id,
  'online',
  NOW() - INTERVAL '5 days'
FROM rewards r
WHERE r.title = '20% Off Nike Purchase'
ON CONFLICT (id) DO NOTHING;

-- Redemption for Sarah Johnson's Starbucks voucher
INSERT INTO redemptions (id, voucher_id, member_id, reward_id, redemption_channel, redeemed_at)
SELECT
  '22222222-ffff-ffff-ffff-222222222222',
  '22222222-eeee-eeee-eeee-222222222222',
  '22222222-aaaa-aaaa-aaaa-222222222222',
  r.id,
  'in_store',
  NOW() - INTERVAL '3 days'
FROM rewards r
WHERE r.title = 'Free Drink with Purchase'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 6: Link auth profiles to member_users
-- ============================================================================

-- Update profiles to reference the correct member_users
UPDATE profiles
SET client_id = '11111111-1111-1111-1111-111111111111'
WHERE email = 'memeber@test.com';

UPDATE profiles
SET client_id = '22222222-2222-2222-2222-222222222222'
WHERE email = 'memeber1@test.com';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify test profiles
SELECT
  'Test Profiles' as check_type,
  p.email,
  p.role,
  p.full_name,
  c.name as client_name,
  b.name as brand_name
FROM profiles p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
WHERE p.email IN ('admin@test.com', 'client@test.com', 'brand@test.com', 'memeber@test.com', 'memeber1@test.com')
ORDER BY p.role, p.email;

-- Verify member_users
SELECT
  'Member Users' as check_type,
  mu.email,
  mu.full_name,
  c.name as client_name,
  COUNT(DISTINCT mm.id) as active_memberships,
  COUNT(DISTINCT v.id) as total_vouchers
FROM member_users mu
JOIN clients c ON mu.client_id = c.id
LEFT JOIN member_memberships mm ON mm.member_id = mu.id AND mm.status = 'active'
LEFT JOIN vouchers v ON v.member_id = mu.id
WHERE mu.email IN ('memeber@test.com', 'memeber1@test.com')
GROUP BY mu.id, mu.email, mu.full_name, c.name;

-- Verify memberships
SELECT
  'Memberships' as check_type,
  mu.email as member_email,
  mp.name as program_name,
  mm.status,
  mm.activated_at,
  mm.expires_at
FROM member_memberships mm
JOIN member_users mu ON mm.member_id = mu.id
JOIN membership_programs mp ON mm.program_id = mp.id
WHERE mu.email IN ('memeber@test.com', 'memeber1@test.com')
ORDER BY mu.email;

-- Verify vouchers
SELECT
  'Vouchers' as check_type,
  mu.email as member_email,
  r.title as reward_title,
  v.code,
  v.status,
  v.expires_at
FROM vouchers v
JOIN member_users mu ON v.member_id = mu.id
JOIN rewards r ON v.reward_id = r.id
WHERE mu.email IN ('memeber@test.com', 'memeber1@test.com')
ORDER BY mu.email, v.status;
