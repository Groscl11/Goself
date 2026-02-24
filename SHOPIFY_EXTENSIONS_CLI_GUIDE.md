# Shopify Extensions - Complete CLI Setup Guide
## Fully Configurable Widgets - Just Enter Widget IDs!

This guide shows you how to build and deploy fully configurable Shopify app extensions where you only need to manage widget IDs and configurations through your dashboard.

---

## 🎯 Overview

Your extensions are now **fully configurable** without code changes:

- **Widget configurations** stored in database
- **Just enter Widget ID** in Shopify admin
- **Change colors, text, behavior** through your dashboard
- **Analytics** automatically tracked
- **A/B testing** support built-in
- **No hardcoded values** in extension code

---

## 📋 Prerequisites

1. **Shopify CLI installed**
   ```bash
   npm install -g @shopify/cli
   ```

2. **Shopify Partner Account**
   - Create at: https://partners.shopify.com

3. **Shopify App created**
   - In Partner Dashboard > Apps > Create app

4. **Supabase project**
   - Database already configured with widget tables
   - Edge functions deployed

---

## 🚀 Quick Start (5 Steps)

### Step 1: Deploy Edge Functions

```bash
# Deploy widget configuration fetcher
supabase functions deploy get-widget-config

# Deploy event tracker
supabase functions deploy track-widget-event

# Deploy order rewards fetcher (if not already deployed)
supabase functions deploy get-order-rewards

# Verify deployment
supabase functions list
```

### Step 2: Install Extension Dependencies

```bash
# Thank You extension
cd extensions/thank-you-card
npm install
cd ../..

# Order Status extension
cd extensions/order-status-rewards
npm install
cd ../..
```

### Step 3: Build Extensions

```bash
# Build the main app
npm run build
```

### Step 4: Deploy to Shopify

```bash
# Option A: Deploy all extensions
shopify app deploy

# Option B: Deploy specific extension
cd extensions/thank-you-card
shopify app extension push
```

During deployment, you'll be asked:
- **Select your app** from list of apps in your Partner account
- **Confirm extension details**
- **Approve permissions** (network_access, api_access)

### Step 5: Configure in Shopify Admin

After deployment, configure each extension in Shopify:

1. **Go to Shopify Admin** of your test store
2. **Navigate to:** Settings > Checkout > Checkout customization
3. **Select page type:**
   - For Thank You widget: Order Status page
   - For Order Status widget: Order Status page
4. **Click:** "Add customization" or "Customize"
5. **In the editor:**
   - Find your extension in left sidebar
   - Drag to desired position
   - Click on the extension block
   - **Configure settings:**
     - Widget ID: e.g., `thank-you-rewards-v1`
     - Supabase URL: `https://xxxxx.supabase.co`
     - Supabase Anon Key: `your_anon_key`
6. **Click:** Save

---

## 🎨 Widget Configuration System

### How It Works

```
┌─────────────────────────────────────────┐
│  1. Create Widget Config in Dashboard   │
│     - Widget ID: "thank-you-v1"         │
│     - Colors, text, behavior            │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  2. Deploy Extension via CLI            │
│     - Extension code unchanged          │
│     - No hardcoded values               │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  3. Configure in Shopify Admin          │
│     - Enter Widget ID only              │
│     - Enter Supabase credentials        │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  4. Extension Fetches Config            │
│     - Calls get-widget-config           │
│     - Gets colors, text from database   │
│     - Renders with your settings        │
└─────────────────────────────────────────┘
```

### Widget Configuration Structure

Widget configs are stored in `widget_configurations` table:

```sql
{
  widget_id: "thank-you-rewards-v1",  -- Friendly ID you enter
  widget_type: "thank-you",

  -- Visual styling
  styles: {
    primaryColor: "#2563eb",
    secondaryColor: "#10b981",
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    borderRadius: "0.5rem"
  },

  -- Text content
  content: {
    title: "Congratulations! You've earned rewards!",
    description: "Thank you for your purchase!",
    buttonText: "View My Rewards",
    subtitle: "Click below to claim your rewards"
  },

  -- Behavior
  config: {
    showRewards: true,
    showPoints: true,
    autoExpand: false
  }
}
```

---

## 🔧 Managing Widget Configurations

### Option 1: Through Dashboard UI (Recommended)

Navigate to: **Client Dashboard > Widget Management**

1. Click "Create New Widget"
2. Enter details:
   - Widget ID: `my-widget-v1`
   - Widget Type: Select from dropdown
   - Customize colors, text, behavior
3. Save

### Option 2: Directly in Database

```sql
-- Create a new widget configuration
INSERT INTO widget_configurations (
  client_id,
  widget_id,
  widget_type,
  name,
  description,
  styles,
  content,
  config,
  is_active
) VALUES (
  'your-client-id',
  'thank-you-rewards-v1',
  'thank-you',
  'Thank You Page Rewards',
  'Shows rewards on thank you page',
  '{"primaryColor": "#2563eb", "secondaryColor": "#10b981"}',
  '{"title": "You earned rewards!", "buttonText": "Claim Now"}',
  '{"showRewards": true}',
  true
);
```

### Option 3: Via API (Coming Soon)

```javascript
// Create widget config via API
const response = await fetch('/api/widgets', {
  method: 'POST',
  body: JSON.stringify({
    widget_id: 'my-widget-v1',
    widget_type: 'thank-you',
    styles: { primaryColor: '#2563eb' },
    content: { title: 'Rewards!' }
  })
});
```

---

## 📊 Widget Types & Examples

### 1. Thank You Page Widget

**Widget ID:** `thank-you-rewards-v1`
**Type:** `thank-you`
**Target:** `purchase.thank-you.block.render`

**Example Configuration:**
```json
{
  "styles": {
    "primaryColor": "#2563eb"
  },
  "content": {
    "title": "Thank you for your order!",
    "description": "You've earned 100 points!",
    "buttonText": "View Rewards"
  },
  "config": {
    "showRewards": true,
    "showPoints": true
  }
}
```

### 2. Order Status Widget

**Widget ID:** `order-status-rewards-v1`
**Type:** `order-status`
**Target:** `purchase.order-status.block.render`

**Example Configuration:**
```json
{
  "styles": {
    "primaryColor": "#10b981"
  },
  "content": {
    "title": "Rewards Available!",
    "description": "Claim your rewards now",
    "buttonText": "Claim Rewards"
  },
  "config": {
    "showRedemptionLink": true,
    "autoExpand": false
  }
}
```

---

## 🔄 Deployment Workflow

### Initial Deployment

```bash
# 1. Make sure you're logged in
shopify auth login

# 2. Link to your app (first time only)
shopify app config link

# 3. Deploy extensions
shopify app deploy

# 4. Confirm deployment
# Extensions are now available in Shopify admin
```

### Updating Extensions

```bash
# Update extension code (if needed)
cd extensions/thank-you-card/src
# Make changes to index.jsx

# Rebuild and deploy
cd ../../..
npm run build
shopify app deploy
```

**Important:** Most updates don't require code changes! Just update the widget configuration in your dashboard.

### Updating Widget Configurations

```bash
# NO REDEPLOYMENT NEEDED!
# Just update in database or dashboard:

# Via SQL
UPDATE widget_configurations
SET content = '{"title": "New Title!"}'
WHERE widget_id = 'my-widget-v1';

# Changes take effect immediately
# No need to redeploy extension
```

---

## 🎯 Configuration via Shopify Admin Settings

Each extension has three required settings:

### 1. Widget ID
- **Purpose:** Identifies which config to fetch
- **Format:** Lowercase, hyphens (e.g., `thank-you-v1`)
- **Example:** `order-rewards-summer-2024`

### 2. Supabase URL
- **Purpose:** Your Supabase project endpoint
- **Format:** `https://xxxxx.supabase.co`
- **Where to find:**
  - Supabase Dashboard > Settings > API > Project URL

### 3. Supabase Anon Key
- **Purpose:** Public API key for edge functions
- **Format:** Long string starting with `eyJ...`
- **Where to find:**
  - Supabase Dashboard > Settings > API > Project API keys > anon/public

---

## 🔍 Testing Extensions

### Local Testing (Preview)

```bash
# Start local preview server
cd extensions/thank-you-card
shopify app dev

# Opens preview URL in browser
# Test in Shopify development store
```

### Test in Development Store

1. Place test order
2. Navigate to Order Status page
3. Verify extension appears
4. Check browser console for errors
5. Verify analytics tracked in database

### Verify Widget Config Loaded

```javascript
// In browser console on Order Status page
// Check network tab for:
// - get-widget-config request
// - get-order-rewards request
// - track-widget-event request
```

### Database Verification

```sql
-- Check if widget was viewed
SELECT * FROM widget_analytics
WHERE event_type = 'view'
ORDER BY created_at DESC
LIMIT 10;

-- Check if button was clicked
SELECT * FROM widget_analytics
WHERE event_type = 'click'
ORDER BY created_at DESC
LIMIT 10;

-- Check widget performance
SELECT
  wc.widget_id,
  wc.view_count,
  wc.click_count,
  wc.conversion_count,
  ROUND((wc.click_count::numeric / NULLIF(wc.view_count, 0)) * 100, 2) as ctr
FROM widget_configurations wc
WHERE wc.is_active = true
ORDER BY wc.view_count DESC;
```

---

## 📈 Analytics & Tracking

### Automatic Tracking

The system automatically tracks:
- **Views:** Widget displayed to user
- **Clicks:** Button/link clicked
- **Conversions:** Reward redeemed

### Custom Events

Track custom events:

```javascript
// In your extension code
await fetch(`${supabaseUrl}/functions/v1/track-widget-event`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anonKey}`,
  },
  body: JSON.stringify({
    widget_config_id: widgetData.widget_config_id,
    event_type: 'custom_event',
    metadata: {
      action: 'expanded_details',
      value: 100
    }
  })
});
```

---

## 🎨 Customization Without Code Changes

### Change Colors

```sql
UPDATE widget_configurations
SET styles = jsonb_set(
  styles,
  '{primaryColor}',
  '"#10b981"'
)
WHERE widget_id = 'my-widget-v1';
```

### Change Text

```sql
UPDATE widget_configurations
SET content = jsonb_set(
  content,
  '{title}',
  '"Summer Sale Rewards!"'
)
WHERE widget_id = 'my-widget-v1';
```

### Enable/Disable Widget

```sql
UPDATE widget_configurations
SET is_active = false
WHERE widget_id = 'my-widget-v1';
```

### Schedule Widget

```sql
UPDATE widget_configurations
SET
  start_date = '2024-07-01 00:00:00+00',
  end_date = '2024-07-31 23:59:59+00'
WHERE widget_id = 'my-widget-v1';
```

---

## 🚨 Troubleshooting

### Extension Not Showing

**Check 1:** Is widget configuration active?
```sql
SELECT is_active, start_date, end_date
FROM widget_configurations
WHERE widget_id = 'your-widget-id';
```

**Check 2:** Are settings configured in Shopify?
- Go to: Settings > Checkout > Customize
- Click on extension block
- Verify all three settings are filled

**Check 3:** Check browser console
- Press F12
- Look for errors in Console tab
- Check Network tab for failed requests

### Configuration Not Loading

**Check 1:** Edge function deployed?
```bash
supabase functions list
```

**Check 2:** Test edge function directly
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/get-widget-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"widget_id":"your-widget-id","shop_domain":"your-shop.myshopify.com"}'
```

**Check 3:** RLS policies correct?
```sql
-- Test function access
SELECT * FROM get_widget_config('your-widget-id', 'your-shop.myshopify.com');
```

### Analytics Not Tracking

**Check 1:** RLS policy for anonymous insert
```sql
-- Should exist
SELECT * FROM pg_policies
WHERE tablename = 'widget_analytics'
AND policyname LIKE '%insert%';
```

**Check 2:** Test event tracking
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/track-widget-event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"widget_config_id":"UUID","event_type":"view"}'
```

---

## 📚 Complete CLI Command Reference

### Shopify CLI Commands

```bash
# Login
shopify auth login

# List apps
shopify app list

# Link app
shopify app config link

# Deploy all extensions
shopify app deploy

# Deploy specific extension
shopify app extension push

# Start dev server
shopify app dev

# Check extension status
shopify app extension list

# View logs
shopify app logs
```

### Supabase CLI Commands

```bash
# Deploy function
supabase functions deploy FUNCTION_NAME

# List functions
supabase functions list

# View logs
supabase functions logs FUNCTION_NAME

# Test function locally
supabase functions serve
```

---

## 🎓 Best Practices

### 1. Use Descriptive Widget IDs
- ✅ `summer-thank-you-v1`
- ✅ `order-status-vip-rewards`
- ❌ `widget1`
- ❌ `test`

### 2. Version Your Widgets
- Create new widget for major changes
- Keep old versions for rollback
- Example: `thank-you-v1`, `thank-you-v2`

### 3. Test Before Going Live
- Use development store
- Test all scenarios
- Check analytics tracking
- Verify mobile display

### 4. Monitor Performance
- Check analytics daily
- Monitor conversion rates
- A/B test variations
- Optimize based on data

### 5. Keep Configurations Organized
- Use clear naming conventions
- Document widget purposes
- Archive inactive widgets
- Regular cleanup

---

## 🔐 Security Considerations

1. **Supabase Anon Key** is safe to use in extensions
   - Only provides public access
   - Protected by RLS policies

2. **Never expose Service Role Key** in extensions

3. **RLS Policies** protect your data
   - Clients can only see their widgets
   - Anonymous can only track events

4. **Widget configs** are client-specific
   - Automatically filtered by shop domain
   - Cannot access other clients' configs

---

## 📖 Next Steps

1. **Deploy your first widget:**
   ```bash
   shopify app deploy
   ```

2. **Create widget configuration:**
   - Use Widget Management UI
   - Or insert into database

3. **Configure in Shopify admin:**
   - Add extension to page
   - Enter widget ID and credentials

4. **Test the flow:**
   - Place test order
   - View Order Status page
   - Verify extension appears

5. **Monitor analytics:**
   - Check widget_analytics table
   - Review performance metrics

---

## 🎯 Summary

With this system, you can:

- ✅ Deploy extensions once via CLI
- ✅ Change everything through dashboard
- ✅ No code changes for updates
- ✅ Just enter widget IDs in Shopify
- ✅ Automatic analytics tracking
- ✅ A/B testing ready
- ✅ Full customization power

**You only need CLI for:**
1. Initial deployment
2. Adding new extension types
3. Major functionality changes

**Everything else is configurable through your dashboard!**

---

**Ready to deploy?** Run: `shopify app deploy`
