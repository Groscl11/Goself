# Brand Module Testing Guide

## Overview
The Brand Module has been fully implemented with:
- Brand Dashboard with comprehensive metrics
- Reward Submission Form
- Rewards Management
- Voucher Tracking
- Analytics with daily metrics, client distribution, and revenue tracking

## Test Brand Accounts

To test the brand module functionality, you need to create brand user accounts. Here's how:

### Creating a Brand User Account

1. **Sign up with a new account**:
   - Go to `/signup`
   - Use one of these test emails:
     - `nike.brand@test.com`
     - `starbucks.brand@test.com`
     - `amazon.brand@test.com`
     - `target.brand@test.com`
     - `bestbuy.brand@test.com`
   - Use password: `Test123!` (or your choice)

2. **Update the profile to link to a brand**:
   After signing up, run this SQL in Supabase:

   ```sql
   -- Link Nike brand to the user
   UPDATE profiles
   SET role = 'brand',
       brand_id = (SELECT id FROM brands WHERE name = 'Nike')
   WHERE email = 'nike.brand@test.com';
   ```

   Replace 'Nike' and the email with the appropriate brand and email you used.

3. **Alternative: Update existing user**:
   If you have an existing account, you can convert it to a brand account:

   ```sql
   UPDATE profiles
   SET role = 'brand',
       brand_id = (SELECT id FROM brands WHERE name = 'Nike')
   WHERE email = 'your-email@example.com';
   ```

## Available Brands in Database

The following brands have been seeded with demo data:
- **Nike** - Athletic apparel and footwear
- **Starbucks** - Coffee and beverages
- **Amazon** - E-commerce and technology
- **Target** - Retail department store
- **Best Buy** - Electronics and appliances

Each brand already has:
- Multiple rewards created
- Vouchers issued
- Some redemptions
- Associated with various clients and members

## Testing the Brand Module

### 1. Brand Dashboard (`/brand`)
View:
- Total Rewards count
- Active Rewards count
- Total Vouchers Issued
- Total Redemptions
- Revenue Generated (estimated)
- Unique Clients
- Unique Members
- Recent Redemptions list

### 2. Submit New Reward (`/brand/rewards/new`)
Test the form by creating a new reward:
- Fill in title, description
- Select reward type (flat discount, percentage, etc.)
- Set discount value
- Choose currency and category
- Add optional fields (min purchase, redemption link, etc.)
- Submit and see it appear in "My Rewards" with "Pending" status

### 3. My Rewards (`/brand/rewards`)
View all your brand's rewards with:
- Filtering by status (All, Active, Pending, Inactive)
- Each reward shows:
  - Vouchers issued count
  - Redemptions count
  - Redemption rate progress bar
  - View and Edit buttons (Edit not yet functional)

### 4. Voucher Tracking (`/brand/vouchers`)
Monitor all vouchers:
- Stats cards showing Total, Available, Redeemed, Expired
- Comprehensive table with:
  - Voucher code
  - Reward title
  - Member name and email
  - Client name
  - Issue and expiry dates
  - Status badges
- Filter by status
- Search across all fields

### 5. Analytics (`/brand/analytics`)
Comprehensive analytics dashboard:

**Summary Cards:**
- Total Issued (with daily average)
- Total Redeemed (with daily average)
- Total Revenue (with redemption rate)

**Daily Metrics Table:**
- Shows last 14 days
- Issued count per day
- Redeemed count per day
- Revenue per day
- Redemption rate (color-coded)

**Client Distribution:**
- Breakdown by client
- Total vouchers per client
- Redemptions per client
- Revenue per client
- Unique members per client

**Reward Performance:**
- Top 5 rewards
- Issued/Redeemed counts
- Redemption rate
- Revenue per reward

**Date Range Selector:**
- Last 7 days
- Last 30 days
- Last 90 days

## Current Seed Data Summary

Based on the existing seed data:
- **3 Clients** with members
- **11 Brands** (5 major ones with data)
- **20 Rewards** distributed across brands
- **8 Member Users**
- **8 Active Memberships**
- **22 Vouchers** (mix of available, redeemed)
- **10 Redemptions** with transaction history

## SQL Queries for Testing

### Check your brand's rewards:
```sql
SELECT r.title, r.status, COUNT(v.id) as voucher_count
FROM rewards r
LEFT JOIN vouchers v ON v.reward_id = r.id
WHERE r.brand_id = (SELECT id FROM brands WHERE name = 'Nike')
GROUP BY r.id, r.title, r.status;
```

### Check voucher distribution:
```sql
SELECT
  b.name as brand,
  COUNT(v.id) as total_vouchers,
  SUM(CASE WHEN v.status = 'redeemed' THEN 1 ELSE 0 END) as redeemed,
  SUM(CASE WHEN v.status = 'available' THEN 1 ELSE 0 END) as available
FROM brands b
JOIN rewards r ON r.brand_id = b.id
LEFT JOIN vouchers v ON v.reward_id = r.id
GROUP BY b.id, b.name
ORDER BY total_vouchers DESC;
```

### Check daily redemptions:
```sql
SELECT
  DATE(redeemed_at) as date,
  COUNT(*) as redemptions
FROM redemptions
WHERE redeemed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(redeemed_at)
ORDER BY date DESC;
```

## Notes

- All brand functionality is read-only for now (viewing analytics, tracking)
- Reward submission form is fully functional
- Edit reward functionality can be added by creating a similar form with pre-filled data
- Revenue is calculated as: redemptions × $15 (estimated value per redemption)
- All dates and times use the database server timezone
