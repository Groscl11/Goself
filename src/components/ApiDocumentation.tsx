import { useState } from 'react';
import { Copy, Check, Code, Book, UserPlus } from 'lucide-react';

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  authentication: string;
  badge?: string;
  requestBody?: { field: string; type: string; required: boolean; description: string }[];
  responseExample: string;
  exampleRequest?: string;
  errorCodes?: { code: string; description: string }[];
}

interface ApiDocumentationProps {
  supabaseUrl: string;
  anonKey: string;
}

export function ApiDocumentation({ supabaseUrl, anonKey }: ApiDocumentationProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'referral' | 'campaigns' | 'loyalty' | 'widgets'>('referral');

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // ─── REFERRAL APIs (NEW) ───────────────────────────────────────────────────
  const referralEndpoints: ApiEndpoint[] = [
    {
      method: 'POST',
      path: '/functions/v1/apply-referral-code',
      description: 'Apply a referral code when a new customer arrives via a referral link or enters a code at checkout. Creates a pending referral record that completes automatically when the referred customer places their first paid order.',
      authentication: 'No Authentication Required (Public)',
      badge: 'NEW',
      requestBody: [
        { field: 'referral_code', type: 'string', required: true, description: 'The referral code shared by the referrer (e.g. TESTUSER10)' },
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain (e.g. mystore.myshopify.com)' },
        { field: 'referred_email', type: 'string', required: false, description: 'Email of the customer being referred (email or phone required)' },
        { field: 'referred_phone', type: 'string', required: false, description: 'Phone of the customer being referred (email or phone required)' },
        { field: 'referred_name', type: 'string', required: false, description: 'Full name of the referred customer' },
      ],
      exampleRequest: `// Call when customer arrives via ?ref=CODE or enters code at checkout
fetch('${supabaseUrl}/functions/v1/apply-referral-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    referral_code: 'TESTUSER10',
    shop_domain: 'mystore.myshopify.com',
    referred_email: 'newcustomer@example.com',
    referred_name: 'Jane Doe'
  })
})`,
      responseExample: `// Success
{
  "success": true,
  "referral_id": "uuid",
  "referral_code": "TESTUSER10",
  "referrer_member_id": "uuid",
  "referred_member_id": "uuid-or-null",
  "message": "Referral applied successfully"
}

// Error cases
{ "error": "invalid_code", "message": "Referral code not found or does not belong to this shop" }
{ "error": "self_referral", "message": "You cannot refer yourself" }
{ "error": "already_referred", "message": "This customer already has a pending or completed referral" }`,
      errorCodes: [
        { code: 'invalid_code', description: 'Code not found or does not belong to this shop' },
        { code: 'self_referral', description: 'Referrer and referee are the same person' },
        { code: 'already_referred', description: 'Customer already has a pending or completed referral' },
        { code: 'shop_not_found', description: 'shop_domain not found in integration_configs or store_installations' },
      ],
    },
    {
      method: 'POST',
      path: '/functions/v1/complete-referral',
      description: 'Manually complete a referral and award points to both referrer and referee. This is called automatically by the Shopify webhook when a referred customer places their first paid order — you only need this for manual testing or edge cases.',
      authentication: 'No Authentication Required (Public)',
      badge: 'NEW • Auto-triggered by webhook',
      requestBody: [
        { field: 'member_user_id', type: 'string', required: true, description: 'UUID of the referred member (the one who placed the order)' },
        { field: 'loyalty_program_id', type: 'string', required: true, description: 'UUID of the loyalty program' },
        { field: 'order_id', type: 'string', required: false, description: 'Order ID for idempotency (prevents double-awarding)' },
        { field: 'order_amount', type: 'number', required: false, description: 'Order amount for reference' },
      ],
      exampleRequest: `// Normally auto-triggered by shopify-webhook on first paid order.
// Call manually only for testing:
fetch('${supabaseUrl}/functions/v1/complete-referral', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    member_user_id: 'referred-member-uuid',
    loyalty_program_id: 'program-uuid',
    order_id: 'shopify-order-123',
    order_amount: 1500.00
  })
})`,
      responseExample: `// Success — both sides awarded
{
  "success": true,
  "referral_id": "uuid",
  "referrer_member_id": "uuid",
  "referee_member_id": "uuid",
  "referrer_points_awarded": 200,
  "referee_points_awarded": 100,
  "referrer_new_balance": 650,
  "referee_new_balance": 100
}

// Skipped (not an error — just not applicable)
{ "success": true, "skipped": true, "reason": "not_first_order" }
{ "success": true, "skipped": true, "reason": "no_referrer_linked" }
{ "success": true, "skipped": true, "reason": "referral_expired" }`,
      errorCodes: [
        { code: 'not_first_order', description: 'Member has placed more than 1 order — referral only triggers on first' },
        { code: 'no_referrer_linked', description: 'Member has no referred_by_member_id set' },
        { code: 'no_pending_referral_found', description: 'No pending member_referral record found' },
        { code: 'referral_expired', description: 'Referral record is past its 90-day expiry' },
      ],
    },
    {
      method: 'POST',
      path: '/functions/v1/validate-referral-code',
      description: 'Validate a referral code and get the referrer\'s details. Use this to show a preview of who referred the customer before applying the code.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'referral_code', type: 'string', required: true, description: 'The referral code to validate' },
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
      ],
      exampleRequest: `// Use on landing page to preview referral before applying
fetch('${supabaseUrl}/functions/v1/validate-referral-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    referral_code: 'TESTUSER10',
    shop_domain: 'mystore.myshopify.com'
  })
})`,
      responseExample: `{
  "valid": true,
  "referral_code": "TESTUSER10",
  "referrer": {
    "name": "John Doe",
    "member_id": "uuid"
  }
}`,
    },
  ];

  // ─── CAMPAIGN APIs ─────────────────────────────────────────────────────────
  const campaignEndpoints: ApiEndpoint[] = [
    {
      method: 'POST',
      path: '/functions/v1/get-order-rewards',
      description: 'Get available rewards for an order based on campaign rules',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'order_id', type: 'string', required: true, description: 'Shopify order ID' },
        { field: 'order_value', type: 'number', required: true, description: 'Total order value' },
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email' },
        { field: 'customer_phone', type: 'string', required: false, description: 'Customer phone' },
        { field: 'campaign_id', type: 'string', required: false, description: 'Specific campaign ID (optional)' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/get-order-rewards', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    order_id: 'shopify_order_123',
    order_value: 150.00,
    customer_email: 'customer@example.com',
    campaign_id: 'CAMP-0001'
  })
})`,
      responseExample: `{
  "success": true,
  "rewards": [
    {
      "id": "uuid",
      "title": "20% Off Next Order",
      "description": "Get 20% discount",
      "reward_type": "discount",
      "discount_value": 20,
      "campaign_id": "CAMP-0001",
      "campaign_name": "VIP Welcome"
    }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/get-order-reward-link',
      description: 'Get the redemption link for a specific order after the webhook has processed it. Returns a tokenized link the customer can use to claim their rewards.',
      authentication: 'No Authentication Required (Public)',
      badge: 'NEW',
      requestBody: [
        { field: 'order_id', type: 'string', required: true, description: 'Shopify order ID' },
        { field: 'customer_email', type: 'string', required: true, description: 'Customer email' },
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
      ],
      exampleRequest: `// Call from thank-you page — retry every 2s for up to 10s if webhook is pending
fetch('${supabaseUrl}/functions/v1/get-order-reward-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    order_id: '12345',
    customer_email: 'customer@example.com',
    shop_domain: 'mystore.myshopify.com'
  })
})`,
      responseExample: `// Rewards ready
{
  "has_rewards": true,
  "redemption_url": "https://yourapp.com/redeem?token=abc123",
  "rewards": [{ "title": "20% Off", "campaign_name": "VIP" }],
  "primary_link": { "token": "abc123", "reward_count": 2 }
}

// Webhook not processed yet — retry
{ "has_rewards": false, "reason": "not_yet" }`,
    },
    {
      method: 'POST',
      path: '/functions/v1/check-campaign-rewards',
      description: 'Check if a customer qualifies for campaign rewards',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email' },
        { field: 'customer_phone', type: 'string', required: false, description: 'Customer phone' },
        { field: 'order_value', type: 'number', required: false, description: 'Order value to check' },
        { field: 'campaign_id', type: 'string', required: false, description: 'Specific campaign to check' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/check-campaign-rewards', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_email: 'customer@example.com',
    order_value: 100.00
  })
})`,
      responseExample: `{
  "qualified": true,
  "campaigns": [{ "campaign_id": "CAMP-0001", "name": "VIP Welcome", "rewards": [] }]
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/redeem-campaign-rewards',
      description: 'Redeem rewards from a campaign',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'token', type: 'string', required: true, description: 'Redemption token' },
        { field: 'reward_ids', type: 'array', required: true, description: 'Array of reward IDs to redeem' },
        { field: 'member_id', type: 'string', required: true, description: 'Member UUID' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/redeem-campaign-rewards', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    token: 'redemption_token_abc123',
    reward_ids: ['uuid1', 'uuid2'],
    member_id: 'member_uuid'
  })
})`,
      responseExample: `{
  "success": true,
  "allocations": [{ "reward_id": "uuid1", "voucher_code": "SAVE20-ABC123" }]
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/get-customer-rewards',
      description: 'Get all rewards available to a customer',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email' },
        { field: 'customer_phone', type: 'string', required: false, description: 'Customer phone' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/get-customer-rewards', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ customer_email: 'customer@example.com' })
})`,
      responseExample: `{
  "success": true,
  "rewards": [{ "id": "uuid", "title": "Free Shipping", "voucher_code": "SHIP-FREE123", "status": "active" }]
}`,
    },
  ];

  // ─── LOYALTY APIs ──────────────────────────────────────────────────────────
  const loyaltyEndpoints: ApiEndpoint[] = [
    {
      method: 'POST',
      path: '/functions/v1/register-loyalty-member',
      description: 'Register a new customer in the loyalty program or retrieve existing member',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'email', type: 'string', required: false, description: 'Customer email (email or phone required)' },
        { field: 'phone', type: 'string', required: false, description: 'Customer phone (email or phone required)' },
        { field: 'first_name', type: 'string', required: false, description: 'Customer first name' },
        { field: 'last_name', type: 'string', required: false, description: 'Customer last name' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/register-loyalty-member', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe'
  })
})`,
      responseExample: `{
  "success": true,
  "member": { "id": "uuid", "email": "customer@example.com", "total_points": 0 }
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/get-loyalty-status',
      description: 'Get customer loyalty points balance, tier, referral code, and recent transactions',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email' },
        { field: 'customer_phone', type: 'string', required: false, description: 'Customer phone' },
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/get-loyalty-status', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_email: 'customer@example.com',
    shop_domain: 'mystore.myshopify.com'
  })
})`,
      responseExample: `{
  "success": true,
  "points_balance": 500,
  "lifetime_points_earned": 1200,
  "referral_code": "JOHN2024",
  "referral_points_earned": 200,
  "tier": { "name": "Gold", "color": "#f59e0b" },
  "program": { "points_name": "Gems", "allow_redemption": true },
  "recent_transactions": [
    { "points_amount": 50, "transaction_type": "earned", "description": "Order #1234", "created_at": "..." }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/calculate-loyalty-points',
      description: 'Calculate loyalty points for an order amount with tier multipliers',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'order_amount', type: 'number', required: true, description: 'Order total amount' },
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email for tier multiplier' },
        { field: 'order_id', type: 'string', required: false, description: 'Order ID for reference tracking' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/calculate-loyalty-points', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    order_amount: 100.00,
    shop_domain: 'mystore.myshopify.com',
    customer_email: 'customer@example.com'
  })
})`,
      responseExample: `{
  "success": true,
  "points": 150,
  "base_points": 100,
  "tier_multiplier": 1.5,
  "tier_name": "Gold",
  "points_name": "Gems"
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/adjust-loyalty-points',
      description: 'Add or remove loyalty points for a customer manually',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'email', type: 'string', required: false, description: 'Customer email (email or phone required)' },
        { field: 'phone', type: 'string', required: false, description: 'Customer phone' },
        { field: 'points', type: 'number', required: true, description: 'Points to add (positive) or remove (negative)' },
        { field: 'reason', type: 'string', required: false, description: 'Reason for adjustment (audit trail)' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/adjust-loyalty-points', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    email: 'customer@example.com',
    points: 50,
    reason: 'Bonus for product review'
  })
})`,
      responseExample: `{
  "success": true,
  "previous_points": 100,
  "adjustment": 50,
  "new_total": 150
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/redeem-loyalty-points',
      description: 'Redeem loyalty points for a Shopify discount code',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'points', type: 'number', required: true, description: 'Points to redeem' },
        { field: 'customer_email', type: 'string', required: true, description: 'Customer email' },
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/redeem-loyalty-points', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    points: 100,
    customer_email: 'customer@example.com',
    shop_domain: 'mystore.myshopify.com'
  })
})`,
      responseExample: `{
  "success": true,
  "discount_code": "LOYALTY-ABC123",
  "discount_value": 10,
  "discount_type": "percentage",
  "points_redeemed": 100,
  "remaining_points": 400
}`,
    },
  ];

  // ─── WIDGET APIs ───────────────────────────────────────────────────────────
  const widgetEndpoints: ApiEndpoint[] = [
    {
      method: 'POST',
      path: '/functions/v1/get-widget-config',
      description: 'Get widget configuration for storefront display',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'widget_type', type: 'string', required: false, description: 'Type of widget (floating, banner, etc)' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/get-widget-config', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ shop_domain: 'mystore.myshopify.com' })
})`,
      responseExample: `{
  "success": true,
  "config": {
    "enabled": true,
    "widget_type": "floating",
    "position": "bottom-right",
    "theme": { "primary_color": "#3b82f6" }
  }
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/track-widget-event',
      description: 'Track widget interaction events for analytics',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'event_type', type: 'string', required: true, description: 'Event type (view, click, close)' },
        { field: 'widget_type', type: 'string', required: true, description: 'Widget type' },
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email if available' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/track-widget-event', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event_type: 'click',
    widget_type: 'floating',
    shop_domain: 'mystore.myshopify.com'
  })
})`,
      responseExample: `{ "success": true, "event_id": "uuid" }`,
    },
  ];


  // ─── EXTRA FUNCTIONS (missing from docs) ──────────────────────────────────
  const extraEndpoints: ApiEndpoint[] = [
    {
      method: 'POST',
      path: '/functions/v1/process-multi-redemption',
      description: 'Process multiple reward redemptions in a single call. Use when a customer redeems several campaign rewards at once from the rewards selection page.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'token', type: 'string', required: true, description: 'Redemption token from get-order-reward-link' },
        { field: 'selected_reward_ids', type: 'array', required: true, description: 'Array of reward allocation IDs the customer selected' },
        { field: 'customer_email', type: 'string', required: true, description: 'Customer email for verification' },
      ],
      exampleRequest: `fetch('https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/process-multi-redemption', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'redemption_token_abc123',
    selected_reward_ids: ['uuid1', 'uuid2'],
    customer_email: 'customer@example.com'
  })
})`,
      responseExample: `{
  "success": true,
  "redeemed": [
    { "reward_id": "uuid1", "voucher_code": "SAVE20-ABC", "title": "20% Off" },
    { "reward_id": "uuid2", "voucher_code": "SHIP-FREE", "title": "Free Shipping" }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/check-loyalty-redemption',
      description: 'Validate a loyalty points redemption before processing. Confirms the customer has sufficient points and returns the expected discount value.',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'customer_email', type: 'string', required: true, description: 'Customer email' },
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'points_to_redeem', type: 'number', required: true, description: 'Number of points to redeem' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/check-loyalty-redemption', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_email: 'customer@example.com',
    shop_domain: 'mystore.myshopify.com',
    points_to_redeem: 100
  })
})`,
      responseExample: `{ "valid": true, "current_balance": 500, "points_to_redeem": 100, "discount_value": 10, "remaining_after": 400 }`,
      errorCodes: [
        { code: 'insufficient_points', description: 'Customer does not have enough points' },
        { code: 'member_not_found', description: 'No loyalty member found for this email/shop' },
        { code: 'redemption_disabled', description: 'Points redemption is disabled for this program' },
      ],
    },
    {
      method: 'GET',
      path: '/functions/v1/widget-script?shop=mystore.myshopify.com',
      description: 'Serves the loyalty widget JavaScript bundle. This is the script tag URL you embed in your Shopify theme — it auto-configures itself for the store.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [],
      exampleRequest: `<!-- Add to theme.liquid -->
<script src="${supabaseUrl}/functions/v1/widget-script?shop=mystore.myshopify.com" defer></script>`,
      responseExample: `// Returns JavaScript bundle (Content-Type: application/javascript)
// Script auto-initializes the loyalty widget for the given shop`,
    },
    {
      method: 'POST',
      path: '/functions/v1/loyalty-widget-panel',
      description: 'Returns data for the loyalty widget popup — points balance, referral code, tier status, and recent transactions. Called by the widget script to render the panel.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email (shows personalised data if provided)' },
        { field: 'customer_phone', type: 'string', required: false, description: 'Customer phone (alternative identifier)' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/loyalty-widget-panel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    customer_email: 'customer@example.com'
  })
})`,
      responseExample: `{
  "success": true,
  "member": {
    "points_balance": 450,
    "referral_code": "JOHN2024",
    "tier": { "name": "Silver", "color": "#94a3b8" },
    "program": { "points_name": "Gems" }
  }
}`,
    },
  ];

  const tabs = [
    { id: 'referral' as const, label: 'Referral APIs', endpoints: referralEndpoints, isNew: true },
    { id: 'campaigns' as const, label: 'Campaign & Rewards', endpoints: campaignEndpoints },
    { id: 'loyalty' as const, label: 'Loyalty Points', endpoints: loyaltyEndpoints },
    { id: 'widgets' as const, label: 'Widget APIs', endpoints: [...widgetEndpoints, ...extraEndpoints] },
  ];

  const currentEndpoints = tabs.find(t => t.id === activeTab)?.endpoints || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Book className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">Complete API Reference</h3>
            <p className="text-sm text-blue-700 mb-2">
              All endpoints for Shopify extensions, loyalty, referrals, and widgets.
            </p>
            <div className="text-xs text-blue-600 space-y-1">
              <p><strong>Base URL:</strong> {supabaseUrl}</p>
              <p><strong>Auth:</strong> Include Anon Key in Authorization header (some endpoints are public)</p>
              <p><strong>Total Endpoints:</strong> {referralEndpoints.length + campaignEndpoints.length + loyaltyEndpoints.length + widgetEndpoints.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Flow Diagram */}
      {activeTab === 'referral' && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-indigo-600" />
            <h4 className="font-semibold text-indigo-900">Two-Way Referral Flow</h4>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {[
              { step: '1', label: 'Member shares ?ref=CODE', color: 'bg-blue-100 text-blue-800' },
              { step: '→', label: '', color: '' },
              { step: '2', label: 'Friend visits → apply-referral-code', color: 'bg-yellow-100 text-yellow-800' },
              { step: '→', label: '', color: '' },
              { step: '3', label: 'Friend places first order', color: 'bg-orange-100 text-orange-800' },
              { step: '→', label: '', color: '' },
              { step: '4', label: 'Webhook → complete-referral (auto)', color: 'bg-green-100 text-green-800' },
              { step: '→', label: '', color: '' },
              { step: '5', label: 'Both get points 🎉', color: 'bg-purple-100 text-purple-800' },
            ].map((item, i) => (
              item.label
                ? <span key={i} className={`px-2 py-1 rounded font-medium ${item.color}`}>{item.step} {item.label}</span>
                : <span key={i} className="text-gray-400 font-bold">{item.step}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
              {tab.endpoints.length}
            </span>
            {tab.isNew && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-green-500 text-white font-bold">NEW</span>
            )}
          </button>
        ))}
      </div>

      {/* Endpoints */}
      {currentEndpoints.map((endpoint, index) => (
        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700">
                {endpoint.method}
              </span>
              <code className="text-sm font-mono text-gray-900 break-all">{endpoint.path}</code>
              {endpoint.badge && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                  {endpoint.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-2">{endpoint.description}</p>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Authentication</h4>
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                endpoint.authentication.includes('No Auth')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {endpoint.authentication}
              </span>
            </div>

            {endpoint.requestBody && endpoint.requestBody.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Request Body</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-100 rounded">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Field</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Required</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {endpoint.requestBody.map((param, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs text-gray-900 font-semibold">{param.field}</td>
                          <td className="px-3 py-2 font-mono text-xs text-blue-600">{param.type}</td>
                          <td className="px-3 py-2 text-xs">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              param.required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {param.required ? 'Required' : 'Optional'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{param.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {endpoint.exampleRequest && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Example Request</h4>
                  <button
                    onClick={() => handleCopy(endpoint.exampleRequest!, `request-${index}`)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    {copiedCode === `request-${index}` ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto leading-relaxed">
                  <code>{endpoint.exampleRequest}</code>
                </pre>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Response Example</h4>
                <button
                  onClick={() => handleCopy(endpoint.responseExample, `response-${index}`)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  {copiedCode === `response-${index}` ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto leading-relaxed">
                <code>{endpoint.responseExample}</code>
              </pre>
            </div>

            {endpoint.errorCodes && endpoint.errorCodes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Error Codes</h4>
                <div className="space-y-1">
                  {endpoint.errorCodes.map((e, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <code className="px-2 py-0.5 bg-red-50 text-red-700 rounded border border-red-100 font-mono shrink-0">{e.code}</code>
                      <span className="text-gray-600">{e.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Footer notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Code className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Using Campaign IDs</h3>
              <p className="text-sm text-yellow-700">
                Copy the Campaign ID from your campaigns list (e.g. CAMP-0001) and use it in your Shopify extension config.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Code className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">Multi-Tenant Architecture</h3>
              <p className="text-sm text-green-700">
                Each shop is identified by <code className="bg-green-100 px-1 rounded">shop_domain</code>. Customer data, points, and referrals are fully isolated per store.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
