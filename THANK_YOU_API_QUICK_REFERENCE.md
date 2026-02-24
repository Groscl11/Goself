# Thank You Banner API - Quick Reference

## API Endpoint

```
POST https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/check-campaign-rewards
```

## Headers

```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0
```

## Request Body (Minimum)

```json
{
  "order_value": 149.99,
  "shop_domain": "yourstore.myshopify.com"
}
```

## Request Body (Full)

```json
{
  "order_id": "gid://shopify/Order/5489678729400",
  "order_value": 149.99,
  "currency": "USD",
  "customer_email": "customer@example.com",
  "customer_phone": "+1234567890",
  "shipping_address": {
    "address1": "123 Main Street",
    "address2": "Apt 4B",
    "city": "Mumbai",
    "province": "Maharashtra",
    "country": "India",
    "zip": "400001"
  },
  "billing_address": {
    "address1": "123 Main Street",
    "city": "Mumbai",
    "province": "Maharashtra",
    "country": "India",
    "zip": "400001"
  },
  "line_items": [
    {
      "product_id": "gid://shopify/Product/123",
      "variant_id": "gid://shopify/ProductVariant/456",
      "title": "Premium Widget",
      "quantity": 2,
      "price": 74.99,
      "sku": "WIDGET-001",
      "product_type": "Electronics"
    }
  ],
  "payment_method": "Credit Card",
  "shop_domain": "yourstore.myshopify.com",
  "discount_codes": ["WELCOME10"]
}
```

## Response (Qualified)

```json
{
  "qualifies": true,
  "bannerTitle": "Congratulations! You've Earned Rewards! 🎉",
  "bannerMessage": "Thank you for your purchase! You've been enrolled in our VIP program.",
  "buttonText": "Claim Your Rewards",
  "rewardUrl": "https://rewards.example.com/claim?token=xyz",
  "clientName": "Your Brand Name",
  "campaignId": "uuid",
  "programName": "VIP Rewards"
}
```

## Response (Not Qualified)

```json
{
  "qualifies": false,
  "message": "Order does not qualify for rewards"
}
```

## Response (Error)

```json
{
  "qualifies": false,
  "error": "Shop not configured"
}
```

## cURL Example

```bash
curl -X POST \
  https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/check-campaign-rewards \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0' \
  -d '{
    "order_id": "gid://shopify/Order/123456",
    "order_value": 149.99,
    "customer_email": "customer@example.com",
    "shop_domain": "yourstore.myshopify.com"
  }'
```

## JavaScript Example

```javascript
const checkCampaignRewards = async (orderData) => {
  const response = await fetch(
    'https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/check-campaign-rewards',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0'
      },
      body: JSON.stringify(orderData)
    }
  );

  return await response.json();
};

// Usage
const result = await checkCampaignRewards({
  order_id: 'gid://shopify/Order/123456',
  order_value: 149.99,
  customer_email: 'customer@example.com',
  shop_domain: 'yourstore.myshopify.com'
});

if (result.qualifies) {
  console.log('Customer qualifies!');
  console.log('Show banner:', result.bannerTitle);
  console.log('Reward URL:', result.rewardUrl);
} else {
  console.log('No rewards available');
}
```

## Testing with Postman

1. Create new POST request
2. URL: `https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/check-campaign-rewards`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0`
4. Body (raw JSON): Copy full request example above
5. Send

## Campaign Rule Types

The API evaluates these rule types:

| Rule Type | Operator | Value Example |
|-----------|----------|---------------|
| order_value_gte | gte | 100 |
| order_value_between | between | "50,200" |
| order_item_count | gte/eq/lte | 3 |
| payment_method | exact | "cod" or "prepaid" |
| shipping_pincode | exact/starts_with/in_list | "400001" or "400" or "400001,400002" |
| shipping_city | exact/in_list | "Mumbai" or "Mumbai,Delhi" |
| shipping_state | exact/in_list | "Maharashtra" |
| specific_product | contains | "product-sku-123" |
| coupon_code | exact/starts_with/contains | "WELCOME10" |
| customer_type | exact | "new" or "returning" |

## Required Fields

- `shop_domain` (required) - Used to identify the client

## Optional but Recommended

- `order_value` - For value-based rules
- `customer_email` - For customer-based rules and redemption
- `shipping_address.zip` - For pincode-based rules
- `shipping_address.city` - For city-based rules
- `shipping_address.province` - For state-based rules
- `line_items` - For product-based rules
- `payment_method` - For payment-based rules

## Status Codes

- `200` - Success (check `qualifies` field)
- `400` - Bad request (missing shop_domain)
- `500` - Server error

## Rate Limiting

Currently no rate limits enforced. If you need to make many requests, consider batching or caching.

## Support

Check function logs:
```bash
supabase functions logs check-campaign-rewards --tail
```

View recent invocations:
```sql
SELECT * FROM campaign_trigger_logs
ORDER BY created_at DESC
LIMIT 10;
```
