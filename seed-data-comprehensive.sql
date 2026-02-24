-- Comprehensive Seed Data for Rewards Platform
-- This script creates demo data across all models including clients, users, memberships, vouchers, and redemptions

-- Clean up existing data (optional - remove if you want to keep existing data)
-- TRUNCATE TABLE redemptions, vouchers, voucher_issuances, member_rewards_allocation, member_memberships, membership_program_rewards, membership_programs, campaign_rules, member_users, clients, rewards, brands, profiles CASCADE;

-- Insert demo clients
INSERT INTO clients (id, name, description, logo_url, primary_color, contact_email, contact_phone, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'TechCorp Industries', 'Leading technology solutions provider', NULL, '#2563EB', 'contact@techcorp.com', '+1-555-0100', true),
('22222222-2222-2222-2222-222222222222', 'FashionHub Retail', 'Premier fashion and lifestyle brand', NULL, '#EC4899', 'hello@fashionhub.com', '+1-555-0200', true),
('33333333-3333-3333-3333-333333333333', 'GourmetMart', 'Premium food and beverage retailer', NULL, '#10B981', 'info@gourmetmart.com', '+1-555-0300', true)
ON CONFLICT (id) DO NOTHING;

-- Insert demo brands
INSERT INTO brands (id, name, description, logo_url, website_url, status, contact_email, year_founded, industry) VALUES
('b1111111-1111-1111-1111-111111111111', 'Nike', 'Athletic apparel and footwear', NULL, 'https://nike.com', 'approved', 'partners@nike.com', 1964, 'Sportswear'),
('b2222222-2222-2222-2222-222222222222', 'Starbucks', 'Coffee and beverages', NULL, 'https://starbucks.com', 'approved', 'partners@starbucks.com', 1971, 'Food & Beverage'),
('b3333333-3333-3333-3333-333333333333', 'Amazon', 'E-commerce and technology', NULL, 'https://amazon.com', 'approved', 'partners@amazon.com', 1994, 'Technology'),
('b4444444-4444-4444-4444-444444444444', 'Target', 'Retail department store', NULL, 'https://target.com', 'approved', 'partners@target.com', 1902, 'Retail'),
('b5555555-5555-5555-5555-555555555555', 'Best Buy', 'Electronics and appliances', NULL, 'https://bestbuy.com', 'approved', 'partners@bestbuy.com', 1966, 'Electronics')
ON CONFLICT (id) DO NOTHING;

-- Insert demo rewards
INSERT INTO rewards (id, brand_id, title, description, reward_type, discount_value, max_discount_value, currency, coupon_type, status, is_marketplace, category) VALUES
('r1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', '20% Off Nike Purchase', 'Get 20% off on any Nike product purchase', 'percentage_discount', 20, 50, 'USD', 'unique', 'active', true, 'fashion'),
('r2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Free Starbucks Drink', 'Complimentary beverage of any size', 'free_item', NULL, NULL, 'USD', 'unique', 'active', true, 'food'),
('r3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333', '$25 Amazon Gift Card', 'Amazon gift card worth $25', 'fixed_value', 25, NULL, 'USD', 'unique', 'active', true, 'shopping'),
('r4444444-4444-4444-4444-444444444444', 'b4444444-4444-4444-4444-444444444444', '$10 Off Target Purchase', 'Get $10 off on purchases over $50', 'flat_discount', 10, NULL, 'USD', 'unique', 'active', true, 'shopping'),
('r5555555-5555-5555-5555-555555555555', 'b5555555-5555-5555-5555-555555555555', 'Up to $100 Off Electronics', 'Save up to $100 on electronics purchase', 'upto_discount', 100, 100, 'USD', 'unique', 'active', true, 'electronics'),
('r6666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111', 'Nike Member Exclusive', 'Exclusive access to member-only products', 'other', NULL, NULL, 'USD', 'generic', 'active', true, 'fashion'),
('r7777777-7777-7777-7777-777777777777', 'b2222222-2222-2222-2222-222222222222', '$5 Starbucks Reward', 'Get $5 off your Starbucks order', 'flat_discount', 5, NULL, 'USD', 'unique', 'active', true, 'food'),
('r8888888-8888-8888-8888-888888888888', 'b3333333-3333-3333-3333-333333333333', '15% Off Amazon Prime', 'Save 15% on Amazon Prime membership', 'percentage_discount', 15, 20, 'USD', 'unique', 'active', true, 'subscription')
ON CONFLICT (id) DO NOTHING;

-- Insert membership programs
INSERT INTO membership_programs (id, client_id, name, description, tier_level, enrollment_type, validity_days, max_rewards_total, max_rewards_per_brand, enrollment_fee, renewal_fee, auto_renew, priority, benefits, is_active) VALUES
('p1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'TechCorp Gold Membership', 'Premium membership with exclusive tech rewards', 'gold', 'manual', 365, 10, 3, 0, 0, false, 10,
  '["Priority customer support", "Early access to new products", "Exclusive member-only deals", "Free shipping on all orders", "Birthday rewards"]'::jsonb,
  true),
('p2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Fashion VIP Program', 'Elite fashion shopping experience', 'vip', 'automatic', 365, 15, 5, 0, 0, true, 20,
  '["Personal stylist consultation", "VIP shopping events", "Free alterations", "Extended return policy", "Complimentary gift wrapping"]'::jsonb,
  true),
('p3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Gourmet Plus Membership', 'Premium food and beverage benefits', 'premium', 'hybrid', 365, 12, 4, 0, 0, false, 15,
  '["Priority reservations", "Exclusive tasting events", "Member discount", "Seasonal gift boxes", "Recipe collections"]'::jsonb,
  true),
('p4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'TechCorp Silver Membership', 'Essential tech membership benefits', 'silver', 'manual', 180, 5, 2, 0, 0, false, 5,
  '["Standard support", "Member newsletter", "Special promotions", "Rewards points"]'::jsonb,
  true)
ON CONFLICT (id) DO NOTHING;

-- Link rewards to membership programs
INSERT INTO membership_program_rewards (program_id, reward_id, quantity_limit) VALUES
('p1111111-1111-1111-1111-111111111111', 'r3333333-3333-3333-3333-333333333333', 2),
('p1111111-1111-1111-1111-111111111111', 'r5555555-5555-5555-5555-555555555555', 1),
('p1111111-1111-1111-1111-111111111111', 'r8888888-8888-8888-8888-888888888888', 1),
('p2222222-2222-2222-2222-222222222222', 'r1111111-1111-1111-1111-111111111111', 3),
('p2222222-2222-2222-2222-222222222222', 'r4444444-4444-4444-4444-444444444444', 2),
('p2222222-2222-2222-2222-222222222222', 'r6666666-6666-6666-6666-666666666666', NULL),
('p3333333-3333-3333-3333-333333333333', 'r2222222-2222-2222-2222-222222222222', 4),
('p3333333-3333-3333-3333-333333333333', 'r7777777-7777-7777-7777-777777777777', 5),
('p4444444-4444-4444-4444-444444444444', 'r3333333-3333-3333-3333-333333333333', 1),
('p4444444-4444-4444-4444-444444444444', 'r4444444-4444-4444-4444-444444444444', 1)
ON CONFLICT (program_id, reward_id) DO NOTHING;

-- Insert demo member users
INSERT INTO member_users (id, client_id, email, full_name, phone, external_id, is_active) VALUES
('m1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'john.doe@email.com', 'John Doe', '+1-555-1001', 'EXT001', true),
('m2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'jane.smith@email.com', 'Jane Smith', '+1-555-1002', 'EXT002', true),
('m3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'mike.johnson@email.com', 'Mike Johnson', '+1-555-2001', 'EXT003', true),
('m4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'sarah.williams@email.com', 'Sarah Williams', '+1-555-2002', 'EXT004', true),
('m5555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'david.brown@email.com', 'David Brown', '+1-555-3001', 'EXT005', true),
('m6666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'emily.davis@email.com', 'Emily Davis', '+1-555-3002', 'EXT006', true),
('m7777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'robert.miller@email.com', 'Robert Miller', '+1-555-1003', 'EXT007', true),
('m8888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'lisa.wilson@email.com', 'Lisa Wilson', '+1-555-2003', 'EXT008', true)
ON CONFLICT (id) DO NOTHING;

-- Insert member memberships
INSERT INTO member_memberships (id, member_id, program_id, status, activated_at, expires_at, enrollment_source) VALUES
('mm111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'active', NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', 'manual'),
('mm222222-2222-2222-2222-222222222222', 'm2222222-2222-2222-2222-222222222222', 'p4444444-4444-4444-4444-444444444444', 'active', NOW() - INTERVAL '15 days', NOW() + INTERVAL '165 days', 'manual'),
('mm333333-3333-3333-3333-333333333333', 'm3333333-3333-3333-3333-333333333333', 'p2222222-2222-2222-2222-222222222222', 'active', NOW() - INTERVAL '60 days', NOW() + INTERVAL '305 days', 'campaign'),
('mm444444-4444-4444-4444-444444444444', 'm4444444-4444-4444-4444-444444444444', 'p2222222-2222-2222-2222-222222222222', 'active', NOW() - INTERVAL '45 days', NOW() + INTERVAL '320 days', 'manual'),
('mm555555-5555-5555-5555-555555555555', 'm5555555-5555-5555-5555-555555555555', 'p3333333-3333-3333-3333-333333333333', 'active', NOW() - INTERVAL '20 days', NOW() + INTERVAL '345 days', 'manual'),
('mm666666-6666-6666-6666-666666666666', 'm6666666-6666-6666-6666-666666666666', 'p3333333-3333-3333-3333-333333333333', 'active', NOW() - INTERVAL '10 days', NOW() + INTERVAL '355 days', 'manual'),
('mm777777-7777-7777-7777-777777777777', 'm7777777-7777-7777-7777-777777777777', 'p1111111-1111-1111-1111-111111111111', 'active', NOW() - INTERVAL '90 days', NOW() + INTERVAL '275 days', 'manual'),
('mm888888-8888-8888-8888-888888888888', 'm8888888-8888-8888-8888-888888888888', 'p2222222-2222-2222-2222-222222222222', 'active', NOW() - INTERVAL '5 days', NOW() + INTERVAL '360 days', 'manual')
ON CONFLICT (id) DO NOTHING;

-- Insert reward allocations
INSERT INTO member_rewards_allocation (id, member_id, membership_id, reward_id, quantity_allocated, quantity_redeemed, allocated_at, expires_at) VALUES
('a1111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111111', 'mm111111-1111-1111-1111-111111111111', 'r3333333-3333-3333-3333-333333333333', 2, 1, NOW() - INTERVAL '25 days', NOW() + INTERVAL '335 days'),
('a2222222-2222-2222-2222-222222222222', 'm1111111-1111-1111-1111-111111111111', 'mm111111-1111-1111-1111-111111111111', 'r5555555-5555-5555-5555-555555555555', 1, 0, NOW() - INTERVAL '25 days', NOW() + INTERVAL '335 days'),
('a3333333-3333-3333-3333-333333333333', 'm2222222-2222-2222-2222-222222222222', 'mm222222-2222-2222-2222-222222222222', 'r3333333-3333-3333-3333-333333333333', 1, 0, NOW() - INTERVAL '10 days', NOW() + INTERVAL '165 days'),
('a4444444-4444-4444-4444-444444444444', 'm3333333-3333-3333-3333-333333333333', 'mm333333-3333-3333-3333-333333333333', 'r1111111-1111-1111-1111-111111111111', 3, 2, NOW() - INTERVAL '55 days', NOW() + INTERVAL '305 days'),
('a5555555-5555-5555-5555-555555555555', 'm4444444-4444-4444-4444-444444444444', 'mm444444-4444-4444-4444-444444444444', 'r4444444-4444-4444-4444-444444444444', 2, 1, NOW() - INTERVAL '40 days', NOW() + INTERVAL '320 days'),
('a6666666-6666-6666-6666-666666666666', 'm5555555-5555-5555-5555-555555555555', 'mm555555-5555-5555-5555-555555555555', 'r2222222-2222-2222-2222-222222222222', 4, 3, NOW() - INTERVAL '15 days', NOW() + INTERVAL '345 days'),
('a7777777-7777-7777-7777-777777777777', 'm5555555-5555-5555-5555-555555555555', 'mm555555-5555-5555-5555-555555555555', 'r7777777-7777-7777-7777-777777777777', 5, 2, NOW() - INTERVAL '15 days', NOW() + INTERVAL '345 days'),
('a8888888-8888-8888-8888-888888888888', 'm6666666-6666-6666-6666-666666666666', 'mm666666-6666-6666-6666-666666666666', 'r2222222-2222-2222-2222-222222222222', 4, 1, NOW() - INTERVAL '8 days', NOW() + INTERVAL '355 days')
ON CONFLICT (id) DO NOTHING;

-- Insert vouchers
INSERT INTO vouchers (id, reward_id, member_id, allocation_id, code, status, expires_at, redeemed_at, issued_at) VALUES
-- Member 1 vouchers
('v1111111-1111-1111-1111-111111111111', 'r3333333-3333-3333-3333-333333333333', 'm1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'AMZN-GC25-ABC123', 'redeemed', NOW() + INTERVAL '335 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '25 days'),
('v2222222-2222-2222-2222-222222222222', 'r3333333-3333-3333-3333-333333333333', 'm1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'AMZN-GC25-XYZ789', 'available', NOW() + INTERVAL '335 days', NULL, NOW() - INTERVAL '25 days'),
('v3333333-3333-3333-3333-333333333333', 'r5555555-5555-5555-5555-555555555555', 'm1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'BBUY-100-DEF456', 'available', NOW() + INTERVAL '335 days', NULL, NOW() - INTERVAL '25 days'),

-- Member 2 vouchers
('v4444444-4444-4444-4444-444444444444', 'r3333333-3333-3333-3333-333333333333', 'm2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'AMZN-GC25-GHI012', 'available', NOW() + INTERVAL '165 days', NULL, NOW() - INTERVAL '10 days'),

-- Member 3 vouchers
('v5555555-5555-5555-5555-555555555555', 'r1111111-1111-1111-1111-111111111111', 'm3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 'NIKE-20-JKL345', 'redeemed', NOW() + INTERVAL '305 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '55 days'),
('v6666666-6666-6666-6666-666666666666', 'r1111111-1111-1111-1111-111111111111', 'm3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 'NIKE-20-MNO678', 'redeemed', NOW() + INTERVAL '305 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '55 days'),
('v7777777-7777-7777-7777-777777777777', 'r1111111-1111-1111-1111-111111111111', 'm3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 'NIKE-20-PQR901', 'available', NOW() + INTERVAL '305 days', NULL, NOW() - INTERVAL '55 days'),

-- Member 4 vouchers
('v8888888-8888-8888-8888-888888888888', 'r4444444-4444-4444-4444-444444444444', 'm4444444-4444-4444-4444-444444444444', 'a5555555-5555-5555-5555-555555555555', 'TGT-10-STU234', 'redeemed', NOW() + INTERVAL '320 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '40 days'),
('v9999999-9999-9999-9999-999999999999', 'r4444444-4444-4444-4444-444444444444', 'm4444444-4444-4444-4444-444444444444', 'a5555555-5555-5555-5555-555555555555', 'TGT-10-VWX567', 'available', NOW() + INTERVAL '320 days', NULL, NOW() - INTERVAL '40 days'),

-- Member 5 vouchers
('va111111-1111-1111-1111-111111111111', 'r2222222-2222-2222-2222-222222222222', 'm5555555-5555-5555-5555-555555555555', 'a6666666-6666-6666-6666-666666666666', 'SBUX-FREE-YZA890', 'redeemed', NOW() + INTERVAL '345 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '15 days'),
('vb222222-2222-2222-2222-222222222222', 'r2222222-2222-2222-2222-222222222222', 'm5555555-5555-5555-5555-555555555555', 'a6666666-6666-6666-6666-666666666666', 'SBUX-FREE-BCD123', 'redeemed', NOW() + INTERVAL '345 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '15 days'),
('vc333333-3333-3333-3333-333333333333', 'r2222222-2222-2222-2222-222222222222', 'm5555555-5555-5555-5555-555555555555', 'a6666666-6666-6666-6666-666666666666', 'SBUX-FREE-EFG456', 'redeemed', NOW() + INTERVAL '345 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '15 days'),
('vd444444-4444-4444-4444-444444444444', 'r2222222-2222-2222-2222-222222222222', 'm5555555-5555-5555-5555-555555555555', 'a6666666-6666-6666-6666-666666666666', 'SBUX-FREE-HIJ789', 'available', NOW() + INTERVAL '345 days', NULL, NOW() - INTERVAL '15 days'),
('ve555555-5555-5555-5555-555555555555', 'r7777777-7777-7777-7777-777777777777', 'm5555555-5555-5555-5555-555555555555', 'a7777777-7777-7777-7777-777777777777', 'SBUX-5OFF-KLM012', 'redeemed', NOW() + INTERVAL '345 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '15 days'),
('vf666666-6666-6666-6666-666666666666', 'r7777777-7777-7777-7777-777777777777', 'm5555555-5555-5555-5555-555555555555', 'a7777777-7777-7777-7777-777777777777', 'SBUX-5OFF-NOP345', 'redeemed', NOW() + INTERVAL '345 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '15 days'),
('vg777777-7777-7777-7777-777777777777', 'r7777777-7777-7777-7777-777777777777', 'm5555555-5555-5555-5555-555555555555', 'a7777777-7777-7777-7777-777777777777', 'SBUX-5OFF-QRS678', 'available', NOW() + INTERVAL '345 days', NULL, NOW() - INTERVAL '15 days'),
('vh888888-8888-8888-8888-888888888888', 'r7777777-7777-7777-7777-777777777777', 'm5555555-5555-5555-5555-555555555555', 'a7777777-7777-7777-7777-777777777777', 'SBUX-5OFF-TUV901', 'available', NOW() + INTERVAL '345 days', NULL, NOW() - INTERVAL '15 days'),
('vi999999-9999-9999-9999-999999999999', 'r7777777-7777-7777-7777-777777777777', 'm5555555-5555-5555-5555-555555555555', 'a7777777-7777-7777-7777-777777777777', 'SBUX-5OFF-WXY234', 'available', NOW() + INTERVAL '345 days', NULL, NOW() - INTERVAL '15 days'),

-- Member 6 vouchers
('vj111111-1111-1111-1111-111111111111', 'r2222222-2222-2222-2222-222222222222', 'm6666666-6666-6666-6666-666666666666', 'a8888888-8888-8888-8888-888888888888', 'SBUX-FREE-ZAB567', 'redeemed', NOW() + INTERVAL '355 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '8 days'),
('vk222222-2222-2222-2222-222222222222', 'r2222222-2222-2222-2222-222222222222', 'm6666666-6666-6666-6666-666666666666', 'a8888888-8888-8888-8888-888888888888', 'SBUX-FREE-CDE890', 'available', NOW() + INTERVAL '355 days', NULL, NOW() - INTERVAL '8 days'),
('vl333333-3333-3333-3333-333333333333', 'r2222222-2222-2222-2222-222222222222', 'm6666666-6666-6666-6666-666666666666', 'a8888888-8888-8888-8888-888888888888', 'SBUX-FREE-FGH123', 'available', NOW() + INTERVAL '355 days', NULL, NOW() - INTERVAL '8 days'),
('vm444444-4444-4444-4444-444444444444', 'r2222222-2222-2222-2222-222222222222', 'm6666666-6666-6666-6666-666666666666', 'a8888888-8888-8888-8888-888888888888', 'SBUX-FREE-IJK456', 'available', NOW() + INTERVAL '355 days', NULL, NOW() - INTERVAL '8 days')
ON CONFLICT (id) DO NOTHING;

-- Insert voucher issuances (tracking)
INSERT INTO voucher_issuances (voucher_id, allocation_id, member_id, reward_id, client_id, issued_by_type, issuance_channel, issued_at)
SELECT
  v.id,
  v.allocation_id,
  v.member_id,
  v.reward_id,
  mu.client_id,
  'system',
  'allocation',
  v.issued_at
FROM vouchers v
JOIN member_users mu ON v.member_id = mu.id
WHERE v.issued_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- Insert redemptions for redeemed vouchers
INSERT INTO redemptions (voucher_id, member_id, reward_id, redemption_channel, redemption_location, redeemed_at)
SELECT
  v.id,
  v.member_id,
  v.reward_id,
  'online',
  'Mobile App',
  v.redeemed_at
FROM vouchers v
WHERE v.status = 'redeemed' AND v.redeemed_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- Insert campaign rules
INSERT INTO campaign_rules (id, client_id, program_id, name, description, trigger_type, trigger_conditions, is_active, priority, start_date, end_date, max_enrollments) VALUES
('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111',
  'High Value Customer Program', 'Auto-enroll customers spending over $500', 'order_value',
  '{"min_order_value": 500}'::jsonb, true, 10, NOW() - INTERVAL '60 days', NOW() + INTERVAL '305 days', 1000),
('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222',
  'New Customer Welcome', 'Welcome program for new signups', 'signup',
  '{}'::jsonb, true, 20, NOW() - INTERVAL '90 days', NULL, NULL),
('c3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'p3333333-3333-3333-3333-333333333333',
  'Frequent Buyer Rewards', 'Rewards for customers with 5+ orders', 'order_count',
  '{"min_order_count": 5}'::jsonb, true, 15, NOW() - INTERVAL '45 days', NOW() + INTERVAL '320 days', 500)
ON CONFLICT (id) DO NOTHING;

-- Summary output
SELECT
  'Seed data inserted successfully!' as message,
  (SELECT COUNT(*) FROM clients) as clients,
  (SELECT COUNT(*) FROM brands) as brands,
  (SELECT COUNT(*) FROM rewards) as rewards,
  (SELECT COUNT(*) FROM membership_programs) as programs,
  (SELECT COUNT(*) FROM member_users) as members,
  (SELECT COUNT(*) FROM member_memberships) as memberships,
  (SELECT COUNT(*) FROM member_rewards_allocation) as allocations,
  (SELECT COUNT(*) FROM vouchers) as vouchers,
  (SELECT COUNT(*) FROM redemptions) as redemptions,
  (SELECT COUNT(*) FROM campaign_rules) as campaign_rules;
