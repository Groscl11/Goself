# Loyalty Points API Reference

This document describes the three loyalty points APIs available for managing customer loyalty programs.

## Multi-Tenant Architecture

This platform is designed to support multiple Shopify stores and e-commerce platforms simultaneously:

- Each client is identified by their unique `shop_domain` (e.g., mystore.myshopify.com)
- Customer data is automatically isolated per shop domain
- Loyalty points, transactions, and members are scoped to each individual store
- Multiple stores can use the same API endpoints with their own domain

## Base URL

```
https://your-project-id.supabase.co/functions/v1
```

## Authentication

All endpoints are public (no JWT verification) and use service role access internally.

---

## 1. Register Loyalty Member

Register a new customer in the loyalty program or retrieve existing member.

**Endpoint:** `POST /register-loyalty-member`

### Request Body

```json
{
  "shop_domain": "your-store.myshopify.com",
  "email": "customer@example.com",
  "phone": "+1234567890",
  "first_name": "John",
  "last_name": "Doe"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shop_domain | string | Yes | Your Shopify store domain |
| email | string | Yes* | Customer email address |
| phone | string | Yes* | Customer phone number |
| first_name | string | No | Customer first name |
| last_name | string | No | Customer last name |

*Either email or phone is required

### Response

**Success (201 Created):**
```json
{
  "success": true,
  "message": "Member registered successfully",
  "member": {
    "id": "uuid",
    "client_id": "uuid",
    "email": "customer@example.com",
    "phone": "+1234567890",
    "first_name": "John",
    "last_name": "Doe",
    "total_points": 0,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Member Already Exists (200 OK):**
```json
{
  "success": true,
  "message": "Member already exists",
  "member": {
    "id": "uuid",
    "email": "customer@example.com",
    "phone": "+1234567890",
    "total_points": 150
  }
}
```

### Example

```bash
curl -X POST \
  https://your-project-id.supabase.co/functions/v1/register-loyalty-member \
  -H 'Content-Type: application/json' \
  -d '{
    "shop_domain": "your-store.myshopify.com",
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

---

## 2. Calculate Loyalty Points

Calculate how many points a customer will earn for an order.

**Endpoint:** `POST /calculate-loyalty-points`

### Request Body

```json
{
  "order_amount": 100.00,
  "shop_domain": "your-store.myshopify.com",
  "customer_email": "customer@example.com",
  "order_id": "12345"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| order_amount | number | Yes | Order total amount |
| shop_domain | string | Yes | Your Shopify store domain |
| customer_email | string | No | Customer email (for tier calculation) |
| order_id | string | No | Order ID for reference |

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "points": 150,
  "base_points": 100,
  "tier_multiplier": 1.5,
  "tier_name": "Gold",
  "order_id": "12345"
}
```

**No Active Program (200 OK):**
```json
{
  "success": false,
  "error": "No active loyalty program found",
  "points": 0
}
```

### Example

```bash
curl -X POST \
  https://your-project-id.supabase.co/functions/v1/calculate-loyalty-points \
  -H 'Content-Type: application/json' \
  -d '{
    "order_amount": 100,
    "shop_domain": "your-store.myshopify.com",
    "customer_email": "customer@example.com",
    "order_id": "12345"
  }'
```

---

## 3. Adjust Loyalty Points

Add or remove loyalty points for a customer.

**Endpoint:** `POST /adjust-loyalty-points`

### Request Body

```json
{
  "shop_domain": "your-store.myshopify.com",
  "email": "customer@example.com",
  "points": 50,
  "reason": "Bonus points for review",
  "order_id": "12345"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shop_domain | string | Yes | Your Shopify store domain |
| email | string | Yes* | Customer email address |
| phone | string | Yes* | Customer phone number |
| points | number | Yes | Points to add (positive) or remove (negative) |
| reason | string | No | Description of the adjustment |
| order_id | string | No | Associated order ID |

*Either email or phone is required

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "message": "Points added successfully",
  "member_id": "uuid",
  "email": "customer@example.com",
  "phone": "+1234567890",
  "previous_points": 100,
  "adjustment": 50,
  "new_total": 150
}
```

**Insufficient Points (400 Bad Request):**
```json
{
  "error": "Insufficient points",
  "current_points": 50,
  "requested_adjustment": -100
}
```

### Examples

**Add Points:**
```bash
curl -X POST \
  https://your-project-id.supabase.co/functions/v1/adjust-loyalty-points \
  -H 'Content-Type: application/json' \
  -d '{
    "shop_domain": "your-store.myshopify.com",
    "email": "customer@example.com",
    "points": 50,
    "reason": "Bonus points for birthday"
  }'
```

**Remove Points:**
```bash
curl -X POST \
  https://your-project-id.supabase.co/functions/v1/adjust-loyalty-points \
  -H 'Content-Type: application/json' \
  -d '{
    "shop_domain": "your-store.myshopify.com",
    "email": "customer@example.com",
    "points": -25,
    "reason": "Redeemed for discount"
  }'
```

---

## Error Responses

All endpoints may return these common errors:

**400 Bad Request:**
```json
{
  "error": "Missing required fields: ..."
}
```

**404 Not Found:**
```json
{
  "error": "Shop not found or not integrated"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error message details"
}
```

---

## Common Use Cases

### New Customer Registration Flow
1. Call `register-loyalty-member` when customer creates account
2. Customer automatically starts with 0 points

### Order Completion Flow
1. Call `calculate-loyalty-points` to preview points
2. Call `adjust-loyalty-points` with positive points to award
3. Include order_id for transaction tracking

### Points Redemption Flow
1. Check customer's current points via `register-loyalty-member`
2. Call `adjust-loyalty-points` with negative points to redeem
3. Include reason describing what was redeemed

### Manual Adjustments
- Award bonus points for reviews, referrals, birthdays
- Remove points for returns or corrections
- Always include descriptive reason for audit trail

---

## Testing

Test endpoints using the provided examples with your Supabase project URL:

```bash
export SUPABASE_URL="https://your-project-id.supabase.co"

# Register a test member
curl -X POST $SUPABASE_URL/functions/v1/register-loyalty-member \
  -H 'Content-Type: application/json' \
  -d '{"shop_domain":"test.myshopify.com","email":"test@example.com"}'

# Calculate points
curl -X POST $SUPABASE_URL/functions/v1/calculate-loyalty-points \
  -H 'Content-Type: application/json' \
  -d '{"order_amount":100,"shop_domain":"test.myshopify.com","customer_email":"test@example.com"}'

# Add points
curl -X POST $SUPABASE_URL/functions/v1/adjust-loyalty-points \
  -H 'Content-Type: application/json' \
  -d '{"shop_domain":"test.myshopify.com","email":"test@example.com","points":50}'
```
