# Loyalty Points API Testing Guide

All loyalty point APIs have been fixed to work with the correct database schema. Here's how to test each endpoint.

## Prerequisites

Before testing, ensure you have:
1. A shop integrated in `integration_configs` with `shop_domain` (e.g., "houmetest.myshopify.com")
2. An active loyalty program in `loyalty_programs` for the client
3. At least one loyalty tier set up in `loyalty_tiers` with `is_default = true`
4. A member registered in `member_users`

## API Endpoints

### 1. Register Loyalty Member

**POST** `/functions/v1/register-loyalty-member`

Creates a new member and automatically enrolls them in the loyalty program.

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/register-loyalty-member' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "shop_domain": "houmetest.myshopify.com",
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Member registered successfully",
  "member": {
    "id": "uuid",
    "email": "customer@example.com",
    "full_name": "John Doe"
  },
  "loyalty_status": {
    "points_balance": 100,
    "lifetime_points_earned": 100
  },
  "welcome_bonus": 100
}
```

### 2. Adjust Loyalty Points

**POST** `/functions/v1/adjust-loyalty-points`

Add or remove points from a member's account.

```bash
# Add points
curl -X POST 'https://your-project.supabase.co/functions/v1/adjust-loyalty-points' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "shop_domain": "houmetest.myshopify.com",
    "email": "customer@example.com",
    "points": 50,
    "reason": "Order completed",
    "order_id": "order_123"
  }'

# Remove points
curl -X POST 'https://your-project.supabase.co/functions/v1/adjust-loyalty-points' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "shop_domain": "houmetest.myshopify.com",
    "email": "customer@example.com",
    "points": -25,
    "reason": "Points redemption"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Points added successfully",
  "member_id": "uuid",
  "email": "customer@example.com",
  "phone": null,
  "full_name": "John Doe",
  "previous_points": 100,
  "adjustment": 50,
  "new_balance": 150
}
```

### 3. Calculate Loyalty Points

**POST** `/functions/v1/calculate-loyalty-points`

Calculate how many points should be awarded for an order.

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/calculate-loyalty-points' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "shop_domain": "houmetest.myshopify.com",
    "order_amount": 100.00,
    "customer_email": "customer@example.com",
    "order_id": "order_123"
  }'
```

**Response:**
```json
{
  "success": true,
  "points": 10,
  "order_amount": 100,
  "tier_name": "Bronze",
  "earn_rate": 1,
  "earn_divisor": 10,
  "order_id": "order_123"
}
```

**Points Calculation Formula:**
```
points = floor((order_amount × earn_rate) / earn_divisor)
```

### 4. Get Loyalty Status

**GET** `/functions/v1/get-loyalty-status`

Get a member's current loyalty points and status.

```bash
# By email and shop domain
curl 'https://your-project.supabase.co/functions/v1/get-loyalty-status?email=customer@example.com&shop_domain=houmetest.myshopify.com' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'

# By member_user_id
curl 'https://your-project.supabase.co/functions/v1/get-loyalty-status?member_user_id=uuid-here' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

**Response:**
```json
{
  "member_user_id": "uuid",
  "points_balance": 150,
  "lifetime_points_earned": 200,
  "lifetime_points_redeemed": 50,
  "total_orders": 5,
  "total_spend": "500.00",
  "tier": {
    "name": "Bronze",
    "level": 1,
    "color": "#CD7F32",
    "benefits": "Earn 1 point per $10 spent",
    "points_earn_rate": 1,
    "points_earn_divisor": 10,
    "max_redemption_percent": 100
  },
  "program": {
    "name": "Houme Rewards",
    "points_name": "Points",
    "points_name_singular": "Point",
    "currency": "USD",
    "allow_redemption": true
  },
  "recent_transactions": [
    {
      "transaction_type": "earn",
      "points_amount": 50,
      "balance_after": 150,
      "description": "Order completed",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### 5. Redeem Loyalty Points

**POST** `/functions/v1/redeem-loyalty-points`

Redeem points for a discount on an order.

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/redeem-loyalty-points' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "member_user_id": "uuid-here",
    "points_to_redeem": 50,
    "order_amount": 100.00,
    "reference_id": "order_456"
  }'
```

**Response:**
```json
{
  "success": true,
  "points_redeemed": 50,
  "discount_amount": 5.00,
  "new_balance": 100
}
```

## Database Schema Reference

### Key Tables

**member_users**
- `id`, `client_id`, `email`, `phone`, `full_name`

**loyalty_programs**
- `id`, `client_id`, `program_name`, `points_name`, `welcome_bonus_points`, `is_active`

**loyalty_tiers**
- `id`, `loyalty_program_id`, `tier_name`, `points_earn_rate`, `points_earn_divisor`, `is_default`

**member_loyalty_status**
- `id`, `member_user_id`, `loyalty_program_id`, `current_tier_id`
- `points_balance`, `lifetime_points_earned`, `lifetime_points_redeemed`
- `total_orders`, `total_spend`

**loyalty_points_transactions**
- `id`, `member_loyalty_status_id`, `member_user_id`
- `transaction_type` ('earn' or 'redeem')
- `points_amount`, `balance_after`, `description`
- `order_id`, `reference_id`

## Common Test Scenarios

### Scenario 1: New Customer Journey

```bash
# 1. Register new member
POST /register-loyalty-member
{
  "shop_domain": "houmetest.myshopify.com",
  "email": "newcustomer@example.com",
  "first_name": "Jane",
  "last_name": "Smith"
}

# 2. Calculate points for first order
POST /calculate-loyalty-points
{
  "shop_domain": "houmetest.myshopify.com",
  "order_amount": 75.00,
  "customer_email": "newcustomer@example.com"
}

# 3. Award the points
POST /adjust-loyalty-points
{
  "shop_domain": "houmetest.myshopify.com",
  "email": "newcustomer@example.com",
  "points": 7,
  "reason": "Purchase - Order #1001"
}

# 4. Check status
GET /get-loyalty-status?email=newcustomer@example.com&shop_domain=houmetest.myshopify.com
```

### Scenario 2: Points Redemption

```bash
# 1. Check current balance
GET /get-loyalty-status?email=customer@example.com&shop_domain=houmetest.myshopify.com

# 2. Redeem points
POST /redeem-loyalty-points
{
  "member_user_id": "uuid-from-step-1",
  "points_to_redeem": 50,
  "order_amount": 100.00,
  "reference_id": "order_2001"
}

# 3. Verify new balance
GET /get-loyalty-status?email=customer@example.com&shop_domain=houmetest.myshopify.com
```

## Error Handling

All APIs return consistent error responses:

```json
{
  "error": "Description of the error",
  "details": "Additional technical details (if available)"
}
```

Common error status codes:
- `400` - Bad request (missing parameters, insufficient points, etc.)
- `404` - Resource not found (shop, member, loyalty program)
- `500` - Internal server error

## Notes

1. All APIs use `shop_domain` to find the associated client
2. Members can be identified by `email`, `phone`, or `member_user_id`
3. Points adjustments support both positive (earn) and negative (redeem) values
4. Transactions are automatically logged for audit purposes
5. Welcome bonus is automatically awarded on member registration
6. Tier benefits are automatically applied during points calculation
