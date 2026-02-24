# Advanced Rule Engine - Deployment Guide

This guide covers deploying the new advanced campaign rule engine to your RewardHub instance.

## Prerequisites

- Supabase project configured
- Database migrations applied
- Edge functions capability enabled

## Deployment Steps

### 1. Apply Database Migration

The database schema has been updated with new tables and columns:

```sql
-- Already applied via migration:
-- upgrade_campaign_rules_engine.sql
```

This migration adds:
- New columns to `campaign_rules` table
- `campaign_rule_evaluations` audit table
- Backward compatibility for existing campaigns
- RLS policies for security

### 2. Deploy Edge Function

Deploy the rule evaluation edge function:

```bash
# Using Supabase CLI (if available)
supabase functions deploy evaluate-campaign-rules

# Or use the Supabase dashboard:
# 1. Go to Edge Functions
# 2. Create new function "evaluate-campaign-rules"
# 3. Copy content from supabase/functions/evaluate-campaign-rules/index.ts
```

The function is located at:
```
/supabase/functions/evaluate-campaign-rules/index.ts
```

### 3. Verify Migration

Check that all existing campaigns were migrated:

```sql
-- All existing campaigns should have rule_version = 1
SELECT id, name, rule_version
FROM campaign_rules
WHERE rule_version IS NOT NULL;

-- Check new columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'campaign_rules'
  AND column_name IN (
    'rule_version',
    'eligibility_conditions',
    'location_conditions',
    'attribution_conditions',
    'exclusion_rules',
    'reward_action',
    'guardrails'
  );
```

### 4. Update Shopify Webhook (Optional)

If you want automatic evaluation, update the Shopify webhook handler to call the new evaluation function:

```typescript
// In shopify-webhook/index.ts
// After order processing, call:

const evaluationResponse = await fetch(
  `${supabaseUrl}/functions/v1/evaluate-campaign-rules`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      order: orderData,
      customer: customerData,
      clientId: integration.client_id,
    }),
  }
);
```

### 5. Test the Deployment

#### Test 1: Create Advanced Rule

1. Log in as a client user
2. Navigate to "Advanced Rules"
3. Create a new rule with:
   - Trigger: Order Value ≥ 100
   - Eligibility: Customer Type = New
   - Exclusions: All enabled
   - Guardrails: Max 1 per customer

#### Test 2: Verify Evaluation

```bash
# Call the edge function directly
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/evaluate-campaign-rules' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "order": {
      "id": "12345",
      "total_price": "150.00",
      "email": "test@example.com",
      "line_items": [],
      "shipping_address": {
        "city": "Mumbai",
        "province": "Maharashtra",
        "zip": "400001",
        "country_code": "IN"
      }
    },
    "customer": {
      "id": "67890",
      "email": "test@example.com",
      "orders_count": 1,
      "total_spent": "150.00"
    },
    "clientId": "YOUR_CLIENT_UUID"
  }'
```

#### Test 3: Check Audit Logs

```sql
-- View evaluation logs
SELECT
  cr.name as rule_name,
  cre.evaluation_result,
  cre.matched_conditions,
  cre.failed_conditions,
  cre.reward_allocated,
  cre.created_at
FROM campaign_rule_evaluations cre
JOIN campaign_rules cr ON cr.id = cre.campaign_rule_id
ORDER BY cre.created_at DESC
LIMIT 10;
```

## UI Verification

### 1. Check Menu Items

The client menu should now show:
- ✓ Campaigns (existing)
- ✓ **Advanced Rules** (new)
- ✓ Campaign Trigger Logs (existing)

### 2. Test UI Components

#### Advanced Rules Page
- List of rules with version badges
- Create rule button
- Priority and status display

#### Rule Builder
- Collapsible sections
- Condition builder
- Scope checking
- Add/remove conditions

#### Settings Page
- Communication settings section
- Template editor
- Provider selection (internal/external)

## Rollback Plan

If issues occur, rollback steps:

### 1. Database Rollback

```sql
-- Remove new columns (data loss!)
ALTER TABLE campaign_rules
  DROP COLUMN IF EXISTS rule_version,
  DROP COLUMN IF EXISTS eligibility_conditions,
  DROP COLUMN IF EXISTS location_conditions,
  DROP COLUMN IF EXISTS attribution_conditions,
  DROP COLUMN IF EXISTS exclusion_rules,
  DROP COLUMN IF EXISTS reward_action,
  DROP COLUMN IF EXISTS guardrails,
  DROP COLUMN IF EXISTS required_scopes;

-- Drop evaluation table
DROP TABLE IF EXISTS campaign_rule_evaluations;
```

### 2. UI Rollback

Remove route from App.tsx:
```typescript
// Comment out or remove:
// import { CampaignsAdvanced } from './pages/client/CampaignsAdvanced';
// <Route path="/client/campaigns-advanced" ... />
```

Remove menu item from clientMenuItems.tsx:
```typescript
// Comment out or remove:
// { label: 'Advanced Rules', path: '/client/campaigns-advanced', ... }
```

### 3. Edge Function Rollback

Delete the edge function via Supabase dashboard or CLI:
```bash
supabase functions delete evaluate-campaign-rules
```

## Monitoring

### Key Metrics to Monitor

1. **Rule Evaluations**
   - Total evaluations per day
   - Match rate (matched vs not_matched)
   - Average evaluation time

2. **Reward Allocations**
   - Rewards allocated via advanced rules
   - Budget consumption rate
   - Per-customer reward counts

3. **System Health**
   - Edge function errors
   - Database query performance
   - RLS policy performance

### Monitoring Queries

```sql
-- Evaluation summary (last 24 hours)
SELECT
  evaluation_result,
  COUNT(*) as count,
  COUNT(DISTINCT campaign_rule_id) as unique_rules
FROM campaign_rule_evaluations
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY evaluation_result;

-- Top performing rules
SELECT
  cr.name,
  COUNT(CASE WHEN cre.evaluation_result = 'matched' THEN 1 END) as matches,
  COUNT(CASE WHEN cre.reward_allocated THEN 1 END) as rewards_allocated
FROM campaign_rules cr
LEFT JOIN campaign_rule_evaluations cre ON cre.campaign_rule_id = cr.id
WHERE cre.created_at > NOW() - INTERVAL '7 days'
GROUP BY cr.id, cr.name
ORDER BY matches DESC
LIMIT 10;

-- Guardrail effectiveness
SELECT
  cr.name,
  cr.guardrails->>'max_rewards_per_customer' as max_per_customer,
  COUNT(DISTINCT cre.customer_email) as unique_customers,
  COUNT(*) as total_allocations
FROM campaign_rules cr
JOIN campaign_rule_evaluations cre ON cre.campaign_rule_id = cr.id
WHERE cre.reward_allocated = true
  AND cr.guardrails IS NOT NULL
GROUP BY cr.id, cr.name, cr.guardrails;
```

## Performance Optimization

### Database Indexes

Already created:
```sql
CREATE INDEX idx_rule_evaluations_campaign ON campaign_rule_evaluations(campaign_rule_id);
CREATE INDEX idx_rule_evaluations_client ON campaign_rule_evaluations(client_id);
CREATE INDEX idx_rule_evaluations_order ON campaign_rule_evaluations(shopify_order_id);
CREATE INDEX idx_rule_evaluations_created ON campaign_rule_evaluations(created_at);
```

### Edge Function Optimization

If evaluation is slow:
1. Cache Shopify customer data
2. Batch evaluate multiple rules
3. Skip inactive rules earlier
4. Optimize condition evaluation order

## Security Considerations

### RLS Policies

Verified:
- ✓ Clients can only view own rule evaluations
- ✓ Clients can only insert evaluations for own rules
- ✓ Campaign rules properly scoped to client

### API Security

- ✓ Edge function requires authentication
- ✓ Service role key used for database operations
- ✓ Client ID validated before evaluation
- ✓ No sensitive data exposed in logs

## Support Checklist

Before going live:
- [ ] Database migration applied successfully
- [ ] Edge function deployed and tested
- [ ] Existing campaigns working (v1)
- [ ] New advanced rules working (v2)
- [ ] Audit logging functional
- [ ] UI accessible and responsive
- [ ] Shopify scopes checked
- [ ] Communication settings configured
- [ ] Monitoring queries tested
- [ ] Rollback plan documented
- [ ] Team trained on new features

## Next Steps

After successful deployment:
1. Train client users on advanced rules
2. Migrate high-value campaigns to v2
3. Monitor performance metrics
4. Gather feedback for improvements
5. Plan Phase 2 enhancements

## Troubleshooting

### Common Issues

**Issue**: Rules not evaluating
- Check edge function logs
- Verify webhook is calling evaluation
- Check rule active status

**Issue**: Conditions always failing
- Review evaluation logs
- Check data format in Shopify webhook
- Verify condition operators

**Issue**: UI not loading
- Clear browser cache
- Check browser console for errors
- Verify routes in App.tsx

**Issue**: Scope warnings showing
- Reconnect Shopify integration
- Grant additional permissions
- Update integration_configs table

## Contact

For deployment support:
- Review logs in Supabase dashboard
- Check ADVANCED_RULE_ENGINE.md documentation
- Contact platform administrator
