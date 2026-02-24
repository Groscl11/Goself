# Widget System Quick Start Guide
## Deploy Once, Configure Forever

---

## What You Get

A fully configurable widget system where:
- **Extensions deployed once** via Shopify CLI
- **Everything configured** through your dashboard
- **Just enter Widget IDs** in Shopify admin
- **No code changes** for updates

---

## Quick Setup (3 Steps)

### 1. Deploy Edge Functions

```bash
supabase functions deploy get-widget-config
supabase functions deploy track-widget-event
supabase functions deploy get-order-rewards
```

### 2. Deploy Shopify Extensions

```bash
# Install dependencies
cd extensions/thank-you-card && npm install && cd ../..
cd extensions/order-status-rewards && npm install && cd ../..

# Deploy to Shopify
shopify app deploy
```

### 3. Configure in Your Dashboard

1. Login to client dashboard
2. Go to: **Widget Configurations**
3. Click: **New Widget**
4. Fill in:
   - Widget ID: `thank-you-rewards-v1`
   - Widget Type: Select type
   - Colors, text, behavior
5. Save

---

## Using Widgets in Shopify

### In Shopify Admin:

1. Go to: **Settings > Checkout > Customize**
2. Select: **Order Status page**
3. Click: **Customize**
4. Find your extension in sidebar
5. Drag to page
6. Configure (3 settings only):
   - **Widget ID:** `thank-you-rewards-v1`
   - **Supabase URL:** `https://xxxxx.supabase.co`
   - **Anon Key:** Your public key
7. Save

That's it! Extension now pulls all config from database.

---

## Widget Configuration Structure

```json
{
  "widget_id": "thank-you-rewards-v1",  // What you enter in Shopify
  "widget_type": "thank-you",

  // Visual styling (customize via dashboard)
  "styles": {
    "primaryColor": "#2563eb",
    "secondaryColor": "#10b981"
  },

  // Text content (customize via dashboard)
  "content": {
    "title": "Congratulations! You've earned rewards!",
    "description": "Thank you for your purchase!",
    "buttonText": "View My Rewards",
    "subtitle": "Click below to claim"
  },

  // Behavior (customize via dashboard)
  "config": {
    "showRewards": true,
    "autoExpand": false
  }
}
```

---

## Available Widget Types

1. **Thank You Page** (`thank-you`)
   - Shows on Order Status page
   - Target: `purchase.thank-you.block.render`

2. **Order Status** (`order-status`)
   - Shows on Order Status page
   - Target: `purchase.order-status.block.render`

3. **Cart** (`cart`)
   - Shows in cart
   - Target: TBD

4. **Product** (`product`)
   - Shows on product pages
   - Target: TBD

---

## Updating Widgets

### Change Colors, Text, Behavior

**NO REDEPLOYMENT NEEDED!**

1. Go to: **Client Dashboard > Widget Configurations**
2. Click: **Edit** on your widget
3. Change anything you want
4. Click: **Save**

Changes are **live immediately**. No CLI commands needed.

### When You NEED CLI

Only for:
- Adding completely new extension types
- Changing extension targets
- Major functionality changes

---

## Analytics

Automatic tracking for:
- **Views:** Widget displayed
- **Clicks:** Button clicked
- **Conversions:** Reward redeemed

View in:
- **Widget Configurations page** (shows metrics per widget)
- **Database:** `widget_analytics` table

---

## File Structure

```
extensions/
├── thank-you-card/
│   ├── src/index.jsx              # Extension code
│   ├── shopify.ui.extension.toml  # Config with settings
│   └── package.json
└── order-status-rewards/
    ├── src/index.jsx
    ├── shopify.ui.extension.toml
    └── package.json

supabase/functions/
├── get-widget-config/             # Fetches config from DB
├── track-widget-event/            # Tracks analytics
└── get-order-rewards/             # Fetches rewards

Database:
├── widget_configurations          # All widget configs
├── widget_analytics               # Tracking data
└── widget_templates               # Default templates
```

---

## Common Tasks

### Create New Widget Config

**Via Dashboard:**
1. Widget Configurations > New Widget
2. Fill form > Save

**Via SQL:**
```sql
INSERT INTO widget_configurations (
  client_id, widget_id, widget_type, name,
  styles, content, is_active
) VALUES (
  'client-id',
  'my-widget-v1',
  'thank-you',
  'My Widget',
  '{"primaryColor":"#2563eb"}',
  '{"title":"Hello!"}',
  true
);
```

### Update Widget Colors

**Via Dashboard:**
Widget Configurations > Edit > Change colors > Save

**Via SQL:**
```sql
UPDATE widget_configurations
SET styles = '{"primaryColor":"#10b981"}'
WHERE widget_id = 'my-widget-v1';
```

### Disable Widget

**Via Dashboard:**
Widget Configurations > Click eye icon

**Via SQL:**
```sql
UPDATE widget_configurations
SET is_active = false
WHERE widget_id = 'my-widget-v1';
```

### Schedule Widget

**Via SQL:**
```sql
UPDATE widget_configurations
SET
  start_date = '2024-07-01',
  end_date = '2024-07-31'
WHERE widget_id = 'my-widget-v1';
```

---

## Testing

### Test Extension Locally

```bash
cd extensions/thank-you-card
shopify app dev
```

### Test in Dev Store

1. Place test order
2. Go to Order Status page
3. Check if extension appears
4. Open browser console (F12)
5. Verify no errors
6. Check Network tab for API calls

### Verify Config Loaded

In database:
```sql
-- Check widget config
SELECT * FROM widget_configurations
WHERE widget_id = 'your-widget-id';

-- Check analytics
SELECT * FROM widget_analytics
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Widget Not Showing

1. **Check if active:**
   ```sql
   SELECT is_active FROM widget_configurations
   WHERE widget_id = 'your-id';
   ```

2. **Check Shopify settings:**
   - Settings > Checkout > Customize
   - Verify extension added and configured

3. **Check browser console** for errors

### Config Not Loading

1. **Test edge function:**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/get-widget-config \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_KEY" \
     -d '{"widget_id":"your-id","shop_domain":"shop.myshopify.com"}'
   ```

2. **Check database:**
   ```sql
   SELECT * FROM get_widget_config('your-id', 'shop.myshopify.com');
   ```

---

## Key Benefits

### For Developers:
- ✅ Deploy once
- ✅ No code changes for updates
- ✅ Version control stays clean
- ✅ Easy to maintain

### For Business:
- ✅ Change colors/text instantly
- ✅ A/B test variations
- ✅ Schedule campaigns
- ✅ Track performance
- ✅ No developer needed for changes

### For Users:
- ✅ Consistent experience
- ✅ Fast loading
- ✅ Shopify native
- ✅ Mobile optimized

---

## Next Steps

1. **Deploy functions:** `supabase functions deploy get-widget-config`
2. **Deploy extensions:** `shopify app deploy`
3. **Create widget config:** Via dashboard
4. **Configure in Shopify:** Add extension + enter Widget ID
5. **Test:** Place order and verify

---

## Documentation Links

- **Full CLI Guide:** [SHOPIFY_EXTENSIONS_CLI_GUIDE.md](./SHOPIFY_EXTENSIONS_CLI_GUIDE.md)
- **Order Status Setup:** [ORDER_STATUS_REWARDS_GUIDE.md](./ORDER_STATUS_REWARDS_GUIDE.md)
- **Widget Script:** [WIDGET_SCRIPT_INSTALLATION_GUIDE.md](./WIDGET_SCRIPT_INSTALLATION_GUIDE.md)

---

## Support

**Need help?**
- Check troubleshooting section above
- Review full CLI guide
- Check Supabase function logs
- Verify RLS policies

---

**Remember:** You only need CLI for initial deployment. Everything else is dashboard-configurable!
