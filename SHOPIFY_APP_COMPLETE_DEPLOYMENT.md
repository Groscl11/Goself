# Shopify App - Complete Deployment Guide

## Overview

Deploy the Rewards Loyalty Platform as a complete Shopify app with all 5 widget extensions:

### Theme Extensions (Appear in Theme Customizer)
1. **Announcement Bar** - Header notification bar
2. **Floating Widget** - Floating rewards button
3. **Product Banner** - Product page rewards banner

### Checkout Extensions (Appear in Checkout Customizer)
4. **Cart Rewards** - Cart page rewards messaging
5. **Thank You Card** - Order confirmation rewards card

## Prerequisites

1. **Shopify Partner Account** - [Create one](https://partners.shopify.com/signup)
2. **Shopify CLI** - Install globally
3. **Development Store** - Create from Partner Dashboard
4. **Node.js 18+** - Required for extensions

## Installation

### Step 1: Install Shopify CLI

```bash
npm install -g @shopify/cli @shopify/app
```

Verify installation:
```bash
shopify version
```

### Step 2: Create Shopify App

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Click **Apps** → **Create app**
3. Select **Custom app** or **Public app**
4. Enter app name: **Rewards Loyalty Platform**
5. Note your **Client ID** and **Client Secret**

### Step 3: Configure App Settings

Update `shopify.app.toml` with your app details:

```toml
client_id = "YOUR_CLIENT_ID"
application_url = "https://your-app-domain.com"
dev_store_url = "your-dev-store.myshopify.com"
```

Update redirect URLs in Partner Dashboard:
- `https://your-app-domain.com/auth/callback`
- `https://your-app-domain.com/shopify/callback`

### Step 4: Set Up Environment

Create `.env` file (if not exists):

```env
SHOPIFY_API_KEY=your_client_id
SHOPIFY_API_SECRET=your_client_secret
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment Process

### Deploy All Extensions

From project root, run:

```bash
# Login to Shopify
shopify auth login

# Deploy all extensions
shopify app deploy

# Follow prompts to select:
# - Partner organization
# - App to deploy to
# - Confirm deployment
```

This will deploy:
- ✓ Rewards Announcement Bar
- ✓ Rewards Floating Widget
- ✓ Rewards Product Banner
- ✓ Rewards Cart Widget
- ✓ Rewards Thank You Card

### Verify Deployment

```bash
shopify app info
```

You should see all 5 extensions listed.

## Installation on Store

### Install App on Development Store

1. Go to Partner Dashboard
2. Find your app
3. Click **Test on development store**
4. Select your store
5. Click **Install**
6. Approve permissions

### Enable Theme Extensions

After installation, enable widgets in Theme Customizer:

1. Go to **Online Store → Themes**
2. Click **Customize** on active theme
3. Add extensions:

#### Announcement Bar
- Click **Add section** → **Apps**
- Select **Rewards Announcement Bar**
- Configure Widget ID
- Set message and CTA text
- Position at top of page

#### Floating Widget
- In theme customizer, go to **Theme settings → App embeds**
- Enable **Rewards Floating Widget**
- Enter Widget ID
- Save changes

#### Product Banner
- Edit any product page template
- Click **Add block** → **Apps**
- Select **Rewards Product Banner**
- Configure Widget ID and messaging
- Position as desired

### Enable Checkout Extensions

Enable checkout widgets in Checkout Customizer:

1. Go to **Settings → Checkout**
2. Click **Customize** next to checkout profile
3. Add extensions:

#### Cart Rewards
- Navigate to **Cart** page
- Click **Add block** → **Apps**
- Select **Rewards Cart Widget**
- Enter Widget ID
- Choose position (top/bottom)

#### Thank You Card
- Navigate to **Order status** page
- Click **Add block** → **Apps**
- Select **Rewards Thank You Card**
- Enter Widget ID
- Save changes

## Widget Configuration

Each widget requires a **Widget ID** from your Rewards dashboard:

### Getting Widget IDs

1. Log in to Rewards Platform admin
2. Go to **Widgets** or **Integrations**
3. Create new widget configurations
4. Copy Widget IDs for each type:
   - Announcement Bar Widget
   - Floating Widget
   - Product Banner Widget
   - Cart Widget
   - Thank You Widget

### Widget Settings

Each widget can be customized in Shopify:

| Widget | Customizable Settings |
|--------|----------------------|
| Announcement Bar | Message, CTA text, Dismissible |
| Floating Widget | Enable/Disable |
| Product Banner | Title, Description, CTA text |
| Cart Rewards | Position (top/bottom) |
| Thank You Card | None (controlled by API) |

## API Integration

All widgets call your Supabase edge function to fetch dynamic content:

### Widget Render Endpoint

Ensure this edge function is deployed:

```bash
# Deploy widget render function
cd supabase/functions/widget-render
# Function should already be deployed
```

Endpoint: `https://your-project.supabase.co/functions/v1/widget-render`

### Widget API Flow

1. Customer views page with widget
2. Widget calls edge function with:
   - Widget ID
   - Widget type
   - Customer context (email, cart, order)
3. Edge function returns:
   - `should_render`: true/false
   - `ui_payload`: Display data
4. Widget renders content or hides

## Testing

### Test Each Widget

#### 1. Announcement Bar
- Visit store homepage
- Verify bar appears at top
- Test CTA button
- Test dismiss functionality

#### 2. Floating Widget
- Browse any page
- Verify widget appears (bottom right)
- Click to test interaction
- Check responsiveness

#### 3. Product Banner
- Visit product page
- Verify banner displays
- Test CTA button
- Verify styling

#### 4. Cart Rewards
- Add items to cart
- Open cart page/drawer
- Verify rewards message appears
- Check positioning

#### 5. Thank You Card
- Complete test order
- View order status page
- Verify reward card appears (if eligible)
- Test claim button

### Debug Issues

Check browser console for errors:
```javascript
// Look for these logs
console.log('Widget loaded:', widgetType);
console.error('Widget error:', error);
```

Verify API calls in Network tab:
- Requests to `widget-render` function
- Response status (should be 200)
- Response payload structure

## Production Deployment

### Before Going Live

- [ ] Test all 5 widgets on development store
- [ ] Verify API endpoints are accessible
- [ ] Check mobile responsiveness
- [ ] Test with real customer data
- [ ] Review Shopify App Store requirements (if publishing)

### Submit to App Store (Optional)

If distributing publicly:

1. Complete app listing in Partner Dashboard
2. Add screenshots of all widgets
3. Write detailed description
4. Submit for review
5. Address any feedback
6. Publish when approved

### For Custom Apps

If keeping private:
1. Install on production store via Partner Dashboard
2. Configure widgets in theme/checkout
3. Monitor performance
4. Iterate based on merchant feedback

## Maintenance

### Updating Extensions

To update widget code:

```bash
# Make changes to extension files
# Then redeploy
shopify app deploy
```

Changes take effect immediately after deployment.

### Monitoring

Track widget performance:
- Supabase logs (edge function calls)
- Shopify analytics (conversion impact)
- Customer feedback
- Error tracking

### Support

Common issues and solutions:

**Widget not appearing**
- Verify app is installed
- Check widget is enabled in customizer
- Confirm Widget ID is correct
- Test API endpoint accessibility

**API errors**
- Check Supabase function logs
- Verify CORS settings
- Confirm authentication
- Test endpoint manually

**Styling issues**
- Review theme compatibility
- Check CSS conflicts
- Test on different devices
- Adjust widget positioning

## Architecture

### File Structure

```
project/
├── shopify.app.toml              # Main app config
├── extensions/
│   ├── announcement-bar/         # Theme extension
│   │   ├── shopify.extension.toml
│   │   ├── announcement-bar.js
│   │   └── announcement-bar.css
│   ├── floating-widget/          # Theme extension
│   │   ├── shopify.extension.toml
│   │   └── floating-widget.js
│   ├── product-banner/           # Theme extension
│   │   ├── shopify.extension.toml
│   │   ├── product-banner.js
│   │   └── product-banner.css
│   ├── cart-rewards/             # Checkout UI extension
│   │   ├── shopify.ui.extension.toml
│   │   ├── package.json
│   │   └── src/index.jsx
│   └── thank-you-card/           # Checkout UI extension
│       ├── shopify.ui.extension.toml
│       ├── package.json
│       └── src/index.jsx
└── supabase/
    └── functions/
        └── widget-render/        # API endpoint
            └── index.ts
```

### Widget Types

**Theme Extensions**
- Written in vanilla JS
- Access to theme Liquid variables
- Simple configuration
- Load with theme assets

**Checkout UI Extensions**
- Built with React
- Use Shopify UI components
- GraphQL access to checkout data
- Isolated from theme

## Next Steps

1. Deploy app and extensions
2. Install on test store
3. Enable and configure widgets
4. Test customer journey
5. Go live on production

## Resources

- [Shopify CLI Docs](https://shopify.dev/docs/apps/tools/cli)
- [Theme Extensions](https://shopify.dev/docs/apps/online-store/theme-app-extensions)
- [Checkout UI Extensions](https://shopify.dev/docs/api/checkout-ui-extensions)
- [Partner Dashboard](https://partners.shopify.com)
