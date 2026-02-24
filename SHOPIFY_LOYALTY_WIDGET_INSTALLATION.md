# Shopify Loyalty Widget - Installation & Deployment Guide

## Overview

This guide will help you deploy the RewardHub Loyalty Widget to Shopify stores. The widget displays a floating button that opens a panel showing:

- Customer's loyalty points balance
- Tier progress and level
- Transaction history
- Ways to earn points
- Ways to redeem points for rewards

Similar to: Nector.io, Smile.io, Yotpo loyalty widgets.

---

## Quick Start - One-Click Installation

### For Store Owners

**Installation URL:**
```
https://YOUR_STORE.myshopify.com/admin/oauth/authorize?client_id=YOUR_SHOPIFY_API_KEY&scope=read_orders,write_customers,read_customers,write_discounts&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback&state=BASE64_ENCODED_STATE
```

**What Happens When You Click:**
1. Redirected to Shopify OAuth approval screen
2. Click "Install App"
3. Automatically redirected back to RewardHub
4. Store registered in system
5. Webhooks configured automatically
6. Loyalty widget enabled on your store
7. Ready to use immediately!

**All done in < 30 seconds!**

---

## Deployment Options

### Option 1: Theme App Extension (Recommended)

Best for:
- Professional deployments
- Multiple store installations
- Easy merchant control
- Theme 2.0+ stores

#### Prerequisites
```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Verify installation
shopify version
```

#### Deploy Steps

1. **Navigate to Extension**
```bash
cd /path/to/project/extensions/loyalty-widget
```

2. **Login to Shopify Partners**
```bash
shopify auth login
```

3. **Link to Your App**
```bash
shopify app config link
```

4. **Deploy Extension**
```bash
shopify app deploy
```

5. **Publish Extension**
- Go to Shopify Partners Dashboard
- Find your app
- Go to "Extensions" tab
- Click "Create version"
- Publish the extension

#### Store Owner Enables Widget

After installation, store owners can:

1. Go to **Shopify Admin → Online Store → Themes**
2. Click **Customize**
3. Click **Add app block** in the theme editor
4. Select **"Loyalty Rewards Widget"**
5. Drag to desired location
6. Configure settings:
   - Button position
   - Colors
   - Points name
   - Enable/disable features

**Widget appears immediately on storefront!**

---

### Option 2: Embedded Script Tag

Best for:
- Quick testing
- Stores without theme access
- Temporary installations

#### Automatic Installation (Recommended)

Your OAuth callback can automatically inject the script tag:

**Add to `shopify-oauth-callback/index.ts`:**
```typescript
// After successful OAuth, register script tag
const scriptTag = await fetch(`https://${shop}/admin/api/2024-01/script_tags.json`, {
  method: 'POST',
  headers: {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    script_tag: {
      event: 'onload',
      src: 'https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-render?type=loyalty'
    }
  })
});
```

#### Manual Installation

Store owner adds to theme:

1. Go to **Shopify Admin → Online Store → Themes**
2. Click **Actions → Edit code**
3. Open **theme.liquid**
4. Add before `</body>`:

```html
<script src="https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-render?type=loyalty" async></script>
```

5. **Save**

Widget appears on all pages!

---

### Option 3: Direct Theme Code

Best for:
- Full control
- Custom modifications
- Advanced customization

#### Steps

1. **Go to Theme Editor**
   - Shopify Admin → Online Store → Themes
   - Actions → Edit code

2. **Create New Snippet**
   - Snippets → Add a new snippet
   - Name: `rewardhub-loyalty-widget`
   - Paste content from `extensions/loyalty-widget/blocks/loyalty-widget.liquid`
   - Save

3. **Include in Theme**
   - Open `theme.liquid`
   - Add before `</body>`:
   ```liquid
   {% render 'rewardhub-loyalty-widget' %}
   ```

4. **Configure Settings**
   - Edit snippet to set:
     - Button position
     - Colors
     - Points name
     - Features

5. **Save & Preview**

---

## Creating One-Click Installation Link

### Step 1: Get Your Shopify API Credentials

1. Go to [Shopify Partners](https://partners.shopify.com)
2. Apps → Select your app
3. Copy **Client ID** (API Key)

### Step 2: Build Installation URL

```
https://STORE.myshopify.com/admin/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &scope=read_orders,write_customers,read_customers,write_discounts
  &redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
  &state=BASE64_STATE
```

### Step 3: Encode State Parameter

State should contain:
```javascript
const state = btoa(JSON.stringify({
  app_url: 'https://your-app.com',
  return_to: '/client/integrations',
  widget_type: 'loyalty'
}));
```

### Step 4: Complete URL Example

```
https://store.myshopify.com/admin/oauth/authorize?client_id=abc123def456&scope=read_orders,write_customers,read_customers,write_discounts&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback&state=eyJhcHBfdXJsIjoiaHR0cHM6Ly95b3VyLWFwcC5jb20ifQ==
```

### Step 5: Share Link

Send this link to store owners via:
- Email campaigns
- Landing page
- Shopify App Store listing
- Marketing materials

**They click → Install → Done!**

---

## Auto-Installation Flow

When merchant clicks installation link:

```
1. Merchant clicks link
   ↓
2. Redirected to Shopify OAuth
   ↓
3. Merchant approves permissions
   ↓
4. Shopify redirects to your callback
   ↓
5. Your callback function:
   - Exchanges code for access token
   - Fetches store details
   - Creates client in database
   - Registers store installation
   - Registers webhooks
   - Installs default plugins
   - Creates master admin user
   - (Optional) Injects widget script tag
   ↓
6. Merchant redirected back to app
   ↓
7. Widget live on their store!
```

**Total time: < 30 seconds**

---

## Widget Configuration

### Available Settings

```javascript
{
  show_floating_button: true,        // Show/hide button
  button_position: 'bottom-right',   // Button position
  primary_color: '#3B82F6',         // Main brand color
  accent_color: '#10B981',          // Accent color
  points_name: 'Rewards Points',    // Points display name
  auto_redeem: false                // Auto-redeem toggle
}
```

### Button Positions
- `bottom-right` (default)
- `bottom-left`
- `top-right`
- `top-left`

### Color Customization

Widget automatically uses configured colors for:
- Floating button background
- Panel header gradient
- Points balance display
- Earned points color
- Action buttons
- Progress bars

### Custom Branding

Edit the widget footer:
```html
<div class="rewardhub-footer">
  <span>Powered by <strong>YourBrand</strong></span>
</div>
```

---

## Backend Integration

### Required Edge Functions

The widget calls these APIs:

#### 1. Get Loyalty Status
```
GET /functions/v1/get-loyalty-status
?email=customer@example.com
&shop=store.myshopify.com
```

Returns customer's points, tier, and transactions.

#### 2. Get Customer Rewards
```
POST /functions/v1/get-customer-rewards
{
  "customer_email": "customer@example.com",
  "shop_domain": "store.myshopify.com"
}
```

Returns available rewards for redemption.

#### 3. Redeem Loyalty Points
```
POST /functions/v1/redeem-loyalty-points
{
  "email": "customer@example.com",
  "shop": "store.myshopify.com",
  "reward_id": "...",
  "points": 500
}
```

Processes point redemption and generates discount code.

### Webhook Integration

Widget relies on these webhooks:
- `orders/create` - Award points on purchase
- `orders/paid` - Confirm points earned
- `customers/create` - Auto-enroll new customers

Make sure webhooks are registered (done automatically during OAuth).

---

## Testing the Widget

### Test Store Setup

1. **Create Development Store**
   - Shopify Partners → Stores → Add store
   - Use for testing

2. **Install Widget**
   - Use OAuth URL with test store
   - Or manually add code

3. **Create Test Customer**
   - Shopify Admin → Customers → Add customer
   - Email: test@example.com
   - Password: testpass123

4. **Award Test Points**
```sql
-- In Supabase SQL Editor
INSERT INTO loyalty_points_transactions (
  member_loyalty_status_id,
  points_change,
  transaction_type,
  description
) VALUES (
  'member_status_id',
  1000,
  'adjustment',
  'Test points'
);
```

5. **Test Widget**
   - Visit store as customer
   - Click floating button
   - Verify points display
   - Test redemption

### Verification Checklist

- [ ] Widget appears on all pages
- [ ] Button positioned correctly
- [ ] Colors match settings
- [ ] Customer can login
- [ ] Points balance displays
- [ ] Transactions show
- [ ] Rewards load
- [ ] Redemption works
- [ ] Mobile responsive
- [ ] No console errors

---

## Customization Examples

### Change Widget Position

```javascript
// Edit in loyalty-widget.liquid
const position = {
  right: '20px',    // Distance from right
  bottom: '20px',   // Distance from bottom
  left: 'auto',     // Or set left instead of right
  top: 'auto'       // Or set top instead of bottom
};
```

### Add Custom Earn Actions

```html
<div class="earn-item">
  <div class="earn-icon">🎉</div>
  <div class="earn-info">
    <h5>Leave a Review</h5>
    <p>Earn <strong>200</strong> points</p>
  </div>
  <button class="earn-btn" onclick="handleReviewClick()">
    Write Review
  </button>
</div>
```

### Translate to Another Language

Replace all text strings:
```javascript
const translations = {
  welcome: "Gracias por unirte!",
  points: "Puntos",
  history: "Historial",
  earn: "Ganar",
  redeem: "Canjear",
  // ... more translations
};
```

### Custom Animations

```css
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.rewardhub-panel {
  animation: slideIn 0.3s ease-out;
}
```

---

## Troubleshooting

### Widget Not Appearing

**Issue:** Floating button doesn't show

**Solutions:**
1. Check `show_floating_button` setting is `true`
2. Verify widget code is in theme
3. Check z-index conflicts with other elements
4. Clear browser cache
5. Check console for JavaScript errors

### Data Not Loading

**Issue:** Widget opens but shows loading spinner

**Solutions:**
1. Verify customer is logged in to Shopify
2. Check API endpoint URLs are correct
3. Ensure customer has loyalty account
4. Check network tab - API calls returning 200?
5. Verify CORS headers on edge functions

### Points Not Updating

**Issue:** Points balance is wrong or outdated

**Solutions:**
1. Refresh page
2. Check webhooks are firing
3. Verify orders are marked as "paid"
4. Check loyalty_points_transactions table
5. Ensure webhook endpoints are accessible

### Redemption Failing

**Issue:** "Redeem Now" button doesn't work

**Solutions:**
1. Verify customer has enough points
2. Check reward is active
3. Ensure redeem-loyalty-points function is deployed
4. Check function logs in Supabase
5. Verify discount code generation working

### Mobile Issues

**Issue:** Widget looks wrong on mobile

**Solutions:**
1. Check viewport meta tag in theme
2. Verify responsive CSS is included
3. Test on actual devices, not just emulator
4. Check for conflicting mobile styles
5. Reduce widget size for mobile screens

---

## Performance Optimization

### Lazy Loading

Widget only loads data when opened:
```javascript
if (!isVisible && customerEmail) {
  loadCustomerData(); // Only load when panel opens
}
```

### Caching

Implement client-side caching:
```javascript
const cache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000 // 5 minutes
};

function getCachedData() {
  if (cache.data && Date.now() - cache.timestamp < cache.ttl) {
    return cache.data;
  }
  return null;
}
```

### Minimize Bundle Size

- No external dependencies
- Inline SVG icons
- Compressed CSS
- Minified JavaScript

### CDN Delivery

Serve widget from CDN:
```html
<script src="https://cdn.yoursite.com/loyalty-widget.min.js"></script>
```

---

## Security Considerations

### Customer Data

- Widget only shows logged-in customer's data
- Email verification required
- No sensitive data exposed
- HTTPS only

### API Security

- CORS properly configured
- Webhook HMAC verification
- Rate limiting on endpoints
- Input sanitization

### XSS Protection

```javascript
// Always escape user data
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

## Monitoring & Analytics

### Track Widget Usage

```javascript
// Track widget opens
function trackWidgetOpen() {
  fetch(`${API_URL}/track-widget-event`, {
    method: 'POST',
    body: JSON.stringify({
      event: 'widget_opened',
      customer_email: customerEmail,
      timestamp: new Date().toISOString()
    })
  });
}
```

### Monitor Performance

- Widget load time
- API response times
- Error rates
- Redemption conversion rate
- Mobile vs desktop usage

### Key Metrics

- Widget open rate
- Average points balance
- Redemption frequency
- Most popular rewards
- Customer engagement time

---

## Support & Resources

### Documentation
- [Main README](./README.md)
- [Shopify Integration Guide](./SHOPIFY_INTEGRATION_GUIDE.md)
- [Store Tracking Guide](./STORE_TRACKING_QUICK_REFERENCE.md)
- [API Reference](./LOYALTY_API_REFERENCE.md)

### Example Stores

See working examples:
- Test store: [your-test-store.myshopify.com]
- Demo video: [link-to-demo]

### Getting Help

1. Check documentation above
2. Review troubleshooting section
3. Check Supabase function logs
4. Contact support

---

## One-Click Installation Summary

**Your Installation Link:**
```
https://MERCHANT_STORE.myshopify.com/admin/oauth/authorize
  ?client_id=YOUR_SHOPIFY_API_KEY
  &scope=read_orders,write_customers,read_customers,write_discounts
  &redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**Share this link with merchants for instant installation!**

**What Gets Installed:**
✅ Floating loyalty widget on storefront
✅ Customer points tracking
✅ Reward redemption system
✅ Automated webhooks
✅ Backend integration
✅ Admin dashboard access

**Installation Time:** < 30 seconds
**Setup Required:** None
**Coding Required:** None

**It just works!**

---

**Built with ❤️ for Shopify merchants**
