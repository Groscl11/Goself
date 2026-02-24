# Thank You Page Banner - Complete Integration Guide

## Overview

Your Thank You page banner is now fully integrated with your campaign system. When customers complete a purchase, the extension automatically evaluates all campaign rules and displays a personalized reward banner if they qualify.

## What's Been Built

### 1. Backend API - `check-campaign-rewards`

**Location:** `supabase/functions/check-campaign-rewards/index.ts`

**Endpoint:** `POST /functions/v1/check-campaign-rewards`

**Features:**
- Accepts comprehensive order data from Shopify
- Identifies client by shop domain
- Evaluates all active campaign rules
- Checks trigger, eligibility, location, and attribution conditions
- Returns personalized banner content when customer qualifies
- Supports all existing rule types from your campaign system

### 2. Thank You Extension - Updated

**Location:** `extensions/thank-you-card/src/index.jsx`

**Features:**
- Extracts comprehensive order data via Shopify GraphQL
- Sends complete order details to backend API
- Displays personalized reward banner when qualified
- Clean UX - shows nothing if no rewards available
- Tracks clicks for analytics

## Data Flow

```
Customer Completes Purchase
         ↓
Thank You Page Loads
         ↓
Extension Queries Shopify GraphQL API
    • Order ID, value, currency
    • Customer email, phone
    • Shipping/billing address
    • Line items (products, SKUs, quantities)
    • Payment method
    • Discount codes
         ↓
Extension Calls Backend API
    POST /functions/v1/check-campaign-rewards
         ↓
Backend Identifies Client by Shop Domain
         ↓
Backend Fetches Active Campaign Rules
         ↓
Backend Evaluates Each Rule
    • Trigger conditions (order value, products, etc.)
    • Eligibility conditions (customer type, spend)
    • Location conditions (pincode, city, state)
    • Attribution conditions (UTM parameters)
    • Exclusion rules (refunded, cancelled, test)
         ↓
Backend Returns Result
    ✓ Qualifies: Banner data with title, message, button, URL
    ✗ No Match: Empty response
         ↓
Extension Displays Banner (if qualified)
    • Personalized title
    • Campaign/program message
    • "Claim Your Rewards" button
    • Redemption link
```

## API Reference

### Request Format

```json
{
  "order_id": "gid://shopify/Order/5489678729400",
  "order_value": 149.99,
  "currency": "USD",
  "customer_email": "customer@example.com",
  "customer_phone": "+1234567890",
  "shipping_address": {
    "address1": "123 Main Street",
    "address2": "Apt 4B",
    "city": "Mumbai",
    "province": "Maharashtra",
    "country": "India",
    "zip": "400001"
  },
  "billing_address": {
    "address1": "123 Main Street",
    "city": "Mumbai",
    "province": "Maharashtra",
    "country": "India",
    "zip": "400001"
  },
  "line_items": [
    {
      "product_id": "gid://shopify/Product/8234567890123",
      "variant_id": "gid://shopify/ProductVariant/45678901234567",
      "title": "Premium Widget",
      "quantity": 2,
      "price": 74.99,
      "sku": "WIDGET-001",
      "product_type": "Electronics"
    }
  ],
  "payment_method": "Credit Card",
  "shop_domain": "yourstore.myshopify.com",
  "discount_codes": ["WELCOME10"]
}
```

### Response Format (Qualified)

```json
{
  "qualifies": true,
  "bannerTitle": "Congratulations! You've Earned VIP Rewards! 🎉",
  "bannerMessage": "Thank you for your first purchase! You've been enrolled in our VIP program with exclusive benefits and early access to new products.",
  "buttonText": "Claim Your Rewards",
  "rewardUrl": "https://app.yourdomain.com/claim?email=customer@example.com&campaign=uuid-here",
  "clientName": "Your Brand",
  "campaignId": "campaign-uuid",
  "programName": "VIP Rewards Program"
}
```

### Response Format (Not Qualified)

```json
{
  "qualifies": false,
  "message": "Order does not qualify for rewards"
}
```

## Campaign Rules Supported

The backend evaluates all your existing campaign rule types:

### Order-Based Rules
- **Order Value GTE**: Minimum order amount
- **Order Value Between**: Order amount within range
- **Order Item Count**: Number of items in cart
- **Specific Product**: Product ID or SKU in order
- **Coupon Code**: Discount code used (exact, starts with, contains)

### Payment Rules
- **Payment Method**: COD vs Prepaid

### Customer Rules
- **Customer Type**: New vs Returning
- **Order Number**: Specific order number (e.g., first order)
- **Lifetime Orders**: Customer's total order count
- **Lifetime Spend**: Customer's total spend
- **Customer Tags**: Shopify customer tags

### Location Rules
- **Shipping Pincode**: Exact match, starts with, or in list
- **Shipping City**: Exact match or in list
- **Shipping State**: Exact match or in list
- **Shipping Country**: Exact match or in list

### Attribution Rules
- **UTM Source**: Campaign source
- **UTM Medium**: Campaign medium
- **UTM Campaign**: Campaign name

### Exclusion Rules
- Exclude refunded orders
- Exclude cancelled orders
- Exclude test orders

## Setup Instructions

### 1. Backend Setup (Already Complete)

The backend API is deployed and ready. No configuration needed.

### 2. Configure Shop Integration

1. Navigate to your **Client Dashboard**
2. Go to **Integrations** → **Shopify**
3. Connect your Shopify store
4. Ensure shop domain is saved correctly

### 3. Create Campaign Rules

1. Go to **Campaigns** in client dashboard
2. Click **Create New Campaign**
3. Set up your rules:
   - Name: "First Purchase VIP Enrollment"
   - Trigger: Order value >= $50
   - Eligibility: Customer type = New
   - Reward: Enroll in VIP Program
4. Save and activate the campaign

### 4. Deploy Extension to Shopify

**Option A: Via Shopify CLI (Recommended)**

```bash
# Navigate to your project
cd /path/to/project

# Deploy the extension
shopify app deploy

# Follow the prompts to select the thank-you-card extension
```

**Option B: Via Shopify Partners Dashboard**

1. Go to Partners Dashboard
2. Select your app
3. Navigate to Extensions
4. Upload the thank-you-card extension

### 5. Install Extension in Store

1. Go to **Settings** → **Checkout** in your Shopify admin
2. Click **Customize** next to your checkout profile
3. Navigate to **Order Status** page
4. Click **Add block** or **Add app block**
5. Select **"Rewards Thank You Card"**
6. (Optional) Enter Widget ID for advanced tracking
7. Click **Save**

## Testing

### Test Scenario 1: Qualified Order

1. Create a campaign: "Orders over $100"
   - Trigger: Order value >= 100
   - Active: Yes

2. Place a test order for $150

3. Complete checkout

4. On Thank You page, verify:
   - Reward banner appears
   - Title matches campaign name
   - Message is personalized
   - Button says "Claim Your Rewards"
   - Clicking button redirects to redemption URL

### Test Scenario 2: Non-Qualified Order

1. Same campaign (Orders over $100)

2. Place a test order for $50

3. Complete checkout

4. On Thank You page, verify:
   - No banner appears
   - Page looks clean and normal

### Test Scenario 3: Location-Based Campaign

1. Create campaign: "Mumbai VIP"
   - Trigger: Order value >= 50
   - Location: Shipping city = Mumbai
   - Active: Yes

2. Place test order with Mumbai shipping address

3. Verify banner appears with campaign details

4. Place test order with different city

5. Verify no banner appears

### Test Scenario 4: New Customer Campaign

1. Create campaign: "First Purchase Reward"
   - Trigger: Customer type = New
   - Active: Yes

2. Place order with new email address

3. Verify banner appears

4. Place second order with same email

5. Verify no banner (customer is now returning)

## Monitoring & Debugging

### Check Function Logs

```bash
# View backend function logs
supabase functions logs check-campaign-rewards --tail

# Look for these log entries:
# - "Evaluating campaign: [campaign name]"
# - "Campaign matched: true/false"
# - Error messages if any
```

### Check Extension Behavior

1. Open browser DevTools (F12)
2. Go to Console tab
3. Place a test order
4. Look for logs:
   - "Fetching reward data..."
   - "Campaign response: {...}"
   - Any error messages

### Common Issues

**Issue: Banner not appearing**
- Check campaign is active
- Verify shop domain is correct in integration settings
- Check browser console for API errors
- Review campaign rule conditions

**Issue: Wrong banner content**
- Check campaign priority (highest priority wins)
- Verify campaign description is set
- Check campaign rule configuration

**Issue: API returns "Shop not configured"**
- Verify Shopify integration is connected
- Check shop domain matches exactly
- Ensure integration is marked as active

**Issue: Button link broken**
- Check redemption URL format
- Verify client base URL is configured
- Test the generated URL manually

## Advanced Configuration

### Custom Banner Content

Customize banner content in your campaign settings:

```
Name: "VIP Enrollment - First Order"
Description: "Welcome to our VIP club! As a first-time buyer, you're now eligible for exclusive discounts, early access to sales, and special birthday treats. Your membership is active immediately!"
```

This description becomes the `bannerMessage` in the API response.

### Multiple Campaign Matching

If multiple campaigns match, the backend returns the highest priority campaign. Set priorities in campaign settings:

```
Campaign A: Priority 10 (highest)
Campaign B: Priority 5
Campaign C: Priority 1 (lowest)
```

### Widget ID Tracking

For advanced analytics, configure Widget ID:

1. Go to **Widget Configurations** in client dashboard
2. Create new widget: "thank-you-rewards"
3. Copy the Widget ID
4. Add to extension settings in Shopify Checkout customization
5. Click events will be tracked in `widget_events` table

## Production Checklist

Before going live:

- [ ] Backend API tested with real orders
- [ ] At least one active campaign configured
- [ ] Shop integration verified and active
- [ ] Extension deployed to Shopify app
- [ ] Extension installed in production store
- [ ] Test orders completed successfully
- [ ] Banner displays correctly
- [ ] Redemption links work
- [ ] No console errors
- [ ] Email integration configured (for sending rewards)
- [ ] Analytics/tracking verified (if using Widget ID)

## API Endpoint Details

**Production URL:**
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/check-campaign-rewards
```

**Authentication:**
- Uses Supabase Anon Key (automatically configured in extension)
- No additional auth required

**Rate Limits:**
- None currently enforced
- Consider adding rate limiting if abuse detected

**CORS:**
- Configured to accept requests from any origin
- Shopify checkout domains are whitelisted

## Support & Maintenance

### Updating Campaign Rules

Campaign rules can be updated anytime without redeploying the extension. Changes take effect immediately for new orders.

### Monitoring Performance

Track these metrics:
- API response time
- Campaign match rate
- Banner click-through rate
- Reward redemption rate

Query communication logs:
```sql
SELECT
  COUNT(*) as total_communications,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked
FROM communication_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND communication_type = 'email';
```

### Scaling Considerations

The current implementation handles:
- Multiple simultaneous requests
- Complex rule evaluation
- Large order datasets

For very high traffic (>1000 orders/min), consider:
- Adding caching layer
- Optimizing database queries
- Implementing rate limiting

## Next Steps

1. **Set up email notifications**: Configure Resend API to send reward emails automatically
2. **Create member portal**: Build a portal where customers can view and redeem rewards
3. **Add analytics dashboard**: Track campaign performance and ROI
4. **Implement A/B testing**: Test different banner messages and CTAs
5. **Add SMS notifications**: Integrate Twilio for SMS rewards

## Questions?

For technical support, check:
- Function logs: `supabase functions logs check-campaign-rewards`
- Database logs: Check `campaign_trigger_logs` table
- Extension logs: Browser DevTools console

Your Thank You page banner is fully functional and ready to drive customer engagement!
