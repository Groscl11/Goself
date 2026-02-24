# Shopify Loyalty Points Server - Quick Setup Guide

Complete Node.js server for connecting your Shopify store to the Supabase loyalty points system.

## What You Get

A ready-to-deploy Express server with:

1. **Webhook Handlers** - Automatically award points on purchases, handle refunds
2. **Storefront Proxy** - Let customers check points and redeem rewards
3. **GDPR Compliance** - Required endpoints for Shopify compliance
4. **Security** - HMAC verification on all requests
5. **Supabase Integration** - Full integration with your existing database

## File Structure

```
shopify-server/
├── middleware/shopify-hmac.js          # Security verification
├── routes/
│   ├── webhooks.js                     # Webhook stubs (for testing)
│   ├── webhooks-with-logic.js          # Full webhook implementation
│   ├── proxy.js                        # Proxy stubs (for testing)
│   ├── proxy-with-logic.js             # Full proxy implementation
│   └── index.js                        # Routes aggregator
├── services/
│   ├── supabase.js                     # Database client
│   └── loyalty-points.js               # Business logic
├── server.js                           # Main server
├── package.json                        # Dependencies
├── .env.example                        # Config template
└── README.md                           # Full documentation
```

## Installation Steps

### 1. Install Dependencies

```bash
cd shopify-server
npm install
```

This installs:
- `express` - Web server
- `cors` - Cross-origin requests
- `dotenv` - Environment variables
- `@supabase/supabase-js` - Database client

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
# Server
PORT=3001

# Shopify Credentials
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
SHOPIFY_PROXY_SECRET=your-proxy-secret
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Your Client ID
DEFAULT_CLIENT_ID=your-client-uuid-from-clients-table
```

**Where to find these:**

**Shopify Secrets:**
- Admin → Settings → Notifications → Webhooks section (webhook secret)
- Admin → Apps → App setup (API credentials)

**Supabase:**
- Dashboard → Project Settings → API
- Copy URL, anon key, and service_role key

**Client ID:**
```sql
SELECT id, name FROM clients WHERE name = 'Your Company';
```

### 3. Choose Implementation

**Option A: Start with Stubs (Recommended First)**

Edit `routes/index.js`:

```javascript
const webhooksRouter = require('./webhooks');  // Stub
const proxyRouter = require('./proxy');        // Stub
```

This lets you test the Shopify connection without worrying about database logic.

**Option B: Use Full Implementation**

Edit `routes/index.js`:

```javascript
const webhooksRouter = require('./webhooks-with-logic');  // Full
const proxyRouter = require('./proxy-with-logic');        // Full
```

This includes complete loyalty points integration.

### 4. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

You should see:
```
Shopify Loyalty Points Server running on port 3001
Health check: http://localhost:3001/health

Webhook endpoints:
  POST http://localhost:3001/webhooks/orders/paid
  POST http://localhost:3001/webhooks/orders/refunded
  POST http://localhost:3001/webhooks/app/uninstalled
  ...

Proxy endpoints:
  GET  http://localhost:3001/api/proxy/points
  POST http://localhost:3001/api/proxy/redeem
  GET  http://localhost:3001/api/proxy/referral
```

## Shopify Configuration

### Step 1: Expose Server Publicly

For local testing, use ngrok:

```bash
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

For production, deploy to Railway, Heroku, or DigitalOcean.

### Step 2: Configure Webhooks

Shopify Admin → Settings → Notifications → Webhooks

Add these webhooks:

| Event | URL |
|-------|-----|
| Order payment | `https://your-domain.com/webhooks/orders/paid` |
| Order refunded | `https://your-domain.com/webhooks/orders/refunded` |
| App uninstalled | `https://your-domain.com/webhooks/app/uninstalled` |
| Customer data request | `https://your-domain.com/webhooks/gdpr/customer_data_request` |
| Customer data erasure | `https://your-domain.com/webhooks/gdpr/customer_redact` |
| Shop data erasure | `https://your-domain.com/webhooks/gdpr/shop_redact` |

Format: `JSON`

### Step 3: Configure App Proxy

Shopify Admin → Apps → App setup → App proxy

- **Subpath prefix:** `apps`
- **Subpath:** `loyalty`
- **Proxy URL:** `https://your-domain.com/api/proxy`

This creates these storefront URLs:
- `https://your-store.myshopify.com/apps/loyalty/points`
- `https://your-store.myshopify.com/apps/loyalty/redeem`
- `https://your-store.myshopify.com/apps/loyalty/referral`

### Step 4: Test the Connection

**Test health check:**
```bash
curl https://your-domain.com/health
```

**Trigger test webhook from Shopify:**
1. Make a test order in your store
2. Check server logs for "Webhook received: orders/paid"
3. Check if points were awarded (if using full logic)

## Database Requirements

### Required Tables

These should already exist from your migrations:

- ✅ `member_users` - Customer accounts
- ✅ `loyalty_programs` - Program settings
- ✅ `loyalty_points_transactions` - Points history
- ✅ `shopify_orders` - Order sync
- ✅ `integration_configs` - Store connections

### Setup Loyalty Program

If you haven't yet, create a loyalty program:

```sql
INSERT INTO loyalty_programs (
  client_id,
  name,
  description,
  points_per_currency,
  currency,
  is_active
) VALUES (
  'your-client-uuid',
  'Shopify Loyalty Program',
  'Earn points on every purchase',
  1.0,  -- 1 point per $1 spent
  'USD',
  true
);
```

### Link Shopify Store

```sql
INSERT INTO integration_configs (
  client_id,
  platform,
  shop_domain,
  is_active
) VALUES (
  'your-client-uuid',
  'shopify',
  'your-store.myshopify.com',
  true
);
```

## How It Works

### Customer Makes Purchase

1. Customer checks out on Shopify
2. Shopify sends webhook → `/webhooks/orders/paid`
3. Server:
   - Verifies HMAC signature
   - Returns 200 OK immediately
   - Finds/creates member by email
   - Calculates points (order total × points_per_currency)
   - Awards points to member
   - Saves order to database

### Customer Redeems Points

1. Customer visits loyalty page
2. Widget calls → `/apps/loyalty/redeem`
3. Shopify proxies → your server `/api/proxy/redeem`
4. Server:
   - Verifies signature
   - Checks points balance
   - Creates Shopify discount code
   - Deducts points
   - Returns discount code

### Order Gets Refunded

1. Merchant refunds in Shopify
2. Shopify sends webhook → `/webhooks/orders/refunded`
3. Server:
   - Finds original order
   - Calculates points to deduct
   - Creates negative transaction
   - Updates member balance

## API Reference

### GET /api/proxy/points

Get customer's points balance.

**Query Parameters:**
- `logged_in_customer_id` - Shopify customer ID
- `customer_email` - Customer email
- `shop` - Shop domain
- `signature` - HMAC signature (auto-added by Shopify)

**Response:**
```json
{
  "success": true,
  "customerId": "123",
  "points": 500,
  "tier": {
    "name": "Gold",
    "minPoints": 500,
    "benefits": ["10% discount", "Free shipping"],
    "multiplier": 1.5
  },
  "nextTier": {
    "name": "Platinum",
    "minPoints": 1000
  },
  "pointsToNextTier": 500,
  "history": [...]
}
```

### POST /api/proxy/redeem

Redeem points for discount code.

**Query Parameters:**
Same as above

**Body:**
```json
{
  "points": 100,
  "rewardId": "optional-reward-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Points redeemed successfully",
  "discountCode": "LOYALTY-ABC123",
  "discountValue": 10,
  "discountType": "percentage",
  "pointsRedeemed": 100,
  "remainingPoints": 400
}
```

### GET /api/proxy/referral

Get referral link.

**Response:**
```json
{
  "success": true,
  "customerId": "123",
  "referralCode": "REF-ABC123",
  "referralLink": "https://store.com?ref=REF-ABC123",
  "referralCount": 5,
  "referralPoints": 50,
  "shareText": "Join me and earn rewards!"
}
```

## Customization

### Adjust Points Calculation

Edit `services/loyalty-points.js`:

```javascript
async function calculatePointsForOrder(orderAmount, loyaltyProgram) {
  // Custom logic here
  const basePoints = Math.floor(orderAmount * loyaltyProgram.points_per_currency);

  // Add bonus for large orders
  if (orderAmount > 100) {
    return basePoints * 1.5;
  }

  return basePoints;
}
```

### Add Custom Webhooks

Create new route in `routes/webhooks-with-logic.js`:

```javascript
router.post('/orders/fulfilled', rawBodyParser, verifyShopifyWebhook(SECRET), async (req, res) => {
  res.status(200).json({ success: true });

  // Your logic here
});
```

### Change Discount Code Format

Edit `services/loyalty-points.js`:

```javascript
async function createShopifyDiscountCode(...) {
  const code = `SAVE${discountValue}-${Date.now()}`;
  // ... rest of logic
}
```

## Deployment

### Railway (Recommended)

1. Push code to GitHub
2. Railway.app → New Project → Deploy from GitHub
3. Add environment variables
4. Auto-deploys on push

### Heroku

```bash
heroku create your-app-name
heroku config:set SHOPIFY_WEBHOOK_SECRET=xxx
heroku config:set SUPABASE_URL=xxx
# ... set all vars
git push heroku main
```

### DigitalOcean App Platform

1. Connect GitHub repo
2. Configure environment variables
3. Deploy

## Monitoring

### Check Server Health

```bash
curl https://your-domain.com/health
```

### View Logs

**Railway:** Dashboard → Deployments → Logs
**Heroku:** `heroku logs --tail`

### Database Monitoring

Check points transactions:
```sql
SELECT
  mu.email,
  lpt.points,
  lpt.transaction_type,
  lpt.description,
  lpt.created_at
FROM loyalty_points_transactions lpt
JOIN member_users mu ON mu.id = lpt.member_id
ORDER BY lpt.created_at DESC
LIMIT 10;
```

## Troubleshooting

### Webhooks Not Arriving

1. ✅ Verify HTTPS (Shopify requires it)
2. ✅ Check webhook URL in Shopify admin
3. ✅ Look for delivery attempts in Shopify webhook logs
4. ✅ Check server logs

### HMAC Verification Failed

1. ✅ Verify `SHOPIFY_WEBHOOK_SECRET` is correct
2. ✅ Check middleware order (rawBodyParser → HMAC → handler)
3. ✅ Ensure using raw body, not parsed JSON

### Points Not Awarded

1. ✅ Check loyalty program exists and is active
2. ✅ Verify `DEFAULT_CLIENT_ID` is set correctly
3. ✅ Check `points_per_currency` is set
4. ✅ Review server logs for errors

### Customer Not Found

1. ✅ Verify email in webhook data
2. ✅ Check `member_users` table for email
3. ✅ Ensure RLS policies allow creation

## Next Steps

1. ✅ Deploy server to production
2. ✅ Configure webhooks in Shopify
3. ✅ Set up app proxy
4. ✅ Create loyalty program in database
5. ✅ Test with real order
6. ✅ Build storefront widget (see widget documentation)
7. ✅ Monitor and optimize

## Support Resources

- **Full Documentation:** `shopify-server/README.md`
- **Loyalty Points Service:** `shopify-server/services/loyalty-points.js`
- **Database Migrations:** `/supabase/migrations/`
- **Shopify Docs:** https://shopify.dev/docs/api/webhooks

---

**Questions?** Review the full README.md or check server logs for detailed error messages.
