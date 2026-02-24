# Brand Module - Ready to Test! ✅

## Quick Start

Your brand user account is **READY TO USE**:

**Login Credentials:**
- **Email:** `brand@test.com`
- **Password:** (the password you used when you signed up)
- **Brand:** Nike
- **Role:** Brand Manager

Just login and navigate to `/brand` to see your dashboard!

---

## What You'll See

### Brand Dashboard (`/brand`)
Your Nike brand account currently has:
- ✅ **2 Total Rewards** (both active)
- ✅ **3 Vouchers Issued**
- ✅ **2 Redemptions**
- ✅ **$30 Revenue Generated** (estimated)
- ✅ **0 Pending Approvals**

### Your Current Rewards
1. **20% Off Nike Purchase** - 3 vouchers issued, 2 redeemed (67% redemption rate)
2. **Nike Member Exclusive** - 0 vouchers issued

---

## Test the Reward Submission Form

1. **Navigate to** `/brand/rewards/new` or click "Submit New Reward" button
2. **Fill out the form:**
   - Title: `30% Off Running Shoes`
   - Description: `Get 30% off all running shoes this month`
   - Reward Type: `Percentage Discount`
   - Discount Value: `30`
   - Currency: `USD`
   - Coupon Type: `Unique`
   - Category: `Fashion`
   - (Optional fields can be left blank)
3. **Click Submit**
4. **Result:** Reward will be created with "pending" status
5. **Check:** Go to `/brand/rewards` to see your new reward

---

## All Available Pages

| Page | URL | What You Can Do |
|------|-----|-----------------|
| Dashboard | `/brand` | View overview metrics, recent redemptions, quick actions |
| My Rewards | `/brand/rewards` | View all rewards, filter by status, see performance metrics |
| Submit New Reward | `/brand/rewards/new` | Create and submit new rewards for approval |
| Voucher Tracking | `/brand/vouchers` | Track all vouchers issued, filter by status, search |
| Analytics | `/brand/analytics` | Daily metrics, client distribution, reward performance, revenue |

---

## Brand Analytics Features

### Daily Metrics Table
Shows last 14 days of:
- Vouchers issued per day
- Redemptions per day
- Revenue per day
- Redemption rate (color-coded)

### Client Distribution
See which clients are using your rewards:
- Total vouchers per client
- Redemptions per client
- Revenue per client
- Unique members per client

### Reward Performance
Top 5 rewards showing:
- Total issued vs redeemed
- Redemption rate %
- Revenue generated

### Date Range Options
- Last 7 days
- Last 30 days
- Last 90 days

---

## Current Test Data for Nike

**Vouchers in the System:**
- 3 total vouchers
- 1 available (not yet redeemed)
- 2 redeemed

**Recent Redemptions:**
- 2 redemptions from members
- $30 estimated revenue (2 × $15)

**Distribution:**
- Vouchers issued to members across different clients
- Can see which companies are using your rewards

---

## Want to Test Other Brands?

You can create accounts for other brands too. Run this SQL:

```sql
-- Link your account to Starbucks instead
UPDATE profiles
SET brand_id = 'b2222222-2222-2222-2222-222222222222'
WHERE email = 'brand@test.com';
```

**Starbucks has more data:**
- 2 rewards
- 13 vouchers issued
- 5 redemptions
- $75 revenue

**Other Available Brands:**
- Amazon (3 rewards, 3 vouchers)
- Target (1 reward, 2 vouchers)
- Best Buy (1 reward, 1 voucher)

---

## Troubleshooting

### "Brand not found" Error
If you get this error, run:
```sql
UPDATE profiles
SET brand_id = 'b1111111-1111-1111-1111-111111111111', -- Nike
    role = 'brand'
WHERE email = 'brand@test.com';
```

### Can't Submit Rewards
Make sure:
1. You're logged in as `brand@test.com`
2. Your profile has `role = 'brand'`
3. Your profile has a `brand_id` set

### No Data Showing
- Nike has limited data (3 vouchers, 2 redemptions)
- Switch to Starbucks for more comprehensive testing
- Or create your own rewards and ask an admin to approve them

---

## Next Steps

1. ✅ **Login** with `brand@test.com`
2. ✅ **Navigate** to `/brand`
3. ✅ **Explore** all the pages
4. ✅ **Submit** a new reward
5. ✅ **View** analytics and voucher tracking

The brand module is fully functional and ready to use! 🎉
