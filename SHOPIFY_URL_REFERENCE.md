# Shopify Integration - URL Reference Card

## Quick URL Finder

This card helps you quickly identify what URLs to use where.

---

## 1. Your Supabase Project URL

### Where to Find It:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → API → Project URL

### Format:
```
https://[your-project-ref].supabase.co
```

### Example:
```
https://abcdefghijklmnop.supabase.co
```

### Common Project References:
- 16 random characters (letters and numbers)
- All lowercase
- No special characters except hyphen

---

## 2. OAuth Callback URL

### Use This In: Shopify App Configuration → Allowed redirection URL(s)

### Format:
```
https://[your-project-ref].supabase.co/functions/v1/shopify-oauth-callback
```

### Example:
```
https://abcdefghijklmnop.supabase.co/functions/v1/shopify-oauth-callback
```

### How to Build:
1. Start with your Supabase Project URL
2. Add `/functions/v1/shopify-oauth-callback`
3. Must be exact - no trailing slash

### ✅ Correct Examples:
```
https://xyzabc123.supabase.co/functions/v1/shopify-oauth-callback
https://my-project.supabase.co/functions/v1/shopify-oauth-callback
```

### ❌ Incorrect Examples:
```
https://xyzabc123.supabase.co/functions/v1/shopify-oauth-callback/  ← trailing slash
http://xyzabc123.supabase.co/functions/v1/shopify-oauth-callback    ← not HTTPS
https://xyzabc123.supabase.co/shopify-oauth-callback                ← missing /functions/v1
```

---

## 3. Webhook URL

### Use This In: Auto-registered by OAuth (can verify in Shopify → Webhooks)

### Format:
```
https://[your-project-ref].supabase.co/functions/v1/shopify-webhook
```

### Example:
```
https://abcdefghijklmnop.supabase.co/functions/v1/shopify-webhook
```

### Note:
- This is automatically registered during OAuth
- You typically don't need to set this manually
- Can verify it in Shopify app → Configuration → Webhooks

---

## 4. Your App URL (Frontend)

### Use This In:
- Shopify App Configuration → App URL
- Supabase Environment Variable → `APP_URL`

### Format:
```
https://your-domain.com
```

### Examples:
```
https://app.myrewards.com
https://rewards.mystore.com
https://myplatform.com
https://localhost:5173  ← for local development only
```

### Requirements:
- Must be HTTPS in production
- Can be HTTP for local development
- Should be your main app domain
- No trailing slash recommended

---

## 5. Development Store URL

### Use This In: Testing OAuth flow

### Format:
```
[store-name].myshopify.com
```

### Example:
```
my-rewards-test.myshopify.com
```

### How to Get:
1. Shopify Partner Dashboard → Stores
2. Create development store
3. Copy the store URL (without https://)

---

## Configuration Checklist

Use this to verify your URLs are configured correctly:

### In Shopify Partner Dashboard → Your App → Configuration:

| Field | Your Value | Status |
|-------|-----------|---------|
| **App URL** | `https://_______.com` | ☐ Set |
| **Allowed redirection URL(s)** | `https://_______.supabase.co/functions/v1/shopify-oauth-callback` | ☐ Set |

### In Supabase Dashboard → Edge Functions → Secrets:

| Variable | Your Value | Status |
|----------|-----------|---------|
| **SHOPIFY_API_KEY** | `abc123...` | ☐ Set |
| **SHOPIFY_API_SECRET** | `shpss_...` | ☐ Set |
| **APP_URL** | `https://_______.com` | ☐ Set |

---

## Testing URLs

### Test OAuth Flow:
```
1. Go to: https://[your-app]/client/integrations
2. Click "Connect Shopify Store"
3. Enter: [store-name].myshopify.com
4. You'll redirect to: https://[store-name].myshopify.com/admin/oauth/authorize?...
5. After approval, redirect to: https://[project].supabase.co/functions/v1/shopify-oauth-callback?...
6. Final redirect to: https://[your-app]/client/integrations?connected=true
```

### Test Webhook:
```
Shopify sends POST to:
https://[your-project].supabase.co/functions/v1/shopify-webhook

With headers:
- X-Shopify-Topic: orders/create
- X-Shopify-Shop-Domain: [store-name].myshopify.com
- X-Shopify-Hmac-Sha256: [signature]
```

---

## Environment Examples

### Development Setup:
```bash
# Supabase Secrets
SHOPIFY_API_KEY=abc123dev456
SHOPIFY_API_SECRET=shpss_dev_secret_key
APP_URL=http://localhost:5173

# Shopify App Configuration
App URL: http://localhost:5173
OAuth Redirect: https://devproject.supabase.co/functions/v1/shopify-oauth-callback
```

### Production Setup:
```bash
# Supabase Secrets
SHOPIFY_API_KEY=xyz789prod012
SHOPIFY_API_SECRET=shpss_prod_secret_key
APP_URL=https://app.myrewards.com

# Shopify App Configuration
App URL: https://app.myrewards.com
OAuth Redirect: https://prodproject.supabase.co/functions/v1/shopify-oauth-callback
```

---

## Common Issues & Solutions

### "Invalid redirect_uri" Error

**Problem:** OAuth callback URL doesn't match

**Check:**
1. Shopify app → Configuration → Allowed redirection URL(s)
2. Must exactly match: `https://[project].supabase.co/functions/v1/shopify-oauth-callback`
3. No typos, extra slashes, or http vs https mismatch

### "App could not be installed"

**Problem:** Incorrect API credentials

**Check:**
1. `SHOPIFY_API_KEY` in Supabase matches Client ID from Shopify
2. `SHOPIFY_API_SECRET` in Supabase matches Client Secret from Shopify
3. No extra spaces or line breaks

### Webhook not received

**Problem:** Webhook URL not accessible or incorrect

**Check:**
1. Edge function deployed: `supabase functions list`
2. URL is public (not localhost)
3. HTTPS enabled
4. Check Shopify → App → Configuration → Webhooks for delivery status

---

## Quick Copy-Paste Templates

### For Shopify App Configuration:

**OAuth Redirect URL:**
```
https://REPLACE_WITH_YOUR_PROJECT.supabase.co/functions/v1/shopify-oauth-callback
```

### For Supabase Secrets:

```bash
SHOPIFY_API_KEY=PASTE_CLIENT_ID_HERE
SHOPIFY_API_SECRET=PASTE_CLIENT_SECRET_HERE
APP_URL=https://PASTE_YOUR_DOMAIN_HERE
```

---

## Need More Help?

- **Complete Setup Guide:** `SHOPIFY_APP_SETUP_COMPLETE_GUIDE.md`
- **Quick Start:** `SHOPIFY_OAUTH_QUICK_START.md`
- **Technical Details:** `SHOPIFY_OAUTH_REFACTOR.md`
- **Migration Info:** `SHOPIFY_INTEGRATION_MIGRATION_NOTICE.md`

---

**Pro Tip:** Bookmark this page for quick reference during setup!
