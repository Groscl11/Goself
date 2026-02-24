-- Demo Data Seed Script for Membership Rewards Platform
-- Run this in your Supabase SQL Editor to populate demo data

-- Note: You'll need to sign up users through the application first,
-- then update the profile records with the appropriate client_id/brand_id

-- Insert Demo Clients
INSERT INTO clients (id, name, description, contact_email, primary_color, is_active) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'TechStore Inc', 'Leading electronics retailer', 'contact@techstore.com', '#3B82F6', true),
  ('c2222222-2222-2222-2222-222222222222', 'Fashion Forward', 'Premium fashion brand', 'hello@fashionforward.com', '#10B981', true),
  ('c3333333-3333-3333-3333-333333333333', 'Fitness Plus', 'Health and wellness center', 'info@fitnessplus.com', '#F59E0B', true)
ON CONFLICT (id) DO NOTHING;

-- Insert Demo Brands
INSERT INTO brands (id, name, description, contact_email, status) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Coffee Masters', 'Premium coffee roasters', 'info@coffeemasters.com', 'approved'),
  ('b2222222-2222-2222-2222-222222222222', 'Book Haven', 'Independent bookstore chain', 'contact@bookhaven.com', 'approved'),
  ('b3333333-3333-3333-3333-333333333333', 'Spa Serenity', 'Luxury spa services', 'hello@spaserenity.com', 'approved'),
  ('b4444444-4444-4444-4444-444444444444', 'Movie Magic', 'Cinema and entertainment', 'info@moviemagic.com', 'approved'),
  ('b5555555-5555-5555-5555-555555555555', 'Dine & Wine', 'Restaurant group', 'contact@dineandwine.com', 'pending')
ON CONFLICT (id) DO NOTHING;

-- Insert Demo Rewards (Marketplace)
INSERT INTO rewards (id, brand_id, title, description, value_description, category, status, is_marketplace, voucher_count, expiry_date) VALUES
  ('r1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Free Coffee Upgrade', 'Upgrade any coffee to large size', '$3 value', 'food', 'active', true, 100, '2025-12-31'),
  ('r2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', '20% Off Coffee Beans', 'Get 20% off any bag of coffee beans', 'Up to $10 off', 'food', 'active', true, 50, '2025-12-31'),
  ('r3333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222', '$10 Off Book Purchase', 'Get $10 off any book purchase over $30', '$10 value', 'entertainment', 'active', true, 75, '2025-12-31'),
  ('r4444444-4444-4444-4444-444444444444', 'b3333333-3333-3333-3333-333333333333', 'Complimentary Massage', '30-minute massage session', '$50 value', 'wellness', 'active', true, 25, '2025-06-30'),
  ('r5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 'Free Movie Ticket', 'One free standard movie ticket', '$15 value', 'entertainment', 'active', true, 200, '2025-12-31')
ON CONFLICT (id) DO NOTHING;

-- Insert Demo Membership Programs for TechStore Inc (you'll need to update client_id if different)
INSERT INTO membership_programs (id, client_id, name, description, validity_days, max_rewards_total, is_active) VALUES
  ('p1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Silver Membership', 'Entry-level membership with 3 rewards', 365, 3, true),
  ('p2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Gold Membership', 'Mid-tier membership with 6 rewards', 365, 6, true),
  ('p3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'Platinum Membership', 'Premium membership with unlimited rewards', 365, NULL, true)
ON CONFLICT (id) DO NOTHING;

-- Link rewards to membership programs
INSERT INTO membership_program_rewards (program_id, reward_id) VALUES
  ('p1111111-1111-1111-1111-111111111111', 'r1111111-1111-1111-1111-111111111111'),
  ('p1111111-1111-1111-1111-111111111111', 'r5555555-5555-5555-5555-555555555555'),
  ('p2222222-2222-2222-2222-222222222222', 'r1111111-1111-1111-1111-111111111111'),
  ('p2222222-2222-2222-2222-222222222222', 'r2222222-2222-2222-2222-222222222222'),
  ('p2222222-2222-2222-2222-222222222222', 'r3333333-3333-3333-3333-333333333333'),
  ('p2222222-2222-2222-2222-222222222222', 'r5555555-5555-5555-5555-555555555555'),
  ('p3333333-3333-3333-3333-333333333333', 'r1111111-1111-1111-1111-111111111111'),
  ('p3333333-3333-3333-3333-333333333333', 'r2222222-2222-2222-2222-222222222222'),
  ('p3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333'),
  ('p3333333-3333-3333-3333-333333333333', 'r4444444-4444-4444-4444-444444444444'),
  ('p3333333-3333-3333-3333-333333333333', 'r5555555-5555-5555-5555-555555555555')
ON CONFLICT (program_id, reward_id) DO NOTHING;

-- Insert Demo Members for TechStore Inc
INSERT INTO member_users (id, client_id, email, full_name, phone, is_active) VALUES
  ('m1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'john.doe@example.com', 'John Doe', '+1-555-0101', true),
  ('m2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'jane.smith@example.com', 'Jane Smith', '+1-555-0102', true),
  ('m3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'bob.wilson@example.com', 'Bob Wilson', '+1-555-0103', true),
  ('m4444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', 'alice.johnson@example.com', 'Alice Johnson', '+1-555-0104', true)
ON CONFLICT (client_id, email) DO NOTHING;

-- Assign memberships to members
INSERT INTO member_memberships (member_id, program_id, status, activated_at, expires_at) VALUES
  ('m1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'active', NOW(), NOW() + INTERVAL '365 days'),
  ('m2222222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222', 'active', NOW(), NOW() + INTERVAL '365 days'),
  ('m3333333-3333-3333-3333-333333333333', 'p3333333-3333-3333-3333-333333333333', 'active', NOW(), NOW() + INTERVAL '365 days'),
  ('m4444444-4444-4444-4444-444444444444', 'p1111111-1111-1111-1111-111111111111', 'active', NOW(), NOW() + INTERVAL '365 days')
ON CONFLICT DO NOTHING;

-- Allocate rewards to members
INSERT INTO member_rewards_allocation (member_id, membership_id, reward_id, quantity_allocated, expires_at)
SELECT
  mm.member_id,
  mm.id,
  mpr.reward_id,
  1,
  mm.expires_at
FROM member_memberships mm
JOIN membership_program_rewards mpr ON mpr.program_id = mm.program_id
WHERE mm.status = 'active'
ON CONFLICT DO NOTHING;

-- Generate vouchers for allocated rewards
INSERT INTO vouchers (reward_id, member_id, allocation_id, code, status, expires_at)
SELECT
  mra.reward_id,
  mra.member_id,
  mra.id,
  'DEMO-' || UPPER(substring(md5(random()::text), 1, 8)),
  'available',
  mra.expires_at
FROM member_rewards_allocation mra
ON CONFLICT (code) DO NOTHING;

-- Insert some demo redemptions
INSERT INTO redemptions (voucher_id, member_id, reward_id, redemption_channel, redeemed_at)
SELECT
  v.id,
  v.member_id,
  v.reward_id,
  'online',
  NOW() - (random() * INTERVAL '30 days')
FROM vouchers v
WHERE v.status = 'available'
LIMIT 5
ON CONFLICT DO NOTHING;

-- Update vouchers that were redeemed
UPDATE vouchers v
SET status = 'redeemed', redeemed_at = r.redeemed_at
FROM redemptions r
WHERE v.id = r.voucher_id;

-- Success message
SELECT 'Demo data seeded successfully!' as message;
