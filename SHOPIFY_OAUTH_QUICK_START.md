# Shopify OAuth Integration - Quick Start

> **📚 Full Setup Guide:** For detailed step-by-step instructions with screenshots and troubleshooting, see `SHOPIFY_APP_SETUP_COMPLETE_GUIDE.md`

## Setup in 5 Minutes

### 1. Create Shopify App (Partner Dashboard)

1. Go to https://partners.shopify.com
2. Apps → Create App → Public/Custom App
3. **App Name:** "Your Rewards Platform"
4. **App URL:** `https://your-app-domain.com` (your frontend URL)
5. **OAuth Redirect URL:**
   ```
   https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/shopify-oauth-callback
   ```
   ⚠️ Replace `YOUR_SUPABASE_PROJECT` with your actual project reference
6. **Scopes:** `read_orders`, `read_customers`, `read_products`
7. Save and copy from **API credentials** tab:
   - **Client ID** → Use for `SHOPIFY_API_KEY`
   - **Client Secret** → Use for `SHOPIFY_API_SECRET`

### 2. Configure Environment Variables

In Supabase Dashboard → Edge Functions → Secrets:

```bash
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
APP_URL=https://your-app-domain.com
```

### 3. Deploy Edge Functions

```bash
# Deploy OAuth endpoints
supabase functions deploy shopify-oauth-connect
supabase functions deploy shopify-oauth-callback

# Deploy webhook handler
supabase functions deploy shopify-webhook
```

### 4. Test Connection

1. Go to your app → Integrations page
2. Click "Connect Shopify Store"
3. Enter shop domain: `your-dev-store.myshopify.com`
4. Click "Continue to Shopify"
5. Approve permissions
6. Verify redirect back to app
7. Check "Connected" status

### 5. Test Webhook

1. Create test order in Shopify
2. Check database:
   ```sql
   SELECT * FROM shopify_webhook_events ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM shopify_orders ORDER BY processed_at DESC LIMIT 5;
   ```
3. Verify `last_event_at` updated in `integration_configs`

## Merchant Instructions (Copy-Paste Ready)

```markdown
### How to Connect Your Shopify Store

1. Click **"Connect Shopify Store"**
2. Enter your shop domain (e.g., `mystore.myshopify.com`)
3. Click **"Continue to Shopify"**
4. Review and approve the permissions
5. You'll be redirected back automatically
6. Orders will now sync in real-time!

No API keys or manual setup required. Takes 30 seconds.
```

## API Endpoints

### Connect
```
POST /functions/v1/shopify-oauth-connect
Body: { "shop": "store.myshopify.com", "client_id": "...", "user_id": "..." }
Returns: { "authorization_url": "https://..." }
```

### Callback (Automatic)
```
GET /functions/v1/shopify-oauth-callback?code=...&shop=...&state=...
Redirects to: APP_URL/client/integrations?connected=true
```

### Webhook (Shopify calls this)
```
POST /functions/v1/shopify-webhook
Headers:
  X-Shopify-Topic: orders/create
  X-Shopify-Shop-Domain: store.myshopify.com
  X-Shopify-Hmac-Sha256: signature
Body: { order data }
```

## Database Queries

### Check Integration Status
```sql
SELECT
  shop_domain,
  status,
  webhooks_registered,
  installed_at,
  last_event_at,
  scopes
FROM integration_configs
WHERE platform = 'shopify' AND client_id = 'YOUR_CLIENT_ID';
```

### View Recent Webhooks
```sql
SELECT
  topic,
  processed,
  processed_at,
  error,
  created_at
FROM shopify_webhook_events
WHERE shop_domain = 'store.myshopify.com'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Recent Orders
```sql
SELECT
  order_number,
  customer_email,
  total_price,
  processed_at
FROM shopify_orders
WHERE client_id = 'YOUR_CLIENT_ID'
ORDER BY processed_at DESC
LIMIT 10;
```

## Troubleshooting

### OAuth Fails
- Check `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` in env vars
- Verify OAuth callback URL in Shopify app settings
- Check browser console for errors

### Webhooks Not Received
- Check `webhooks_registered = true` in database
- Verify webhook URL in Shopify app → Configuration → Webhooks
- Check `shopify_webhook_events` for errors
- Test webhook with Shopify's webhook tester

### HMAC Verification Fails
- Verify `SHOPIFY_API_SECRET` is correct
- Check that secret matches the one in Shopify app
- DO NOT modify webhook payload before verification

### Orders Not Saving
- Check `shopify_webhook_events` table for error messages
- Verify `shopify_orders` table exists
- Check RLS policies
- Review Edge Function logs

## Common Issues

**Q: Merchant sees "Invalid shop domain"**
A: Ensure domain ends with `.myshopify.com`

**Q: Redirect fails after OAuth**
A: Check `APP_URL` environment variable is correct

**Q: Webhooks register but no events received**
A: Verify webhook URL is publicly accessible (not localhost)

**Q: Multiple integrations for same shop**
A: Query uses `shop_domain` and `client_id` to prevent duplicates

## Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Webhooks register automatically
- [ ] Status shows "Connected"
- [ ] Scopes display correctly
- [ ] Test order creates webhook event
- [ ] Order appears in `shopify_orders` table
- [ ] `last_event_at` updates
- [ ] Disconnect works
- [ ] Reconnect works
- [ ] HMAC verification passes

## Security Notes

- Access tokens stored in database (encrypt in production)
- HMAC signature verified on every webhook
- State parameter prevents CSRF
- Scopes limited to minimum required
- No sensitive data in frontend

## Support

- OAuth issues: Check edge function logs
- Webhook issues: Query `shopify_webhook_events` table
- Integration issues: Check `integration_configs` table
- Order processing: Check `shopify_orders` table

## Resources

- Full documentation: See `SHOPIFY_OAUTH_REFACTOR.md`
- Shopify OAuth docs: https://shopify.dev/docs/apps/auth/oauth
- Webhook docs: https://shopify.dev/docs/apps/webhooks
