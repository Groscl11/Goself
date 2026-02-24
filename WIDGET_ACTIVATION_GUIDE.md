# Widget Activation Guide for Shopify Stores

## Overview

After installing the RewardHub app on your Shopify store, you need to activate the loyalty widgets on your storefront. This guide explains the simple process.

---

## Quick Setup (2 Minutes)

### Method 1: Automatic Script Injection (Recommended)

The loyalty widget can be automatically injected into your theme using our JavaScript snippet.

**Step 1: Add Widget Script to Theme**

1. Go to **Shopify Admin** → **Online Store** → **Themes**
2. Click **Actions** → **Edit code**
3. Find `theme.liquid` in the Layout folder
4. Add this script **before** the closing `</body>` tag:

```html
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-render?shop={{ shop.domain }}';
    script.async = true;
    document.body.appendChild(script);
  })();
</script>
```

5. Click **Save**

**That's it!** The widget will now appear on your store.

---

### Method 2: Shopify App Extensions (Advanced)

For more control, you can install individual app extensions:

1. **Loyalty Points Widget** - Displays customer points balance
2. **Order Rewards Card** - Shows rewards on order status page
3. **Thank You Card** - Displays rewards on checkout thank you page
4. **Cart Rewards** - Shows available rewards in shopping cart

These are installed via Shopify CLI or through your app configuration.

---

## Widget Types Available

### 1. Floating Loyalty Widget

**What it does:** Shows a floating button that customers can click to:
- View their points balance
- See available rewards
- Register for loyalty program
- Track order rewards

**Where it appears:** Bottom-right corner of every page

**Customization:**
- Position (left/right, top/bottom)
- Colors (matches your brand)
- Toggle show/hide

---

### 2. Embedded Points Display

**What it does:** Shows points balance inline on specific pages

**Where it appears:**
- Account page
- Product pages
- Collection pages
- Custom pages

**Installation:** Add this liquid code where you want it to appear:

```liquid
{% if customer %}
<div id="loyalty-points-display"
     data-customer-email="{{ customer.email }}"
     data-shop="{{ shop.domain }}">
</div>
{% endif %}
```

---

### 3. Order Status Rewards

**What it does:** Displays earned rewards and points on order confirmation page

**Where it appears:** Order status page after purchase

**Installation:** This is automatically added via Shopify checkout extensions

---

### 4. Thank You Page Card

**What it does:** Shows personalized rewards and next purchase incentives

**Where it appears:** Checkout thank you page

**Installation:** Automatically enabled after app install

---

## Widget Configuration

### Access Widget Settings

1. Go to RewardHub Dashboard
2. Navigate to **Integrations** → **Shopify Widgets**
3. Select **Widget Configurations**

### Available Settings

**Display Options:**
- Show/hide floating widget
- Widget position (4 corners)
- Colors and branding
- Text customization

**Behavior:**
- Auto-popup on first visit
- Show after X seconds
- Display for returning customers only
- Hide for logged-out users

**Content:**
- Welcome message
- Points display format
- Rewards preview
- Call-to-action text

---

## Testing Your Widgets

### Test Checklist

1. **Visit your storefront** (not preview mode)
2. **Check floating widget** appears in bottom-right
3. **Click the widget** - should open loyalty panel
4. **Register as customer** using test email
5. **Make test purchase** with test payment
6. **Check order status page** - should show rewards
7. **View thank you page** - should show points earned

### Troubleshooting

**Widget not appearing?**
- Clear browser cache
- Check theme.liquid has the script
- Verify shop domain in script matches your store
- Check browser console for JavaScript errors

**Widget appearing but empty?**
- Verify store installation in Admin → Store Installations
- Check webhooks are registered
- Confirm loyalty program is active

**Points not tracking?**
- Verify Shopify webhooks are healthy
- Check Orders page in RewardHub dashboard
- Ensure customer is registered in loyalty program

---

## Customization Examples

### Example 1: Custom Colors

Access Widget Configurations and set:
```json
{
  "primaryColor": "#FF5733",
  "secondaryColor": "#C70039",
  "accentColor": "#FFC300"
}
```

### Example 2: Custom Position

Set widget position:
```json
{
  "position": "bottom-left",
  "offset": {
    "x": "20px",
    "y": "20px"
  }
}
```

### Example 3: Custom Text

Customize welcome message:
```json
{
  "welcomeText": "Welcome to our VIP Loyalty Program!",
  "ctaText": "Claim Your Rewards",
  "pointsLabel": "Reward Points"
}
```

---

## Advanced: Multiple Widgets

You can have multiple widgets on different pages:

**Product Page Widget:**
```html
<div class="loyalty-widget"
     data-widget-type="product-rewards"
     data-product-id="{{ product.id }}">
</div>
```

**Cart Page Widget:**
```html
<div class="loyalty-widget"
     data-widget-type="cart-rewards"
     data-cart-total="{{ cart.total_price }}">
</div>
```

**Account Page Widget:**
```html
<div class="loyalty-widget"
     data-widget-type="points-dashboard"
     data-customer-email="{{ customer.email }}">
</div>
```

---

## Widget API

### JavaScript API

Access widget programmatically:

```javascript
// Show widget
RewardHub.show();

// Hide widget
RewardHub.hide();

// Refresh points balance
RewardHub.refresh();

// Check if customer is registered
RewardHub.isRegistered();

// Get customer points
RewardHub.getPoints().then(points => {
  console.log('Customer has', points, 'points');
});
```

### Events

Listen to widget events:

```javascript
// Widget opened
RewardHub.on('open', () => {
  console.log('Widget opened');
});

// Customer registered
RewardHub.on('registered', (customer) => {
  console.log('New customer registered:', customer);
});

// Points updated
RewardHub.on('points-updated', (newBalance) => {
  console.log('New points balance:', newBalance);
});
```

---

## Security & Privacy

**Data Protection:**
- All data transmitted over HTTPS
- Customer data encrypted at rest
- GDPR compliant

**Performance:**
- Widget loads asynchronously (doesn't slow page load)
- < 50KB total size
- Cached for 24 hours

**Privacy:**
- No third-party tracking
- No cookies without consent
- Customer data stays in your Supabase instance

---

## Support

**Need Help?**

1. Check the troubleshooting section above
2. View logs in RewardHub Dashboard → Integrations → Store Installations
3. Contact support: [email/link]

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Widget not loading | Check script is before `</body>` |
| Points not updating | Verify webhooks are active |
| Styling conflicts | Use custom CSS overrides |
| Mobile display issues | Widget is responsive by default |

---

## Next Steps

1. **Test the widget** on your storefront
2. **Configure campaigns** to reward customers
3. **Set up loyalty tiers** for VIP treatment
4. **Create rewards** customers can redeem
5. **Monitor analytics** in dashboard

Your loyalty program is now live!
