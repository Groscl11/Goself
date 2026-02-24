# Multi-Tenant Store Installation & Tracking System

## Overview

Complete auto-registration and tracking system for multiple Shopify stores installing your plugins (loyalty, rewards, referral, etc.). When a store installs any plugin, the system automatically creates client profiles, registers webhooks, tracks installations, and manages multi-user access.

---

## System Architecture

### Database Tables

#### 1. `store_installations`
Master table tracking all Shopify stores that have installed your app.

**Key Fields:**
- Store details: `shop_domain`, `shop_name`, `shop_email`, `shop_owner`, `shop_plan`
- Installation status: `installation_status` (active, inactive, suspended, uninstalled)
- OAuth credentials: `access_token`, `scopes`, `api_version`
- Webhook health: `webhooks_registered`, `webhook_health_status`, `last_webhook_received_at`
- Billing: `billing_plan`, `billing_status`, `trial_ends_at`
- Timestamps: `installed_at`, `uninstalled_at`, `last_active_at`

#### 2. `store_plugins`
Tracks which plugins are installed per store.

**Plugin Types:**
- loyalty
- rewards
- referral
- campaigns
- membership
- widget
- analytics

**Key Fields:**
- `plugin_type`, `plugin_name`, `plugin_version`
- `status` (active, inactive, configured, pending)
- `plugin_config` (JSONB for plugin-specific settings)
- `feature_flags` (JSONB for A/B testing)
- Usage stats: `total_events_processed`, `total_users_affected`

#### 3. `store_webhooks`
Tracks webhook registration and health status per store.

**Key Fields:**
- `webhook_topic` (orders/create, orders/paid, etc.)
- `shopify_webhook_id` (Shopify's webhook ID)
- `status` (active, inactive, failed, pending)
- Health monitoring: `total_events_received`, `total_successful`, `total_failed`, `consecutive_failures`
- Error tracking: `last_error`, `error_details`

#### 4. `store_users`
Multi-user access management per store.

**User Roles:**
- `master_admin` - Full control, can manage users
- `admin` - Can manage store settings and plugins
- `member` - Limited access to view data
- `viewer` - Read-only access

**Key Fields:**
- `email`, `full_name`, `phone`
- `role`, `permissions` (JSONB)
- `status` (active, inactive, invited, suspended)
- `invitation_token`, `invitation_expires_at`
- `invited_by`, `last_login_at`

---

## Auto-Registration Flow

### When a Store Installs Your App

**1. OAuth Callback Triggered**
```
https://your-supabase-url/functions/v1/shopify-oauth-callback
?code=xxx&shop=store.myshopify.com
```

**2. Automatic Actions:**

```typescript
// Auto-create client profile
{
  name: "Store Name",
  email: "owner@store.com",
  company_name: "Store Name",
  status: "active",
  metadata: {
    source: "shopify_auto_install",
    shop_domain: "store.myshopify.com",
    shop_id: "12345"
  }
}

// Create store installation record
{
  client_id: "...",
  shop_domain: "store.myshopify.com",
  shop_name: "My Store",
  installation_status: "active",
  webhooks_registered: false,
  // ... all shop details
}

// Register webhooks (5 topics)
- orders/create
- orders/updated
- orders/paid
- customers/create
- customers/update

// Install default plugins
- Loyalty Points System
- Rewards Program
- Referral Program
- Campaign Management

// Create master admin user
{
  email: "owner@store.com",
  role: "master_admin",
  status: "active",
  permissions: {
    full_access: true,
    can_manage_users: true,
    can_manage_plugins: true
  }
}
```

**3. Result:**
Store is fully configured and ready to use within seconds of installation.

---

## Admin Dashboard - Store Tracking

### Access
**URL:** `/admin/store-installations`

**Permissions:** Admin users only

### Features

#### 1. Overview Stats
- Total stores installed
- Active stores
- Inactive stores
- Stores with healthy webhooks

#### 2. Store List View
**Columns:**
- Store name & domain
- Installation status (active, inactive, suspended, uninstalled)
- Webhook health (healthy, degraded, failed, unknown)
- Number of plugins installed
- Number of users with access
- Installation date

#### 3. Search & Filters
- Search by domain, name, or email
- Filter by installation status
- Real-time data refresh

#### 4. Store Details Modal
Click on any store to view:

**Store Information:**
- Email, phone, country
- Shopify plan
- Currency

**Installed Plugins:**
- Plugin name, type, version
- Status (active/inactive)
- Installation date

**Webhooks:**
- All registered webhook topics
- Status and health
- Total events received
- Last event timestamp

**Store Users:**
- All users with access
- Their roles and status
- Email addresses

---

## Webhook URL

Your system automatically registers this webhook URL for all stores:

```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
```

### Registered Topics
1. **orders/create** - New order placed
2. **orders/updated** - Order status changed
3. **orders/paid** - Payment received
4. **customers/create** - New customer account
5. **customers/update** - Customer info updated

### What Webhooks Do
When webhook received:
1. Log event to `shopify_webhook_events`
2. Update `last_webhook_received_at` timestamp
3. Auto-create member if new customer
4. Save order to `shopify_orders`
5. Execute campaign rules (auto-enrollment)
6. Process loyalty points
7. Update webhook health metrics

---

## Multi-User Access System

### User Roles & Permissions

#### Master Admin
- Full access to all features
- Can invite and manage store users
- Can install/configure plugins
- Can view all analytics
- Can manage billing

#### Admin
- Can manage store settings
- Can configure plugins
- Can view reports
- Cannot manage users

#### Member
- Can view customer data
- Can process orders
- Limited configuration access

#### Viewer
- Read-only access
- Can view reports and analytics
- Cannot make changes

### Inviting Store Users

**Future Feature (Table Ready):**
```sql
INSERT INTO store_users (
  store_installation_id,
  client_id,
  email,
  full_name,
  role,
  status,
  invitation_token,
  invitation_expires_at,
  invited_by
) VALUES (...);
```

The `store_users` table is fully set up with:
- Invitation tokens
- Expiration dates
- Invited by tracking
- Activation timestamps

---

## Health Monitoring

### Webhook Health Status

**Healthy:** All webhooks receiving events regularly
- All registered webhooks active
- No consecutive failures
- Events processed in last 24 hours

**Degraded:** Some issues detected
- Some webhooks failing
- 1-3 consecutive failures
- Slow event processing

**Failed:** Critical issues
- Multiple webhooks down
- 4+ consecutive failures
- No events in 48+ hours

### Automatic Tracking
System automatically tracks:
- Total events received per webhook
- Success/failure rates
- Last successful event timestamp
- Consecutive failure count
- Error messages and details

---

## Plugin Management

### Default Plugins Installed
On installation, every store gets:

1. **Loyalty Points System**
   - Points earning rules
   - Points redemption
   - Tier management

2. **Rewards Program**
   - Reward catalog
   - Discount codes
   - Gift vouchers

3. **Referral Program**
   - Referral tracking
   - Referral rewards
   - Share links

4. **Campaign Management**
   - Auto-enrollment campaigns
   - Order value triggers
   - Advanced rule engine

### Plugin Configuration
Each plugin has:
- `plugin_config` - Plugin-specific settings (JSONB)
- `feature_flags` - A/B testing flags (JSONB)
- Usage tracking
- Version management

### Adding New Plugins
To add a new plugin type:

```sql
-- Update CHECK constraint
ALTER TABLE store_plugins DROP CONSTRAINT IF EXISTS store_plugins_plugin_type_check;
ALTER TABLE store_plugins ADD CONSTRAINT store_plugins_plugin_type_check
  CHECK (plugin_type IN ('loyalty', 'rewards', 'referral', 'campaigns', 'membership', 'widget', 'analytics', 'your_new_type'));
```

Then update `DEFAULT_PLUGINS` in `shopify-oauth-callback/index.ts`.

---

## API Integration

### OAuth Installation URL

**Start Installation:**
```
https://your-app.com/client/integrations
```

User clicks "Connect Shopify" → OAuth flow starts → Callback handles registration

### Webhook URL
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
```

### Manual Webhook Registration
```bash
POST https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-register-webhooks

{
  "shop": "store.myshopify.com",
  "access_token": "shpat_xxxxx"
}
```

---

## Database Queries

### Get All Active Stores
```sql
SELECT
  si.shop_domain,
  si.shop_name,
  si.installation_status,
  si.webhooks_registered,
  si.webhook_health_status,
  c.name as client_name,
  COUNT(sp.id) as plugins_count,
  COUNT(su.id) as users_count
FROM store_installations si
JOIN clients c ON c.id = si.client_id
LEFT JOIN store_plugins sp ON sp.store_installation_id = si.id
LEFT JOIN store_users su ON su.store_installation_id = si.id
WHERE si.installation_status = 'active'
GROUP BY si.id, c.name
ORDER BY si.installed_at DESC;
```

### Check Webhook Health
```sql
SELECT
  si.shop_domain,
  sw.webhook_topic,
  sw.status,
  sw.total_events_received,
  sw.total_failed,
  sw.consecutive_failures,
  sw.last_event_at
FROM store_webhooks sw
JOIN store_installations si ON si.id = sw.store_installation_id
WHERE sw.status != 'active'
   OR sw.consecutive_failures > 3
ORDER BY sw.consecutive_failures DESC;
```

### Get Store's Plugin Usage
```sql
SELECT
  si.shop_domain,
  sp.plugin_name,
  sp.plugin_type,
  sp.status,
  sp.total_events_processed,
  sp.total_users_affected,
  sp.installed_at
FROM store_plugins sp
JOIN store_installations si ON si.id = sp.store_installation_id
WHERE si.shop_domain = 'store.myshopify.com'
ORDER BY sp.installed_at;
```

---

## Security & RLS Policies

### Store Installations
- **Admins** can view all stores
- **Store users** can view only their store
- **System** (service role) can manage all records

### Store Plugins
- **Admins** can view all plugins
- **Store admins** can manage their store's plugins
- **Store users** can view their store's plugins

### Store Webhooks
- **Admins** can view all webhooks
- **Store users** can view their store's webhooks
- **System** can update webhook status

### Store Users
- **Admins** can view all store users
- **Master admins** can manage their store's users
- **Store users** can view their team members

---

## Testing the System

### 1. Install Test Store
```bash
# Use Shopify Partners test store
# Install your app via OAuth
# Check admin dashboard for new store entry
```

### 2. Verify Auto-Registration
```sql
-- Check client created
SELECT * FROM clients WHERE metadata->>'source' = 'shopify_auto_install' ORDER BY created_at DESC LIMIT 1;

-- Check store installation
SELECT * FROM store_installations ORDER BY installed_at DESC LIMIT 1;

-- Check plugins installed
SELECT * FROM store_plugins WHERE store_installation_id = 'xxx';

-- Check webhooks registered
SELECT * FROM store_webhooks WHERE store_installation_id = 'xxx';

-- Check master admin created
SELECT * FROM store_users WHERE role = 'master_admin' ORDER BY created_at DESC LIMIT 1;
```

### 3. Test Webhook
Place a test order in Shopify store and verify:
```sql
-- Check webhook received
SELECT * FROM shopify_webhook_events ORDER BY created_at DESC LIMIT 1;

-- Check order saved
SELECT * FROM shopify_orders ORDER BY processed_at DESC LIMIT 1;

-- Check webhook health updated
SELECT webhook_health_status, last_webhook_received_at
FROM store_installations
WHERE shop_domain = 'test-store.myshopify.com';
```

---

## Monitoring & Maintenance

### Daily Checks
1. Webhook health status
2. Failed webhook count
3. Store installation status
4. Plugin activation rates

### Weekly Reviews
1. New store installations
2. Store uninstallations
3. User access patterns
4. Plugin usage statistics

### Monthly Analysis
1. Growth metrics
2. Churn rate
3. Most used plugins
4. Support ticket patterns

---

## Next Steps

### Immediate
1. Test OAuth flow with a Shopify development store
2. Verify auto-registration creates all records
3. Place test order to verify webhooks
4. Check admin dashboard displays correctly

### Future Enhancements
1. **Store User Invitations**
   - Build invitation email system
   - Create user onboarding flow
   - Add role management UI

2. **Billing Integration**
   - Shopify App Bridge billing
   - Plan upgrade/downgrade
   - Usage-based billing

3. **Analytics Dashboard**
   - Store performance metrics
   - Plugin usage analytics
   - Revenue tracking per store

4. **Plugin Marketplace**
   - Browse available plugins
   - One-click installation
   - Plugin ratings/reviews

5. **Automated Health Checks**
   - Webhook failure alerts
   - Automatic retry logic
   - Store admin notifications

---

## Support

### Common Issues

**Webhooks Not Receiving Events:**
1. Check webhook registration status
2. Verify HMAC signature validation
3. Check Shopify webhook delivery logs
4. Ensure store is active

**Store Not Appearing in Dashboard:**
1. Verify OAuth callback completed successfully
2. Check RLS policies allow viewing
3. Ensure admin user logged in
4. Refresh the page

**Plugins Not Installing:**
1. Check store_plugins table for errors
2. Verify plugin types in database constraint
3. Check function logs for errors

---

## Summary

Your multi-tenant system now:
- ✅ Auto-creates client profiles on app install
- ✅ Tracks all store installations with full details
- ✅ Registers webhooks automatically (5 topics)
- ✅ Monitors webhook health in real-time
- ✅ Installs default plugins (loyalty, rewards, referral, campaigns)
- ✅ Creates master admin users
- ✅ Supports multi-user access per store
- ✅ Provides comprehensive admin dashboard
- ✅ Tracks plugin usage and events
- ✅ Maintains security with RLS policies

**All stores installing your Shopify app are automatically registered, configured, and ready to use within seconds!**
