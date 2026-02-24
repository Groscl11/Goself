# Shopify Loyalty Points Server - Complete

Your Shopify integration server is ready to deploy!

## What's Included

### Complete Express.js Server Structure

```
shopify-server/
├── middleware/
│   └── shopify-hmac.js              ✅ HMAC verification for webhooks & proxy
├── routes/
│   ├── index.js                     ✅ Main routes aggregator
│   ├── webhooks.js                  ✅ Webhook stubs (testing)
│   ├── webhooks-with-logic.js       ✅ Full webhook implementation
│   ├── proxy.js                     ✅ Proxy stubs (testing)
│   └── proxy-with-logic.js          ✅ Full proxy implementation
├── services/
│   ├── supabase.js                  ✅ Database client
│   └── loyalty-points.js            ✅ Business logic (award/redeem/tiers)
├── server.js                        ✅ Main server
├── package.json                     ✅ Dependencies
├── .env.example                     ✅ Configuration template
├── .gitignore                       ✅ Git ignore rules
└── README.md                        ✅ Full documentation
```

## Endpoints Provided

### ✅ Webhook Endpoints (All POST)

| Endpoint | Purpose |
|----------|---------|
| `/webhooks/orders/paid` | Award points when order paid |
| `/webhooks/orders/refunded` | Deduct points when refunded |
| `/webhooks/app/uninstalled` | Cleanup on uninstall |
| `/webhooks/gdpr/customer_data_request` | GDPR data export |
| `/webhooks/gdpr/customer_redact` | GDPR customer deletion |
| `/webhooks/gdpr/shop_redact` | GDPR shop deletion |

### ✅ Proxy Endpoints (Storefront)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/proxy/points` | GET | Get balance, tier, history |
| `/api/proxy/redeem` | POST | Redeem points for discount |
| `/api/proxy/referral` | GET | Get referral link |

### ✅ Health Check

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Server status |

## Security Features

✅ **HMAC Verification** - All webhook and proxy requests verified
✅ **Raw Body Parsing** - Proper webhook signature validation
✅ **Immediate Response** - Returns 200 OK to prevent Shopify timeouts
✅ **Service Role Key** - Bypasses RLS for server operations
✅ **Environment Variables** - Secrets stored securely

## Implementation Highlights

### 1. Automatic Points Award

When a customer makes a purchase:

```javascript
// 1. Webhook received
POST /webhooks/orders/paid

// 2. Server responds immediately
res.status(200).json({ success: true });

// 3. Processes asynchronously
const member = await findOrCreateMember(clientId, customerData);
const points = calculatePointsForOrder(orderTotal, program);
await awardPoints(member.id, points, description);
```

### 2. Points Redemption

When a customer redeems points:

```javascript
// 1. Check balance
const balance = await getPointsBalance(memberId);

// 2. Validate redemption
if (balance < points) throw new Error('Insufficient points');

// 3. Create discount code
const code = await createShopifyDiscountCode(...);

// 4. Deduct points
await deductPoints(memberId, points, description);

// 5. Return code to customer
return { discountCode: code.code };
```

### 3. Refund Handling

When an order is refunded:

```javascript
// 1. Find original order
const order = await getOrderByShopifyId(orderId);

// 2. Calculate points to deduct
const pointsToDeduct = calculatePointsForOrder(refundAmount);

// 3. Create negative transaction
await deductPoints(memberId, pointsToDeduct, 'Refund');
```

### 4. Member Tiers

Automatically calculates tier based on points:

```javascript
const tier = await getMemberTier(memberId, loyaltyProgram);

// Returns tier with:
// - name (e.g., "Gold")
// - minPoints (e.g., 500)
// - benefits (e.g., ["10% discount", "Free shipping"])
// - multiplier (e.g., 1.5x points)
```

## Database Integration

### Tables Used

| Table | Purpose |
|-------|---------|
| `member_users` | Customer records |
| `loyalty_programs` | Program configuration |
| `loyalty_points_transactions` | Points history |
| `loyalty_discount_codes` | Generated discount codes |
| `shopify_orders` | Order sync records |
| `integration_configs` | Store connections |

### Key Functions in loyalty-points.js

```javascript
// Member Management
await findOrCreateMember(clientId, customerData);

// Program Management
await getLoyaltyProgram(clientId);

// Points Operations
await calculatePointsForOrder(orderAmount, program);
await awardPoints(memberId, points, description, metadata);
await deductPoints(memberId, points, description, metadata);
await getPointsBalance(memberId);

// Tier Management
await getMemberTier(memberId, program);

// Redemption
await createShopifyDiscountCode(clientId, memberId, points, value);
```

## Quick Start

### 1. Install

```bash
cd shopify-server
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start

```bash
# Development
npm run dev

# Production
npm start
```

### 4. Deploy

**Railway:**
```bash
# Push to GitHub
# Connect repo in Railway
# Add environment variables
# Deploy automatically
```

**Heroku:**
```bash
heroku create
heroku config:set SHOPIFY_WEBHOOK_SECRET=xxx
git push heroku main
```

### 5. Configure Shopify

1. **Webhooks:** Add 6 webhooks pointing to your endpoints
2. **App Proxy:** Configure proxy to `/api/proxy`
3. **Test:** Make test order, check logs

## Testing

### Local Testing with ngrok

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3001

# Use ngrok HTTPS URL in Shopify
```

### Test Endpoints

```bash
# Health check
curl https://your-domain.com/health

# Test webhook (with proper HMAC)
curl -X POST https://your-domain.com/webhooks/orders/paid \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: YOUR_HMAC" \
  -d '{"id": 123, "total_price": "50.00", "customer": {"email": "test@example.com"}}'
```

## Two Implementation Options

### Option 1: Stub Routes (For Testing)

Perfect for testing Shopify integration without database logic:

```javascript
// routes/index.js
const webhooksRouter = require('./webhooks');
const proxyRouter = require('./proxy');
```

**What it does:**
- ✅ Receives webhooks
- ✅ Returns 200 OK
- ✅ Logs all data
- ❌ No database operations

**Use when:**
- Setting up Shopify webhooks
- Testing HMAC verification
- Debugging webhook payloads

### Option 2: Full Logic (For Production)

Complete loyalty points implementation:

```javascript
// routes/index.js
const webhooksRouter = require('./webhooks-with-logic');
const proxyRouter = require('./proxy-with-logic');
```

**What it does:**
- ✅ Receives webhooks
- ✅ Returns 200 OK immediately
- ✅ Creates/finds members
- ✅ Awards points
- ✅ Handles refunds
- ✅ Generates discount codes
- ✅ Tracks tiers

**Use when:**
- Ready for production
- Database is set up
- Loyalty program configured

## Customization Guide

### Change Points Calculation

Edit `services/loyalty-points.js`:

```javascript
async function calculatePointsForOrder(orderAmount, loyaltyProgram) {
  const basePoints = Math.floor(orderAmount * loyaltyProgram.points_per_currency);

  // Add your custom logic:
  // - Bonus for first-time customers
  // - Double points on weekends
  // - Extra points for specific products
  // - Tier-based multipliers

  return basePoints;
}
```

### Add Custom Webhooks

Add to `routes/webhooks-with-logic.js`:

```javascript
router.post('/orders/fulfilled', rawBodyParser, verifyShopifyWebhook(SECRET), async (req, res) => {
  res.status(200).json({ success: true });

  try {
    const order = req.body;
    // Your custom logic
    // - Bonus points for first fulfillment
    // - Notify customer
    // - Update tier
  } catch (error) {
    console.error('Error:', error);
  }
});
```

### Customize Discount Codes

Edit `services/loyalty-points.js`:

```javascript
async function createShopifyDiscountCode(clientId, memberId, points, discountValue) {
  // Custom code format
  const code = `MEMBER-${discountValue}OFF-${Date.now()}`;

  // Custom expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90 days

  // Custom usage limits
  const usageLimit = 1; // Single use
  const minimumOrderValue = 50; // $50 minimum

  // Save to database with custom fields
  const { data } = await supabase
    .from('loyalty_discount_codes')
    .insert([{
      client_id: clientId,
      member_id: memberId,
      code,
      discount_type: 'percentage',
      discount_value: discountValue,
      points_redeemed: points,
      is_used: false,
      expires_at: expiresAt,
      usage_limit: usageLimit,
      minimum_order_value: minimumOrderValue
    }])
    .select()
    .single();

  return data;
}
```

## Monitoring & Debugging

### Check Logs

```bash
# Railway
railway logs

# Heroku
heroku logs --tail

# Local
# Check console output
```

### Common Log Messages

```
✅ HMAC verification successful
✅ Processing order 123 for shop store.myshopify.com
✅ Member ID: abc-123-def
✅ Awarded 50 points to member abc-123-def

❌ Missing HMAC header
❌ HMAC verification failed
❌ Client not found for shop
❌ No active loyalty program found
```

### Database Queries

**Check recent points transactions:**
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
LIMIT 20;
```

**Check member balance:**
```sql
SELECT
  email,
  (
    SELECT COALESCE(SUM(points), 0)
    FROM loyalty_points_transactions
    WHERE member_id = mu.id
  ) as balance
FROM member_users mu
WHERE email = 'customer@example.com';
```

**Check discount codes:**
```sql
SELECT
  mu.email,
  ldc.code,
  ldc.discount_value,
  ldc.points_redeemed,
  ldc.is_used,
  ldc.created_at
FROM loyalty_discount_codes ldc
JOIN member_users mu ON mu.id = ldc.member_id
ORDER BY ldc.created_at DESC
LIMIT 10;
```

## Troubleshooting

### Issue: Webhooks Not Received

**Check:**
1. Server is running and accessible
2. URL is HTTPS (Shopify requirement)
3. Webhook configured in Shopify admin
4. Firewall allows incoming requests

**Debug:**
```bash
curl https://your-domain.com/health
# Should return: {"status": "healthy", ...}
```

### Issue: HMAC Verification Failed

**Check:**
1. `SHOPIFY_WEBHOOK_SECRET` matches Shopify
2. Middleware order is correct
3. Using raw body, not parsed JSON

**Debug:**
```javascript
// Add to middleware
console.log('Raw body:', req.rawBody);
console.log('HMAC header:', req.get('X-Shopify-Hmac-Sha256'));
console.log('Calculated HMAC:', hash);
```

### Issue: Points Not Awarded

**Check:**
1. Loyalty program exists and is active
2. `points_per_currency` is set
3. Member was created successfully
4. RLS policies allow insert

**Debug:**
```javascript
// Add to webhook handler
console.log('Client ID:', clientId);
console.log('Loyalty program:', loyaltyProgram);
console.log('Member:', member);
console.log('Points to award:', points);
```

### Issue: Discount Code Not Working

**Check:**
1. Code was saved to database
2. Code is not expired
3. Code is not already used
4. Shopify accepts the format

**Debug:**
```sql
SELECT * FROM loyalty_discount_codes
WHERE code = 'YOUR-CODE'
LIMIT 1;
```

## Documentation Files

| File | Purpose |
|------|---------|
| `/shopify-server/README.md` | Complete technical documentation |
| `/SHOPIFY_LOYALTY_SERVER_SETUP.md` | Quick setup guide |
| `/SHOPIFY_SERVER_COMPLETE.md` | This file - overview and summary |

## Next Steps

1. ✅ **Deploy Server** - Railway, Heroku, or DigitalOcean
2. ✅ **Configure Webhooks** - In Shopify admin
3. ✅ **Set Up Proxy** - For storefront access
4. ✅ **Create Loyalty Program** - In Supabase database
5. ✅ **Test with Real Order** - Verify points awarded
6. ✅ **Build Storefront Widget** - Display points to customers
7. ✅ **Monitor and Optimize** - Track usage and errors

## Support

**For Server Issues:**
- Check server logs
- Review error messages
- Verify environment variables

**For Database Issues:**
- Check migration files in `/supabase/migrations/`
- Verify RLS policies
- Review Supabase logs

**For Shopify Issues:**
- Check webhook delivery in Shopify admin
- Verify HMAC secret
- Review Shopify API documentation

## Summary

You now have a complete, production-ready Shopify loyalty points integration server with:

- ✅ Secure webhook handling with HMAC verification
- ✅ Automatic points award on purchases
- ✅ Points deduction on refunds
- ✅ Customer-facing proxy endpoints
- ✅ Discount code generation
- ✅ Tier management
- ✅ GDPR compliance
- ✅ Full Supabase integration
- ✅ Comprehensive error handling
- ✅ Detailed logging
- ✅ Complete documentation

**Status:** Ready to deploy!

---

**Questions?** Review the full documentation in `/shopify-server/README.md`
