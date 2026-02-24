# Quick Test Reference - All Accounts Ready

## Test Accounts Summary

| Email | Password | Role | What You'll See |
|-------|----------|------|----------------|
| **admin@test.com** | (your password) | Admin | Full system access, manage everything |
| **client@test.com** | (your password) | Client | TechCorp with 4 members, 2 programs |
| **brand@test.com** | (your password) | Brand | Nike with 2 rewards, 3 vouchers, analytics |
| **memeber@test.com** | (your password) | Member | John Smith - TechCorp Gold, 2 vouchers |
| **memeber1@test.com** | (your password) | Member | Sarah Johnson - Fashion VIP, 2 vouchers |

---

## What Each Profile Can Test

### Admin (`admin@test.com`)
- ✅ View/manage all brands (11 total)
- ✅ View/manage all clients (3 total)
- ✅ Approve/reject brand rewards
- ✅ Manage membership programs
- ✅ View all transactions
- ✅ Create users and assign roles

**Start at:** `/admin`

---

### Client (`client@test.com`)
- ✅ Dashboard with member overview
- ✅ **4 Members** to manage:
  - John Doe (TechCorp Gold)
  - Jane Smith (TechCorp Silver)
  - Robert Miller (TechCorp Gold)
  - John Smith (TechCorp Gold - test account)
- ✅ **2 Membership Programs**:
  - TechCorp Gold (365 days)
  - TechCorp Silver (180 days)
- ✅ Browse marketplace rewards (20 total)
- ✅ Allocate rewards to members

**Start at:** `/client`

---

### Brand (`brand@test.com`)
**Nike Brand Manager**

**Dashboard Metrics:**
- 2 Total Rewards
- 2 Active Rewards
- 3 Vouchers Issued
- 2 Redemptions
- $30 Revenue Generated
- Unique Clients: Varies
- 0 Pending Approvals

**Your Rewards:**
1. "20% Off Nike Purchase"
   - 3 vouchers issued
   - 2 redeemed (67% redemption rate)
   - $30 revenue

2. "Nike Member Exclusive"
   - 0 vouchers issued
   - Ready to allocate

**Available Pages:**
- `/brand` - Dashboard
- `/brand/rewards` - Manage rewards
- `/brand/rewards/new` - **Submit new reward (fully functional form)**
- `/brand/vouchers` - Track 3 vouchers
- `/brand/analytics` - Full analytics with:
  - Daily metrics (last 7/30/90 days)
  - Client distribution
  - Reward performance
  - Revenue tracking

**Start at:** `/brand`

---

### Member 1 (`memeber@test.com`)
**John Smith - TechCorp Industries**

**Your Membership:**
- Program: TechCorp Gold
- Status: Active
- Started: 30 days ago
- Expires: In 335 days

**Your Rewards:**
- 3 Nike rewards allocated
- 1 already redeemed

**Your Vouchers:**
- `NIKE-TEST-001` - Available (use anytime)
- `NIKE-TEST-002` - Redeemed (5 days ago)

**What You Can Do:**
- View membership details
- Browse available rewards
- Redeem vouchers
- Track redemption history

**Start at:** `/member`

---

### Member 2 (`memeber1@test.com`)
**Sarah Johnson - FashionHub Retail**

**Your Membership:**
- Program: Fashion VIP Program
- Status: Active
- Started: 15 days ago
- Expires: In 350 days

**Your Rewards:**
- 5 Starbucks rewards allocated
- 2 already redeemed

**Your Vouchers:**
- `SBUX-TEST-001` - Available (use anytime)
- `SBUX-TEST-002` - Redeemed (3 days ago)

**What You Can Do:**
- View Fashion VIP benefits
- Browse rewards from FashionHub
- Redeem Starbucks vouchers
- Track purchase history

**Start at:** `/member`

---

## Testing the Brand Module

### Submit a New Reward (WORKING!)

1. Login as `brand@test.com`
2. Navigate to `/brand/rewards/new`
3. Fill out the form:

**Example Reward:**
```
Title: 30% Off Running Shoes
Description: Limited time offer on all Nike running shoes
Reward Type: Percentage Discount
Discount Value: 30
Currency: USD
Category: Fashion
Coupon Type: Unique
```

4. Click "Submit Reward"
5. Go to `/brand/rewards` to see your pending reward
6. Switch to `admin@test.com` to approve it

---

## Testing Member Features

### As John Smith (`memeber@test.com`)
1. Login
2. Go to `/member/memberships` - See TechCorp Gold
3. Go to `/member/vouchers` - See 2 Nike vouchers
4. Check one is available, one is redeemed
5. View `/member/rewards` - See allocated rewards

### As Sarah Johnson (`memeber1@test.com`)
1. Login
2. Go to `/member/memberships` - See Fashion VIP
3. Go to `/member/vouchers` - See 2 Starbucks vouchers
4. Different client, different rewards
5. Compare experience with John Smith

---

## Testing Client Features

### As TechCorp Manager (`client@test.com`)
1. Login
2. Go to `/client/members` - See 4 members listed
3. Click on "John Smith" - View details, memberships, vouchers
4. Go to `/client/programs` - See 2 programs
5. Go to `/client/rewards` - Browse 20 marketplace rewards
6. Allocate a reward to a member

---

## Quick Verification

After logging in with any account, verify your profile:

```sql
SELECT
  p.email,
  p.role,
  c.name as client,
  b.name as brand
FROM profiles p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
WHERE p.email = 'your-login-email@test.com';
```

---

## Current Database Stats

- **Total Brands:** 11
- **Total Clients:** 3
- **Total Members:** 10 (8 existing + 2 test accounts)
- **Total Rewards:** 20+
- **Total Vouchers:** 24+ (22 existing + 2 test)
- **Total Redemptions:** 11+ (10 existing + 1 test)
- **Membership Programs:** 4
- **Active Memberships:** 10 (8 existing + 2 test)

---

## Files Created

1. **PROFILE_SWITCHING_GUIDE.md** - Detailed guide for all accounts
2. **seed-test-profiles.sql** - Complete SQL script for test data
3. **BRAND_LOGIN_READY.md** - Brand module quick start
4. **brand-setup-quick.sql** - Quick brand user setup
5. **QUICK_TEST_REFERENCE.md** - This file (quick reference)

---

## Ready to Test!

All accounts are configured and ready. Just login with any email above and start testing the corresponding module. All data is interconnected and realistic for proper testing.

**Recommended Testing Order:**
1. Start with **Admin** to see everything
2. Test **Brand** to submit rewards and view analytics
3. Test **Client** to manage members and programs
4. Test **Members** to experience the end-user flow
5. Switch back to **Admin** to approve brand rewards

Happy Testing! 🚀
