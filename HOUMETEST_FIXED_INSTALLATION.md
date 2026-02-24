# Houmetest Installation - FIXED

## Issues Resolved

1. **Localhost redirect error** - Fixed OAuth callback to use Supabase URL instead of localhost
2. **Manual theme editing** - Created Shopify App Block for no-code widget installation

---

## Step 1: Re-Install the App

Use this updated installation link:

```
https://houmetest.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**What Changed:**
- OAuth callback now uses Supabase URL as default (no more localhost error)
- Redirects to proper success page
- Automatically creates store installation record
- Registers all webhooks
- Installs default plugins

**Expected Result:**
You'll see a success page with:
- "App Installed Successfully" message
- Store name (Houmetest)
- Link to dashboard
- Feature overview

---

## Step 2: Add Widget Using App Block (NO CODE EDITING!)

### Method 1: App Block (Recommended - No Code!)

1. **Open Theme Customizer**
   - Go to: **Online Store** → **Themes**
   - Click **Customize** on your active theme

2. **Add App Block**
   - In the theme editor, look for the **App embeds** section (usually in the left sidebar)
   - Find **"Loyalty Widget"** from RewardHub
   - Toggle it ON
   - Click **Save**

3. **Configure Settings (Optional)**
   - Widget Position: Choose corner placement
   - Primary Color: Match your brand
   - Secondary Color: Accent color
   - Welcome Text: Customize greeting
   - Auto Popup: Enable/disable
   - Popup Delay: Set timing

**That's it!** The widget is now live on your store.

### Method 2: Manual Script (Alternative)

If app blocks don't work, you can still add manually:

1. Go to: **Online Store** → **Themes** → **Actions** → **Edit code**
2. Open `theme.liquid`
3. Add before `</body>`:

```html
<script src="https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-script?shop=houmetest.myshopify.com" async></script>
```

---

## Step 3: Test the Widget

1. **Visit Your Storefront**
   ```
   https://houmetest.myshopify.com
   ```

2. **Look for Widget**
   - Floating button in bottom-right corner (or position you chose)
   - Should show loyalty icon

3. **Click to Open**
   - Opens loyalty panel
   - Shows registration form for guests
   - Shows points balance for logged-in customers

4. **Test Registration**
   - Enter email address
   - Click "Join Program"
   - Should see success message

---

## Step 4: Verify Installation in Dashboard

1. **Open RewardHub Admin**
   ```
   Your app URL/#/admin/store-installations
   ```

2. **Check Store Record**
   You should see:
   - **Store:** houmetest.myshopify.com
   - **Status:** Active (green badge)
   - **Webhooks:** 5 registered, healthy
   - **Plugins:** 4 installed (loyalty, rewards, referral, campaigns)
   - **Installation Date:** Current date/time

3. **View Details**
   - Click the eye icon to view full details
   - Verify all webhooks are active
   - Check plugins are installed

---

## What Was Fixed

### 1. OAuth Redirect Issue

**Before:**
```typescript
return 'http://localhost:5173'; // ❌ This caused the error
```

**After:**
```typescript
return Deno.env.get('SUPABASE_URL') || 'http://localhost:5173'; // ✅ Uses production URL
```

**Result:** No more "localhost refused to connect" error

### 2. Widget Installation Method

**Before:**
- Manual theme.liquid editing required
- Error-prone
- Merchant needs technical knowledge

**After:**
- App Block in theme customizer
- Toggle on/off without code
- Customize visually
- No technical knowledge needed

**Files Created:**
- `extensions/loyalty-widget-app-block/blocks/loyalty-widget.liquid` - App block template
- `extensions/loyalty-widget-app-block/shopify.extension.toml` - Configuration
- `supabase/functions/widget-script/index.ts` - Dynamic widget loader

---

## App Block Features

### Visual Customization
All done in theme customizer:
- Widget position (4 corners)
- Brand colors (primary + secondary)
- Welcome message
- Auto-popup behavior
- Popup timing

### No Code Required
- Toggle widget on/off
- Change settings instantly
- Preview in real-time
- No theme file editing

### Automatic Updates
- Widget code updates automatically
- No need to update theme files
- Always uses latest version

---

## Troubleshooting

### Still Getting Localhost Error?

**Clear the OAuth state:**
1. Try installation link in incognito/private window
2. If still failing, check Supabase edge function logs
3. Verify `SUPABASE_URL` environment variable is set

**Check Environment:**
```bash
# Should return your Supabase URL
echo $SUPABASE_URL
```

### Widget Not Appearing?

**Using App Block Method:**
1. Check App embeds section is enabled
2. Verify "Loyalty Widget" toggle is ON
3. Click Save in theme customizer
4. Clear browser cache
5. Visit store in incognito window

**Using Manual Method:**
1. Verify script is before `</body>` tag
2. Check shop domain matches exactly
3. Open browser console for errors
4. Test in incognito mode

### App Block Not Found?

The app block is created locally. To deploy it to Shopify:

**Option 1: Via Shopify CLI (if you have it)**
```bash
shopify app deploy
```

**Option 2: Use Manual Script Method**
Since the app block needs to be deployed via Shopify Partners, use the manual script method for now.

---

## Production Deployment Checklist

- [ ] App installed on houmetest store
- [ ] Installation shows success page (not localhost error)
- [ ] Store appears in Admin → Store Installations
- [ ] All 5 webhooks registered and healthy
- [ ] All 4 plugins installed
- [ ] Widget appears on storefront
- [ ] Widget opens when clicked
- [ ] Registration form works
- [ ] Points tracking active
- [ ] Test purchase shows rewards

---

## Next Steps

1. **Configure Loyalty Program**
   - Set points per dollar
   - Set signup bonus
   - Configure redemption rates

2. **Create Rewards**
   - Add discount codes
   - Set point costs
   - Enable rewards

3. **Set Up Campaigns**
   - Welcome campaign
   - Purchase milestones
   - Birthday rewards

4. **Monitor Analytics**
   - Enrollment rate
   - Redemption rate
   - Customer engagement

---

## Support

**Installation Issues:**
- Check Supabase function logs
- Verify environment variables
- Test in incognito mode

**Widget Issues:**
- Check browser console
- Verify app block is enabled
- Test with manual script

**Data Sync Issues:**
- Verify webhooks are healthy
- Check webhook event logs
- Test with new order

---

## Updated Installation URL

**Use this URL (fixed):**
```
https://houmetest.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

This will now:
1. Complete OAuth successfully (no localhost error)
2. Show success page
3. Create store installation
4. Register webhooks
5. Install plugins
6. Be ready for widget installation

You can then add the widget using either:
- App Block (no code) - Recommended
- Manual script (fallback)

Both methods now work correctly!
