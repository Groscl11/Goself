# Thank You Card Extension - Deployment Guide

## Why It's Not Showing in Shopify

The thank-you-card is a **Checkout UI Extension** that needs to be deployed through Shopify's development tools. It won't automatically appear in your Shopify admin without proper deployment.

## Prerequisites

1. **Shopify Partner Account** (create at partners.shopify.com)
2. **Shopify CLI installed** (`npm install -g @shopify/cli @shopify/app`)
3. **A Shopify App** (custom or public app)

## Deployment Steps

### Option 1: Deploy as Part of a Shopify App (Recommended)

#### Step 1: Create/Connect to a Shopify App

```bash
cd /path/to/your/project
shopify app init
```

#### Step 2: Configure shopify.app.toml

Create or update `shopify.app.toml` in your project root:

```toml
name = "Rewards Loyalty Platform"
client_id = "YOUR_CLIENT_ID"
application_url = "https://your-app-url.com"
embedded = true

[build]
automatically_update_urls_on_dev = true

[access_scopes]
scopes = "read_orders,read_customers,read_products"

[webhooks]
api_version = "2024-01"
```

#### Step 3: Deploy the Extension

```bash
shopify app deploy
```

This will:
- Build your extension
- Upload it to Shopify
- Make it available in your app

#### Step 4: Install the App on Your Store

1. Go to your Shopify Partner Dashboard
2. Find your app
3. Click "Test on development store" or "Select store"
4. Install the app on your target store

#### Step 5: Enable in Checkout Settings

1. Go to **Settings → Checkout** in your Shopify admin
2. Click **Customize** next to your checkout profile
3. Navigate to **Order Status** page (Thank You page)
4. Click **Add block** → **Apps** section
5. Select **"Rewards Thank You Card"**
6. Configure the Widget ID
7. Click **Save**

### Option 2: Alternative - Use Shopify Scripts (Limited)

If you can't deploy a full app, you can use Shopify's Order Status Page scripts:

1. Go to **Settings → Checkout**
2. Scroll to **Order status page → Additional scripts**
3. Add custom JavaScript to inject your widget

**Note:** This approach is less reliable and may violate Shopify's policies.

### Option 3: Use Theme App Extensions (Simpler)

Convert the thank-you card to a Theme App Extension that can be embedded more easily:

1. Create a new theme extension
2. Use Shopify's Theme App Extension format
3. Deploy using `shopify theme app extension push`

## Configuration After Deployment

Once deployed and visible in Shopify:

1. Enter your Widget ID from the rewards dashboard
2. Configure the API endpoint in extension settings
3. Test with a sample order
4. Verify the card appears on the thank you page

## Troubleshooting

### Extension Not Appearing in "Add block"

- **Cause:** Extension not deployed or app not installed
- **Fix:** Complete deployment steps and install app on store

### "No apps installed" Message

- **Cause:** Your Shopify app isn't installed on the store
- **Fix:** Install the app from Shopify Partner Dashboard

### Extension Shows But Doesn't Render

- **Cause:** Missing Widget ID or API endpoint not configured
- **Fix:** Configure extension settings in Checkout customizer

### API Errors

- **Cause:** Widget render endpoint not accessible
- **Fix:** Update the API endpoint URL in the extension code

## Quick Test

To verify deployment worked:

1. Place a test order on your store
2. Go to the thank you page
3. The reward card should appear if the customer is eligible
4. Check browser console for any API errors

## Need Help?

- Shopify CLI Docs: https://shopify.dev/docs/apps/tools/cli
- Checkout UI Extensions: https://shopify.dev/docs/api/checkout-ui-extensions
- Partner Support: partners.shopify.com/support
