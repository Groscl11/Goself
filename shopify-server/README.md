# Shopify Loyalty Points Integration Server

Complete Node.js/Express server for integrating Shopify with your Supabase-based loyalty points system.

## Features

- ✅ **Webhook Handling** - Automatic points award on orders, refund handling, app uninstall tracking
- ✅ **HMAC Verification** - Secure webhook and proxy request verification
- ✅ **Storefront Proxy** - Customer-facing endpoints for checking points and redeeming rewards
- ✅ **GDPR Compliance** - Required endpoints for Shopify GDPR webhooks
- ✅ **Supabase Integration** - Full integration with existing loyalty points database
- ✅ **Immediate Response** - Returns 200 OK immediately to prevent Shopify timeouts

## Directory Structure

```
shopify-server/
├── middleware/
│   └── shopify-hmac.js         # HMAC verification middleware
├── routes/
│   ├── index.js                # Main routes aggregator
│   ├── webhooks.js             # Webhook endpoints (stub)
│   ├── webhooks-with-logic.js  # Webhook endpoints (with full logic)
│   ├── proxy.js                # Proxy endpoints (stub)
│   └── proxy-with-logic.js     # Proxy endpoints (with full logic)
├── services/
│   ├── supabase.js             # Supabase client
│   └── loyalty-points.js       # Loyalty points business logic
├── .env.example                # Environment variables template
├── package.json                # Dependencies
├── server.js                   # Main server file
└── README.md                   # This file
```

## Quick Start

### 1. Install Dependencies

```bash
cd shopify-server
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3001

# Get these from Shopify Admin
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
SHOPIFY_PROXY_SECRET=your-proxy-secret
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret

# Get these from Supabase Dashboard
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Your client UUID from the clients table
DEFAULT_CLIENT_ID=your-client-uuid
```

### 3. Start the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on port 3001 (or your configured PORT).

## Endpoints Overview

### Webhook Endpoints (POST only)

These receive notifications from Shopify when events occur:

| Endpoint | Purpose | Trigger |
|----------|---------|---------|
| `/webhooks/orders/paid` | Award points when order is paid | Order payment successful |
| `/webhooks/orders/refunded` | Deduct points when order refunded | Order refunded |
| `/webhooks/app/uninstalled` | Cleanup when app uninstalled | App removed from store |
| `/webhooks/gdpr/customer_data_request` | GDPR data export request | Customer requests data |
| `/webhooks/gdpr/customer_redact` | GDPR customer deletion | Customer requests deletion |
| `/webhooks/gdpr/shop_redact` | GDPR shop deletion | Store requests full deletion |

### Proxy Endpoints (GET/POST)

These are called from your Shopify storefront:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/proxy/points` | GET | Get customer's points balance and tier |
| `/api/proxy/redeem` | POST | Redeem points for discount code |
| `/api/proxy/referral` | GET | Get customer's referral link |

### Health Check

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Server health check |

## Implementation Options

### Option 1: Start with Stub Routes (Recommended for Testing)

Use `routes/webhooks.js` and `routes/proxy.js` to test the endpoint structure first:

```javascript
// routes/index.js
const webhooksRouter = require('./webhooks');  // Stub version
const proxyRouter = require('./proxy');        // Stub version

router.use('/webhooks', webhooksRouter);
router.use('/api/proxy', proxyRouter);
```

These return 200 OK and log the data, perfect for verifying Shopify integration.

### Option 2: Use Full Logic Routes

Once tested, switch to full implementation:

```javascript
// routes/index.js
const webhooksRouter = require('./webhooks-with-logic');  // Full version
const proxyRouter = require('./proxy-with-logic');        // Full version

router.use('/webhooks', webhooksRouter);
router.use('/api/proxy', proxyRouter);
```

These include complete loyalty points logic with Supabase integration.

## Shopify Configuration

### 1. Set Up Webhooks

In Shopify Admin → Settings → Notifications → Webhooks, add:

**Orders webhooks:**
- Event: `Order payment` → URL: `https://your-domain.com/webhooks/orders/paid`
- Event: `Order refunded` → URL: `https://your-domain.com/webhooks/orders/refunded`

**App webhooks:**
- Event: `App uninstalled` → URL: `https://your-domain.com/webhooks/app/uninstalled`

**GDPR webhooks:**
- Event: `Customer data request` → URL: `https://your-domain.com/webhooks/gdpr/customer_data_request`
- Event: `Customer data erasure` → URL: `https://your-domain.com/webhooks/gdpr/customer_redact`
- Event: `Shop data erasure` → URL: `https://your-domain.com/webhooks/gdpr/shop_redact`

### 2. Set Up App Proxy

In Shopify Admin → Apps → App setup → App proxy:

- **Subpath prefix:** `apps`
- **Subpath:** `loyalty`
- **Proxy URL:** `https://your-domain.com/api/proxy`

This makes your endpoints accessible at:
- `https://your-store.myshopify.com/apps/loyalty/points`
- `https://your-store.myshopify.com/apps/loyalty/redeem`
- `https://your-store.myshopify.com/apps/loyalty/referral`

### 3. Get Your Secrets

**Webhook Secret:**
1. Shopify Admin → Settings → Notifications
2. Scroll to "Webhooks"
3. Copy the webhook signing secret

**Proxy Secret:**
1. In your app setup, the shared secret is your API secret key
2. Use the same value for `SHOPIFY_PROXY_SECRET`

## Security Features

### HMAC Verification

All webhooks and proxy requests are verified using HMAC:

**Webhooks:** Uses `X-Shopify-Hmac-Sha256` header
**Proxy Requests:** Uses `signature` query parameter

Failed verification returns `401 Unauthorized`.

### Raw Body Parsing

Webhooks require raw body access for HMAC verification. The middleware handles this automatically.

## How It Works

### Order Paid Flow

1. Customer completes purchase in Shopify
2. Shopify sends webhook to `/webhooks/orders/paid`
3. Server verifies HMAC
4. Returns 200 OK immediately (prevents timeout)
5. Finds or creates member in database
6. Calculates points based on order value
7. Awards points to member
8. Stores order in `shopify_orders` table

### Points Redemption Flow

1. Customer clicks "Redeem" in your storefront widget
2. Widget makes POST to `/apps/loyalty/redeem`
3. Shopify proxies to your server at `/api/proxy/redeem`
4. Server verifies proxy signature
5. Validates points balance
6. Creates Shopify discount code
7. Deducts points from member
8. Returns discount code to customer

### Refund Flow

1. Merchant refunds order in Shopify
2. Shopify sends webhook to `/webhooks/orders/refunded`
3. Server finds original order and member
4. Calculates points to deduct
5. Creates negative points transaction
6. Updates member's balance

## Database Integration

### Required Tables

Your Supabase database needs these tables (already created if you're using the existing migrations):

- `member_users` - Customer records
- `loyalty_programs` - Program configuration
- `loyalty_points_transactions` - Points history
- `loyalty_discount_codes` - Generated discount codes
- `shopify_orders` - Order sync records
- `integration_configs` - Shopify shop connections

### Key Functions

The `services/loyalty-points.js` module provides:

```javascript
// Find or create member by email/phone
await findOrCreateMember(clientId, customerData);

// Get active loyalty program
await getLoyaltyProgram(clientId);

// Calculate points for order amount
await calculatePointsForOrder(orderAmount, loyaltyProgram);

// Award points to member
await awardPoints(memberId, points, description, metadata);

// Deduct points from member
await deductPoints(memberId, points, description, metadata);

// Get current points balance
await getPointsBalance(memberId);

// Get member's tier
await getMemberTier(memberId, loyaltyProgram);

// Create Shopify discount code
await createShopifyDiscountCode(clientId, memberId, points, discountValue);
```

## Testing

### Test Webhook Locally

Use ngrok to expose your local server:

```bash
ngrok http 3001
```

Then use the ngrok URL in Shopify webhook configuration.

### Test with cURL

**Test webhook:**
```bash
curl -X POST http://localhost:3001/webhooks/orders/paid \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: test-hmac" \
  -d '{"id": 123, "total_price": "50.00"}'
```

**Test proxy:**
```bash
curl "http://localhost:3001/api/proxy/points?logged_in_customer_id=123&customer_email=test@example.com&shop=your-store.myshopify.com&signature=test"
```

### Check Logs

The server logs all webhook and proxy requests:

```
Webhook received: orders/paid
Processing order 123 for shop your-store.myshopify.com
Member ID: abc-123
Awarded 50 points to member abc-123
```

## Deployment

### Deploy to Railway

1. Create Railway account
2. New Project → Deploy from GitHub
3. Add environment variables
4. Deploy

### Deploy to Heroku

```bash
heroku create your-app-name
heroku config:set SHOPIFY_WEBHOOK_SECRET=xxx
heroku config:set SUPABASE_URL=xxx
# ... set all env vars
git push heroku main
```

### Deploy to Vercel

Not recommended - Vercel is designed for serverless functions, not long-running servers. Use Railway, Heroku, or DigitalOcean instead.

## Monitoring

### Health Check

```bash
curl https://your-domain.com/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-27T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Logs to Watch

- HMAC verification failures
- Member creation
- Points transactions
- Discount code generation
- Webhook processing errors

## Troubleshooting

### Webhooks Not Received

1. Check webhook configuration in Shopify
2. Verify HTTPS endpoint (Shopify requires HTTPS)
3. Check server logs for incoming requests
4. Verify HMAC secret is correct

### HMAC Verification Fails

1. Ensure using raw body (not parsed JSON) for verification
2. Check `SHOPIFY_WEBHOOK_SECRET` matches Shopify
3. Verify middleware order (rawBodyParser before HMAC)

### Points Not Awarded

1. Check if loyalty program is active for client
2. Verify `DEFAULT_CLIENT_ID` is set
3. Check `loyalty_programs` table has a record
4. Review server logs for errors

### Discount Codes Not Created

1. Verify `loyalty_discount_codes` table exists
2. Check member has sufficient points
3. Ensure redemption options configured in loyalty program
4. Review RLS policies on discount codes table

## Support

For issues with:
- **Shopify Integration:** Check Shopify documentation
- **Supabase Queries:** Review migration files in `/supabase/migrations/`
- **Server Errors:** Check server logs and error messages

## License

MIT

---

**Ready to integrate?** Start with Option 1 (stub routes) to test the connection, then switch to Option 2 (full logic) when ready.
