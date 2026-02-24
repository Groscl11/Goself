# Complete Integration Guide

Comprehensive guide to all integration endpoints, APIs, and features available in the Rewards & Membership platform.

## Table of Contents

1. [Overview](#overview)
2. [Supabase Edge Function APIs](#supabase-edge-function-apis)
   - [Campaign & Rewards APIs](#campaign--rewards-apis)
   - [Loyalty Points APIs](#loyalty-points-apis)
   - [Widget APIs](#widget-apis)
3. [Shopify Loyalty Server APIs](#shopify-loyalty-server-apis)
   - [Webhook Endpoints](#webhook-endpoints)
   - [Storefront Proxy Endpoints](#storefront-proxy-endpoints)
4. [Shopify Extension Integration](#shopify-extension-integration)
5. [Authentication](#authentication)
6. [Quick Start](#quick-start)

---

## Overview

The platform provides two types of APIs:

1. **Supabase Edge Functions** - Serverless functions for campaigns, loyalty points, and widgets
2. **Shopify Loyalty Server** - Node.js/Express server for Shopify webhooks and storefront proxy

**Base URLs:**
- Edge Functions: `https://your-project.supabase.co/functions/v1`
- Loyalty Server: `https://your-server-domain.com` (Railway, Heroku, etc.)

---

## Supabase Edge Function APIs

### Campaign & Rewards APIs

#### 1. Get Order Rewards

Get available rewards for an order based on campaign rules.

**Endpoint:** `POST /functions/v1/get-order-rewards`

**Authentication:** Bearer Token (Anon Key)

**Request Body:**
```json
{
  "order_id": "shopify_order_123",
  "order_value": 150.00,
  "customer_email": "customer@example.com",
  "customer_phone": "+1234567890",
  "campaign_id": "CAMP-0001"
}
```

**Response:**
```json
{
  "success": true,
  "rewards": [
    {
      "id": "uuid",
      "title": "20% Off Next Order",
      "description": "Get 20% discount",
      "reward_type": "discount",
      "discount_value": 20,
      "campaign_id": "CAMP-0001",
      "campaign_name": "VIP Welcome"
    }
  ],
  "campaign": {
    "id": "uuid",
    "campaign_id": "CAMP-0001",
    "name": "VIP Welcome"
  }
}
```

#### 2. Check Campaign Rewards

Check if a customer qualifies for campaign rewards.

**Endpoint:** `POST /functions/v1/check-campaign-rewards`

**Request Body:**
```json
{
  "customer_email": "customer@example.com",
  "customer_phone": "+1234567890",
  "order_value": 100.00,
  "campaign_id": "CAMP-0001"
}
```

**Response:**
```json
{
  "qualified": true,
  "campaigns": [
    {
      "campaign_id": "CAMP-0001",
      "name": "VIP Welcome",
      "rewards": [...]
    }
  ]
}
```

#### 3. Redeem Campaign Rewards

Redeem rewards from a campaign.

**Endpoint:** `POST /functions/v1/redeem-campaign-rewards`

**Request Body:**
```json
{
  "token": "redemption_token_abc123",
  "reward_ids": ["uuid1", "uuid2"],
  "member_id": "member_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "allocations": [
    {
      "reward_id": "uuid1",
      "voucher_code": "SAVE20-ABC123",
      "expires_at": "2024-12-31"
    }
  ]
}
```

#### 4. Get Customer Rewards

Get all rewards available to a customer.

**Endpoint:** `POST /functions/v1/get-customer-rewards`

**Request Body:**
```json
{
  "customer_email": "customer@example.com",
  "customer_phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "rewards": [
    {
      "id": "uuid",
      "title": "Free Shipping",
      "voucher_code": "SHIP-FREE123",
      "status": "active"
    }
  ]
}
```

---

### Loyalty Points APIs

#### 1. Get Loyalty Status

Get customer loyalty points balance and tier information.

**Endpoint:** `POST /functions/v1/get-loyalty-status`

**Request Body:**
```json
{
  "customer_email": "customer@example.com",
  "customer_phone": "+1234567890",
  "shop_domain": "mystore.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "member": {
    "id": "uuid",
    "email": "customer@example.com",
    "total_points": 500,
    "available_points": 350
  },
  "tier": {
    "name": "Gold",
    "min_points": 500,
    "benefits": ["10% discount", "Free shipping"],
    "multiplier": 1.5
  }
}
```

#### 2. Calculate Loyalty Points

Calculate loyalty points for an order amount.

**Endpoint:** `POST /functions/v1/calculate-loyalty-points`

**Request Body:**
```json
{
  "order_amount": 100.00,
  "shop_domain": "mystore.myshopify.com",
  "customer_email": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "points": 150,
  "base_points": 100,
  "tier_multiplier": 1.5,
  "tier_name": "Gold"
}
```

#### 3. Redeem Loyalty Points

Redeem loyalty points for a discount code.

**Endpoint:** `POST /functions/v1/redeem-loyalty-points`

**Request Body:**
```json
{
  "points": 100,
  "customer_email": "customer@example.com",
  "shop_domain": "mystore.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "discount_code": "LOYALTY-ABC123",
  "discount_value": 10,
  "discount_type": "percentage",
  "points_redeemed": 100,
  "remaining_points": 400
}
```

#### 4. Check Loyalty Redemption

Check available redemption options for customer points.

**Endpoint:** `POST /functions/v1/check-loyalty-redemption`

**Request Body:**
```json
{
  "customer_email": "customer@example.com",
  "shop_domain": "mystore.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "available_points": 500,
  "redemption_options": [
    {
      "points_required": 100,
      "discount_value": 10,
      "discount_type": "percentage",
      "can_redeem": true
    },
    {
      "points_required": 500,
      "discount_value": 50,
      "discount_type": "percentage",
      "can_redeem": true
    }
  ]
}
```

---

### Widget APIs

#### 1. Get Widget Config

Get widget configuration for storefront display.

**Endpoint:** `POST /functions/v1/get-widget-config`

**Request Body:**
```json
{
  "shop_domain": "mystore.myshopify.com",
  "widget_type": "floating"
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "enabled": true,
    "widget_type": "floating",
    "position": "bottom-right",
    "theme": {
      "primary_color": "#3b82f6",
      "text_color": "#ffffff",
      "background_color": "#1f2937"
    },
    "campaigns": [...]
  }
}
```

#### 2. Track Widget Event

Track widget interaction events for analytics.

**Endpoint:** `POST /functions/v1/track-widget-event`

**Request Body:**
```json
{
  "event_type": "click",
  "widget_type": "floating",
  "shop_domain": "mystore.myshopify.com",
  "customer_email": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "uuid"
}
```

---

## Shopify Loyalty Server APIs

The Shopify Loyalty Server handles webhooks from Shopify and provides storefront proxy endpoints for real-time loyalty points operations.

**Server Location:** `/shopify-server/`

**Documentation:** See `/shopify-server/README.md` and `/SHOPIFY_LOYALTY_SERVER_SETUP.md`

### Webhook Endpoints

All webhook endpoints require HMAC verification and return `200 OK` immediately to prevent timeouts.

#### 1. Orders Paid

Automatically award loyalty points when an order is paid.

**Endpoint:** `POST /webhooks/orders/paid`

**Headers:**
- `X-Shopify-Hmac-Sha256`: HMAC signature
- `X-Shopify-Shop-Domain`: Shop domain
- `Content-Type`: application/json

**Webhook Payload:** Standard Shopify order webhook

**Response:** `200 OK` (immediate)

**What Happens:**
1. Verifies HMAC signature
2. Returns 200 OK immediately
3. Finds or creates member by email/phone
4. Calculates points based on order value
5. Awards points to member
6. Stores order in database

#### 2. Orders Refunded

Automatically deduct loyalty points when an order is refunded.

**Endpoint:** `POST /webhooks/orders/refunded`

**Response:** `200 OK` (immediate)

**What Happens:**
1. Verifies HMAC signature
2. Returns 200 OK immediately
3. Finds original order and member
4. Calculates points to deduct
5. Creates negative points transaction
6. Updates member balance

#### 3. App Uninstalled

Handle cleanup when the app is uninstalled.

**Endpoint:** `POST /webhooks/app/uninstalled`

**Response:** `200 OK` (immediate)

#### 4. GDPR Webhooks

Required for Shopify app compliance.

**Endpoints:**
- `POST /webhooks/gdpr/customer_data_request` - Export customer data
- `POST /webhooks/gdpr/customer_redact` - Delete customer data
- `POST /webhooks/gdpr/shop_redact` - Delete shop data

**Response:** `200 OK` (immediate)

---

### Storefront Proxy Endpoints

These endpoints are accessed through Shopify's App Proxy feature at `https://your-store.myshopify.com/apps/loyalty/*`

All proxy endpoints require signature verification.

#### 1. Get Points Balance

Get customer's current points balance, tier, and history.

**Endpoint:** `GET /api/proxy/points`

**Query Parameters:**
- `logged_in_customer_id`: Shopify customer ID (auto-added by Shopify)
- `customer_email`: Customer email (auto-added by Shopify)
- `shop`: Shop domain (auto-added by Shopify)
- `signature`: HMAC signature (auto-added by Shopify)

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
  "history": [
    {
      "points": 100,
      "transaction_type": "earn",
      "description": "Order #1234",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 2. Redeem Points

Redeem loyalty points for a Shopify discount code.

**Endpoint:** `POST /api/proxy/redeem`

**Query Parameters:** Same as above (auto-added by Shopify)

**Request Body:**
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

#### 3. Get Referral Link

Get customer's unique referral link and stats.

**Endpoint:** `GET /api/proxy/referral`

**Query Parameters:** Same as above (auto-added by Shopify)

**Response:**
```json
{
  "success": true,
  "customerId": "123",
  "referralCode": "REF-ABC123",
  "referralLink": "https://mystore.com?ref=REF-ABC123",
  "referralCount": 5,
  "referralPoints": 50,
  "shareText": "Join me on MyStore and get rewards! Use my referral code: REF-ABC123"
}
```

---

## Shopify Extension Integration

### Using Edge Functions in Extensions

All Shopify extensions should use the Supabase Edge Function APIs for fetching campaigns and rewards.

**Example: Cart Rewards Extension**

```javascript
// In your extension's index.jsx
import { useEffect, useState } from 'react';
import { Extension, BlockStack, Text } from '@shopify/ui-extensions-react/checkout';

const SUPABASE_URL = 'https://your-project.supabase.co';
const ANON_KEY = 'your-anon-key';

export default function CartRewards() {
  const [rewards, setRewards] = useState([]);

  useEffect(() => {
    fetchRewards();
  }, []);

  async function fetchRewards() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/check-campaign-rewards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_email: 'customer@example.com',
        campaign_id: 'CAMP-0001'
      })
    });

    const data = await response.json();
    if (data.qualified) {
      setRewards(data.campaigns[0].rewards);
    }
  }

  return (
    <Extension>
      <BlockStack>
        {rewards.map(reward => (
          <Text key={reward.id}>{reward.title}</Text>
        ))}
      </BlockStack>
    </Extension>
  );
}
```

### Using Loyalty Server in Extensions

For loyalty points, use the storefront proxy endpoints which are called through Shopify's App Proxy.

**Example: Loyalty Points Widget**

```javascript
// Client-side widget script
async function fetchPoints() {
  // Shopify automatically adds signature and customer info
  const response = await fetch('/apps/loyalty/points');
  const data = await response.json();

  document.getElementById('points-balance').textContent = data.points;
  document.getElementById('tier-name').textContent = data.tier?.name || 'Bronze';
}

async function redeemPoints(points) {
  const response = await fetch('/apps/loyalty/redeem', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ points })
  });

  const data = await response.json();
  if (data.success) {
    alert(`Your discount code: ${data.discountCode}`);
  }
}
```

---

## Authentication

### Edge Functions

All Edge Function endpoints use Bearer token authentication with your Supabase Anon Key:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
  'Content-Type': 'application/json'
}
```

### Loyalty Server Webhooks

Webhooks use HMAC-SHA256 verification:

```javascript
// Automatically verified by middleware
const hmac = req.get('X-Shopify-Hmac-Sha256');
const hash = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody, 'utf8')
  .digest('base64');
```

### Loyalty Server Proxy

Proxy requests use query parameter signature verification:

```javascript
// Automatically verified by middleware
const { signature, ...params } = req.query;
const sortedParams = Object.keys(params)
  .sort()
  .map(key => `${key}=${params[key]}`)
  .join('');
const hash = crypto
  .createHmac('sha256', PROXY_SECRET)
  .update(sortedParams, 'utf8')
  .digest('hex');
```

---

## Quick Start

### 1. Set Up Supabase Edge Functions

Edge functions are already deployed. Use them immediately:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/get-loyalty-status \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customer_email":"test@example.com","shop_domain":"mystore.myshopify.com"}'
```

### 2. Deploy Loyalty Server

```bash
cd shopify-server
npm install
cp .env.example .env
# Edit .env with your credentials
npm start

# Deploy to Railway/Heroku
git push railway main
```

### 3. Configure Shopify Webhooks

In Shopify Admin → Settings → Notifications → Webhooks:

| Event | URL |
|-------|-----|
| Order payment | `https://your-server.com/webhooks/orders/paid` |
| Order refunded | `https://your-server.com/webhooks/orders/refunded` |
| App uninstalled | `https://your-server.com/webhooks/app/uninstalled` |

### 4. Set Up App Proxy

In Shopify Admin → Apps → App setup → App proxy:

- Subpath prefix: `apps`
- Subpath: `loyalty`
- Proxy URL: `https://your-server.com/api/proxy`

### 5. Test Integration

**Test Edge Function:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/get-loyalty-status \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customer_email":"test@example.com","shop_domain":"mystore.myshopify.com"}'
```

**Test Loyalty Server:**
```bash
# Make a test order in Shopify
# Check server logs for webhook processing
# Visit https://your-store.myshopify.com/apps/loyalty/points
```

---

## Additional Resources

### Documentation Files

- `/shopify-server/README.md` - Complete loyalty server documentation
- `/SHOPIFY_LOYALTY_SERVER_SETUP.md` - Quick setup guide
- `/SHOPIFY_INTEGRATION_INDEX.md` - Shopify integration overview
- `/CAMPAIGN_API_INTEGRATION_GUIDE.md` - Campaign API details
- `/LOYALTY_POINTS_GUIDE.md` - Loyalty points system guide

### Example Code

- `/shopify-server/routes/webhooks-with-logic.js` - Webhook implementations
- `/shopify-server/routes/proxy-with-logic.js` - Proxy implementations
- `/shopify-server/services/loyalty-points.js` - Business logic

### Support

For issues or questions:
1. Check the relevant documentation file
2. Review server logs for errors
3. Test endpoints with curl or Postman
4. Verify HMAC signatures and authentication

---

## Summary

### Total Available Endpoints

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| Campaign & Rewards | 4 | Order rewards, qualifications, redemptions |
| Loyalty Points | 4 | Points balance, calculations, redemptions |
| Widgets | 2 | Widget config, event tracking |
| Webhooks | 6 | Order events, app lifecycle, GDPR |
| Storefront Proxy | 3 | Points balance, redemption, referrals |
| **Total** | **19** | **Complete integration** |

### Key Features

- Real-time order tracking via webhooks
- Automatic points award and deduction
- Customer-facing loyalty portal
- Campaign-based reward distribution
- Tier-based points multipliers
- Discount code generation
- Referral tracking
- GDPR compliance
- Widget analytics
- Multi-tenant support

Ready to integrate!
