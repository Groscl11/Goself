# Campaign Multi-Reward Selection Guide

Complete guide for configuring campaigns with multiple rewards that customers can select and redeem after purchase.

## Overview

The multi-reward system allows you to:
- Associate multiple rewards with a single campaign
- Let customers choose one or more rewards after qualifying
- Automatically track reward redemptions
- Send voucher codes and redemption links via email

## Flow Diagram

```
Customer Places Order
         ↓
Thank You Page Loads
         ↓
Extension Checks Campaign Rules ← (check-campaign-rewards function)
         ↓
Customer Qualifies? ─────No────→ (Nothing shows)
         ↓
        Yes
         ↓
Banner Displays: "You've Earned Rewards!"
         ↓
Customer Clicks "Claim Your Rewards"
         ↓
Reward Selection Page Opens ← (/claim-rewards)
         ↓
Customer Sees All Available Rewards
         ↓
Customer Selects 1+ Rewards (Checkboxes)
         ↓
Customer Clicks "Claim Selected Rewards"
         ↓
Backend Processes Redemption ← (redeem-campaign-rewards function)
         ↓
- Creates/Updates Member Profile
- Allocates Rewards
- Assigns Voucher Codes
- Sends Email with Details
         ↓
Success Page Shows ← (/redemption-success)
         ↓
Customer Receives Email with Codes
```

## Step 1: Create or Select Rewards

Before configuring campaigns, you can either create your own rewards or use rewards from the marketplace.

### Option A: Create Your Own Rewards

1. Navigate to **My Rewards**
2. Click **Create New Reward**
3. Fill in reward details:
   - **Title**: "20% Off Next Purchase"
   - **Description**: "Get 20% discount on your next order"
   - **Type**: Discount / Voucher / etc.
   - **Discount Value**: 20
   - **Category**: Shopping, Dining, Travel, etc.
   - **Coupon Type**:
     - **Generic**: Same code for all (e.g., SAVE20)
     - **Unique**: Different codes per customer (upload CSV)

4. Add voucher codes if needed:
   - Generic: Enter one code
   - Unique: Upload CSV with codes

5. Set redemption details:
   - **Redemption Link**: Where to use the code
   - **Terms & Conditions**: Usage restrictions
   - **Expiry Date**: Validity period

6. Click **Create Reward**

Repeat for all rewards you want to offer.

### Option B: Use Marketplace Rewards

1. Navigate to **Rewards Marketplace**
2. Browse available rewards from partner brands
3. These rewards are automatically available for your campaigns
4. No additional setup needed - they appear in campaign reward selection

**Note**: When selecting rewards for campaigns, you'll see:
- **My Reward** badge - Rewards you created
- **Marketplace** badge - Rewards from the marketplace/brands
- Both types can be mixed in the same campaign

## Step 2: Configure Campaign with Rewards

### Create/Edit Campaign:

1. Navigate to **Campaigns**
2. Click **New Campaign Rule** or edit existing
3. Fill in campaign basics:
   - **Name**: "First Purchase Rewards"
   - **Description**: "Welcome! Choose your rewards"
   - **Program**: Select membership program
   - **Trigger Type**: Order Value / Order Count / etc.
   - **Priority**: Higher = checked first

4. Set trigger conditions:
   - Example: Order value >= $50

5. **Select Rewards to Offer**:
   - See all your rewards (green "My Reward" badge)
   - See all marketplace rewards (blue "Marketplace" badge)
   - Select multiple rewards using checkboxes
   - Mix your own rewards with marketplace rewards
   - Brand names shown for marketplace rewards
   - Order matters (first selected = displayed first)
   - Can select as many as you want

6. Configure communication settings (optional):
   - Enable automatic email
   - Custom message template
   - Link validity period

7. Click **Create Rule** or **Update Rule**

### Example Configuration:

**Campaign**: "VIP Welcome Package"
- **Trigger**: Order value >= $100
- **Selected Rewards**:
  - ✅ 25% Off Next Order (My Reward)
  - ✅ Free Shipping Voucher (My Reward)
  - ✅ $10 Starbucks Gift Card (Marketplace - Starbucks)
  - ✅ Premium Gym Membership (Marketplace - Fitness Brand)

## Step 3: Customer Experience

### On Thank You Page:

When a customer completes an order that qualifies:

```
┌─────────────────────────────────────────────────┐
│ ✅ Congratulations! You've Earned Rewards!      │
│                                                 │
│ Welcome! Choose your rewards from our VIP       │
│ welcome package.                                │
│                                                 │
│ Your Store Name - 4 rewards available           │
│                                                 │
│ [Claim Your Rewards] ← Button                   │
└─────────────────────────────────────────────────┘
```

### On Reward Selection Page:

Customer is redirected to a beautiful selection page:

```
┌─────────────────────────────────────────────────┐
│              Select Your Rewards                 │
│              Your Store Name                     │
│         VIP Welcome Package                      │
├─────────────────────────────────────────────────┤
│ Select one or more rewards to claim your benefits│
├─────────────────────────────────────────────────┤
│                                                 │
│  ☑ 25% Off Next Order                           │
│    Get 25% discount on your next purchase       │
│    25% OFF • Shopping                           │
│    [Terms & Conditions ▼]                       │
│                                                 │
│  ☑ Free Shipping Voucher                        │
│    Enjoy free shipping on any order             │
│    Voucher • Shopping                           │
│                                                 │
│  ☐ $10 Gift Card                                │
│    $10 credit for your next purchase            │
│    Gift Card • Shopping                         │
│                                                 │
│  ☐ Premium Member Access                        │
│    Unlock exclusive member benefits             │
│    Membership • Benefits                        │
│                                                 │
├─────────────────────────────────────────────────┤
│ 2 rewards selected                              │
│                    [Claim Selected Rewards] ←   │
└─────────────────────────────────────────────────┘
```

### Features:
- **Checkboxes**: Select multiple rewards
- **Visual Feedback**: Selected items highlighted
- **Reward Details**: Title, description, value, brand
- **Terms Toggle**: Expandable T&Cs
- **Counter**: Shows how many selected
- **Responsive**: Works on mobile & desktop

### After Claiming:

Success page appears:

```
┌─────────────────────────────────────────────────┐
│              ✅ Success!                         │
│                                                 │
│    Rewards Claimed Successfully!                │
│                                                 │
│ You have successfully claimed 2 rewards.        │
│ Check your email for redemption details and     │
│ instructions.                                   │
│                                                 │
│ What's Next?                                    │
│ Your rewards and voucher codes have been sent   │
│ to your email. You can use them on your next    │
│ purchase or redeem them as instructed.          │
│                                                 │
│            [Close Window]                       │
└─────────────────────────────────────────────────┘
```

### Email Received:

```
Subject: Your Rewards from VIP Welcome Package

Dear Customer,

Congratulations! You've successfully claimed your rewards from VIP Welcome Package.

Your Rewards:
1. 25% Off Next Order
   Get 25% discount on your next purchase
   Code: SAVE25VIP
   Redeem at: https://yourstore.com

2. Free Shipping Voucher
   Enjoy free shipping on any order
   Code: FREESHIP2024
   Redeem at: https://yourstore.com

Thank you for being a valued customer!

Best regards,
Your Store Name
```

## Step 4: Managing Campaign Rewards

### View Campaign Rewards:

In the Campaigns list, you can see:
- Campaign name and status
- Trigger conditions
- Priority
- Active/Paused status

### Edit Campaign Rewards:

1. Click **Edit** on any campaign
2. The reward checkboxes show currently selected rewards
3. Check/uncheck to add/remove rewards
4. Click **Update Rule**
5. Changes apply immediately

### Remove Campaign:

1. Click **Delete** on campaign
2. Confirm deletion
3. Campaign-reward associations are removed
4. Rewards themselves remain available

## Understanding Reward Sources

### My Rewards vs Marketplace Rewards

**My Rewards** (Green Badge):
- Rewards you created yourself in "My Rewards"
- Full control over terms, codes, and availability
- Can be exclusive to your brand
- You manage voucher codes and redemption
- Examples: Your store discounts, your gift cards, your exclusive offers

**Marketplace Rewards** (Blue Badge):
- Rewards from partner brands in the marketplace
- Managed by the brand that created them
- Available to all clients using the platform
- Brand provides and manages voucher codes
- Examples: Starbucks gift cards, airline miles, hotel stays, partner discounts

### Campaign Configuration Display

When selecting rewards for your campaign, you'll see:

```
┌─────────────────────────────────────────────────┐
│ Rewards to Offer                                │
│ Select from your rewards and marketplace rewards│
├─────────────────────────────────────────────────┤
│                                                 │
│ ☑ 20% Off Your Next Order  [My Reward]         │
│   Get 20% discount on your next purchase       │
│   20% off • Shopping                            │
│                                                 │
│ ☑ Free Shipping Voucher  [My Reward]           │
│   Enjoy free shipping on any order             │
│   Voucher • Shopping                           │
│                                                 │
│ ☐ $10 Starbucks Gift Card  [Marketplace]       │
│   Enjoy coffee on us                           │
│   Gift Card • Food & Beverage • Starbucks      │
│                                                 │
│ ☐ Premium Fitness Pass  [Marketplace]          │
│   1 month access to premium gyms               │
│   Membership • Fitness • FitLife               │
│                                                 │
├─────────────────────────────────────────────────┤
│ 2 rewards selected                              │
└─────────────────────────────────────────────────┘
```

### Mixing Reward Types

You can combine both types in a single campaign:
- **Balanced Mix**: Offer your 20% discount + Starbucks gift card
- **Value Stack**: Mix store credit with partner brand rewards
- **Tiered Rewards**: Basic = your rewards, Premium = marketplace upgrades
- **Benefits**: More variety, higher perceived value, cross-brand promotion

### How Customers See It

On the customer-facing selection page:
- All rewards look uniform and professional
- No visible distinction between sources
- Brand logos and names shown for marketplace items
- Selection is seamless regardless of source
- Redemption works identically for both types

## Step 5: Backend Processing

### What Happens on Redemption:

1. **Validate Request**:
   - Check campaign exists and is active
   - Check rewards exist and are active
   - Verify email or phone provided

2. **Create/Update Member**:
   - Find existing member by email
   - Create new if doesn't exist
   - Associate with campaign program

3. **Allocate Rewards**:
   - Create reward_allocation record for each reward
   - Mark status as 'allocated'
   - Link to member and campaign

4. **Assign Voucher Codes**:
   - Generic: Use the same code for all
   - Unique: Pick unused code from pool
   - Mark code as used
   - Track who used it

5. **Send Email** (if enabled):
   - Generate email with all reward details
   - Include voucher codes
   - Include redemption links
   - Send to customer email

## Database Tables Used

### campaign_rewards (NEW)
Junction table linking campaigns to rewards:
- `campaign_id`: Which campaign
- `reward_id`: Which reward
- `priority`: Display order
- `is_active`: Enable/disable

### reward_allocations
Tracks which member got which reward:
- `member_id`: Who received it
- `reward_id`: What they got
- `campaign_id`: From which campaign
- `status`: allocated, redeemed, expired

### coupon_codes
Stores unique voucher codes:
- `reward_id`: Which reward
- `code`: Actual voucher code
- `is_used`: Claimed or not
- `used_by_email`: Who claimed it

## API Endpoints

### 1. Check Campaign Rewards
**Function**: `check-campaign-rewards`
**Method**: POST
**Purpose**: Check if order qualifies and return rewards

**Request**:
```json
{
  "order_id": "gid://shopify/Order/12345",
  "order_value": 149.99,
  "customer_email": "customer@example.com",
  "shop_domain": "mystore.myshopify.com",
  "shipping_address": {
    "city": "Mumbai",
    "province": "Maharashtra"
  }
}
```

**Response** (Qualifies):
```json
{
  "qualifies": true,
  "bannerTitle": "Congratulations! You've Earned Rewards!",
  "bannerMessage": "Welcome! Choose your rewards...",
  "buttonText": "Claim Your Rewards",
  "rewardUrl": "https://yourapp.com/claim-rewards?email=...&campaign=...",
  "clientName": "Your Store",
  "campaignId": "uuid",
  "rewards": [
    {
      "id": "uuid",
      "title": "25% Off",
      "description": "...",
      "reward_type": "discount",
      "discount_value": 25
    }
  ],
  "rewardCount": 4
}
```

**Response** (Doesn't Qualify):
```json
{
  "qualifies": false,
  "message": "Order does not qualify for rewards"
}
```

### 2. Redeem Campaign Rewards
**Function**: `redeem-campaign-rewards`
**Method**: POST
**Purpose**: Process multi-reward redemption

**Request**:
```json
{
  "campaign_id": "campaign-uuid",
  "reward_ids": ["reward-1-uuid", "reward-2-uuid"],
  "email": "customer@example.com",
  "order_id": "gid://shopify/Order/12345"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully redeemed 2 rewards",
  "allocations": [
    {
      "reward_id": "reward-1-uuid",
      "reward_title": "25% Off",
      "voucher_code": "SAVE25",
      "redemption_url": "https://store.com"
    },
    {
      "reward_id": "reward-2-uuid",
      "reward_title": "Free Shipping",
      "voucher_code": "FREESHIP",
      "redemption_url": "https://store.com"
    }
  ],
  "member_id": "member-uuid"
}
```

## Testing the Flow

### Test Scenario 1: Single Reward Campaign

1. **Setup**:
   - Create reward: "Welcome Discount - 10% Off"
   - Create campaign: "New Customer Welcome"
   - Trigger: Order value >= $25
   - Select 1 reward

2. **Test**:
   - Place order for $30
   - Check Thank You page
   - Should see banner with "1 reward available"
   - Click button → Shows selection page with 1 reward
   - Select reward → Click claim
   - Success page shows "1 reward claimed"
   - Check email for voucher code

### Test Scenario 2: Multiple Rewards Campaign

1. **Setup**:
   - Create 4 rewards:
     - 20% Off
     - Free Shipping
     - $5 Gift Card
     - Early Access
   - Create campaign: "VIP Rewards"
   - Trigger: Order value >= $100
   - Select all 4 rewards

2. **Test**:
   - Place order for $150
   - Check Thank You page
   - Should see "4 rewards available"
   - Click button → Shows all 4 rewards
   - Select 2 rewards → Click claim
   - Success page shows "2 rewards claimed"
   - Check email for both codes

### Test Scenario 3: Location-Based Campaign

1. **Setup**:
   - Create 3 rewards for Mumbai customers
   - Create campaign: "Mumbai Special"
   - Trigger: City = Mumbai AND Order >= $50
   - Select 3 rewards

2. **Test**:
   - Place order with Mumbai shipping
   - Order value $75
   - Should qualify
   - Select 1 reward → Claim
   - Verify Mumbai-specific rewards shown

## Troubleshooting

### Banner Doesn't Appear

**Check**:
1. Campaign is active (`is_active = true`)
2. Campaign has rewards associated
3. Order meets trigger conditions
4. Shop domain is configured correctly
5. Extension is installed on Thank You page
6. Browser console for errors

**Debug**:
```sql
-- Check campaign rewards
SELECT cr.*, camp.name, r.title
FROM campaign_rewards cr
JOIN campaign_rules camp ON camp.id = cr.campaign_id
JOIN rewards r ON r.id = cr.reward_id
WHERE camp.client_id = 'your-client-id'
  AND cr.is_active = true;
```

### Selection Page is Empty

**Check**:
1. URL has correct `campaign` parameter
2. Rewards are active (`status = 'active'`)
3. Campaign-reward associations exist
4. Browser console for API errors

**Debug**:
```sql
-- Check specific campaign rewards
SELECT * FROM campaign_rewards
WHERE campaign_id = 'campaign-uuid'
  AND is_active = true;
```

### Redemption Fails

**Check**:
1. Email or phone is provided
2. Rewards still active
3. Campaign still active
4. Voucher codes available (for unique codes)
5. Backend logs for errors

**Debug**:
```bash
# Check edge function logs
supabase functions logs redeem-campaign-rewards --tail
```

### No Voucher Codes in Email

**Check**:
1. Reward has `coupon_type` set
2. Generic: `generic_coupon_code` is filled
3. Unique: Codes exist in `coupon_codes` table
4. Codes are not all used (`is_used = false`)

**Debug**:
```sql
-- Check available codes
SELECT * FROM coupon_codes
WHERE reward_id = 'reward-uuid'
  AND is_used = false;
```

## Best Practices

### Reward Configuration

1. **Clear Titles**: Use descriptive names like "25% Off Next Order" not "Discount1"
2. **Detailed Descriptions**: Explain exactly what the reward includes
3. **Set Expiry Dates**: Create urgency and prevent indefinite validity
4. **Add T&Cs**: Specify restrictions, minimum orders, excluded items
5. **Use Categories**: Help customers filter (Shopping, Dining, Travel)

### Campaign Setup

1. **Meaningful Names**: "First Purchase Bonus" not "Campaign 1"
2. **Clear Descriptions**: Used in thank you banner message
3. **Set Priorities**: Higher priority campaigns checked first
4. **Define Date Ranges**: Start/end dates for seasonal campaigns
5. **Test Before Launch**: Always test with real orders first

### Reward Selection

1. **Curate Smartly**: Don't overwhelm with too many options (3-5 ideal)
2. **Mix Types**: Offer variety (discount, gift card, free item, membership)
3. **Balance Value**: Mix high-value and entry-level rewards
4. **Brand Partners**: Include partner rewards for cross-promotion
5. **Seasonal Updates**: Refresh rewards regularly

### Customer Experience

1. **Mobile First**: Test on phones - most users are mobile
2. **Fast Loading**: Optimize images, keep API calls quick
3. **Clear CTAs**: "Claim Your Rewards" is better than "Continue"
4. **Explain Steps**: Tell customers what happens after claiming
5. **Follow Up**: Send reminder email if codes unused after 7 days

### Security

1. **Unique Codes**: Use for high-value rewards to prevent sharing
2. **Limit Redemptions**: Set max uses per customer
3. **Expiry Dates**: Prevent code hoarding
4. **Email Verification**: Require email for tracking
5. **Monitor Usage**: Check for abuse patterns

## Analytics & Reporting

### Key Metrics to Track

1. **Qualification Rate**: % of orders that qualify for campaigns
2. **Click-Through Rate**: % who click "Claim" button on Thank You page
3. **Selection Rate**: % who complete reward selection
4. **Rewards Per Claim**: Average number of rewards selected
5. **Redemption Rate**: % of allocated rewards actually redeemed
6. **Popular Rewards**: Which rewards are most selected
7. **Conversion Impact**: Do reward campaigns increase repeat purchases?

### SQL Queries for Reporting

```sql
-- Campaign performance
SELECT
  cr.name as campaign,
  COUNT(DISTINCT ra.member_id) as unique_claimers,
  COUNT(ra.id) as total_rewards_allocated,
  AVG(rewards_per_member) as avg_rewards_per_claim
FROM campaign_rules cr
LEFT JOIN reward_allocations ra ON ra.campaign_id = cr.id
GROUP BY cr.id, cr.name;

-- Most popular rewards
SELECT
  r.title,
  COUNT(ra.id) as times_claimed,
  COUNT(DISTINCT ra.member_id) as unique_claimers
FROM rewards r
LEFT JOIN reward_allocations ra ON ra.reward_id = r.id
GROUP BY r.id, r.title
ORDER BY times_claimed DESC;

-- Redemption rate by reward type
SELECT
  r.reward_type,
  COUNT(ra.id) as allocated,
  SUM(CASE WHEN ra.status = 'redeemed' THEN 1 ELSE 0 END) as redeemed,
  ROUND(100.0 * SUM(CASE WHEN ra.status = 'redeemed' THEN 1 ELSE 0 END) / COUNT(ra.id), 2) as redemption_rate_pct
FROM rewards r
JOIN reward_allocations ra ON ra.reward_id = r.id
GROUP BY r.reward_type;
```

## Next Steps

1. **Create Your First Multi-Reward Campaign**:
   - Start with 3-4 popular rewards
   - Set simple trigger (order value >= $50)
   - Test thoroughly

2. **Monitor Performance**:
   - Track which rewards are popular
   - Adjust selection based on data
   - A/B test different combinations

3. **Expand**:
   - Add location-based campaigns
   - Create tiered campaigns (Silver, Gold, Platinum)
   - Partner with brands for exclusive rewards

4. **Automate**:
   - Set up email sequences
   - Create expiry reminders
   - Build loyalty point integration

## Support

For issues or questions:
- Check browser console for errors
- Review edge function logs
- Verify database records
- Test with simple scenarios first
- Contact support with campaign ID and order details

---

**Implementation Complete!**

Your multi-reward campaign system is ready to use. Start creating campaigns and watch customer engagement soar!
