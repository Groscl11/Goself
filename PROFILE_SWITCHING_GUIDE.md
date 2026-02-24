# Profile Switching Guide - Test Accounts Ready

## Overview
All test accounts are now properly configured with real data. You can switch between different user roles to test all modules.

---

## Available Test Accounts

### 1. Admin Account
**Email:** `admin@test.com`
**Password:** (your signup password)
**Role:** Administrator
**Access:** Full system access

**What You Can Test:**
- `/admin` - Admin dashboard
- `/admin/brands` - Manage all brands
- `/admin/clients` - Manage all clients
- `/admin/users` - Manage all users
- `/admin/rewards` - Approve/reject rewards
- `/admin/membership-programs` - Manage programs
- `/admin/campaign-rules` - Set up campaign rules
- `/admin/transactions` - View all transactions

---

### 2. Client Account
**Email:** `client@test.com`
**Password:** (your signup password)
**Role:** Client Manager
**Organization:** TechCorp Industries
**Members:** 4 members under management

**What You Can Test:**
- `/client` - Client dashboard
- `/client/members` - View and manage 4 members
- `/client/programs` - Manage membership programs (2 programs)
- `/client/rewards` - Browse and allocate rewards from marketplace

**Current Data:**
- 4 member users (John Doe, Jane Smith, Robert Miller, John Smith)
- 2 membership programs (TechCorp Gold, TechCorp Silver)
- Multiple active memberships
- Reward allocations in progress

---

### 3. Brand Account
**Email:** `brand@test.com`
**Password:** (your signup password)
**Role:** Brand Manager
**Brand:** Nike
**Rewards:** 2 active rewards

**What You Can Test:**
- `/brand` - Brand dashboard with metrics:
  - 2 Total Rewards
  - 3 Vouchers Issued
  - 2 Redemptions
  - $30 Revenue Generated
- `/brand/rewards` - View and manage rewards
- `/brand/rewards/new` - Submit new rewards
- `/brand/vouchers` - Track all vouchers (3 total)
- `/brand/analytics` - Comprehensive analytics:
  - Daily metrics
  - Client distribution
  - Reward performance
  - Revenue tracking

**Current Rewards:**
1. "20% Off Nike Purchase" - 3 vouchers issued, 2 redeemed
2. "Nike Member Exclusive" - 0 vouchers issued

---

### 4. Member Account #1
**Email:** `memeber@test.com`
**Password:** (your signup password)
**Role:** Member
**Name:** John Smith
**Client:** TechCorp Industries
**Membership:** TechCorp Gold (Active)

**What You Can Test:**
- `/member` - Member portal
- `/member/memberships` - View active membership (1):
  - TechCorp Gold
  - Activated 30 days ago
  - Expires in 335 days
- `/member/rewards` - View allocated rewards (3 Nike vouchers)
- `/member/vouchers` - View vouchers (2 total):
  - NIKE-TEST-001 (Available)
  - NIKE-TEST-002 (Redeemed 5 days ago)

**Membership Details:**
- Program: TechCorp Gold Membership
- Status: Active
- Duration: 365 days
- Rewards Allocated: 3 (1 redeemed)

---

### 5. Member Account #2
**Email:** `memeber1@test.com`
**Password:** (your signup password)
**Role:** Member
**Name:** Sarah Johnson
**Client:** FashionHub Retail
**Membership:** Fashion VIP Program (Active)

**What You Can Test:**
- `/member` - Member portal
- `/member/memberships` - View active membership (1):
  - Fashion VIP Program
  - Activated 15 days ago
  - Expires in 350 days
- `/member/rewards` - View allocated rewards (5 Starbucks vouchers)
- `/member/vouchers` - View vouchers (2 total):
  - SBUX-TEST-001 (Available)
  - SBUX-TEST-002 (Redeemed 3 days ago)

**Membership Details:**
- Program: Fashion VIP Program
- Status: Active
- Duration: 365 days
- Rewards Allocated: 5 (2 redeemed)

---

## How to Switch Profiles

### Method 1: Logout and Login (Recommended)
1. Logout from current account
2. Login with different test email
3. Navigate to the appropriate dashboard

### Method 2: SQL Profile Update (For Testing)
```sql
-- Switch to Admin
UPDATE profiles
SET role = 'admin',
    client_id = NULL,
    brand_id = NULL
WHERE email = 'your-current-email@test.com';

-- Switch to Client
UPDATE profiles
SET role = 'client',
    client_id = '11111111-1111-1111-1111-111111111111',
    brand_id = NULL
WHERE email = 'your-current-email@test.com';

-- Switch to Brand
UPDATE profiles
SET role = 'brand',
    client_id = NULL,
    brand_id = 'b1111111-1111-1111-1111-111111111111'
WHERE email = 'your-current-email@test.com';

-- Switch to Member
UPDATE profiles
SET role = 'member',
    client_id = '11111111-1111-1111-1111-111111111111',
    brand_id = NULL
WHERE email = 'your-current-email@test.com';
```

---

## Test Scenarios by Role

### Admin Testing
- [ ] View all brands and approve/reject
- [ ] View all clients and their members
- [ ] Manage membership programs
- [ ] Set up campaign rules
- [ ] View all transactions
- [ ] Create new users

### Client Testing
- [ ] View member list (4 members)
- [ ] View member details
- [ ] Create/manage membership programs
- [ ] Browse marketplace rewards
- [ ] Allocate rewards to members
- [ ] Track member activity

### Brand Testing
- [ ] View dashboard metrics
- [ ] Submit new reward (form fully functional)
- [ ] View reward performance
- [ ] Track voucher issuance (3 vouchers)
- [ ] View analytics by date range (7/30/90 days)
- [ ] See client distribution
- [ ] Monitor redemptions (2 total)

### Member Testing (John Smith)
- [ ] View membership details
- [ ] Browse available rewards
- [ ] View allocated vouchers (2 total)
- [ ] See redemption history (1 redemption)
- [ ] Check membership expiry

### Member Testing (Sarah Johnson)
- [ ] View Fashion VIP membership
- [ ] Browse rewards from different client
- [ ] View Starbucks vouchers (2 total)
- [ ] See redemption history (1 redemption)
- [ ] Different client experience

---

## Database Reference

### Client IDs
- `11111111-1111-1111-1111-111111111111` - TechCorp Industries (4 members)
- `22222222-2222-2222-2222-222222222222` - FashionHub Retail (3 members)
- `33333333-3333-3333-3333-333333333333` - GourmetMart (2 members)

### Brand IDs
- `b1111111-1111-1111-1111-111111111111` - Nike (2 rewards)
- `b2222222-2222-2222-2222-222222222222` - Starbucks (2 rewards)
- `b3333333-3333-3333-3333-333333333333` - Amazon (3 rewards)
- `b4444444-4444-4444-4444-444444444444` - Target (1 reward)
- `b5555555-5555-5555-5555-555555555555` - Best Buy (1 reward)

### Membership Programs
- TechCorp Gold Membership (365 days validity)
- TechCorp Silver Membership (180 days validity)
- Fashion VIP Program (365 days validity)
- Gourmet Plus Membership (365 days validity)

---

## Quick Verification Queries

### Check Your Current Profile
```sql
SELECT
  p.email,
  p.role,
  p.full_name,
  c.name as client_name,
  b.name as brand_name
FROM profiles p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
WHERE p.email = 'your-email@test.com';
```

### View Member Data
```sql
SELECT
  mu.email,
  mu.full_name,
  c.name as client,
  COUNT(DISTINCT mm.id) as memberships,
  COUNT(DISTINCT v.id) as vouchers
FROM member_users mu
JOIN clients c ON mu.client_id = c.id
LEFT JOIN member_memberships mm ON mm.member_id = mu.id
LEFT JOIN vouchers v ON v.member_id = mu.id
WHERE mu.email IN ('memeber@test.com', 'memeber1@test.com')
GROUP BY mu.id, mu.email, mu.full_name, c.name;
```

### View Brand Performance
```sql
SELECT
  b.name as brand,
  COUNT(DISTINCT r.id) as rewards,
  COUNT(DISTINCT v.id) as vouchers,
  COUNT(DISTINCT rd.id) as redemptions
FROM brands b
LEFT JOIN rewards r ON r.brand_id = b.id
LEFT JOIN vouchers v ON v.reward_id = r.id
LEFT JOIN redemptions rd ON rd.reward_id = r.id
WHERE b.name = 'Nike'
GROUP BY b.id, b.name;
```

---

## Summary

All test accounts are ready with real, interconnected data:

| Account | Email | Role | Key Data |
|---------|-------|------|----------|
| Admin | admin@test.com | admin | Full access |
| Client | client@test.com | client | 4 members, 2 programs |
| Brand | brand@test.com | brand | 2 rewards, 3 vouchers |
| Member 1 | memeber@test.com | member | 1 membership, 2 vouchers |
| Member 2 | memeber1@test.com | member | 1 membership, 2 vouchers |

**All modules are fully functional with real data for testing!**
