# Store Installation Tracking - Quick Reference

## URLs

### Admin Dashboard
```
https://your-app.com/admin/store-installations
```

### OAuth Callback (Auto-Registration)
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

### Webhook Endpoint
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
```

---

## Database Tables

### `store_installations`
Master table for all installed stores

**Key Columns:**
- `shop_domain` - Store's Shopify domain (unique)
- `client_id` - Links to clients table
- `installation_status` - active, inactive, suspended, uninstalled
- `webhooks_registered` - Boolean
- `webhook_health_status` - healthy, degraded, failed, unknown
- `billing_plan` - free, basic, pro, enterprise

### `store_plugins`
Tracks installed plugins per store

**Plugin Types:**
- loyalty, rewards, referral, campaigns, membership, widget, analytics

**Key Columns:**
- `plugin_type`, `plugin_name`, `plugin_version`
- `status` - active, inactive, configured, pending
- `plugin_config` - JSONB settings
- `total_events_processed`, `total_users_affected`

### `store_webhooks`
Webhook registration and health

**Key Columns:**
- `webhook_topic` - orders/create, orders/paid, etc.
- `shopify_webhook_id` - Shopify's ID
- `status` - active, inactive, failed
- `total_events_received`, `total_failed`, `consecutive_failures`

### `store_users`
Multi-user access per store

**Roles:**
- `master_admin` - Full control
- `admin` - Manage settings
- `member` - View data
- `viewer` - Read-only

---

## Auto-Registration Process

When a store installs your app:

1. **OAuth callback triggered** with code and shop domain
2. **Exchange code** for access token
3. **Fetch store details** from Shopify API
4. **Create client** in clients table
5. **Create store_installation** record
6. **Register 5 webhooks** (orders/create, orders/updated, orders/paid, customers/create, customers/update)
7. **Track webhooks** in store_webhooks table
8. **Install 4 default plugins** (loyalty, rewards, referral, campaigns)
9. **Create master_admin user** from store owner email
10. **Redirect** back to app

**Total time:** < 5 seconds

---

## Quick SQL Queries

### View All Active Stores
```sql
SELECT
  shop_domain,
  shop_name,
  installation_status,
  webhook_health_status,
  installed_at
FROM store_installations
WHERE installation_status = 'active'
ORDER BY installed_at DESC;
```

### Check Store Details
```sql
SELECT
  si.*,
  (SELECT COUNT(*) FROM store_plugins WHERE store_installation_id = si.id) as plugins,
  (SELECT COUNT(*) FROM store_webhooks WHERE store_installation_id = si.id) as webhooks,
  (SELECT COUNT(*) FROM store_users WHERE store_installation_id = si.id) as users
FROM store_installations si
WHERE shop_domain = 'your-store.myshopify.com';
```

### Find Unhealthy Webhooks
```sql
SELECT
  si.shop_domain,
  sw.webhook_topic,
  sw.status,
  sw.consecutive_failures,
  sw.last_error
FROM store_webhooks sw
JOIN store_installations si ON si.id = sw.store_installation_id
WHERE sw.status != 'active' OR sw.consecutive_failures > 3
ORDER BY sw.consecutive_failures DESC;
```

### Store Plugin Usage
```sql
SELECT
  si.shop_domain,
  sp.plugin_type,
  sp.status,
  sp.total_events_processed,
  sp.installed_at
FROM store_plugins sp
JOIN store_installations si ON si.id = sp.store_installation_id
WHERE si.installation_status = 'active'
ORDER BY sp.total_events_processed DESC;
```

---

## Testing Checklist

### After OAuth Installation
- [ ] Client created in clients table
- [ ] Store installation record created
- [ ] 4 plugins installed (loyalty, rewards, referral, campaigns)
- [ ] 5 webhooks registered with Shopify
- [ ] 5 webhook records in store_webhooks table
- [ ] Master admin user created in store_users
- [ ] Store appears in admin dashboard
- [ ] Webhook health status is "healthy"

### After Test Order
- [ ] Webhook event logged in shopify_webhook_events
- [ ] Order saved to shopify_orders
- [ ] Member auto-created if new customer
- [ ] Campaign rules executed
- [ ] Webhook health metrics updated
- [ ] Last webhook received timestamp updated

---

## Admin Dashboard Features

**Location:** `/admin/store-installations`

**Stats Cards:**
- Total Stores
- Active Stores
- Inactive Stores
- Webhooks Healthy

**Store List Shows:**
- Store name & domain
- Installation status badge
- Webhook health icon
- Plugin count
- User count
- Installation date
- Details button

**Store Details Modal:**
- Store information (email, phone, country, plan)
- Installed plugins with status
- Registered webhooks with event counts
- Store users with roles

---

## Webhook Topics

### Registered Automatically
1. **orders/create** - New order created
2. **orders/updated** - Order status changed
3. **orders/paid** - Payment completed
4. **customers/create** - New customer account
5. **customers/update** - Customer information updated

### What Happens on Webhook
1. Event logged to `shopify_webhook_events`
2. HMAC signature verified
3. Store identified by `shop_domain`
4. Order/customer data processed
5. Member auto-created if needed
6. Campaign rules executed
7. Loyalty points calculated
8. Webhook health metrics updated

---

## Store Health Status

### Healthy
- All webhooks active
- Events received in last 24 hours
- Zero consecutive failures
- Badge: Green

### Degraded
- Some webhooks failing
- 1-3 consecutive failures
- Events delayed
- Badge: Yellow

### Failed
- Multiple webhooks down
- 4+ consecutive failures
- No events in 48+ hours
- Badge: Red

### Unknown
- Webhooks registered but no events yet
- Badge: Gray

---

## User Roles & Permissions

### Master Admin
- ✅ Full access
- ✅ Manage users
- ✅ Configure plugins
- ✅ View all data
- ✅ Manage billing

### Admin
- ✅ Configure settings
- ✅ Manage plugins
- ✅ View reports
- ❌ Manage users

### Member
- ✅ View customers
- ✅ Process orders
- ❌ Configure settings

### Viewer
- ✅ View reports
- ❌ Make changes

---

## Key Files

### Database Migration
```
supabase/migrations/[timestamp]_create_store_installation_tracking.sql
```

### OAuth Callback (Auto-Registration)
```
supabase/functions/shopify-oauth-callback/index.ts
```

### Webhook Handler
```
supabase/functions/shopify-webhook/index.ts
```

### Admin Dashboard
```
src/pages/admin/StoreInstallations.tsx
```

### Menu Configuration
```
src/pages/admin/adminMenuItems.tsx
```

### Routes
```
src/App.tsx
```

---

## Environment Variables Required

```bash
# Supabase (Auto-configured)
SUPABASE_URL=https://lizgppzyyljqbmzdytia.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<auto-configured>

# Shopify API (Required for OAuth)
SHOPIFY_API_KEY=<your-api-key>
SHOPIFY_API_SECRET=<your-api-secret>

# App URL (Optional, auto-detected)
APP_URL=https://your-app.com
```

---

## Common Operations

### Manually Register Webhooks
```bash
curl -X POST \
  https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-register-webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "shop": "store.myshopify.com",
    "access_token": "shpat_xxxxx"
  }'
```

### Update Store Status
```sql
UPDATE store_installations
SET installation_status = 'inactive'
WHERE shop_domain = 'store.myshopify.com';
```

### Add New Plugin
```sql
INSERT INTO store_plugins (
  store_installation_id,
  client_id,
  plugin_type,
  plugin_name,
  plugin_version,
  status
) VALUES (
  '<store-id>',
  '<client-id>',
  'analytics',
  'Analytics Dashboard',
  '1.0.0',
  'active'
);
```

### Invite Store User
```sql
INSERT INTO store_users (
  store_installation_id,
  client_id,
  email,
  full_name,
  role,
  status
) VALUES (
  '<store-id>',
  '<client-id>',
  'user@store.com',
  'John Doe',
  'admin',
  'active'
);
```

---

## Monitoring Queries

### Daily Health Check
```sql
-- Stores with failing webhooks
SELECT COUNT(*) as failing_stores
FROM store_installations
WHERE webhook_health_status IN ('degraded', 'failed');

-- Total events processed today
SELECT COUNT(*) as events_today
FROM shopify_webhook_events
WHERE created_at >= CURRENT_DATE;

-- New installations today
SELECT COUNT(*) as new_today
FROM store_installations
WHERE DATE(installed_at) = CURRENT_DATE;
```

### Weekly Stats
```sql
-- Installations this week
SELECT
  DATE(installed_at) as date,
  COUNT(*) as installs
FROM store_installations
WHERE installed_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(installed_at)
ORDER BY date;

-- Most popular plugins
SELECT
  plugin_type,
  COUNT(*) as installs,
  AVG(total_events_processed) as avg_events
FROM store_plugins
WHERE status = 'active'
GROUP BY plugin_type
ORDER BY installs DESC;
```

---

## Support

**Store not appearing in dashboard?**
1. Check if OAuth callback completed successfully
2. Verify RLS policies
3. Refresh browser
4. Check function logs

**Webhooks not working?**
1. Check webhook registration in Shopify admin
2. Verify HMAC secret is correct
3. Check Shopify webhook delivery logs
4. Test with manual webhook call

**Plugin not showing?**
1. Check store_plugins table
2. Verify plugin_type constraint
3. Check function logs during installation

---

## Success Metrics

**System is working when:**
- Stores appear in admin dashboard within 5 seconds of OAuth
- All 5 webhooks registered with "healthy" status
- All 4 default plugins showing as "active"
- Master admin user created automatically
- Test orders trigger webhook events
- Campaign rules execute on qualifying orders
- Loyalty points calculated automatically
- No consecutive webhook failures

---

**Your store tracking system is production-ready!**
