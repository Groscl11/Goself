# Loyalty Points System - Complete Guide

A comprehensive points-based loyalty program with configurable tiers, automatic points earning, and flexible redemption options.

## Overview

The Loyalty Points System allows clients to:
- Create custom loyalty programs with their own branding
- Define multiple membership tiers with different benefits
- Award points based on order value
- Allow members to redeem points for discounts
- Track all points transactions with a complete ledger

## Features

### 1. Customizable Program Configuration
- **Program Name**: Brand your loyalty program (e.g., "VIP Rewards", "Star Club")
- **Points Name**: Customize what you call your points (e.g., "Stars", "Coins", "Gems")
- **Currency Support**: Support for multiple currencies (INR, USD, EUR, GBP)
- **Welcome Bonus**: Award new members with bonus points upon enrollment
- **Points Expiry**: Optional expiration period for points

### 2. Flexible Tier System
- **Multiple Tiers**: Create unlimited loyalty tiers (Basic, Silver, Gold, Platinum, etc.)
- **Tier Requirements**: Set minimum orders and spend to reach each tier
- **Tier Benefits**:
  - Custom points earning rates per tier
  - Different redemption limits per tier
  - Personalized benefits descriptions
  - Custom tier colors for branding

### 3. Points Earning Rules
- **Configurable Earn Rate**: Define how many points earned per currency spent
- **Divisor System**: Award points based on spending intervals (e.g., 1 point per Rs 10)
- **Automatic Calculation**: Points automatically calculated on order completion
- **Order Tracking**: Track total orders and lifetime spend

### 4. Points Redemption
- **Percentage Limits**: Set maximum % of order value that can be paid with points
- **Point Limits**: Set absolute maximum points per redemption
- **Point Value**: Define currency value of each point when redeeming
- **Real-time Calculation**: Instant discount calculation at checkout

## Database Schema

### Tables Created

1. **loyalty_programs**
   - Main program configuration
   - One program per client
   - Stores points name, currency, expiry rules

2. **loyalty_tiers**
   - Tier definitions within a program
   - Earning and redemption rules per tier
   - Tier progression requirements

3. **member_loyalty_status**
   - Current status for each member
   - Points balance and tier assignment
   - Lifetime statistics (earned, redeemed, orders, spend)

4. **loyalty_points_transactions**
   - Complete ledger of all points activity
   - Tracks earned, redeemed, expired, bonus points
   - Links to orders for traceability

## Client Setup Guide

### Step 1: Create Your Loyalty Program

1. Navigate to **Loyalty Points** in the client dashboard
2. Click **Create Loyalty Program**
3. Fill in the program details:
   ```
   Program Name: VIP Rewards
   Points Name (Plural): Stars
   Points Name (Singular): Star
   Currency: INR
   Welcome Bonus: 100 points
   Points Expiry: 365 days (optional)
   Allow Redemption: ✓ Yes
   ```
4. Click **Save Program**

### Step 2: Create Loyalty Tiers

#### Example Tier Structure:

**Basic Tier (Default Starting Tier)**
```
Tier Name: Basic
Tier Level: 1
Minimum Orders: 0
Minimum Spend: ₹0
Points Earn Rate: 1 point per ₹10 spent
Max Redemption: 25% of order value
Point Value: ₹0.25 per point
Benefits: Welcome to our loyalty program!
```

**Silver Tier**
```
Tier Name: Silver
Tier Level: 2
Minimum Orders: 5
Minimum Spend: ₹5,000
Points Earn Rate: 1 point per ₹8 spent
Max Redemption: 50% of order value
Point Value: ₹0.30 per point
Benefits: Enhanced earning rate and double redemption limit
```

**Gold Tier**
```
Tier Name: Gold
Tier Level: 3
Minimum Orders: 15
Minimum Spend: ₹20,000
Points Earn Rate: 1 point per ₹5 spent
Max Redemption: 75% of order value
Point Value: ₹0.40 per point
Benefits: Premium earning rate, priority support, exclusive offers
```

**Platinum Tier**
```
Tier Name: Platinum
Tier Level: 4
Minimum Orders: 30
Minimum Spend: ₹50,000
Points Earn Rate: 1 point per ₹3 spent
Max Redemption: 100% of order value
Point Value: ₹0.50 per point
Benefits: Maximum benefits, VIP treatment, special events access
```

### Step 3: Understanding Points Calculation

#### Earning Points Example:
- **Customer**: Makes a ₹1,000 order
- **Tier**: Silver (1 point per ₹8)
- **Calculation**: 1000 ÷ 8 = 125 points earned

#### Redeeming Points Example:
- **Customer**: Has 500 points, placing ₹2,000 order
- **Tier**: Silver (50% max redemption, ₹0.30 per point)
- **Max Redeemable**: (2000 × 50%) ÷ 0.30 = 333 points
- **Discount if using 333 points**: 333 × 0.30 = ₹100

## Member Experience

### Viewing Points Balance

Members can view their loyalty status at `/member/loyalty-points` which shows:
- Current points balance
- Current tier and benefits
- Lifetime points earned and redeemed
- Progress to next tier
- Complete transaction history

### Transaction History

Every points transaction shows:
- Date and time
- Transaction type (earned/redeemed/bonus/adjusted)
- Points amount (+ for earned, - for redeemed)
- Balance after transaction
- Related order information
- Expiration date (if applicable)

## API Integration

### Edge Functions Created

#### 1. Calculate Loyalty Points
**Endpoint**: `/functions/v1/calculate-loyalty-points`
**Method**: POST

Award points when an order is completed.

```javascript
{
  "member_user_id": "uuid",
  "order_id": "uuid",
  "order_amount": 1000.00
}
```

**Response**:
```javascript
{
  "success": true,
  "points_earned": 125,
  "new_balance": 625,
  "transaction_id": "uuid"
}
```

#### 2. Check Loyalty Redemption
**Endpoint**: `/functions/v1/check-loyalty-redemption`
**Method**: POST

Check how many points can be redeemed for an order.

```javascript
{
  "member_user_id": "uuid",
  "order_amount": 2000.00,
  "points_to_redeem": 300  // optional
}
```

**Response**:
```javascript
{
  "can_redeem": true,
  "points_balance": 500,
  "max_points": 333,
  "points_to_redeem": 300,
  "discount_value": 90.00,
  "currency": "INR"
}
```

#### 3. Redeem Loyalty Points
**Endpoint**: `/functions/v1/redeem-loyalty-points`
**Method**: POST

Process points redemption.

```javascript
{
  "member_user_id": "uuid",
  "points_to_redeem": 300,
  "order_amount": 2000.00,
  "reference_id": "order-123"
}
```

**Response**:
```javascript
{
  "success": true,
  "points_redeemed": 300,
  "discount_value": 90.00,
  "new_balance": 200
}
```

#### 4. Get Loyalty Status
**Endpoint**: `/functions/v1/get-loyalty-status`
**Method**: GET

Get member's current loyalty status.

**Query Parameters**:
- `member_user_id` OR `email` (required)
- `client_id` (optional, recommended with email)

**Response**:
```javascript
{
  "member_user_id": "uuid",
  "points_balance": 625,
  "lifetime_points_earned": 1250,
  "lifetime_points_redeemed": 625,
  "total_orders": 10,
  "total_spend": 10000.00,
  "tier": {
    "name": "Silver",
    "level": 2,
    "color": "#C0C0C0",
    "benefits": "Enhanced earning rate...",
    "points_earn_rate": 1,
    "points_earn_divisor": 8,
    "max_redemption_percent": 50
  },
  "program": {
    "name": "VIP Rewards",
    "points_name": "Stars",
    "points_name_singular": "Star",
    "currency": "INR",
    "allow_redemption": true
  },
  "recent_transactions": [...]
}
```

## Shopify Integration

### Theme Extension

A Liquid-based theme extension is available at:
`extensions/loyalty-points-display/blocks/points-display.liquid`

#### Features:
- Displays customer's current points balance
- Shows current loyalty tier
- Calculates points to be earned on current cart
- Shows available discount from points redemption
- Beautiful gradient design with customizable colors

#### Installation:
1. Add the block to your Shopify theme
2. Configure API URL (your Supabase URL)
3. Configure Client ID
4. Place the block where you want points displayed (cart, product pages, etc.)

### Widget Configuration

In Shopify theme editor settings:
```liquid
API URL: https://your-project.supabase.co
Client ID: your-client-uuid
```

The widget automatically:
- Detects logged-in customers
- Fetches their loyalty status
- Calculates earn/redeem for current cart
- Updates in real-time

## Tier Progression

Members automatically advance to higher tiers when they meet the requirements:

1. System checks tier eligibility after each order
2. If member meets requirements for a higher tier, they're automatically upgraded
3. Tier upgrade triggers:
   - New tier benefits apply immediately
   - Better earning rate on future orders
   - Increased redemption limits

### Progress Tracking

Members can see their progress to the next tier:
- Orders remaining to next tier
- Spend remaining to next tier
- Visual progress bars

## Points Expiration

If configured, points can expire after a set number of days:

- Expiration tracked per transaction
- Members notified of expiring points
- Expired points automatically deducted
- Transaction history shows expiration events

## Best Practices

### 1. Tier Design
- Start with 3-4 tiers maximum
- Make tier progression achievable
- Ensure meaningful benefit increases between tiers
- Consider your average order value when setting requirements

### 2. Earning Rates
- Balance generosity with profitability
- Typical range: 1-10% of order value as points
- Higher tiers should offer noticeably better rates
- Consider margin impact when setting rates

### 3. Redemption Limits
- Lower tiers: 20-30% max redemption
- Mid tiers: 40-60% max redemption
- Top tiers: 70-100% max redemption
- Prevents complete free orders while rewarding loyalty

### 4. Point Values
- Set realistic currency values
- Typical: 1 point = 0.10-0.50 in currency
- Higher tiers can have higher point values
- Consider redemption impact on revenue

### 5. Communication
- Clearly explain earning and redemption rules
- Highlight tier benefits prominently
- Send notifications for tier upgrades
- Regular point balance reminders

## Troubleshooting

### Members Not Seeing Points
1. Verify member is enrolled in loyalty program
2. Check that loyalty program is active
3. Ensure member has completed orders
4. Verify orders are marked as paid/completed

### Points Not Calculating Correctly
1. Check tier earning rate configuration
2. Verify points divisor is correct
3. Ensure order amount is in correct currency
4. Check transaction logs for errors

### Redemption Not Working
1. Verify redemption is enabled in program settings
2. Check member has sufficient points
3. Verify redemption doesn't exceed tier limits
4. Check point value is configured correctly

## Future Enhancements

Potential additions to consider:
- Points for non-purchase actions (reviews, referrals, social shares)
- Bonus point campaigns and promotions
- Birthday bonus points
- Points gifting between members
- Tier-based free shipping
- Early access to sales for higher tiers
- Points pooling for group purchases

## Support

For technical support or feature requests, please contact your system administrator or refer to the main platform documentation.
