# Shopify Custom App Integration Guide

## Why Custom Apps?

Shopify restricts access to **protected customer data** (orders, customers) for security. To access this data via webhooks, you have two options:

1. **Custom App** (Recommended) - Immediate access for your own store
2. **Public App** - Requires Shopify app review process

Since you're connecting your own store, a Custom App is the simplest solution.

## Key Differences

### Custom App
- ✅ Direct Admin API access token
- ✅ No OAuth flow required
- ✅ No redirect URL needed
- ✅ Immediate access to protected customer data
- ✅ Quick setup (5 minutes)
- ❌ Only works for one store

### Public App (OAuth)
- ❌ Requires OAuth flow
- ❌ Needs redirect URL configuration
- ❌ Requires Shopify app review for protected data
- ❌ Complex setup process
- ✅ Can be installed on multiple stores

## Setup Steps

### 1. Create a Custom App in Shopify

1. Go to your Shopify Admin: `https://your-store.myshopify.com/admin`

2. Navigate to:
   ```
   Settings → Apps and sales channels → Develop apps
   ```

3. If this is your first custom app, click **"Allow custom app development"**

4. Click **"Create an app"**
   - App name: `RewardHub Integration` (or any name you prefer)
   - App developer: Select yourself

### 2. Configure API Scopes

1. Click on your newly created app

2. Go to the **"Configuration"** tab

3. Under **"Admin API integration"**, click **"Configure"**

4. Select these scopes:
   - ✅ `read_orders` - Access order information
   - ✅ `read_customers` - Access customer information
   - ✅ `read_products` - Access product information

5. Click **"Save"**

### 3. Install the App

1. Click the **"Install app"** button

2. Review the permissions

3. Click **"Install"** to confirm

### 4. Get Your Access Token

1. Go to the **"API credentials"** tab

2. Under **"Admin API access token"**, click **"Reveal token once"**

3. **IMPORTANT**: Copy this token immediately! You cannot view it again.
   - The token format looks like: `shpat_xxxxxxxxxxxxxxxxxxxxxxxx`

4. Store this token securely

### 5. Connect in RewardHub

1. Go to the **Integrations** page in RewardHub

2. Click **"Connect Shopify Store"**

3. In the connection form:
   - Connection Method: **Custom App (Recommended)** (already selected)
   - Shop Domain: `your-store.myshopify.com`
   - Admin API Access Token: Paste your token from step 4

4. Click **"Connect Store"**
   - The connection saves immediately
   - No redirect or OAuth flow required
   - Token verification happens during webhook registration

5. Once connected, click **"Register Webhooks Manually"** to enable real-time order tracking
   - This step verifies your token is valid
   - Sets up real-time order sync

## What Gets Set Up

Once connected, your store will:

1. ✅ Track all orders in real-time via webhooks
2. ✅ Automatically trigger reward allocations
3. ✅ Sync customer data for membership matching
4. ✅ Update order status in RewardHub

## Troubleshooting

### Connection saves but webhooks fail to register
- Your token or domain may be incorrect
- Check the error message in the webhook registration section
- Verify the custom app is installed in your store
- Make sure you have the correct scopes enabled

### Webhook registration fails with 403 error
- This means you're NOT using a custom app
- Public apps require app review for protected customer data
- Switch to using a custom app instead

### Token not showing in Shopify
- The access token is only shown ONCE when you reveal it
- If you missed it, you'll need to uninstall and reinstall the app
- Or create a new custom app

## Security Notes

- Store your access token securely
- The token has full access to your store's data
- Never commit the token to version control
- You can revoke access anytime by uninstalling the custom app

## Next Steps

After connecting:

1. Test the connection by placing a test order in your Shopify store
2. Verify the order appears in RewardHub Orders page
3. Check that rewards are allocated automatically
4. Set up your membership programs and reward rules

## Support

For more information:
- [Shopify Custom Apps Documentation](https://shopify.dev/docs/apps/auth/admin-app-access-tokens)
- [Protected Customer Data Policy](https://shopify.dev/docs/apps/launch/protected-customer-data)
