-- Quick Brand User Setup for Testing
-- Run this SQL in Supabase to link your brand user account to a brand

-- OPTION 1: Link existing brand@test.com to Nike (ALREADY DONE)
-- This user is ready to use!
UPDATE profiles
SET brand_id = 'b1111111-1111-1111-1111-111111111111', -- Nike
    role = 'brand'
WHERE email = 'brand@test.com';

-- OPTION 2: Link any other user email to a brand
-- Replace 'your-email@example.com' with your actual email
-- Replace brand_id with the desired brand from the list below

-- UPDATE profiles
-- SET brand_id = 'b1111111-1111-1111-1111-111111111111', -- Nike
--     role = 'brand'
-- WHERE email = 'your-email@example.com';

-- Available Brands (copy the ID you want):
-- b1111111-1111-1111-1111-111111111111  Nike (Sportswear) - 2 rewards, 3 vouchers, 2 redemptions
-- b2222222-2222-2222-2222-222222222222  Starbucks (Food & Beverage) - 2 rewards, 13 vouchers, 5 redemptions
-- b3333333-3333-3333-3333-333333333333  Amazon (Technology) - 3 rewards, 3 vouchers, 1 redemption
-- b4444444-4444-4444-4444-444444444444  Target (Retail) - 1 reward, 2 vouchers, 1 redemption
-- b5555555-5555-5555-5555-555555555555  Best Buy (Electronics) - 1 reward, 1 voucher, 0 redemptions

-- Verify your brand user is set up correctly:
SELECT
  p.email,
  p.role,
  p.full_name,
  b.name as brand_name,
  b.industry,
  (SELECT COUNT(*) FROM rewards WHERE brand_id = p.brand_id) as total_rewards,
  (SELECT COUNT(*) FROM vouchers WHERE reward_id IN (SELECT id FROM rewards WHERE brand_id = p.brand_id)) as total_vouchers
FROM profiles p
LEFT JOIN brands b ON p.brand_id = b.id
WHERE p.role = 'brand';

-- If you want to create a new brand user from scratch:
-- 1. First sign up at /signup with a new email (e.g., test.brand@example.com)
-- 2. Then run this SQL:
-- UPDATE profiles
-- SET brand_id = 'b2222222-2222-2222-2222-222222222222', -- Choose your brand
--     role = 'brand'
-- WHERE email = 'test.brand@example.com'; -- Your signup email
