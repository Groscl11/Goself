# CRITICAL FIX - Shopify Partners Configuration Required

## Problems Identified

1. **"Example Domain" error** - App URL not configured in Shopify Partners dashboard
2. **App embeds not working** - Need to be enabled in theme customizer

The local `shopify.app.toml` file I updated doesn't automatically sync to Shopify Partners. You need to manually update the app configuration in your Shopify Partners dashboard.

---

## Step 1: Update App Configuration in Shopify Partners

### Go to Shopify Partners Dashboard

1. Visit: https://partners.shopify.com
2. Navigate to: **Apps** → **Loyalty Bolt 2.0**
3. Click on your app to edit it

### Update App URLs

In the app configuration:

**App URL:** (Required - this fixes "Example Domain")
```
https://lizgppzyyljqbmzdytia.supabase.co/shopify-app.html
```

**Allowed redirection URL(s):** (Add if not already there)
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**App proxy URL:** (Optional - leave blank for now)
```
(leave blank)
```

### Set Distribution Settings

**Distribution:**
- [ ] Public app (listed in Shopify App Store)
- [x] Custom app (private - for specific stores)

**Embedded app:**
- [ ] Embed app in Shopify admin (uncheck this!)

Uncheck "Embed app in Shopify admin" since we're using app embeds/extensions instead of an embedded admin interface.

### Save Changes

Click **Save** at the top right.

---

## Step 2: Set Environment Variable in Supabase

### Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard
2. Navigate to your project: **lizgppzyyljqbmzdytia**
3. Go to: **Edge Functions** → **Manage secrets**

### Add APP_URL Secret

Add this secret:

**Key:**
```
APP_URL
```

**Value:**
```
https://lizgppzyyljqbmzdytia.supabase.co
```

This ensures the OAuth callback redirects to the correct URL.

---

## Step 3: Re-Install the App

After updating Shopify Partners configuration, uninstall and reinstall the app:

### Uninstall Current Installation

1. Go to Shopify Admin: https://houmetest.myshopify.com/admin/apps
2. Find "Loyalty Bolt 2.0"
3. Click **Delete** or **Uninstall**
4. Confirm deletion

### Re-Install Using OAuth Link

```
https://houmetest.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**Expected Result:**
- Should redirect to success page (not "Example Domain")
- Should NOT show localhost error

---

## Step 4: Enable App Embeds in Theme

After successful installation:

### Method 1: Theme Customizer (Easiest)

1. Go to: **Online Store** → **Themes**
2. Click **Customize** on active theme
3. Look for **App embeds** section (usually in left sidebar at bottom)
4. You should see app blocks like:
   - "Nector Loyalty & Rewards" (or similar names)
   - "RewardHub Floating Widget"
   - "Loyalty Widget"
5. **Toggle them ON**
6. Click **Save**

### Method 2: Manual Script (If App Embeds Don't Show)

If you don't see the app embeds, add manually:

1. Go to: **Online Store** → **Themes** → **Actions** → **Edit code**
2. Open `theme.liquid`
3. Add before `</body>`:

```html
<script src="https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-script?shop=houmetest.myshopify.com" async></script>
```

4. Click **Save**

---

## Step 5: Verify Everything Works

### Check 1: App Opens Without Error

1. Go to: https://houmetest.myshopify.com/admin/apps
2. Click on **Loyalty Bolt 2.0**
3. Should open success page (not "Example Domain")

### Check 2: Store Installation Recorded

1. Open your RewardHub admin dashboard
2. Go to: **Admin** → **Store Installations**
3. Should see: houmetest.myshopify.com with status "Active"

### Check 3: Widget Appears on Storefront

1. Visit: https://houmetest.myshopify.com
2. Look for floating button in bottom-right corner
3. Click it - should open loyalty panel

### Check 4: Test Registration

1. On the loyalty panel, enter test email
2. Click "Join Program"
3. Should see success message

---

## Why This Happened

### Local vs Remote Configuration

The `shopify.app.toml` file is just a **local configuration** used by Shopify CLI for development. It does NOT automatically sync with Shopify Partners.

You need to manually configure:
- **Shopify Partners Dashboard** - For production app settings
- **Supabase Environment Variables** - For edge function secrets
- **Theme Customizer** - For enabling app embeds

### Embedded vs Non-Embedded Apps

**Embedded apps** load inside Shopify admin in an iframe. This requires:
- Shopify App Bridge integration
- Special authentication handling
- Complex setup

**Non-embedded apps** (what we're using) just redirect to external URLs and use app embeds for storefront integration. This is:
- Simpler to setup
- More flexible
- Better for extension-based apps

---

## Troubleshooting

### Still Seeing "Example Domain"?

**Check:**
1. Did you update App URL in Shopify Partners?
2. Did you save changes in Shopify Partners?
3. Did you uninstall and reinstall the app?
4. Did you set embedded = false in Shopify Partners?

**Try:**
1. Clear browser cache
2. Try incognito window
3. Wait 5 minutes for Shopify to update
4. Check Shopify Partners for validation errors

### App Embeds Not Showing?

**Check:**
1. App is installed on the store
2. Theme customizer → App embeds section
3. Scroll to bottom of left sidebar in customizer
4. Look for app name variations

**Try:**
1. Search for "loyalty", "reward", "nector"
2. Check if toggles are ON but hidden
3. Use manual script method instead

### Widget Not Appearing on Store?

**Check:**
1. App embeds are toggled ON
2. Saved in theme customizer
3. Viewing actual storefront (not preview)
4. Not blocking JavaScript

**Try:**
1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Incognito window
3. Different browser
4. Check browser console for errors

---

## Summary of Required Actions

- [ ] Update App URL in Shopify Partners to: `https://lizgppzyyljqbmzdytia.supabase.co/shopify-app.html`
- [ ] Add redirect URL in Shopify Partners: `https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback`
- [ ] Uncheck "Embed app in Shopify admin" in Shopify Partners
- [ ] Save changes in Shopify Partners
- [ ] Add APP_URL secret in Supabase: `https://lizgppzyyljqbmzdytia.supabase.co`
- [ ] Uninstall current app installation
- [ ] Reinstall app using OAuth link
- [ ] Enable app embeds in theme customizer OR add manual script
- [ ] Test widget on storefront
- [ ] Verify installation in admin dashboard

---

## After Completing These Steps

You should have:
- ✅ App opens without "Example Domain" error
- ✅ Store installation recorded in database
- ✅ Floating widget visible on storefront
- ✅ Customer registration working
- ✅ Points tracking active
- ✅ Webhooks registered and healthy

---

## Need Help?

If you're still having issues after following these steps:

1. Check Shopify Partners app dashboard for validation errors
2. Check Supabase Edge Function logs for OAuth callback errors
3. Check browser console for JavaScript errors on storefront
4. Verify all secrets are set correctly in Supabase

The key issue is that Shopify Partners dashboard needs to be manually configured - the local files alone aren't enough!
