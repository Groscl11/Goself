# Shopify Integration & Redemption System - Complete Guide

## Overview

This implementation adds comprehensive Shopify integration with order syncing and a public reward redemption system for your membership platform.

## What's Been Implemented

### 1. Database Tables

Three new tables have been created to support the integration:

#### `shopify_orders`
- Stores all orders synced from Shopify
- Tracks customer email, phone, order details
- Automatically updated via webhook
- Linked to clients for multi-tenant support

#### `redemption_links`
- Manages unique redemption links for membership programs
- Tracks usage limits and expiration dates
- Supports unlimited or limited use cases
- Can be embedded in Shopify thank you pages and emails

#### `redemption_tracking`
- Records all redemption attempts
- Captures customer information (email, phone)
- Links to member accounts when available
- Provides analytics on redemption success

### 2. Shopify Integration Components

#### Interactive Setup Guide (`ShopifySetupGuide.tsx`)
A comprehensive, step-by-step accordion guide that walks clients through:
- Accessing the Shopify Dev Dashboard
- Creating a custom app
- Configuring API scopes (read_orders, read_customers)
- Installing the app and retrieving credentials
- Setting up webhooks for automatic order sync
- Testing the integration

The guide includes:
- Copy-to-clipboard functionality for webhook URLs
- Direct links to Shopify admin
- Visual step indicators
- Collapsible sections for easy navigation

#### Enhanced Integrations Page
The client integrations page now includes:
- Shopify configuration form with credential management
- Interactive setup guide
- Redemption link manager
- Integration status tracking
- Connection testing

### 3. Webhook Handler (Edge Function)

**Function Name:** `shopify-webhook`
**Endpoint:** `{SUPABASE_URL}/functions/v1/shopify-webhook`

Features:
- Handles Shopify `orders/create` and `orders/updated` webhooks
- Validates requests using Shopify headers
- Stores order data with customer information
- Uses upsert to prevent duplicates
- Supports multi-tenant architecture (matches by shop domain)
- Includes proper CORS headers for security
- Automatic error handling and logging

### 4. Redemption Link Manager (`RedemptionLinkManager.tsx`)

A complete link management system for clients:

**Features:**
- Generate unique redemption codes (8-character alphanumeric)
- Associate links with specific membership programs
- Set usage limits (unlimited or specific number)
- Set expiration dates
- View usage statistics
- Copy links to clipboard
- Toggle active/inactive status
- Delete links
- Preview links in new tab

**Integration Templates Included:**
- Shopify thank you page HTML snippet
- Email template example
- Ready-to-copy code with visual styling

### 5. Public Redemption Page (`RewardRedemption.tsx`)

A beautiful, public-facing page for customers to redeem rewards:

**Features:**
- Validates redemption codes
- Checks link expiration and usage limits
- Displays program details and benefits
- Collects customer email and phone
- Auto-creates member accounts if needed
- Auto-enrolls in membership program
- Shows success confirmation with next steps
- Mobile-responsive design
- Error handling for invalid/expired links

**User Flow:**
1. Customer clicks redemption link from thank you page/email
2. Sees program details and benefits
3. Enters email and phone number
4. System creates/finds member account
5. Enrolls in membership program
6. Allocates rewards automatically (via existing trigger)
7. Shows success message with benefits

### 6. Automatic Features

**Redemption Tracking:**
- Trigger automatically increments `uses_count` on redemption
- Tracks IP address and user agent for analytics
- Links redemptions to member accounts

**Reward Allocation:**
- Existing trigger automatically allocates rewards when enrolled
- No manual intervention needed

## How to Use This System

### For Clients - Setting Up Shopify

1. **Navigate to Integrations**
   - Go to Client Dashboard → Integrations

2. **Follow the Setup Guide**
   - Click "Configure" on the Shopify card
   - Follow the interactive 6-step guide
   - Each step is expandable with detailed instructions

3. **Enter Your Credentials**
   - Shop Domain: `yourstore.myshopify.com`
   - API Key: From Shopify app
   - API Secret: From Shopify app
   - Access Token: From Shopify app

4. **Verify Webhook Setup**
   - Webhook URL is automatically provided
   - Copy it into Shopify webhook settings
   - Subscribe to "Order creation" event

### For Clients - Creating Redemption Links

1. **Navigate to Integrations**
   - Scroll to "Redemption Links" section
   - Click "Create Link"

2. **Configure Link**
   - Select membership program
   - Set max uses (optional - leave blank for unlimited)
   - Set expiration days (optional - leave blank for never expires)

3. **Copy and Use**
   - Copy the generated link
   - Add to Shopify thank you pages
   - Include in order confirmation emails
   - Share in marketing materials

### For Clients - Adding to Shopify

**Option 1: Thank You Page (Recommended)**

Add the HTML snippet provided in the integration instructions to:
- Shopify Admin → Settings → Checkout → Order status page
- Additional scripts section

**Option 2: Email Templates**

Add the redemption link to:
- Order confirmation emails
- Shipping confirmation emails
- Marketing emails

**Option 3: Custom Liquid Templates**

For advanced users, add to theme templates:
```liquid
{% if checkout.order_number %}
  <a href="YOUR_REDEMPTION_LINK">Claim Your Rewards</a>
{% endif %}
```

### For End Users (Customers)

1. **Complete Purchase**
   - Customer makes a purchase on Shopify store

2. **See Redemption Offer**
   - On thank you page or in email
   - Click redemption link

3. **Claim Rewards**
   - Enter email and phone number
   - Submit form

4. **Get Enrolled**
   - Automatically enrolled in membership
   - Rewards allocated based on program rules
   - Can now access member portal

## Technical Details

### Security

- RLS policies protect all tables
- Public can only view active links by code
- Webhook endpoint validates Shopify headers
- Member data properly isolated by client
- Service role used for webhook operations

### Database Indexes

Optimized for performance:
- `idx_shopify_orders_client_order` - Fast order lookup
- `idx_shopify_orders_email` - Customer email search
- `idx_redemption_links_code` - Quick code validation
- `idx_redemption_tracking_link` - Analytics queries

### API Endpoints

**Webhook Endpoint:**
```
POST {SUPABASE_URL}/functions/v1/shopify-webhook
```

**Public Redemption:**
```
GET /redeem?code={UNIQUE_CODE}
```

### Data Flow

1. **Order Sync:**
   ```
   Shopify Order → Webhook → Edge Function → shopify_orders table
   ```

2. **Redemption:**
   ```
   Customer → Redemption Page → Creates/Finds Member →
   Enrolls in Program → Trigger Allocates Rewards → Success Page
   ```

## Testing

### Test Shopify Integration

1. Create a test order in Shopify
2. Check Shopify webhook deliveries
3. Verify order appears in database
4. Confirm customer email is captured

### Test Redemption Flow

1. Create a redemption link
2. Open link in incognito browser
3. Enter test email/phone
4. Verify enrollment in database
5. Check rewards allocation

## Monitoring

**Shopify Orders:**
```sql
SELECT * FROM shopify_orders
WHERE client_id = 'YOUR_CLIENT_ID'
ORDER BY created_at DESC;
```

**Redemption Analytics:**
```sql
SELECT
  rl.unique_code,
  rl.uses_count,
  COUNT(rt.id) as total_redemptions
FROM redemption_links rl
LEFT JOIN redemption_tracking rt ON rt.link_id = rl.id
WHERE rl.client_id = 'YOUR_CLIENT_ID'
GROUP BY rl.id;
```

## Troubleshooting

### Orders Not Syncing

1. Check webhook status in Shopify
2. Verify credentials are correct
3. Check integration is marked as active
4. Review edge function logs

### Redemption Link Not Working

1. Verify link is marked as active
2. Check expiration date
3. Verify usage limits not exceeded
4. Test in incognito mode

### Member Not Getting Rewards

1. Check enrollment was created
2. Verify trigger is enabled
3. Check membership program has rewards assigned
4. Review reward allocation limits

## Future Enhancements

Potential additions:
- Order value-based campaign triggers
- Abandoned cart integration
- Customer lifetime value tracking
- Multi-store support
- Advanced analytics dashboard
- SMS notifications for redemptions

## Support

For issues or questions:
1. Check edge function logs in Supabase
2. Review webhook delivery logs in Shopify
3. Verify database records were created
4. Check browser console for errors

---

**Implementation Complete!**

All components are deployed, tested, and ready for production use. The system is fully integrated and clients can start setting up their Shopify stores immediately.
