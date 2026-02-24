# Quick Fix - 3 Steps to Get Widget Working

## The Root Cause

The "Example Domain" error and missing app embeds are caused by **Shopify Partners dashboard not being configured**. The local files I updated don't automatically sync to Shopify.

---

## Step 1: Configure Shopify Partners (5 minutes)

### Go to Shopify Partners
https://partners.shopify.com → Apps → Loyalty Bolt 2.0

### Update These Settings:

**App URL:**
```
https://lizgppzyyljqbmzdytia.supabase.co/shopify-app.html
```

**Allowed redirection URL(s):**
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**Embedded app:**
- [x] UNCHECK "Embed app in Shopify admin"

### Save Changes

---

## Step 2: Set Supabase Secret (2 minutes)

### Go to Supabase Dashboard
https://supabase.com/dashboard → Your Project → Edge Functions → Manage secrets

### Add Secret:

**Key:** `APP_URL`

**Value:** `https://lizgppzyyljqbmzdytia.supabase.co`

---

## Step 3: Reinstall & Enable (3 minutes)

### Uninstall App
https://houmetest.myshopify.com/admin/apps → Delete "Loyalty Bolt 2.0"

### Reinstall App
Click this link:
```
https://houmetest.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

### Enable App Embeds
**Option A:** Go to Online Store → Themes → Customize → App embeds → Toggle ON → Save

**Option B:** Add to theme.liquid before </body>:
```html
<script src="https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-script?shop=houmetest.myshopify.com" async></script>
```

---

## What You'll See After

✅ App opens without "Example Domain" error

✅ Floating widget on storefront

✅ Store shows in admin dashboard

✅ Customers can register and earn points

---

## Full Details

See: `CRITICAL_FIX_SHOPIFY_PARTNERS.md` for complete instructions and troubleshooting.

---

## Files Updated

- `shopify.app.toml` - Local config (reference only)
- `public/shopify-app.html` - Success page with instructions
- `supabase/functions/shopify-oauth-callback/` - OAuth flow
- `supabase/functions/widget-script/` - Widget loader
- `extensions/loyalty-widget-app-block/` - App block for theme

All deployed and ready!
