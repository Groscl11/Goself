# Engage Universal - Step-by-Step Implementation Guide

Complete guide to building and deploying the Engage Universal app extension.

---

## What is Engage Universal?

A **Theme App Extension** that adds a floating rewards widget to any page of a Shopify store. Customers can:
- See their available rewards
- Claim rewards with one click
- Track reward count via badge
- Access from any page

---

## Step 1: Create Extension Files

### 1.1: Create Directory Structure

```bash
mkdir -p extensions/engage-universal/blocks
mkdir -p extensions/engage-universal/assets
```

### 1.2: Create Extension Configuration

**File:** `extensions/engage-universal/shopify.extension.toml`

```toml
api_version = "2024-10"

[[extensions]]
type = "theme_app_extension"
name = "Engage Universal"
handle = "engage-universal"

[extensions.settings]
[[extensions.settings.fields]]
key = "widget_id"
type = "text"
name = "RewardHub Widget ID"
info = "Enter the widget ID from your RewardHub dashboard"

[[extensions.settings.fields]]
key = "position"
type = "select"
name = "Widget Position"
info = "Choose where to display the widget"
default = "bottom-right"
options = [
  { label = "Bottom Right", value = "bottom-right" },
  { label = "Bottom Left", value = "bottom-left" },
  { label = "Top Right", value = "top-right" },
  { label = "Top Left", value = "top-left" }
]

[[extensions.settings.fields]]
key = "show_on_mobile"
type = "checkbox"
name = "Show on Mobile"
info = "Display widget on mobile devices"
default = true

[[extensions.settings.fields]]
key = "auto_open"
type = "checkbox"
name = "Auto Open"
info = "Automatically open widget on page load"
default = false
```

**What this does:**
- Defines extension as a Theme App Extension
- Sets up configuration options for merchants
- Allows customization of position, mobile display, and behavior

---

## Step 2: Create the Widget Block

### 2.1: Create Liquid Block File

**File:** `extensions/engage-universal/blocks/rewards-widget.liquid`

This is a large file that includes:
1. **HTML Structure** - Widget container and markup
2. **CSS Styles** - All styling for button, panel, cards
3. **JavaScript Logic** - Widget functionality and API calls
4. **Schema** - Block settings configuration

**Key Components:**

#### HTML Container
```liquid
<div
  id="rewardhub-widget-{{ block.id }}"
  class="rewardhub-widget"
  data-widget-id="{{ block.settings.widget_id }}"
  data-position="{{ block.settings.position }}"
  data-mobile="{{ block.settings.show_on_mobile }}"
  data-auto-open="{{ block.settings.auto_open }}"
>
  <!-- Widget rendered by JavaScript -->
</div>
```

#### Hardcoded Credentials
```javascript
const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

#### Widget Initialization
```javascript
function initRewardHubWidget(container) {
  const widgetId = container.dataset.widgetId;
  const button = createWidgetButton();
  const panel = createWidgetPanel();

  container.appendChild(button);
  container.appendChild(panel);

  loadWidgetConfig(widgetId, panel, button);
}
```

---

## Step 3: Create Edge Function

### 3.1: Create Shared CORS Module

**File:** `supabase/functions/_shared/cors.ts`

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
```

### 3.2: Create Customer Rewards Function

**File:** `supabase/functions/get-customer-rewards/index.ts`

This function:
1. Accepts customer email and widget ID
2. Looks up customer in database
3. Fetches available rewards
4. Generates redemption tokens
5. Returns reward data with links

**Key Logic:**

```typescript
// Find customer
const { data: customers } = await supabase
  .from('customers')
  .select('id, client_id')
  .eq('email', customer_email)
  .maybeSingle();

// Get available rewards
const { data: rewards } = await supabase
  .from('reward_allocations')
  .select(`
    id,
    quantity,
    redeemed_count,
    rewards (name, description, reward_type, value_amount)
  `)
  .eq('customer_id', customers.id)
  .gt('quantity', supabase.raw('redeemed_count'));

// Generate redemption links
const rewardsWithLinks = rewards.map(async (allocation) => {
  const token = await createRedemptionToken(allocation.id, customers.id);
  return {
    ...allocation.rewards,
    redemption_link: `/redeem/${token}`
  };
});
```

---

## Step 4: Deploy Everything

### 4.1: Deploy Edge Function

```bash
# Deploy the customer rewards function
supabase functions deploy get-customer-rewards

# Verify deployment
supabase functions list
```

### 4.2: Deploy Shopify Extension

```bash
# Deploy all extensions
shopify app deploy

# Or deploy specific extension
shopify app deploy --extension engage-universal
```

### 4.3: Verify Deployment

```bash
# Check extension versions
shopify app versions list

# Should show:
# ✓ engage-universal - v1.0.0
# ✓ thank-you-card - v1.0.0
# ✓ order-status-rewards - v1.0.0
```

---

## Step 5: Configure in Shopify

### 5.1: Enable App Embed

1. **Go to:** Shopify Admin → Online Store → Themes
2. **Click:** Customize (on active theme)
3. **Scroll down** to App embeds section (bottom of left sidebar)
4. **Find:** Engage Universal
5. **Toggle:** Switch to ON (enabled)

### 5.2: Configure Settings

1. **Click** on "Engage Universal" to expand settings
2. **Enter Widget ID:** `universal-widget-v1`
3. **Select Position:** Bottom Right
4. **Check:** Show on Mobile
5. **Uncheck:** Auto Open (optional)
6. **Click:** Save

### 5.3: Preview

1. **Click** the eye icon (Preview) in top bar
2. **Look for** floating button in bottom right
3. **Click button** to test widget opens
4. **Test** on mobile preview

---

## Step 6: Create Widget Configuration

### 6.1: Login to Dashboard

```
URL: https://your-app.com/login
Email: client@example.com
Password: [your password]
```

### 6.2: Create Widget

1. **Navigate:** Dashboard → Widget Configurations
2. **Click:** New Widget
3. **Fill in:**
   ```
   Widget ID: universal-widget-v1
   Widget Type: embedded
   Name: Universal Rewards Widget
   Description: Floating widget for rewards
   Is Active: ✓

   Content:
     Title: Your Rewards
     Description: View and claim your exclusive rewards
     Button Text: Claim Reward
     Subtitle: Available while supplies last

   Styles:
     Primary Color: #667eea
     Secondary Color: #764ba2
     Text Color: #111827
     Background Color: #ffffff
   ```
4. **Click:** Create Widget
5. **Copy:** Widget ID for use in Shopify

---

## Step 7: Test the Widget

### 7.1: Test as Guest (Not Logged In)

1. **Open** incognito browser
2. **Visit** your store
3. **Look for** floating button
4. **Click** button
5. **Should see:** "Sign in to view your rewards" message
6. **Should have:** Sign In button

### 7.2: Test as Customer with No Rewards

1. **Create** test customer account
2. **Login** on storefront
3. **Click** widget button
4. **Should see:** "No rewards available yet"
5. **Should see:** "Keep shopping to earn rewards!"

### 7.3: Test as Customer with Rewards

#### Create Test Customer
```sql
INSERT INTO customers (client_id, email, first_name, last_name)
VALUES (
  (SELECT id FROM clients WHERE name = 'Test Client'),
  'test@example.com',
  'Test',
  'Customer'
);
```

#### Allocate Test Reward
```sql
-- Get customer ID
SELECT id FROM customers WHERE email = 'test@example.com';

-- Get reward ID
SELECT id FROM rewards WHERE name = '10% Off';

-- Allocate reward
INSERT INTO reward_allocations (customer_id, reward_id, quantity)
VALUES (
  '[customer-id]',
  '[reward-id]',
  1
);
```

#### Test Flow
1. **Login** as test@example.com
2. **Visit** any page
3. **Widget button** should show badge with "1"
4. **Click** button
5. **Should see** reward card with:
   - Reward name
   - Description
   - "Claim Reward" button
6. **Click** "Claim Reward"
7. **Should open** redemption page

---

## Step 8: Customize Styling (Optional)

### 8.1: Change Brand Colors

Edit `blocks/rewards-widget.liquid`:

```css
/* Find these lines and change colors */

/* Button gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Change to your brand */
background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
```

### 8.2: Change Button Size

```css
.rewardhub-widget-button {
  width: 60px;   /* Change to 70px for larger */
  height: 60px;  /* Change to 70px for larger */
}
```

### 8.3: Change Panel Width

```css
.rewardhub-widget-panel {
  width: 380px;  /* Change to 400px for wider */
}
```

### 8.4: Redeploy After Changes

```bash
shopify app deploy
```

Changes will appear immediately in theme customizer.

---

## Step 9: Monitor Analytics

### 9.1: Check Widget Views

```sql
SELECT
  widget_id,
  COUNT(*) as total_views,
  COUNT(DISTINCT metadata->>'customer_email') as unique_customers
FROM widget_analytics wa
JOIN widget_configurations wc ON wa.widget_config_id = wc.id
WHERE event_type = 'view'
  AND wc.widget_id = 'universal-widget-v1'
GROUP BY widget_id;
```

### 9.2: Check Reward Claims

```sql
SELECT
  r.name,
  COUNT(*) as claims,
  SUM(CASE WHEN mrt.used THEN 1 ELSE 0 END) as completed
FROM member_redemption_tokens mrt
JOIN reward_allocations ra ON mrt.reward_allocation_id = ra.id
JOIN rewards r ON ra.reward_id = r.id
GROUP BY r.name
ORDER BY claims DESC;
```

### 9.3: Check Conversion Rate

```sql
SELECT
  widget_id,
  COUNT(*) FILTER (WHERE event_type = 'view') as views,
  COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
  ROUND(
    (COUNT(*) FILTER (WHERE event_type = 'click')::numeric /
     NULLIF(COUNT(*) FILTER (WHERE event_type = 'view'), 0)) * 100,
    2
  ) as conversion_rate
FROM widget_analytics wa
JOIN widget_configurations wc ON wa.widget_config_id = wc.id
WHERE wc.widget_id = 'universal-widget-v1'
GROUP BY widget_id;
```

---

## Troubleshooting

### Widget Not Appearing

**Issue:** Floating button doesn't show up

**Solution:**
1. Check app embed is enabled in theme customizer
2. Verify widget ID is correct
3. Check browser console for errors
4. Ensure extension is deployed: `shopify app versions list`
5. Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Badge Not Showing Count

**Issue:** Badge doesn't display reward count

**Solution:**
1. Verify customer is logged in
2. Check customer has allocated rewards:
   ```sql
   SELECT * FROM reward_allocations
   WHERE customer_id = (SELECT id FROM customers WHERE email = 'customer@example.com');
   ```
3. Check edge function is deployed: `supabase functions list`
4. Check browser network tab for failed API calls

### Panel Shows Loading Forever

**Issue:** Panel stays on "Loading rewards..."

**Solution:**
1. Open browser DevTools → Network tab
2. Look for `get-customer-rewards` request
3. Check if request failed (red)
4. Check response for error message
5. Verify edge function logs:
   ```bash
   supabase functions logs get-customer-rewards
   ```

### Claims Button Not Working

**Issue:** "Claim Reward" button doesn't do anything

**Solution:**
1. Check redemption link is generated
2. Verify redemption page exists
3. Check browser console for JavaScript errors
4. Test link manually by copying URL

---

## Production Checklist

Before going live:

- [ ] Edge function deployed
- [ ] Extension deployed to Shopify
- [ ] App embed enabled in theme
- [ ] Widget ID configured
- [ ] Test as guest user
- [ ] Test as logged-in user
- [ ] Test reward claims
- [ ] Test on mobile
- [ ] Test on different browsers
- [ ] Verify analytics tracking
- [ ] Check error handling
- [ ] Monitor function logs
- [ ] Set up alerting for errors

---

## File Reference

```
project/
├── extensions/
│   └── engage-universal/
│       ├── shopify.extension.toml          # Extension config
│       ├── blocks/
│       │   └── rewards-widget.liquid       # Main widget block
│       ├── assets/                         # Optional assets
│       └── README.md                       # Extension docs
│
├── supabase/
│   └── functions/
│       ├── _shared/
│       │   └── cors.ts                     # CORS headers
│       └── get-customer-rewards/
│           └── index.ts                    # Customer rewards API
│
└── ENGAGE_UNIVERSAL_GUIDE.md              # This guide
```

---

## Summary

**What You Built:**
1. Theme App Extension (engage-universal)
2. Floating rewards widget
3. Customer rewards API (edge function)
4. Shared CORS module

**What Merchants Do:**
1. Enable app embed in theme
2. Enter Widget ID
3. Configure position and options
4. Save

**What Customers See:**
1. Floating button on all pages
2. Badge with reward count
3. Panel with available rewards
4. One-click reward redemption

**Result:**
A professional, merchant-friendly rewards widget that works across the entire store with minimal configuration!

---

**You're done!** 🎉 The Engage Universal extension is ready to deploy.
