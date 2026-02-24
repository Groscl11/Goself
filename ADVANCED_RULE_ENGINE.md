# Advanced Campaign Rule Engine

The RewardHub platform now includes a sophisticated, Shopify-native campaign rule engine that allows you to create complex, condition-based campaigns without breaking existing functionality.

## Overview

The new rule engine follows a structured evaluation model:

```
IF (Trigger Conditions)
AND (Eligibility Conditions)
AND (Location Conditions)
AND (Attribution Conditions)
AND NOT (Exclusion Rules)
THEN (Reward Action)
WITH (Guardrails)
```

## Key Features

### 1. Rule Version System
- **Version 1**: Legacy campaigns (backward compatible)
- **Version 2**: New advanced rule engine
- Existing campaigns automatically migrated to v1
- No breaking changes to existing functionality

### 2. Condition Types

#### A. Trigger Conditions (Order & Cart)
- **Order Value**: ≥, ≤, or between specified amounts
- **Order Item Count**: Number of items in cart
- **Specific Product**: Check for specific product in cart
- **Product Collection**: Check if products from collection
- **Coupon Code**: Exact match, starts with, or contains
- **Payment Method**: Prepaid vs COD

#### B. Eligibility Conditions (Customer-based)
- **Customer Type**: First-time vs returning
- **Order Number**: Nth order (e.g., 2nd order)
- **Lifetime Orders**: Total order count ≥ or ≤
- **Lifetime Spend**: Customer's total spend ≥ or ≤
- **Customer Tags**: Has or doesn't have specific tags

#### C. Location Conditions (Geographic Targeting)
- **Shipping Pincode/ZIP**:
  - Exact match
  - Starts with (for area codes)
  - In list (comma-separated)
- **Shipping City**: Exact or in list
- **Shipping State/Province**: Exact or in list
- **Shipping Country**: Country code exact or in list

Example use cases:
- Reward only Bangalore customers
- Exclude pincodes starting with "8"
- Extra rewards for Maharashtra state

#### D. Attribution Conditions (UTM Tracking)
- **utm_source**: Track traffic source
- **utm_medium**: Track marketing medium
- **utm_campaign**: Track specific campaigns

Supports attribution via order note attributes or metafields.

### 3. Exclusion Rules

Automatically exclude:
- Refunded orders
- Cancelled orders
- Test/staff orders

Each exclusion can be toggled on/off per campaign.

### 4. Reward Actions

Configure how rewards are allocated:
- **Allocation Timing**: Instant or delayed (after fulfillment)
- **Claim Method**: Auto-allocate or click-to-claim
- **Expiry Days**: How long rewards remain valid

### 5. Guardrails & Limits

Protect your budget with:
- **Max Rewards Per Customer**: Limit per individual
- **Max Total Rewards**: Overall campaign cap
- **Budget Cap**: Monetary limit

## Database Schema

### New Tables

#### `campaign_rule_evaluations`
Tracks every rule evaluation with:
- Campaign rule ID
- Order and customer info
- Evaluation result (matched/not_matched/excluded)
- Matched conditions (which passed)
- Failed conditions (which didn't pass)
- Reward allocation status
- Metadata for debugging

### New Columns on `campaign_rules`

- `rule_version`: 1 (legacy) or 2 (advanced)
- `eligibility_conditions`: JSONB customer conditions
- `location_conditions`: JSONB geographic targeting
- `attribution_conditions`: JSONB UTM tracking
- `exclusion_rules`: JSONB exclusion settings
- `reward_action`: JSONB reward configuration
- `guardrails`: JSONB limits and caps
- `required_scopes`: Array of Shopify API scopes needed

## How to Use

### Creating an Advanced Rule

1. Navigate to **Advanced Rules** in the client menu
2. Click **Create Advanced Rule**
3. Fill in basic details (name, program)
4. Configure each section:

#### Trigger Conditions
Add one or more conditions that trigger the campaign:
```
Example: Order Value ≥ 1000 AND Coupon Code contains "WELCOME"
```

#### Eligibility Conditions
Add customer-based eligibility:
```
Example: Customer Type = New AND Lifetime Orders ≤ 1
```

#### Location Conditions
Add geographic targeting:
```
Example: Shipping City in list "Mumbai,Delhi,Bangalore"
```

#### Attribution Conditions
Track campaign source:
```
Example: utm_source = "facebook" AND utm_campaign contains "summer"
```

#### Exclusion Rules
Toggle automatic exclusions:
- ✓ Exclude Refunded Orders
- ✓ Exclude Cancelled Orders
- ✓ Exclude Test Orders

#### Reward Action
Configure reward delivery:
- Allocation Timing: Instant
- Claim Method: Auto-Allocate
- Expiry: 90 days

#### Guardrails
Set limits:
- Max 1 reward per customer
- Max 1000 total rewards
- Budget cap: $10,000

5. Set priority, dates, and activation
6. Click **Create Rule**

## Evaluation Flow

### When Rules are Evaluated

Campaign rules are evaluated on:
1. Shopify order creation (`orders/create` webhook)
2. Shopify order payment (`orders/paid` webhook)
3. Custom internal events

### Evaluation Process

1. **Load Active Rules**: Get all active rules for client, ordered by priority
2. **Check Exclusions**: Skip if order is refunded/cancelled/test
3. **Evaluate Conditions**: Check each condition group (all must pass)
4. **Log Result**: Record evaluation in audit table
5. **Allocate Reward**: If matched, trigger reward allocation

### Audit Logging

Every evaluation is logged with:
- Which conditions matched
- Which conditions failed
- Final evaluation result
- Reward allocation status

Access logs via Campaign Trigger Logs page.

## Shopify Scopes

### Required Scopes (Phase 1)
- `read_orders`: For order-based conditions
- `read_customers`: For customer-based conditions
- `read_products`: For product-based conditions
- `read_discounts`: For coupon-based conditions

### Scope Checking

The UI automatically:
- Checks available Shopify scopes
- Disables unavailable condition types
- Shows "Requires additional permission" warnings
- Gracefully degrades without breaking

## Backward Compatibility

### Legacy Campaigns (v1)
- Existing campaigns continue to work unchanged
- Auto-migrated to version 1 structure
- Simple trigger_conditions format preserved
- No action required from users

### New Campaigns (v2)
- Use advanced rule builder
- Full condition support
- Enhanced audit logging
- Better Shopify integration

### Migration Notes
- All existing campaigns set to `rule_version: 1`
- Default exclusion rules applied to all campaigns
- Existing trigger_conditions preserved as-is
- No data loss or breaking changes

## Edge Function: evaluate-campaign-rules

### Endpoint
```
POST /functions/v1/evaluate-campaign-rules
```

### Request Body
```json
{
  "order": { /* Shopify order object */ },
  "customer": { /* Shopify customer object */ },
  "clientId": "uuid"
}
```

### Response
```json
{
  "success": true,
  "matchedRules": [
    {
      "ruleId": "uuid",
      "ruleName": "Premium Customer Reward",
      "programId": "uuid",
      "matched": true,
      "rewardAction": { /* reward config */ }
    }
  ],
  "evaluatedCount": 5
}
```

### Error Handling
- Invalid conditions return false (don't break evaluation)
- Errors logged with context
- Continues to next rule on error

## Best Practices

### 1. Use Priority Effectively
- Higher priority = evaluated first
- Use for mutually exclusive campaigns
- Prevents double-rewarding same order

### 2. Combine Conditions Strategically
```
✓ Good: Order Value ≥ 1000 AND Customer Type = New
✗ Avoid: Too many conflicting conditions
```

### 3. Test Before Activating
- Create rule as inactive
- Review evaluation logs
- Adjust conditions as needed
- Activate when confident

### 4. Set Appropriate Guardrails
- Always set budget caps
- Limit rewards per customer
- Monitor total allocations

### 5. Use Location Targeting Wisely
- Test pincode patterns first
- Use "starts with" for regions
- Maintain list of target cities

### 6. Track Attribution
- Add UTM parameters to campaigns
- Use consistent naming conventions
- Monitor which sources perform best

## Troubleshooting

### Rules Not Triggering

1. Check rule is active
2. Verify dates (start/end)
3. Review evaluation logs
4. Check failed conditions
5. Verify Shopify scopes

### Conditions Always Failing

1. Check data format (case sensitivity)
2. Verify Shopify sends expected data
3. Test with simpler conditions first
4. Review webhook payload structure

### Missing Scopes

1. Go to Integrations page
2. Reconnect Shopify app
3. Grant additional permissions
4. Verify in Integration Configs table

## Future Enhancements

Planned for future releases:
- Time-based conditions (happy hours, day of week)
- Advanced attribution models (first-touch, last-touch)
- Product collection conditions
- Customer segment targeting
- A/B testing support
- Rule templates

## Support

For questions or issues:
1. Check Campaign Trigger Logs for evaluation details
2. Review this documentation
3. Contact platform administrator
