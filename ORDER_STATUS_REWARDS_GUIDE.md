# Order Status Rewards Extension - Complete Installation Guide

This guide will help you install and configure the **Order Status Rewards Widget** that displays reward links on your Shopify Order Status pages (similar to the Thank You page widget).

## Overview

When customers place orders that qualify for rewards through your campaign rules, they will see a beautiful rewards banner on their Order Status page with a "View My Rewards" button. Clicking this button takes them to a dedicated redemption portal where they can claim their rewards by entering their email or phone number.

## Features

✅ Automatic reward detection on Order Status pages
✅ Beautiful, branded rewards banner
✅ Secure tokenized redemption links
✅ Email or SMS reward delivery
✅ Automatic voucher creation
✅ Member account creation (if needed)
✅ Seamless integration with your campaign rules

---

## Installation Steps

### Step 1: Deploy Edge Functions

First, deploy the required edge functions that power the rewards system:

```bash
# Deploy the order rewards fetcher
supabase functions deploy get-order-rewards

# Deploy the redemption processor
supabase functions deploy process-reward-redemption
```

**Verification:**
```bash
supabase functions list
```

You should see both `get-order-rewards` and `process-reward-redemption` in the list.

---

### Step 2: Update Extension Configuration

The Order Status Rewards extension is located at:
```
extensions/order-status-rewards/
```

**Update the environment variables** in `extensions/order-status-rewards/src/index.jsx`:

Replace the placeholder values with your actual Supabase credentials:

```jsx
const response = await fetch(
  `https://YOUR_PROJECT_ID.supabase.co/functions/v1/get-order-rewards`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer YOUR_ANON_KEY`,
    },
    // ...
  }
);
```

**Where to find your credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings > API
4. Copy:
   - Project URL (VITE_SUPABASE_URL)
   - Anon/Public Key (VITE_SUPABASE_ANON_KEY)

---

### Step 3: Deploy the Shopify Extension

Using the Shopify CLI:

```bash
# Navigate to your project root
cd /path/to/your/project

# Install dependencies for the extension
cd extensions/order-status-rewards
npm install

# Return to project root
cd ../..

# Deploy to Shopify
npm run deploy
# OR
shopify app deploy
```

**During deployment:**
1. Select your Shopify app
2. Confirm the extension deployment
3. The extension will be automatically activated

---

### Step 4: Configure in Shopify Admin

After deployment, configure the extension in your Shopify admin:

1. **Go to your Shopify Admin**
2. **Navigate to:** Settings > Checkout > Checkout customization
3. **Find:** "Order status page"
4. **Click:** "Add customization" or "Customize"
5. **In the editor:**
   - Look for your app extensions in the left sidebar
   - Find "Order Status Rewards" extension
   - Drag it to your desired location (recommended: after order summary)
   - Click "Save"

---

### Step 5: Test the Complete Flow

#### A. Create a Test Campaign (if not already created)

1. **Login to your client dashboard**
2. **Navigate to:** Client > Campaigns
3. **Create a new campaign:**
   - Name: "Order Rewards Test"
   - Trigger: "order_placed"
   - Condition: Order value > $50
   - Action: "enroll_in_program"
   - Select a membership program with rewards

#### B. Place a Test Order

1. **Go to your Shopify store**
2. **Add products to cart** (total > $50 to match your campaign rule)
3. **Complete checkout** with test payment
4. **After payment**, you'll land on the Order Status page

#### C. Verify the Rewards Banner

On the Order Status page, you should see:
- ✅ A green banner with "Congratulations! You've earned rewards!"
- ✅ A "View My Rewards" button
- ✅ Brief description of the rewards program

#### D. Test Redemption Flow

1. **Click "View My Rewards"** button
2. **You should see:**
   - Order details (order number, client name)
   - Program information
   - List of available rewards
   - Contact method selection (Email or SMS)

3. **Choose contact method** and enter details:
   - For email: Enter a valid email address
   - For SMS: Enter phone number (format: +1234567890)

4. **Click "Claim My Rewards"**

5. **Verify success:**
   - You should see a success message
   - Check your email/phone for reward notification
   - Vouchers should be created in the system

#### E. Verify in Database

Check that everything was recorded correctly:

```sql
-- Check if redemption token was used
SELECT * FROM member_redemption_tokens
WHERE used = true
ORDER BY created_at DESC
LIMIT 5;

-- Check if vouchers were created
SELECT * FROM vouchers
ORDER BY created_at DESC
LIMIT 5;

-- Check if member was created/updated
SELECT * FROM members
ORDER BY created_at DESC
LIMIT 5;

-- Check communication logs
SELECT * FROM campaign_communications
WHERE message_type = 'reward_redemption'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Customization Options

### Change Banner Appearance

Edit `extensions/order-status-rewards/src/index.jsx`:

```jsx
<Banner status="success" title="🎁 Congratulations! You've earned rewards!">
  <BlockStack spacing="base">
    <Text>
      Your custom message here...
    </Text>
    <Button kind="primary" onPress={...}>
      Your Custom Button Text
    </Button>
  </BlockStack>
</Banner>
```

### Customize Redemption Portal

Edit `src/pages/public/RedeemRewards.tsx`:

1. **Change colors:**
   - Update Tailwind classes (e.g., `from-blue-600` to `from-purple-600`)

2. **Change messaging:**
   - Update text content in the JSX

3. **Add/remove contact methods:**
   - Modify the contact method selection section

4. **Customize reward display:**
   - Update the rewards list rendering

---

## Redemption Link Structure

The system generates secure tokenized links automatically:

**Format:**
```
https://your-domain.com/redeem/{TOKEN}
```

**Example:**
```
https://app.yourdomain.com/redeem/abc123def456ghi789
```

**Token characteristics:**
- 32-character random string
- Unique per order/campaign combination
- Expires after 30 days (configurable)
- One-time use only
- Includes order and campaign context

---

## How It Works

### 1. Order is Placed
- Customer completes checkout on Shopify
- Webhook sends order data to your system

### 2. Campaign Rules Evaluated
- Edge function `evaluate-campaign-rules` processes the order
- Checks if order meets campaign conditions
- If qualified, creates redemption token

### 3. Order Status Page Loads
- Extension calls `get-order-rewards` edge function
- Passes order ID and shop domain
- Receives redemption link if rewards are available

### 4. Banner Displays
- Shows rewards notification
- Provides "View My Rewards" button
- Button opens redemption portal in new tab

### 5. Customer Redeems
- Lands on beautiful redemption portal
- Sees order details and available rewards
- Chooses email or SMS delivery
- Enters contact information
- Clicks "Claim My Rewards"

### 6. Redemption Processing
- `process-reward-redemption` edge function:
  - Validates token (not used, not expired)
  - Creates/updates member record
  - Creates vouchers for all rewards
  - Marks token as used
  - Sends notification via email/SMS

### 7. Rewards Delivered
- Customer receives notification
- Vouchers are available in member portal
- Can be used according to reward terms

---

## Troubleshooting

### Banner Not Showing

**Check 1: Is the extension deployed?**
```bash
shopify app extensions list
```

**Check 2: Is the extension active in Shopify?**
- Go to Shopify Admin > Settings > Checkout
- Verify extension is added and saved

**Check 3: Does the order have rewards?**
```sql
SELECT * FROM member_redemption_tokens
WHERE order_id = 'YOUR_ORDER_ID';
```

**Check 4: Check browser console**
- Open Order Status page
- Press F12 to open developer tools
- Look for errors in Console tab

### Redemption Link Not Working

**Check 1: Verify token exists**
```sql
SELECT * FROM member_redemption_tokens
WHERE token = 'YOUR_TOKEN';
```

**Check 2: Check token status**
- `used = false` (should not be used yet)
- `expires_at > now()` (should not be expired)

**Check 3: Test edge function directly**
```bash
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/get-order-rewards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"order_id": "YOUR_SHOPIFY_ORDER_ID", "shop_domain": "your-shop.myshopify.com"}'
```

### Rewards Not Being Created

**Check 1: Verify campaign rules**
```sql
SELECT * FROM campaign_rules
WHERE client_id = 'YOUR_CLIENT_ID'
AND enabled = true;
```

**Check 2: Check trigger logs**
```sql
SELECT * FROM campaign_trigger_logs
WHERE order_number = 'YOUR_ORDER_NUMBER'
ORDER BY created_at DESC;
```

**Check 3: Verify reward allocations**
```sql
SELECT ra.*, r.name, r.type, r.brand_id
FROM reward_allocations ra
JOIN rewards r ON ra.reward_id = r.id
WHERE ra.membership_program_id = 'YOUR_PROGRAM_ID';
```

### Email/SMS Not Sending

**Check 1: Verify communication settings**
```sql
SELECT twilio_account_sid, twilio_phone_number, email_from_address
FROM clients
WHERE id = 'YOUR_CLIENT_ID';
```

**Check 2: Check communication logs**
```sql
SELECT * FROM campaign_communications
WHERE message_type = 'reward_redemption'
ORDER BY created_at DESC
LIMIT 10;
```

**Check 3: Test communication function**
```bash
supabase functions invoke send-campaign-communication \
  --data '{"member_id":"...","client_id":"...","message_type":"reward_redemption"}'
```

---

## Database Schema Reference

### member_redemption_tokens

Stores the tokenized redemption links:

```sql
CREATE TABLE member_redemption_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  member_id UUID REFERENCES members(id),
  order_id UUID REFERENCES shopify_orders(id),
  campaign_rule_id UUID REFERENCES campaign_rules(id),
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### vouchers

Stores the issued reward vouchers:

```sql
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id),
  reward_id UUID REFERENCES rewards(id),
  issued_by UUID REFERENCES clients(id),
  status TEXT DEFAULT 'active',
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Security Considerations

1. **Token Expiration:** Tokens expire after 30 days
2. **One-time Use:** Tokens can only be used once
3. **HTTPS Only:** All communication over secure connections
4. **No Sensitive Data:** Tokens don't contain member information
5. **Server-side Validation:** All validation happens server-side
6. **Rate Limiting:** Consider adding rate limits to edge functions

---

## Advanced Configuration

### Custom Token Expiration

Edit `supabase/functions/shopify-webhook/index.ts`:

```typescript
// Change from 30 days to your desired duration
expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
```

### Multiple Reward Programs

The system automatically supports multiple programs:
- Each order can trigger multiple campaigns
- Each campaign creates separate tokens
- Customer sees all available rewards in one portal

### Custom Email Templates

Edit `supabase/functions/send-campaign-communication/index.ts`:

Customize the email content for `reward_redemption` message type.

---

## Production Checklist

Before going live:

- [ ] All edge functions deployed
- [ ] Extension deployed to Shopify
- [ ] Extension configured in Shopify Admin
- [ ] Campaign rules created and enabled
- [ ] Reward allocations configured
- [ ] Communication settings configured (Twilio, Email)
- [ ] Test orders placed and verified
- [ ] Redemption flow tested end-to-end
- [ ] Email/SMS delivery tested
- [ ] Error handling verified
- [ ] Database backups configured

---

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the Campaign Trigger Logs in your dashboard
3. Check Supabase Edge Function logs
4. Review the database tables for data integrity

---

## Related Documentation

- [Campaign Rules Setup](./ADVANCED_RULE_ENGINE.md)
- [Thank You Card Widget](./SIMPLE_THANK_YOU_SETUP.md)
- [Communication Settings](./CAMPAIGN_COMMUNICATIONS_GUIDE.md)
- [Shopify Integration](./SHOPIFY_INTEGRATION_GUIDE.md)

---

**Congratulations!** You've successfully installed the Order Status Rewards system. Your customers can now discover and claim their rewards directly from their order status pages!
