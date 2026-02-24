# Simplified Extension Setup - Widget ID Only

## What Changed

The Shopify extensions have been simplified to only require the **RewardHub Widget ID**. No more API keys or URLs needed!

### Before (Old Setup)
```
RewardHub Widget ID: thank-you-rewards-v1
RewardHub API Base URL: https://lizgppzyyljqbmzdytia.supabase.co
RewardHub Public API Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### After (New Setup)
```
RewardHub Widget ID: thank-you-rewards-v1
```

That's it! Just one field.

---

## How It Works

The Supabase URL and public API key are now **hardcoded** in the extension code. Since these are:
1. **Public values** (anon key is safe to expose)
2. **Same for all merchants** (your Supabase project)
3. **Never change** (static configuration)

There's no reason to ask merchants to configure them manually.

---

## Installation Steps

### 1. Deploy Extensions

```bash
# Navigate to your project
cd /path/to/project

# Deploy to Shopify
shopify app deploy
```

### 2. Configure in Shopify Admin

#### For Thank You Page Extension:

1. **Go to:** Shopify Admin → Settings → Checkout
2. **Click:** Customize (under Order Status page)
3. **Add:** Your "Rewards Thank You Card" extension
4. **Enter Widget ID:** `thank-you-rewards-v1` (or your widget ID)
5. **Save**

#### For Order Status Extension:

1. **Go to:** Shopify Admin → Settings → Checkout
2. **Click:** Customize (under Order Status page)
3. **Add:** Your "Order Status Rewards" extension
4. **Enter Widget ID:** `order-status-rewards-v1` (or your widget ID)
5. **Save**

#### For Cart Extension:

1. **Go to:** Shopify Admin → Online Store → Themes
2. **Click:** Customize
3. **Navigate to:** Cart page/drawer
4. **Add:** Your "Rewards Cart Widget" extension
5. **Enter Widget ID:** `cart-rewards-v1` (or your widget ID)
6. **Save**

---

## Creating Widget IDs in Dashboard

### Step 1: Login to RewardHub Dashboard
```
URL: https://your-app.com/login
Role: Client
```

### Step 2: Navigate to Widget Configurations
```
Dashboard → Widget Configurations
```

### Step 3: Create New Widget
```
Click: "New Widget"

Fill in:
  Widget ID: thank-you-rewards-v1  ← Copy this!
  Widget Type: thank-you
  Name: Thank You Page Rewards
  Description: Shows rewards on thank you page

  Content:
    Title: Congratulations! You've earned rewards!
    Description: Thank you for your purchase!
    Button Text: View My Rewards
    Subtitle: Click below to claim your rewards

  Styles:
    Primary Color: #2563eb (blue)
    Secondary Color: #10b981 (green)

Click: "Create Widget"
```

### Step 4: Copy Widget ID

Once created, copy the **Widget ID** from the list and use it in Shopify admin settings.

---

## Widget ID Format

Widget IDs should follow this pattern:
```
{purpose}-{location}-{version}

Examples:
  thank-you-rewards-v1
  order-status-rewards-v1
  cart-rewards-v1
  summer-sale-thank-you-v2
  vip-order-status-v1
```

**Best Practices:**
- Use lowercase
- Use hyphens (not underscores)
- Include version number
- Be descriptive
- Keep it short

---

## Testing

### 1. Place Test Order

1. Go to your dev store
2. Add products to cart
3. Complete checkout
4. View Order Status page

### 2. Verify Widget Appears

You should see:
- Custom styled banner
- Rewards message
- Action button
- All configured colors/text

### 3. Check Analytics

In RewardHub dashboard:
```sql
SELECT
  widget_id,
  name,
  view_count,
  click_count,
  ROUND((click_count::numeric / NULLIF(view_count, 0)) * 100, 2) as ctr
FROM widget_configurations
ORDER BY view_count DESC;
```

---

## Troubleshooting

### Widget Not Showing Up

**Check 1: Widget ID**
```
- Verify exact spelling (case-sensitive)
- Check for extra spaces
- Ensure it matches dashboard exactly
```

**Check 2: Widget Active**
```sql
SELECT widget_id, is_active, start_date, end_date
FROM widget_configurations
WHERE widget_id = 'your-widget-id';
```

**Check 3: Extension Deployed**
```bash
shopify app versions list
```

**Check 4: Extension Enabled in Checkout**
```
Settings → Checkout → Customize
Verify extension is added to the page
```

### Wrong Content Showing

**Issue:** Old content appears after updating

**Solution:**
1. Widget configs are cached by Shopify for ~5 minutes
2. Wait 5 minutes or clear browser cache
3. Or use a new browser/incognito window

### Analytics Not Tracking

**Check 1: Edge Function Deployed**
```bash
supabase functions deploy track-widget-event
```

**Check 2: Verify Function Works**
```bash
curl -X POST \
  https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/track-widget-event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "widget_config_id": "uuid-here",
    "event_type": "view"
  }'
```

---

## Updating Widget Configuration

### Live Updates (No Redeployment)

You can update widget content instantly without redeploying:

**Via Dashboard:**
1. Go to Widget Configurations
2. Click Edit on your widget
3. Change text, colors, etc.
4. Save
5. Changes appear within 5 minutes

**Via SQL:**
```sql
-- Update title
UPDATE widget_configurations
SET content = jsonb_set(
  content,
  '{title}',
  '"New Title Here!"'
)
WHERE widget_id = 'thank-you-rewards-v1';

-- Update colors
UPDATE widget_configurations
SET styles = jsonb_set(
  styles,
  '{primaryColor}',
  '"#10b981"'
)
WHERE widget_id = 'thank-you-rewards-v1';

-- Disable widget
UPDATE widget_configurations
SET is_active = false
WHERE widget_id = 'thank-you-rewards-v1';
```

---

## Hardcoded Values

### Location in Code

**Thank You Extension:**
```javascript
// File: extensions/thank-you-card/src/index.jsx
// Lines 27-28

const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Order Status Extension:**
```javascript
// File: extensions/order-status-rewards/src/index.jsx
// Lines 13-14

const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Cart Extension:**
```javascript
// File: extensions/cart-rewards/src/index.jsx
// Lines 26-27

const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### If You Need to Change Them

If you ever need to update the Supabase URL or key:

1. **Update in code** (3 files above)
2. **Redeploy extensions:**
   ```bash
   shopify app deploy
   ```
3. **Merchants don't need to do anything** (it's transparent to them)

---

## Benefits of This Approach

1. **Simpler for Merchants**
   - Just one field to configure
   - Less chance of errors
   - Faster setup

2. **Better Security**
   - Anon key is public anyway
   - No risk of merchants exposing sensitive keys
   - Centralized credential management

3. **Easier Maintenance**
   - Update credentials in one place
   - No merchant coordination needed
   - Consistent across all installations

4. **Professional Experience**
   - Merchants only see RewardHub branding
   - No technical jargon
   - Plug-and-play experience

---

## Migration from Old Setup

If merchants already have the old 3-field configuration:

1. **Extensions will work automatically**
   - Old settings are ignored
   - Hardcoded values are used instead
   - No breaking changes

2. **No Action Required**
   - Merchants don't need to reconfigure
   - Widget IDs remain the same
   - Everything continues working

3. **UI Updates on Next Edit**
   - When they next edit extension settings
   - They'll see only the Widget ID field
   - Other fields are gone

---

## Production Checklist

Before going live:

- [ ] Deploy all edge functions
- [ ] Deploy Shopify extensions
- [ ] Create default widget configurations
- [ ] Test in dev store
- [ ] Verify analytics tracking
- [ ] Check mobile responsiveness
- [ ] Test with/without customer login
- [ ] Verify error handling
- [ ] Monitor function logs
- [ ] Set up alerting

---

## Support

If merchants have issues:

1. **Verify Widget ID:**
   - Check spelling exactly
   - Confirm widget is active
   - Check start/end dates

2. **Check Extension Status:**
   - Verify deployed in Shopify
   - Confirm enabled in checkout customizer
   - Check version is latest

3. **Test Edge Functions:**
   - Verify functions are deployed
   - Check function logs for errors
   - Test with curl commands

4. **Review Analytics:**
   - Check if views are being tracked
   - Verify widget_config_id is correct
   - Monitor error rates

---

**Documentation Complete!** Merchants now have a simple, one-field configuration for all RewardHub widgets.
