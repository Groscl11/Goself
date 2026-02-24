# How to Get Your Shopify API Key (Client ID)

## Overview

To create the one-click installation link for merchants, you need a **Shopify API Key** (also called Client ID). This is obtained by creating a Shopify App in the Shopify Partners dashboard.

---

## Step-by-Step Guide

### Step 1: Create Shopify Partners Account

1. **Go to Shopify Partners**
   - Visit: [https://partners.shopify.com/signup](https://partners.shopify.com/signup)

2. **Sign Up**
   - Enter your email
   - Create password
   - Fill in business details
   - Agree to terms
   - Click "Create account"

3. **Verify Email**
   - Check your email
   - Click verification link

4. **Complete Profile**
   - Add business name
   - Select account type
   - Complete onboarding

**Time:** 5-10 minutes

---

### Step 2: Create Your Shopify App

1. **Access Partners Dashboard**
   - Log in to [https://partners.shopify.com](https://partners.shopify.com)
   - Click "Apps" in left sidebar

2. **Create New App**
   - Click "Create app" button
   - Select "Create app manually"

3. **Enter App Details**
   ```
   App name: RewardHub Loyalty & Rewards
   App URL: https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-render
   ```

4. **Click "Create app"**

**Time:** 2 minutes

---

### Step 3: Configure App Settings

#### Basic Information

1. **Go to App Setup**
   - Click on your newly created app
   - Go to "Configuration" tab

2. **Set App URLs**
   ```
   App URL: https://your-dashboard-url.com
   OR: https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-render

   Allowed redirection URL(s):
   https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
   ```

3. **Set Privacy & Compliance URLs**
   ```
   Privacy policy URL: https://your-site.com/privacy
   Terms of service URL: https://your-site.com/terms
   Support URL: mailto:support@your-email.com
   ```

4. **Save Changes**

---

#### API Access Scopes

1. **Click "Configuration" → "API access"**

2. **Select Required Scopes**
   ```
   ✅ read_orders
   ✅ write_orders (optional)
   ✅ read_customers
   ✅ write_customers
   ✅ read_discounts
   ✅ write_discounts
   ✅ read_products (optional)
   ✅ read_price_rules (for discount codes)
   ✅ write_price_rules (for discount codes)
   ```

3. **Save Scopes**

**Important:** These scopes must match the scopes in your OAuth URL!

---

#### Webhooks (Optional - can be registered via API)

You can manually register webhooks here OR let your OAuth callback do it automatically (recommended).

**If registering manually:**
```
orders/create → https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
orders/paid → https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
customers/create → https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
app/uninstalled → https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
customers/redact → https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
shop/redact → https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
customers/data_request → https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
```

---

### Step 4: Get Your API Credentials

1. **Navigate to API Credentials**
   - Still in your app dashboard
   - Look for "Client credentials" or "API credentials" section

2. **Copy Your Credentials**
   ```
   API key (Client ID): abc123def456ghi789
   API secret key: shpss_1234567890abcdef1234567890ab
   ```

3. **Save These Securely**
   - Store in password manager
   - Never commit to git
   - Keep secret key private

**These are your Shopify API credentials!**

---

### Step 5: Store Credentials Securely

#### In Supabase (Recommended)

1. **Go to Supabase Dashboard**
   - Project Settings → Edge Functions → Secrets

2. **Add Secrets**
   ```bash
   SHOPIFY_API_KEY=abc123def456ghi789
   SHOPIFY_API_SECRET=shpss_1234567890abcdef1234567890ab
   ```

3. **Use in Functions**
   ```typescript
   const apiKey = Deno.env.get('SHOPIFY_API_KEY');
   const apiSecret = Deno.env.get('SHOPIFY_API_SECRET');
   ```

#### In Local .env File

```bash
# Add to .env (DO NOT COMMIT!)
SHOPIFY_API_KEY=abc123def456ghi789
SHOPIFY_API_SECRET=shpss_1234567890abcdef1234567890ab
```

---

## Creating Your One-Click Installation Link

### Template

Now that you have your API Key, create the installation URL:

```
https://MERCHANT_STORE.myshopify.com/admin/oauth/authorize
  ?client_id=YOUR_SHOPIFY_API_KEY
  &scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules
  &redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
  &state=OPTIONAL_BASE64_STATE
```

### Real Example

**Your API Key:** `abc123def456ghi789`
**Merchant Store:** `cool-store.myshopify.com`

**Installation URL:**
```
https://cool-store.myshopify.com/admin/oauth/authorize?client_id=abc123def456ghi789&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

### Dynamic Installation Link Generator

Create a simple page for merchants to generate their install link:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Install RewardHub</title>
</head>
<body>
  <h1>Install RewardHub Loyalty</h1>
  <input type="text" id="shop" placeholder="your-store.myshopify.com">
  <button onclick="install()">Install Now</button>

  <script>
    const SHOPIFY_API_KEY = 'abc123def456ghi789'; // Your actual key

    function install() {
      const shop = document.getElementById('shop').value;
      const cleanShop = shop.replace('https://', '').replace('/', '');

      const installUrl = `https://${cleanShop}/admin/oauth/authorize` +
        `?client_id=${SHOPIFY_API_KEY}` +
        `&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules` +
        `&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback`;

      window.location.href = installUrl;
    }
  </script>
</body>
</html>
```

---

## Installation Flow Explanation

### What Happens When Merchant Clicks Link

```
1. Merchant clicks your installation URL
   ↓
2. Redirected to Shopify OAuth screen
   https://their-store.myshopify.com/admin/oauth/authorize
   ↓
3. Shopify shows permissions approval screen
   "RewardHub Loyalty & Rewards wants to access:
   - Read and write customer information
   - Read orders
   - Create discount codes"
   ↓
4. Merchant clicks "Install app"
   ↓
5. Shopify redirects to your callback:
   https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
   ?code=TEMPORARY_CODE&shop=their-store.myshopify.com&state=...
   ↓
6. Your callback function:
   - Verifies HMAC signature
   - Exchanges code for permanent access token
   - Stores shop data in database
   - Registers webhooks
   - Creates client profile
   - Redirects merchant to dashboard
   ↓
7. Installation complete! Widget appears on store
```

**Total time: 20-30 seconds**

---

## Testing Your Installation

### Step 1: Create Development Store

1. **In Shopify Partners Dashboard**
   - Click "Stores" in sidebar
   - Click "Add store"
   - Select "Development store"

2. **Fill Details**
   ```
   Store name: rewardhub-test
   Store type: Development store
   Purpose: Test app development
   ```

3. **Click "Create development store"**

4. **Store URL:** `rewardhub-test.myshopify.com`

### Step 2: Test Installation

1. **Create Test Install URL**
   ```
   https://rewardhub-test.myshopify.com/admin/oauth/authorize
     ?client_id=YOUR_API_KEY
     &scope=read_orders,write_customers,read_customers,write_discounts
     &redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
   ```

2. **Click the URL**
   - Should see OAuth approval screen
   - Click "Install app"
   - Should redirect to your callback
   - Should see success message

3. **Verify Installation**
   - Check Supabase database
   - Look for new record in `store_installations` table
   - Check webhooks registered
   - Visit store and look for widget

### Step 3: Test Widget

1. **Create Test Customer**
   - Shopify Admin → Customers → Add customer
   - Email: test@example.com
   - Password: test123

2. **Give Test Points**
   - In your RewardHub dashboard
   - Or directly in database:
   ```sql
   UPDATE member_loyalty_status
   SET points_balance = 1000
   WHERE member_user_id = 'customer_id';
   ```

3. **Visit Store as Customer**
   - Login as test customer
   - Look for floating loyalty button
   - Click and verify widget appears
   - Check points display correctly

---

## Distributing Your App

### Option 1: Direct Installation Links

**For each new merchant:**

1. Get their store domain
2. Generate installation URL with their domain
3. Send them the link via:
   - Email
   - Your website
   - Support ticket
   - Onboarding flow

**Example Email:**
```
Subject: Install RewardHub on Your Store

Hi [Merchant Name],

Click the link below to install RewardHub Loyalty & Rewards on your Shopify store:

https://YOUR-STORE.myshopify.com/admin/oauth/authorize?client_id=abc123&scope=read_orders,write_customers,read_customers,write_discounts&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback

Installation takes just 30 seconds!

Questions? Reply to this email.

Thanks,
RewardHub Team
```

---

### Option 2: Installation Landing Page

Create a simple page where merchants enter their store name:

**Example: `https://your-site.com/install`**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Install RewardHub - Shopify Loyalty App</title>
  <style>
    body {
      font-family: system-ui;
      max-width: 500px;
      margin: 100px auto;
      padding: 40px;
      text-align: center;
    }

    input {
      width: 100%;
      padding: 12px;
      font-size: 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      margin: 20px 0;
    }

    button {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    button:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <h1>Install RewardHub</h1>
  <p>Enter your Shopify store URL to get started</p>

  <input
    type="text"
    id="shop"
    placeholder="your-store.myshopify.com"
    autofocus
  >

  <button onclick="installApp()">Install Now</button>

  <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
    Installation takes 30 seconds. No credit card required.
  </p>

  <script>
    const API_KEY = 'abc123def456'; // Replace with your actual API key
    const SCOPES = 'read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules';
    const REDIRECT_URI = 'https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback';

    function installApp() {
      let shop = document.getElementById('shop').value.trim();

      // Clean up shop domain
      shop = shop.replace('https://', '')
                 .replace('http://', '')
                 .replace('/', '');

      if (!shop) {
        alert('Please enter your store domain');
        return;
      }

      // Ensure .myshopify.com suffix
      if (!shop.includes('.myshopify.com')) {
        shop = shop.replace('.myshopify.com', '') + '.myshopify.com';
      }

      // Build OAuth URL
      const installUrl = `https://${shop}/admin/oauth/authorize` +
        `?client_id=${API_KEY}` +
        `&scope=${SCOPES}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

      // Redirect to Shopify OAuth
      window.location.href = installUrl;
    }

    // Allow Enter key to submit
    document.getElementById('shop').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') installApp();
    });
  </script>
</body>
</html>
```

Save this as `install.html` and host it on your domain.

---

### Option 3: Shopify App Store (Future)

Once your app is approved for the Shopify App Store:

1. **Merchants find your app** in App Store
2. **Click "Add app"**
3. **Shopify handles OAuth** automatically
4. **Installation completes** in seconds

**Your app will have a permanent URL:**
```
https://apps.shopify.com/rewardhub-loyalty
```

---

## Security Best Practices

### 1. Never Expose API Secret

**✅ GOOD:**
```typescript
// In Edge Function
const apiSecret = Deno.env.get('SHOPIFY_API_SECRET');
```

**❌ BAD:**
```javascript
// In client-side code
const apiSecret = 'shpss_1234567890'; // NEVER DO THIS!
```

### 2. Always Verify HMAC

In your OAuth callback:

```typescript
function verifyHmac(query: URLSearchParams, secret: string): boolean {
  const hmac = query.get('hmac');
  query.delete('hmac');

  const message = Array.from(query.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const hash = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return hash === hmac;
}
```

### 3. Store Access Tokens Securely

```typescript
// ✅ Encrypted in database
await supabase
  .from('store_installations')
  .insert({
    shop_domain: shop,
    access_token: encryptedToken, // Use encryption
    installed_at: new Date()
  });
```

### 4. Use HTTPS Only

All URLs must use HTTPS:
- ✅ `https://yourapp.com/callback`
- ❌ `http://yourapp.com/callback`

---

## Troubleshooting

### Error: "Invalid client_id"

**Cause:** Wrong API key or app not found

**Solution:**
1. Double-check API key in Partners dashboard
2. Ensure you copied the correct key
3. Remove any extra spaces

### Error: "redirect_uri mismatch"

**Cause:** Redirect URL not whitelisted in app settings

**Solution:**
1. Go to Partners → Your App → Configuration
2. Add to "Allowed redirection URL(s)":
   ```
   https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
   ```
3. Save and retry

### Error: "Invalid scope"

**Cause:** Requesting scopes not configured in app

**Solution:**
1. Go to Partners → Your App → API access
2. Enable the requested scopes
3. Save changes
4. Retry installation

### Installation Hangs

**Cause:** Callback function not responding

**Solution:**
1. Check Supabase function logs
2. Verify function is deployed
3. Test callback URL manually
4. Check for errors in code

---

## Summary

### To Get Your API Key:

1. ✅ Create Shopify Partners account
2. ✅ Create new app
3. ✅ Configure OAuth redirect URL
4. ✅ Copy API key (Client ID)
5. ✅ Store securely

### To Create Installation Link:

```
https://MERCHANT-STORE.myshopify.com/admin/oauth/authorize
  ?client_id=YOUR_API_KEY
  &scope=read_orders,write_customers,read_customers,write_discounts
  &redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

### To Test:

1. ✅ Create development store
2. ✅ Click installation link
3. ✅ Approve app
4. ✅ Verify widget appears

**You're ready to onboard merchants!**

---

## Quick Reference

**Shopify Partners Dashboard:**
https://partners.shopify.com

**Your App's OAuth Screen:**
```
https://{shop}/admin/oauth/authorize
  ?client_id={api_key}
  &scope={scopes}
  &redirect_uri={callback_url}
```

**Your OAuth Callback:**
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**Required Scopes:**
```
read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules
```

---

**Need help? Check the [Shopify OAuth documentation](https://shopify.dev/docs/apps/auth/oauth) or contact Shopify Partner Support.**
