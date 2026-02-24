# Complete Shopify App Setup Guide

## Overview

This guide walks you through creating a Shopify app and connecting it to your Rewards & Membership platform using OAuth 2.0.

**Time Required:** 15-20 minutes
**Prerequisites:** Shopify Partner account, Supabase project

---

## Step 1: Create Shopify Partner Account

### 1.1 Sign Up for Partners Account

1. Go to https://partners.shopify.com
2. Click **"Join now"** or **"Log in"**
3. Create your account with:
   - Email address
   - Password
   - Business details (can be individual developer)
4. Verify your email address

### 1.2 Complete Partner Profile

1. Fill in your business information
2. Accept the Partner Program Agreement
3. Set up your payment details (for app revenue sharing, if applicable)

---

## Step 2: Create Development Store (Optional but Recommended)

For testing your integration before going live:

1. In Partner Dashboard, go to **"Stores"**
2. Click **"Add store"** → **"Development store"**
3. Enter store details:
   - Store name: `my-rewards-dev` (or any name)
   - Store type: Choose based on your needs
   - Purpose: "Testing app"
4. Click **"Create development store"**
5. Note your store URL: `my-rewards-dev.myshopify.com`

---

## Step 3: Create Your Shopify App

### 3.1 Navigate to Apps Section

1. In Partner Dashboard, click **"Apps"** in the left sidebar
2. Click **"Create app"** button

### 3.2 Choose App Type

Select **"Public app"** (if you want to list in App Store) or **"Custom app"** (for private use)

### 3.3 Basic App Information

Fill in the app details:

**App name:**
```
Rewards & Membership Integration
```
*Or your platform name*

**App URL:**
```
https://YOUR_FRONTEND_URL.com
```
*This is where merchants land after installing. Use your app's main URL.*

**Allowed redirection URL(s):**
```
https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/shopify-oauth-callback
```

**Important:** Replace `YOUR_SUPABASE_PROJECT` with your actual Supabase project reference.

**Example:**
```
https://abcdefghijklmnop.supabase.co/functions/v1/shopify-oauth-callback
```

### 3.4 Find Your Supabase URL

To get your Supabase URL:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **URL** under "Project URL"
5. It looks like: `https://xxxxx.supabase.co`

---

## Step 4: Configure API Scopes

### 4.1 Navigate to Configuration

1. Click on your newly created app
2. Go to **"Configuration"** tab
3. Scroll to **"Admin API integration"** section
4. Click **"Configure"**

### 4.2 Select Required Scopes

Select these API access scopes:

**Required Scopes:**
- ✅ `read_orders` - Read order information
- ✅ `read_customers` - Read customer information
- ✅ `read_products` - Read product catalog (optional)

**Optional Scopes (for future features):**
- `write_customers` - Update customer data
- `read_customer_events` - Track customer activity
- `read_discounts` - Access discount codes

### 4.3 Save Configuration

1. Click **"Save"** at the bottom
2. Review the permissions summary

---

## Step 5: Get API Credentials

### 5.1 Navigate to API Credentials

1. In your app dashboard, click **"API credentials"** tab
2. You'll see two sections:
   - **Admin API credentials**
   - **API keys**

### 5.2 Copy Your Credentials

**Client ID (API Key):**
```
Location: API credentials tab
Label: "Client ID"
Format: Alphanumeric string
Example: abc123def456ghi789
```
**Copy this** - you'll need it for `SHOPIFY_API_KEY`

**Client Secret (API Secret Key):**
```
Location: API credentials tab
Label: "Client secret"
Note: Click "Show" to reveal
Format: Alphanumeric string (longer)
```
**Copy this immediately** - you'll need it for `SHOPIFY_API_SECRET`

⚠️ **Important:** The Client Secret is only shown once. If you lose it, you'll need to regenerate it.

---

## Step 6: Set Environment Variables in Supabase

### 6.1 Navigate to Supabase Edge Function Settings

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"Edge Functions"** in the left sidebar
4. Click **"Manage secrets"** or the **settings gear icon**

### 6.2 Add Environment Variables

Add these three secrets:

**Secret 1: SHOPIFY_API_KEY**
```
Name: SHOPIFY_API_KEY
Value: [Your Client ID from Step 5.2]
```

**Secret 2: SHOPIFY_API_SECRET**
```
Name: SHOPIFY_API_SECRET
Value: [Your Client Secret from Step 5.2]
```

**Secret 3: APP_URL**
```
Name: APP_URL
Value: https://YOUR_FRONTEND_URL.com
```
*This should match the App URL from Step 3.3*

**Example configuration:**
```bash
SHOPIFY_API_KEY=abc123def456ghi789
SHOPIFY_API_SECRET=shpss_1234567890abcdef
APP_URL=https://myrewards.com
```

### 6.3 Verify Environment Variables

After adding, verify they appear in the secrets list:
- ✅ SHOPIFY_API_KEY
- ✅ SHOPIFY_API_SECRET
- ✅ APP_URL

---

## Step 7: Deploy Edge Functions

### 7.1 Install Supabase CLI (if not installed)

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# npm (all platforms)
npm install -g supabase
```

### 7.2 Login to Supabase

```bash
supabase login
```

### 7.3 Link Your Project

```bash
# Get your project reference from Supabase dashboard
supabase link --project-ref YOUR_PROJECT_REF
```

### 7.4 Deploy All Three Functions

```bash
# Deploy OAuth connect endpoint
supabase functions deploy shopify-oauth-connect

# Deploy OAuth callback endpoint
supabase functions deploy shopify-oauth-callback

# Deploy webhook handler
supabase functions deploy shopify-webhook
```

### 7.5 Verify Deployment

Check deployment status:
```bash
supabase functions list
```

You should see:
- ✅ shopify-oauth-connect
- ✅ shopify-oauth-callback
- ✅ shopify-webhook

---

## Step 8: Configure Webhooks (Optional - Auto-registered via OAuth)

While webhooks are automatically registered during the OAuth flow, you can manually verify or configure them:

### 8.1 Navigate to Webhooks Settings

1. In your Shopify app dashboard
2. Go to **"Configuration"** tab
3. Scroll to **"Webhooks"** section

### 8.2 Webhook URL

Your webhook endpoint URL is:
```
https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/shopify-webhook
```

### 8.3 Webhook Topics (Auto-registered)

These are automatically registered via the OAuth callback:
- `orders/create` - New order created
- `orders/paid` - Order payment confirmed
- `customers/create` - New customer registered

**Note:** You don't need to manually add these - the OAuth callback function does it automatically.

---

## Step 9: Test Your Integration

### 9.1 Install App in Development Store

1. In Partner Dashboard → **"Apps"** → Your app
2. Click **"Select store"**
3. Choose your development store
4. Click **"Install app"**

OR

1. Go to your app's frontend
2. Navigate to **Integrations** page
3. Click **"Connect Shopify Store"**
4. Enter your development store domain: `my-rewards-dev.myshopify.com`
5. Click **"Continue to Shopify"**

### 9.2 OAuth Flow Test

You should see:
1. Redirect to Shopify login
2. Permissions approval screen showing:
   - Read orders
   - Read customers
   - Read products
3. "Install app" confirmation
4. Redirect back to your app
5. "Connected" status with green checkmark

### 9.3 Check Database

Verify the integration was stored:

```sql
SELECT
  shop_domain,
  status,
  webhooks_registered,
  installed_at,
  scopes
FROM integration_configs
WHERE platform = 'shopify'
ORDER BY created_at DESC
LIMIT 1;
```

Expected result:
- `status` = 'connected'
- `webhooks_registered` = true
- `shop_domain` = your store domain
- `scopes` = array with granted permissions

### 9.4 Test Webhook Delivery

1. In your development store, create a test order:
   - Go to **Orders** → **Create order**
   - Add a product
   - Add customer info
   - Mark as paid
   - Save

2. Check webhook events in database:

```sql
SELECT
  topic,
  processed,
  created_at,
  processed_at
FROM shopify_webhook_events
ORDER BY created_at DESC
LIMIT 5;
```

3. Verify order was stored:

```sql
SELECT
  order_number,
  customer_email,
  total_price,
  processed_at
FROM shopify_orders
ORDER BY processed_at DESC
LIMIT 5;
```

### 9.5 Check Integration UI

1. Go to your app → **Integrations** page
2. Verify you see:
   - ✅ Connected status
   - Shop domain displayed
   - OAuth Connected label
   - Webhook status: Active
   - Last webhook received timestamp
   - Granted permissions (scopes)

---

## Step 10: Production Deployment

### 10.1 Update App URLs for Production

When ready for production:

1. In Shopify Partner Dashboard → Your App → **"Configuration"**
2. Update **"App URL"** to your production domain:
   ```
   https://app.yourplatform.com
   ```
3. Update **"Allowed redirection URL(s)"** to your production Supabase:
   ```
   https://YOUR_PROD_SUPABASE.supabase.co/functions/v1/shopify-oauth-callback
   ```

### 10.2 Update Environment Variables

Update `APP_URL` in Supabase production project:
```bash
APP_URL=https://app.yourplatform.com
```

### 10.3 App Review (for Public Apps)

If publishing to Shopify App Store:

1. Complete app listing:
   - App icon (512x512px)
   - Screenshots
   - Description
   - Pricing
2. Submit for review
3. Address any feedback
4. Wait for approval

---

## Important URLs Reference

### Required URLs to Configure

| Setting | Value | Where to Use |
|---------|-------|--------------|
| **App URL** | `https://your-app-domain.com` | Shopify App Configuration |
| **OAuth Redirect** | `https://your-supabase.supabase.co/functions/v1/shopify-oauth-callback` | Shopify App Configuration |
| **Webhook URL** | `https://your-supabase.supabase.co/functions/v1/shopify-webhook` | Auto-registered via OAuth |

### Environment Variables

| Variable | Example Value | Where to Set |
|----------|--------------|--------------|
| `SHOPIFY_API_KEY` | `abc123def456` | Supabase Edge Functions Secrets |
| `SHOPIFY_API_SECRET` | `shpss_1234567890abcdef` | Supabase Edge Functions Secrets |
| `APP_URL` | `https://myapp.com` | Supabase Edge Functions Secrets |

---

## Troubleshooting

### Error: "Invalid redirect_uri"

**Cause:** OAuth redirect URL doesn't match Shopify app configuration

**Solution:**
1. Check Shopify app → Configuration → Allowed redirection URL(s)
2. Ensure it exactly matches: `https://YOUR_PROJECT.supabase.co/functions/v1/shopify-oauth-callback`
3. No trailing slashes
4. Must be HTTPS

### Error: "App installation failed"

**Cause:** Missing or incorrect API credentials

**Solution:**
1. Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` in Supabase secrets
2. Ensure they match the credentials from Shopify Partner Dashboard
3. Check for extra spaces or incorrect characters

### Error: "Webhooks not registered"

**Cause:** OAuth callback function failed to register webhooks

**Solution:**
1. Check Edge Function logs: `supabase functions logs shopify-oauth-callback`
2. Verify the access token was stored correctly
3. Check Shopify API rate limits
4. Manually verify in Shopify app → Configuration → Webhooks

### Error: "HMAC verification failed"

**Cause:** Incorrect `SHOPIFY_API_SECRET` or webhook payload modified

**Solution:**
1. Verify `SHOPIFY_API_SECRET` matches exactly
2. Don't modify webhook payload before verification
3. Check webhook is coming from Shopify (verify headers)

### No orders appearing after webhook

**Cause:** Database permissions or table doesn't exist

**Solution:**
1. Check `shopify_orders` table exists
2. Verify RLS policies allow inserts
3. Check Edge Function logs: `supabase functions logs shopify-webhook`
4. Query `shopify_webhook_events` for error messages

---

## Security Checklist

Before going live:

- [ ] HTTPS enabled on all URLs
- [ ] Environment variables secured in Supabase (never in code)
- [ ] OAuth redirect URL validated
- [ ] HMAC verification enabled for webhooks
- [ ] Access tokens encrypted (TODO in production)
- [ ] Scopes limited to minimum required
- [ ] RLS policies enabled on all tables
- [ ] Test with real Shopify store
- [ ] Webhook delivery confirmed
- [ ] Error handling tested

---

## Support Resources

- **Shopify OAuth Documentation:** https://shopify.dev/docs/apps/auth/oauth
- **Shopify Webhook Documentation:** https://shopify.dev/docs/apps/webhooks
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Your Integration Docs:** See `SHOPIFY_OAUTH_REFACTOR.md`

---

## Quick Reference Card

### For First-Time Setup:

1. ✅ Create Shopify Partner account
2. ✅ Create Shopify app
3. ✅ Configure OAuth redirect: `[SUPABASE_URL]/functions/v1/shopify-oauth-callback`
4. ✅ Copy API Key and Secret
5. ✅ Add secrets to Supabase Edge Functions
6. ✅ Deploy 3 edge functions
7. ✅ Test OAuth flow
8. ✅ Create test order
9. ✅ Verify webhook received
10. ✅ Ready for production!

### Critical URLs:

```bash
# OAuth Callback (set in Shopify)
https://[PROJECT].supabase.co/functions/v1/shopify-oauth-callback

# Webhook Endpoint (auto-registered)
https://[PROJECT].supabase.co/functions/v1/shopify-webhook

# Your App URL (set in Shopify)
https://your-app-domain.com
```

### Environment Variables Template:

```bash
SHOPIFY_API_KEY=your_client_id_here
SHOPIFY_API_SECRET=your_client_secret_here
APP_URL=https://your-app-domain.com
```

---

**Need Help?**
- Check logs: `supabase functions logs [function-name]`
- Query events: `SELECT * FROM shopify_webhook_events`
- Test OAuth: Use development store first
- Verify setup: Follow checklist above

**Ready to Connect?**
Go to your app → Integrations → Click "Connect Shopify Store" 🚀
