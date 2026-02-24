# Shopify Extension - Campaign Configuration Quick Start

Quick guide for configuring Campaign IDs in your Shopify extensions.

## Overview

Campaign IDs allow your Shopify extensions to display rewards from specific campaigns, giving you precise control over what customers see and where.

## Step 1: Get Your Campaign ID

1. Log into your **Client Portal**
2. Navigate to **Campaigns**
3. Find your campaign in the list
4. Look for the blue Campaign ID badge (e.g., `CAMP-0001`)
5. Click the copy icon to copy the ID

```
Example Campaign Display:
┌─────────────────────────────────────┐
│ VIP Welcome Campaign                │
│ Rewards for high-value orders      │
│ ┌──────────┐  📋                   │
│ │CAMP-0001 │   Copy                 │
│ └──────────┘                        │
└─────────────────────────────────────┘
```

## Step 2: Configure Your Extension

### Option A: Environment Configuration

Create a config file in your extension:

```javascript
// config/campaigns.js
export const CAMPAIGN_CONFIG = {
  thankYouPage: 'CAMP-0001',
  orderStatus: 'CAMP-0002',
  cartPage: 'CAMP-0003'
};
```

### Option B: Direct Configuration

Set the Campaign ID directly in your extension code:

```javascript
// In your extension file
const CAMPAIGN_ID = 'CAMP-0001'; // Your campaign ID here
```

### Option C: Extension Settings (Recommended)

Create configurable settings for merchants:

```javascript
// shopify.ui.extension.toml
[settings]
[[settings.fields]]
key = "campaign_id"
type = "single_line_text_field"
name = "Campaign ID"
description = "Enter your campaign ID (e.g., CAMP-0001)"
```

## Step 3: Use Campaign ID in API Calls

### Basic API Call with Campaign ID

```javascript
const API_BASE = 'https://your-project.supabase.co/functions/v1';
const ANON_KEY = 'your-anon-key';
const CAMPAIGN_ID = 'CAMP-0001';

async function fetchCampaignRewards(orderId, orderValue, customerEmail) {
  const response = await fetch(`${API_BASE}/get-order-rewards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: orderId,
      order_value: orderValue,
      customer_email: customerEmail,
      campaign_id: CAMPAIGN_ID  // Campaign ID here!
    })
  });

  return await response.json();
}
```

## Common Extension Patterns

### Pattern 1: Thank You Page Extension

**Use Case**: Show rewards immediately after purchase

```javascript
// thank-you-extension/src/index.jsx
import { useEffect, useState } from 'react';
import { Banner } from '@shopify/ui-extensions-react/checkout';

const CAMPAIGN_ID = 'CAMP-0001';

export default function ThankYouExtension({ order }) {
  const [rewards, setRewards] = useState([]);

  useEffect(() => {
    fetchRewards(order.id, order.totalPrice.amount, order.email);
  }, []);

  async function fetchRewards(orderId, orderValue, email) {
    const response = await fetch(`${API_BASE}/get-order-rewards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: orderId,
        order_value: orderValue,
        customer_email: email,
        campaign_id: CAMPAIGN_ID
      })
    });

    const data = await response.json();
    if (data.success) {
      setRewards(data.rewards);
    }
  }

  if (rewards.length === 0) return null;

  return (
    <Banner status="success" title="You earned rewards!">
      You have {rewards.length} rewards from your purchase!
    </Banner>
  );
}
```

### Pattern 2: Order Status Extension

**Use Case**: Display rewards on order tracking page

```javascript
// order-status-extension/src/index.jsx
import { BlockStack, Text, Button, Icon } from '@shopify/ui-extensions-react/order-status';

const CAMPAIGN_ID = 'CAMP-0002';

export default function OrderStatusExtension({ order }) {
  const [rewards, setRewards] = useState([]);

  useEffect(() => {
    checkRewards();
  }, []);

  async function checkRewards() {
    const response = await fetch(`${API_BASE}/check-campaign-rewards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_email: order.email,
        order_value: parseFloat(order.totalPrice.amount),
        campaign_id: CAMPAIGN_ID
      })
    });

    const data = await response.json();
    if (data.qualified) {
      setRewards(data.campaigns[0]?.rewards || []);
    }
  }

  if (rewards.length === 0) return null;

  return (
    <BlockStack>
      <Text size="large" emphasis="bold">
        Available Rewards
      </Text>
      {rewards.map(reward => (
        <Text key={reward.id}>{reward.title}</Text>
      ))}
      <Button onPress={() => window.location.href = '/rewards'}>
        Claim Rewards
      </Button>
    </BlockStack>
  );
}
```

### Pattern 3: Multiple Campaigns

**Use Case**: Display rewards from multiple campaigns

```javascript
const CAMPAIGNS = {
  welcome: 'CAMP-0001',
  vip: 'CAMP-0002',
  seasonal: 'CAMP-0003'
};

async function getAllCampaignRewards(orderData) {
  const results = await Promise.all(
    Object.values(CAMPAIGNS).map(campaignId =>
      fetch(`${API_BASE}/get-order-rewards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...orderData,
          campaign_id: campaignId
        })
      }).then(res => res.json())
    )
  );

  return results
    .filter(r => r.success)
    .flatMap(r => r.rewards);
}
```

## Configuration Examples by Extension Type

### Thank You Page (Checkout Extension)

```toml
# shopify.ui.extension.toml
name = "post-purchase-rewards"
type = "checkout.post_purchase.render"

[[extensions.settings]]
key = "campaign_id"
name = "Campaign ID"
description = "Enter CAMP-XXXX from your campaigns list"
type = "single_line_text_field"
default = "CAMP-0001"
```

```javascript
// src/index.jsx
export default function Extension({ settings }) {
  const campaignId = settings.campaign_id || 'CAMP-0001';
  // Use campaignId in API calls
}
```

### Order Status Extension

```toml
# shopify.ui.extension.toml
name = "order-rewards-display"
type = "order_status.block.render"

[[extensions.settings]]
key = "campaign_id"
name = "Campaign ID"
type = "single_line_text_field"
```

### App Block Extension

```toml
# shopify.ui.extension.toml
name = "rewards-widget"
type = "theme.app.block"

[[extensions.settings]]
key = "campaign_id"
name = "Campaign ID"
description = "Which campaign to display"
type = "single_line_text_field"
```

## Testing Your Configuration

### Test Checklist

- [ ] Campaign ID copied correctly from portal
- [ ] Campaign is active
- [ ] Campaign has rewards associated
- [ ] API credentials are correct
- [ ] Extension loads without errors
- [ ] Rewards display correctly
- [ ] Error handling works

### Test Script

```javascript
// test-campaign-config.js
async function testCampaignConfig() {
  const CAMPAIGN_ID = 'CAMP-0001'; // Your ID
  const TEST_ORDER_VALUE = 100.00;

  console.log('Testing Campaign ID:', CAMPAIGN_ID);

  try {
    const response = await fetch(`${API_BASE}/check-campaign-rewards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_value: TEST_ORDER_VALUE,
        campaign_id: CAMPAIGN_ID
      })
    });

    const data = await response.json();

    if (data.qualified) {
      console.log('✅ Campaign found and qualified!');
      console.log('Rewards available:', data.campaigns[0]?.rewards.length);
    } else {
      console.log('❌ Not qualified for campaign');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCampaignConfig();
```

## Troubleshooting

### Campaign ID Not Working

**Check**:
1. Campaign ID is spelled correctly (case-sensitive)
2. Campaign is active in your portal
3. Campaign has not expired
4. API credentials are correct

### No Rewards Showing

**Check**:
1. Campaign has rewards associated
2. Order meets trigger conditions
3. Customer is eligible
4. Campaign hasn't reached max enrollments

### Extension Not Loading

**Check**:
1. Extension is deployed and published
2. API endpoint is accessible
3. CORS is configured correctly
4. Browser console for errors

## Best Practices

### 1. Use Configuration Over Hardcoding

**Bad**:
```javascript
const CAMPAIGN_ID = 'CAMP-0001'; // Hardcoded
```

**Good**:
```javascript
const CAMPAIGN_ID = settings.campaign_id || 'CAMP-0001'; // Configurable
```

### 2. Handle Missing Campaigns Gracefully

```javascript
async function fetchRewards(campaignId) {
  try {
    const response = await fetch(/* ... */);
    const data = await response.json();

    if (!data.success) {
      console.warn('Campaign not found:', campaignId);
      return [];
    }

    return data.rewards;
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return [];
  }
}
```

### 3. Cache Campaign Data

```javascript
const campaignCache = new Map();

async function getCampaignRewards(campaignId, orderData) {
  const cacheKey = `${campaignId}-${orderData.order_id}`;

  if (campaignCache.has(cacheKey)) {
    return campaignCache.get(cacheKey);
  }

  const rewards = await fetchRewards(campaignId, orderData);
  campaignCache.set(cacheKey, rewards);

  return rewards;
}
```

### 4. Document Your Configuration

```javascript
/**
 * Campaign Configuration
 *
 * CAMP-0001: VIP Welcome - Orders >= $100
 * CAMP-0002: Seasonal Promo - All orders (active Dec 1-31)
 * CAMP-0003: Birthday Rewards - Member birthdays
 *
 * Update Campaign IDs in settings when campaigns change
 */
const CAMPAIGNS = {
  vip: 'CAMP-0001',
  seasonal: 'CAMP-0002',
  birthday: 'CAMP-0003'
};
```

## Quick Reference

### API Endpoints with Campaign ID

| Endpoint | Campaign ID Parameter | Required |
|----------|----------------------|----------|
| `get-order-rewards` | `campaign_id` | Optional |
| `check-campaign-rewards` | `campaign_id` | Optional |
| `get-customer-rewards` | N/A | N/A |
| `get-loyalty-status` | N/A | N/A |

### Campaign ID Format

- **Pattern**: `CAMP-XXXX`
- **Example**: `CAMP-0001`
- **Case**: Uppercase
- **Length**: 9 characters

### Getting Campaign IDs

1. Client Portal → Campaigns
2. Copy icon next to campaign name
3. Format: `CAMP-XXXX`

---

**Ready to configure your Shopify extension with Campaign IDs!**

For detailed API documentation, visit the **Integrations** page in your client portal.
