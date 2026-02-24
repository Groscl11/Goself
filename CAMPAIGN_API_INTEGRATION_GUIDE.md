# Campaign ID & API Integration Guide

Complete guide for using Campaign IDs in Shopify extensions and integrating with the Rewards API.

## Overview

Campaign IDs are unique, human-readable identifiers (e.g., `CAMP-0001`) that allow you to reference specific campaigns in your Shopify extensions and API calls.

## Table of Contents

1. [Campaign ID Generation](#campaign-id-generation)
2. [Finding Your Campaign ID](#finding-your-campaign-id)
3. [Using Campaign IDs in Shopify Extensions](#using-campaign-ids-in-shopify-extensions)
4. [API Endpoints](#api-endpoints)
5. [Implementation Examples](#implementation-examples)
6. [Best Practices](#best-practices)

---

## Campaign ID Generation

### Automatic Generation

Campaign IDs are **automatically generated** when you create a new campaign:

- **Format**: `CAMP-XXXX` (e.g., `CAMP-0001`, `CAMP-0042`)
- **Sequential**: Numbers increment automatically
- **Unique**: Each campaign gets a unique ID
- **Immutable**: Once assigned, the ID never changes

### Database Implementation

```sql
-- Campaign ID field in database
ALTER TABLE campaign_rules ADD COLUMN campaign_id text UNIQUE;

-- Automatic generation via trigger
CREATE TRIGGER trigger_set_campaign_id
  BEFORE INSERT ON campaign_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_campaign_id();
```

---

## Finding Your Campaign ID

### In the Client Portal

1. Navigate to **Campaigns** in your client dashboard
2. View your campaign list
3. Each campaign shows its Campaign ID with the campaign name:

```
┌─────────────────────────────────────────────┐
│ Campaign Name                               │
│ Description text                            │
│ ┌──────────┐  [Copy Icon]                 │
│ │CAMP-0001 │                                │
│ └──────────┘                                │
└─────────────────────────────────────────────┘
```

4. Click the copy icon to copy the Campaign ID to your clipboard
5. The checkmark appears when successfully copied

### Campaign ID Display

Campaign IDs are displayed:
- In a blue badge with monospace font
- With a copy button for easy access
- Below the campaign name and description
- In all campaign list views

---

## Using Campaign IDs in Shopify Extensions

### Configuration Setup

When configuring your Shopify extension, you can specify a Campaign ID to filter rewards:

#### Example: Order Status Extension

```javascript
// In your Shopify extension configuration
const extensionConfig = {
  campaignId: 'CAMP-0001', // Use your campaign ID here
  apiUrl: 'https://your-project.supabase.co/functions/v1',
  apiKey: 'your-anon-key'
};
```

#### Example: Thank You Page Extension

```liquid
<!-- In your extension liquid template -->
<script>
  const CAMPAIGN_ID = 'CAMP-0001';
  const API_BASE = '{{ shop.metafields.rewards.api_url }}';

  // Fetch rewards for this specific campaign
  fetchCampaignRewards(CAMPAIGN_ID);
</script>
```

### Benefits of Using Campaign IDs

1. **Specificity**: Target exact campaigns instead of all active campaigns
2. **Testing**: Test specific campaigns in production without affecting others
3. **Organization**: Separate campaigns by extension placement
4. **Control**: Enable/disable specific campaigns per extension

---

## API Endpoints

All API endpoints are available in the **Integrations** page of your client portal.

### Base Configuration

```javascript
const API_BASE = 'https://your-project.supabase.co/functions/v1';
const ANON_KEY = 'your-anon-key';

const headers = {
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json'
};
```

### 1. Get Order Rewards

**Endpoint**: `POST /functions/v1/get-order-rewards`

Get available rewards for an order based on campaign rules.

**Request Body**:
```json
{
  "order_id": "shopify_order_123",
  "order_value": 150.00,
  "customer_email": "customer@example.com",
  "campaign_id": "CAMP-0001"  // Optional: Filter by specific campaign
}
```

**Response**:
```json
{
  "success": true,
  "rewards": [
    {
      "id": "uuid",
      "title": "20% Off Next Order",
      "description": "Get 20% discount on your next purchase",
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

**Example Usage**:
```javascript
async function getOrderRewards(orderId, orderValue, campaignId = null) {
  const body = {
    order_id: orderId,
    order_value: orderValue,
    customer_email: customerEmail
  };

  if (campaignId) {
    body.campaign_id = campaignId;
  }

  const response = await fetch(`${API_BASE}/get-order-rewards`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  return await response.json();
}

// Use with campaign ID
const rewards = await getOrderRewards('order_123', 150.00, 'CAMP-0001');
```

### 2. Check Campaign Rewards

**Endpoint**: `POST /functions/v1/check-campaign-rewards`

Check if a customer qualifies for campaign rewards.

**Request Body**:
```json
{
  "customer_email": "customer@example.com",
  "order_value": 100.00,
  "campaign_id": "CAMP-0001"  // Optional: Check specific campaign
}
```

**Response**:
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

### 3. Redeem Campaign Rewards

**Endpoint**: `POST /functions/v1/redeem-campaign-rewards`

Redeem rewards from a campaign.

**Request Body**:
```json
{
  "token": "redemption_token_abc123",
  "reward_ids": ["uuid1", "uuid2"],
  "member_id": "member_uuid"
}
```

**Response**:
```json
{
  "success": true,
  "allocations": [
    {
      "reward_id": "uuid1",
      "voucher_code": "SAVE20-ABC123",
      "expires_at": "2024-12-31T23:59:59Z"
    }
  ]
}
```

### 4. Get Customer Rewards

**Endpoint**: `POST /functions/v1/get-customer-rewards`

Get all rewards available to a customer.

**Request Body**:
```json
{
  "customer_email": "customer@example.com"
}
```

### 5. Get Loyalty Status

**Endpoint**: `POST /functions/v1/get-loyalty-status`

Get customer loyalty points and status.

**Request Body**:
```json
{
  "customer_email": "customer@example.com",
  "shop_domain": "mystore.myshopify.com"
}
```

---

## Implementation Examples

### Example 1: Thank You Page Extension

Display rewards for a specific campaign on the order confirmation page.

```javascript
// thank-you-extension.js
import { extend, Banner } from '@shopify/ui-extensions/checkout';

const CAMPAIGN_ID = 'CAMP-0001';
const API_BASE = 'https://your-project.supabase.co/functions/v1';
const ANON_KEY = 'your-anon-key';

extend('Checkout::ThankYou::Content', (root, { order }) => {
  const fetchRewards = async () => {
    try {
      const response = await fetch(`${API_BASE}/get-order-rewards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: order.id,
          order_value: parseFloat(order.totalPrice.amount),
          customer_email: order.email,
          campaign_id: CAMPAIGN_ID
        })
      });

      const data = await response.json();

      if (data.success && data.rewards.length > 0) {
        root.appendChild(
          root.createComponent(Banner, {
            title: 'You earned rewards!',
            status: 'success'
          }, `You have ${data.rewards.length} rewards from ${data.campaign.campaign_name}`)
        );
      }
    } catch (error) {
      console.error('Error fetching rewards:', error);
    }
  };

  fetchRewards();
});
```

### Example 2: Order Status Extension

Show campaign-specific rewards on order status page.

```javascript
// order-status-extension.js
import { extend, BlockStack, Text, Button } from '@shopify/ui-extensions/order-status';

const CAMPAIGN_ID = 'CAMP-0002';

extend('OrderStatus::Content::End', (root, { order }) => {
  const container = root.createComponent(BlockStack);

  // Fetch rewards for this campaign
  fetch(`${API_BASE}/get-order-rewards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: order.id,
      order_value: parseFloat(order.totalPrice.amount),
      customer_email: order.email,
      campaign_id: CAMPAIGN_ID
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.rewards.length > 0) {
      container.appendChild(
        root.createComponent(Text, {
          size: 'large',
          emphasis: 'bold'
        }, `${data.campaign.campaign_name} Rewards`)
      );

      data.rewards.forEach(reward => {
        container.appendChild(
          root.createComponent(Text, {}, reward.title)
        );
      });

      container.appendChild(
        root.createComponent(Button, {
          onPress: () => {
            // Redirect to reward selection
            window.location.href = `/rewards/select?campaign=${CAMPAIGN_ID}`;
          }
        }, 'Claim Your Rewards')
      );
    }
  });

  root.appendChild(container);
});
```

### Example 3: Multiple Campaigns

Handle multiple campaigns in a single extension.

```javascript
const CAMPAIGNS = {
  vip: 'CAMP-0001',
  seasonal: 'CAMP-0002',
  welcome: 'CAMP-0003'
};

async function getRewardsForAllCampaigns(orderData) {
  const promises = Object.entries(CAMPAIGNS).map(([key, campaignId]) =>
    fetch(`${API_BASE}/get-order-rewards`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...orderData,
        campaign_id: campaignId
      })
    }).then(res => res.json())
  );

  const results = await Promise.all(promises);

  // Combine all rewards
  const allRewards = results
    .filter(r => r.success)
    .flatMap(r => r.rewards);

  return allRewards;
}
```

### Example 4: Campaign-Specific Widget

Display different widgets based on campaign ID.

```javascript
function renderCampaignWidget(campaignId) {
  switch(campaignId) {
    case 'CAMP-0001':
      return renderVIPWidget();
    case 'CAMP-0002':
      return renderSeasonalWidget();
    case 'CAMP-0003':
      return renderWelcomeWidget();
    default:
      return renderDefaultWidget();
  }
}

function renderVIPWidget() {
  return `
    <div class="vip-rewards">
      <h3>VIP Exclusive Rewards</h3>
      <p>You've unlocked premium rewards!</p>
    </div>
  `;
}
```

---

## Best Practices

### 1. Campaign ID Management

**Do**:
- Copy Campaign IDs directly from the portal
- Store Campaign IDs in extension configuration
- Use descriptive campaign names to remember which ID is which
- Document which Campaign ID is used in each extension

**Don't**:
- Hardcode random or made-up Campaign IDs
- Share Campaign IDs publicly (they're not secrets, but keep organized)
- Reuse Campaign IDs across completely different purposes

### 2. API Integration

**Do**:
- Always include the `Authorization` header with your Anon Key
- Handle API errors gracefully
- Cache API responses when appropriate
- Use campaign_id parameter when you want specific campaigns
- Test with different Campaign IDs in development

**Don't**:
- Expose your Service Role Key in client-side code
- Make excessive API calls without caching
- Assume a Campaign ID will always return results (check response)
- Forget to handle network errors

### 3. Extension Configuration

**Do**:
- Make Campaign IDs configurable (not hardcoded)
- Provide clear labels when configuring Campaign IDs
- Test extensions with actual Campaign IDs
- Document which campaign each extension uses
- Use environment-specific Campaign IDs (dev vs production)

**Don't**:
- Bury Campaign ID configuration deep in code
- Use production Campaign IDs in development
- Skip validation of Campaign ID format

### 4. Testing

**Do**:
- Test with valid Campaign IDs from your portal
- Test with invalid Campaign IDs (handle gracefully)
- Test with expired campaigns
- Test with inactive campaigns
- Verify rewards display correctly for each campaign

**Don't**:
- Skip error handling for missing campaigns
- Assume campaigns will always have rewards
- Test only with one campaign

### 5. Security

**Do**:
- Use HTTPS for all API calls
- Validate Campaign IDs on the server side
- Use Anon Key (not Service Role Key) in extensions
- Implement rate limiting on your API calls
- Log suspicious activity

**Don't**:
- Trust Campaign IDs from user input without validation
- Expose sensitive campaign data in client code
- Skip authentication checks

---

## Troubleshooting

### Campaign ID Not Found

**Problem**: API returns "Campaign not found" error

**Solutions**:
1. Verify Campaign ID is copied correctly (case-sensitive)
2. Check campaign is active
3. Ensure campaign hasn't been deleted
4. Verify you're using the correct client account

### No Rewards Returned

**Problem**: Campaign ID is valid but no rewards returned

**Solutions**:
1. Check campaign has rewards associated
2. Verify campaign trigger conditions are met
3. Ensure campaign date range is valid
4. Check campaign hasn't reached max enrollments

### Extension Not Loading Rewards

**Problem**: Shopify extension doesn't display rewards

**Solutions**:
1. Check browser console for API errors
2. Verify Supabase URL is correct
3. Confirm Anon Key is valid
4. Check CORS settings on API
5. Verify Campaign ID is properly configured

### Multiple Campaigns Conflicting

**Problem**: Multiple campaigns showing unexpected rewards

**Solutions**:
1. Use specific Campaign IDs to filter
2. Review campaign priority settings
3. Check campaign trigger conditions don't overlap
4. Adjust campaign date ranges

---

## Support

### Quick Reference

- **Campaign ID Format**: `CAMP-XXXX`
- **Location**: Campaigns page in client portal
- **API Documentation**: Integrations page in client portal
- **Copy Function**: Click copy icon next to Campaign ID

### Getting Help

1. Check this guide first
2. Review API documentation in Integrations page
3. Test with the example code provided
4. Check browser console for errors
5. Verify Campaign ID in portal

---

## Changelog

### Version 1.0 (Current)
- Automatic Campaign ID generation
- Campaign ID display in portal
- Copy to clipboard functionality
- API endpoint integration
- Shopify extension support
- Complete documentation

---

**Start using Campaign IDs today to create targeted, trackable campaigns in your Shopify extensions!**
