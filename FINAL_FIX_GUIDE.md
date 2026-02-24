# Final Fix Guide - Get App Working in 10 Minutes

## What I Fixed

1. **Created edge function for app page** - `shopify-app` edge function now serves the HTML
2. **Updated OAuth callback** - Redirects to edge function URL instead of static file
3. **Created app embed extension** - New extension that will appear in theme customizer
4. **Updated configuration** - All URLs now point to edge functions

## What You Need to Do

The local files don't automatically sync to Shopify Partners. You need to update 3 things manually:

---

## Step 1: Update Shopify Partners Dashboard (5 min)

### Go to Partners Dashboard
https://partners.shopify.com → Apps → Loyalty Bolt 2.0

### Update App URL
**Change from:**
```
https://lizgppzyyljqbmzdytia.supabase.co/shopify-app.html
```

**Change to:**
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-app
```

### Verify Redirect URL
Make sure this is set:
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

### Set App Type
- **Embedded:** UNCHECK (must be unchecked!)
- **Distribution:** Custom/Private app

### Click Save

---

## Step 2: Set Supabase Secrets (2 min)

### Go to Supabase Dashboard
https://supabase.com/dashboard → Project Settings → Edge Functions

### Add These Secrets (if not already set)

**SHOPIFY_API_KEY:**
```
0341c8495ce44f2a98b3ac0d43fce5bc
```

**SHOPIFY_API_SECRET:**
```
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
```

**APP_URL:**
```
https://lizgppzyyljqbmzdytia.supabase.co
```

---

## Step 3: Reinstall the App (3 min)

### Uninstall Current Installation

1. Go to: https://houmetest.myshopify.com/admin/apps
2. Find "Loyalty Bolt 2.0"
3. Click settings/menu → Delete app
4. Confirm deletion

### Reinstall Using OAuth Link

Click this link (or paste in browser):

```
https://houmetest.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**Expected result:**
- Should redirect to success page (NOT "Example Domain" error)
- Should show store name and next steps

### Enable App Embed

After successful installation:

1. Go to: **Online Store → Themes → Customize**
2. Scroll down in left sidebar to **App embeds** section
3. Find "Loyalty Bolt Widget"
4. Toggle it **ON**
5. Click **Save**

---

## Step 4: Verify Everything Works

### Check 1: App Opens Successfully
- Go to: https://houmetest.myshopify.com/admin/apps
- Click "Loyalty Bolt 2.0"
- Should see success page with instructions

### Check 2: Widget Appears on Store
- Visit: https://houmetest.myshopify.com
- Look for floating button in bottom-right corner
- Click it - should open loyalty panel

### Check 3: Customer Registration Works
- In loyalty panel, enter test email
- Click "Join Program"
- Should see success message

### Check 4: Admin Dashboard Shows Store
- Open: https://lizgppzyyljqbmzdytia.supabase.co
- Login as admin
- Go to: Admin → Store Installations
- Should see: houmetest.myshopify.com with status "Active"

---

## Why the Error Happened

### "Example Domain" Error

This error happens when Shopify tries to load the app URL configured in Partners dashboard, but the URL is invalid or returns an error.

**Root cause:** Supabase doesn't serve static HTML files from `/public/` folder. You can't use:
```
https://lizgppzyyljqbmzdytia.supabase.co/shopify-app.html ❌
```

**Solution:** Use an edge function to serve the HTML:
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-app ✅
```

### "No App Embeds" Issue

App embeds only appear in theme customizer if:
1. The app is installed successfully
2. The app has theme extensions configured
3. The extensions are properly structured with `app_embed` type

**What I created:**
- New `loyalty-app-embed` extension
- Proper `shopify.extension.toml` configuration
- Widget loader JavaScript

**Where it appears:**
- Theme Customizer → App embeds section (bottom of left sidebar)
- Shows as "Loyalty Bolt Widget" with ON/OFF toggle

---

## If App Embeds Still Don't Appear

### Option 1: Wait and Refresh

Sometimes Shopify takes a few minutes to detect app extensions:
1. Wait 5 minutes after installation
2. Hard refresh theme customizer (Ctrl+Shift+R)
3. Try opening in incognito mode

### Option 2: Manual Script Installation

If app embeds never appear, manually add widget:

1. Go to: **Online Store → Themes → Actions → Edit code**
2. Open `theme.liquid` file
3. Find the closing `</body>` tag
4. Add this right before it:

```liquid
<script src="https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-script?shop={{ shop.permanent_domain }}" async></script>
```

5. Click **Save**

This loads the widget directly without needing the app embed toggle.

---

## What's Deployed and Ready

### Edge Functions Deployed:
- ✅ `shopify-app` - Serves app installation success page
- ✅ `shopify-oauth-callback` - Handles OAuth and creates store installation
- ✅ `widget-script` - Loads widget on storefront
- ✅ `get-loyalty-status` - API for checking customer loyalty status
- ✅ `register-loyalty-member` - API for customer registration
- ✅ All other loyalty/rewards functions

### Extensions Created:
- ✅ `loyalty-app-embed` - App embed for theme customizer
- ✅ `floating-widget` - Alternative theme block
- ✅ `announcement-bar` - Announcement bar block
- ✅ `product-banner` - Product page banner
- ✅ `cart-rewards` - Cart page widget
- ✅ `thank-you-card` - Thank you page card

### Database Ready:
- ✅ All tables created with RLS policies
- ✅ Store installations tracking
- ✅ Webhooks registration
- ✅ Loyalty points system
- ✅ Campaign management
- ✅ Rewards catalog

---

## Testing Checklist

After completing all steps above:

- [ ] App URL updated in Shopify Partners
- [ ] Redirect URL confirmed in Shopify Partners
- [ ] "Embedded" checkbox unchecked in Shopify Partners
- [ ] All secrets set in Supabase
- [ ] Old app installation deleted
- [ ] New app installed via OAuth link
- [ ] Success page loads (not "Example Domain")
- [ ] Store installation recorded in database
- [ ] App embed toggled ON in theme customizer
- [ ] Widget visible on storefront
- [ ] Customer can register for loyalty program
- [ ] Points are tracked on orders
- [ ] Admin dashboard shows store data

---

## Need Help?

### Check Logs

**Supabase Edge Function Logs:**
https://supabase.com/dashboard → Edge Functions → Logs

**Shopify Webhook Status:**
Admin Dashboard → Store Installations → Select store → View webhooks

### Common Issues

**"Example Domain" still showing:**
- Clear browser cache
- Wait 5 minutes for Shopify to update
- Verify app URL in Partners dashboard exactly matches
- Check Supabase edge function logs for errors

**App embed not appearing:**
- Confirm app is installed (not just connected to OAuth)
- Try different browser
- Check if other apps' embeds show up
- Use manual script method instead

**Widget not loading:**
- Check browser console for JavaScript errors
- Verify widget-script edge function is deployed
- Try manual script installation method
- Check if Supabase edge functions are accessible

---

## Support

If you're still having issues after following all steps:

1. Check Supabase edge function logs for specific errors
2. Verify all secrets are set correctly in Supabase
3. Test OAuth callback URL directly in browser
4. Check Shopify Partners dashboard for any validation warnings

The app is fully deployed and ready - it just needs the Shopify Partners configuration updated to match!
