# Quick Fix Summary - Houmetest Installation

## Issues Fixed

1. **"Example Domain" error** in Shopify admin
2. **Widget not appearing** on storefront
3. **Admin panel showing nothing** in Store Installations

## What You Need to Do Now

### Step 1: Re-Install App (10 seconds)

Click this link:
```
https://houmetest.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

You'll see a success page instead of "Example Domain"

### Step 2: Add Widget to Store (2 minutes)

1. Shopify Admin → Online Store → Themes → Actions → Edit code
2. Open `theme.liquid`
3. Add before `</body>`:

```html
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-render?shop=houmetest.myshopify.com';
    script.async = true;
    document.body.appendChild(script);
  })();
</script>
```

4. Save

### Step 3: Test (1 minute)

Visit `https://houmetest.myshopify.com` and look for floating widget in bottom-right corner.

## That's It!

Everything else is automatic:
- Webhooks registered
- Plugins installed
- Admin panel will show data
- Points tracking works
- Rewards system active

## Need More Details?

See `HOUMETEST_INSTALLATION_COMPLETE.md` for full documentation.
