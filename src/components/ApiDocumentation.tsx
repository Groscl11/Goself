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
  const [activeTab, setActiveTab] = useState<'referral' | 'campaigns' | 'loyalty' | 'widgets' | 'earn'>('referral');

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
      path: '/functions/v1/get-campaign-reward-link',
      description: 'Generate a tokenised reward-claim link for a Shopify order tied to a specific campaign. Supports both GET (query params) and POST (JSON body). Returns a unique /claim-rewards URL the customer can open to pick and claim their rewards.',
      authentication: 'No Authentication Required (Public)',
      badge: 'NEW',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain (e.g. mystore.myshopify.com)' },
        { field: 'shopify_order_id', type: 'string', required: false, description: 'Shopify order ID (used in fallback URL)' },
        { field: 'campaign_id', type: 'string', required: false, description: 'Campaign UUID or human-readable code (e.g. CAMP-0004). Defaults to the highest-priority active campaign.' },
        { field: 'email', type: 'string', required: false, description: 'Customer email — used to create a pre-verified token' },
        { field: 'phone', type: 'string', required: false, description: 'Customer phone — used when email is not available' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/get-campaign-reward-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    shopify_order_id: '12345',
    campaign_id: 'CAMP-0004',
    email: 'customer@example.com'
  })
})`,
      responseExample: `// Tokenised link (email/phone provided)
{
  "has_rewards": true,
  "redemption_link": "https://goself.netlify.app/claim-rewards?token=uuid",
  "campaign_name": "VIP Summer Rewards",
  "customer_first_name": "Jane"
}

// Fallback (no email/phone)
{
  "has_rewards": true,
  "redemption_link": "https://goself.netlify.app/claim-rewards?campaign=uuid&order=12345",
  "campaign_name": "VIP Summer Rewards",
  "customer_first_name": ""
}

// Not configured
{ "has_rewards": false, "message": "No active campaigns for this shop" }`,
    },
    {
      method: 'POST',
      path: '/functions/v1/get-order-token',
      description: 'Generate a pre-verified, tokenised claim URL for a Shopify order. Designed for the order thank-you page — the returned claim_url opens the reward-claim flow with the customer already authenticated. Supports both GET (query params) and POST (JSON body).',
      authentication: 'No Authentication Required (Public)',
      badge: 'NEW',
      requestBody: [
        { field: 'shop', type: 'string', required: true, description: 'Shopify shop domain (e.g. mystore.myshopify.com)' },
        { field: 'order_id', type: 'string', required: false, description: 'Shopify order ID (included in fallback URL)' },
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email — used to create a pre-verified token' },
        { field: 'customer_phone', type: 'string', required: false, description: 'Customer phone — fallback when email is unavailable' },
      ],
      exampleRequest: `// Embed in Shopify thank-you page (Additional Scripts)
fetch('${supabaseUrl}/functions/v1/get-order-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop: 'mystore.myshopify.com',
    order_id: '{{ order.id }}',
    customer_email: '{{ customer.email }}'
  })
})`,
      responseExample: `// Token created — show personalised reward button
{
  "has_reward": true,
  "claim_url": "https://goself.netlify.app/claim-rewards?token=uuid",
  "campaign_name": "VIP Summer Rewards",
  "customer_first_name": "Jane",
  "expires_at": "2025-07-30T10:00:00.000Z",
  "pre_verified": true
}

// No active campaigns configured for this shop
{ "has_reward": false, "message": "No active campaigns available" }`,
    },
    {
      method: 'POST',
      path: '/functions/v1/validate-campaign-token',
      description: 'Three-step token validation endpoint that powers the /claim-rewards page. Step 1 (PROBE): check token validity and whether identity verification is needed. Step 2 (VERIFY): submit customer email/phone to unlock the reward pool. Step 3 (CLAIM): claim the selected rewards and receive voucher codes.',
      authentication: 'No Authentication Required (Public)',
      badge: 'NEW',
      requestBody: [
        { field: 'token', type: 'string', required: true, description: 'Claim token from get-order-token or get-campaign-reward-link' },
        { field: 'identity', type: 'string', required: false, description: 'Customer email or phone for identity gate (Steps 2 & 3)' },
        { field: 'claim', type: 'boolean', required: false, description: 'Set true to claim rewards (Step 3)' },
        { field: 'reward_ids', type: 'array', required: false, description: 'Array of reward UUIDs to redeem (Step 3)' },
        { field: 'is_pre_verified', type: 'boolean', required: false, description: 'Skip identity gate when customer was already authenticated by Shopify (Phase 5 flow)' },
      ],
      exampleRequest: `// Step 1 — probe
fetch('${supabaseUrl}/functions/v1/validate-campaign-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'uuid-token' })
})

// Step 2 — verify identity
fetch('${supabaseUrl}/functions/v1/validate-campaign-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'uuid-token', identity: 'customer@example.com' })
})

// Step 3 — claim
fetch('${supabaseUrl}/functions/v1/validate-campaign-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'uuid-token',
    identity: 'customer@example.com',
    claim: true,
    reward_ids: ['reward-uuid-1', 'reward-uuid-2']
  })
})`,
      responseExample: `// Step 1 — valid, identity required
{
  "valid": true,
  "requires_identity": true,
  "identity_hint": "cust***@example.com",
  "campaign_name": "VIP Summer Rewards",
  "expires_at": "2025-07-30T10:00:00.000Z"
}

// Step 2 — identity verified, reward pool returned
{
  "valid": true,
  "verified": true,
  "rewards": [{ "id": "uuid", "title": "20% Off Next Order" }],
  "min_rewards": 1,
  "max_rewards": 2,
  "reward_selection_mode": "choice"
}

// Step 3 — claimed
{ "valid": true, "claimed": true, "allocations": [{ "reward_id": "uuid", "voucher_code": "SAVE20-ABC" }] }

// Already redeemed
{ "valid": false, "reason": "already_claimed", "claimed_at": "2025-07-01T09:00:00Z", "claimed_rewards": [...] }`,
      errorCodes: [
        { code: 'not_found', description: 'Token does not exist' },
        { code: 'expired', description: 'Token is past its expiry date' },
        { code: 'already_claimed', description: 'Rewards were already claimed for this token' },
        { code: 'campaign_inactive', description: 'The associated campaign has been deactivated' },
        { code: 'identity_mismatch', description: 'Provided email/phone does not match the token\'s customer record' },
        { code: 'missing_token', description: 'token field was not supplied in the request' },
      ],
    },
    {
      method: 'POST',
      path: '/functions/v1/claim-standalone-campaign',
      description: 'Two-mode endpoint for standalone campaigns accessed via a direct /claim-rewards?campaign=RULE_ID URL. Mode 1 (read-only, no claim flag): returns campaign metadata and available reward pool. Mode 2 (claim: true): validates inputs, allocates vouchers and returns the allocations.',
      authentication: 'No Authentication Required (Public)',
      badge: 'NEW',
      requestBody: [
        { field: 'campaign_rule_id', type: 'string', required: true, description: 'UUID of the standalone campaign rule' },
        { field: 'email', type: 'string', required: false, description: 'Customer email — required when claim is true' },
        { field: 'reward_ids', type: 'array', required: false, description: 'UUIDs of rewards to claim — required when claim is true' },
        { field: 'claim', type: 'boolean', required: false, description: 'Set true to allocate vouchers (default: false returns read-only pool)' },
      ],
      exampleRequest: `// Read-only: load campaign & reward pool
fetch('${supabaseUrl}/functions/v1/claim-standalone-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ campaign_rule_id: 'campaign-rule-uuid' })
})

// Claim rewards
fetch('${supabaseUrl}/functions/v1/claim-standalone-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    campaign_rule_id: 'campaign-rule-uuid',
    email: 'customer@example.com',
    reward_ids: ['reward-uuid-1'],
    claim: true
  })
})`,
      responseExample: `// Read-only — campaign metadata + reward pool
{
  "success": true,
  "campaign_id": "uuid",
  "campaign_name": "Summer Giveaway",
  "reward_selection_mode": "choice",
  "min_rewards": 1,
  "max_rewards": 2,
  "rewards": [
    {
      "id": "uuid",
      "title": "Free Coffee",
      "available_vouchers": 45,
      "brand": { "name": "Coffee Co", "logo_url": "..." }
    }
  ]
}

// Claimed successfully
{ "success": true, "allocations": [{ "reward_id": "uuid", "voucher_code": "FREE-COFFEE-XYZ" }] }`,
      errorCodes: [
        { code: 'campaign_not_found', description: 'No campaign rule exists with the given UUID' },
        { code: 'campaign_inactive', description: 'Campaign is_active flag is false' },
        { code: 'campaign_not_started', description: 'Campaign start_date has not been reached' },
        { code: 'campaign_ended', description: 'Campaign end_date has passed' },
        { code: 'not_standalone', description: 'Campaign rule_mode is not "standalone"' },
        { code: 'missing_email', description: 'email is required when claim is true' },
        { code: 'no_rewards_selected', description: 'reward_ids is empty when claim is true' },
      ],
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
    {
      method: 'POST',
      path: '/functions/v1/evaluate-campaign-rules',
      description: 'Evaluate all active campaign rules for a given order/event and return matched rules. Used internally by the webhook but can also be called manually to preview what rules would fire.',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email' },
        { field: 'order_value', type: 'number', required: false, description: 'Order total for order_value triggers' },
        { field: 'order_count', type: 'number', required: false, description: 'Total order count for order_count triggers' },
        { field: 'trigger_type', type: 'string', required: false, description: 'Trigger type to evaluate (order_value, order_count, signup, birthday)' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/evaluate-campaign-rules', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    customer_email: 'customer@example.com',
    order_value: 150.00,
    trigger_type: 'order_value'
  })
})`,
      responseExample: `{
  "success": true,
  "matched_rules": [
    { "campaign_id": "CAMP-0001", "name": "VIP Welcome", "rewards": [{ "id": "uuid", "title": "20% Off" }] }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/send-campaign-communication',
      description: 'Send an email or SMS communication to a member as part of a campaign enrollment. Uses the campaign\'s communication settings and the client\'s default template.',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'campaign_rule_id', type: 'string', required: true, description: 'UUID of the campaign rule' },
        { field: 'member_user_id', type: 'string', required: true, description: 'UUID of the member to notify' },
        { field: 'reward_allocation_id', type: 'string', required: false, description: 'UUID of the reward allocation issued (for deep link in message)' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/send-campaign-communication', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    campaign_rule_id: 'campaign-uuid',
    member_user_id: 'member-uuid',
    reward_allocation_id: 'allocation-uuid'
  })
})`,
      responseExample: `{ "success": true, "message_id": "uuid", "channel": "email" }`,
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
    {
      method: 'GET',
      path: '/functions/v1/get-member-rewards?shop=mystore.myshopify.com&member_user_id=uuid',
      description: 'Returns all redeemable rewards for a loyalty member grouped into discount rewards, brand rewards, and manual rewards. Includes can_redeem flag based on current points balance.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop', type: 'string (query param)', required: true, description: 'Shopify shop domain' },
        { field: 'member_user_id', type: 'string (query param)', required: false, description: 'Member UUID (member_user_id or email required)' },
        { field: 'email', type: 'string (query param)', required: false, description: 'Customer email (alternative to member_user_id)' },
      ],
      exampleRequest: `// GET request
fetch('${supabaseUrl}/functions/v1/get-member-rewards?shop=mystore.myshopify.com&member_user_id=uuid')`,
      responseExample: `{
  "points_balance": 450,
  "discount_rewards": [{ "id": "uuid", "title": "20% Off", "points_cost": 200, "can_redeem": true }],
  "brand_rewards": [{ "id": "uuid", "title": "Coffee Voucher", "brand": "Brand Name", "can_redeem": false }],
  "manual_rewards": [],
  "existing_codes": { "reward-uuid": { "code": "DISC20-ABC", "expires_at": "2026-06-01" } }
}`,
    },
    {
      method: 'GET',
      path: '/functions/v1/get-rewards-catalog?shop=mystore.myshopify.com',
      description: 'Returns the full public rewards catalog for a store — all active rewards available to members regardless of points balance.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop', type: 'string (query param)', required: true, description: 'Shopify shop domain' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/get-rewards-catalog?shop=mystore.myshopify.com')`,
      responseExample: `{
  "rewards": [
    { "id": "uuid", "title": "Free Shipping", "points_cost": 100, "reward_type": "discount", "is_active": true }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/redeem-reward',
      description: 'Redeem a specific reward for a member. Deducts points, creates a voucher/discount code, and returns the code for display.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'reward_id', type: 'string', required: true, description: 'UUID of the reward to redeem' },
        { field: 'member_user_id', type: 'string', required: false, description: 'Member UUID (member_user_id or email required)' },
        { field: 'email', type: 'string', required: false, description: 'Customer email' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/redeem-reward', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    reward_id: 'reward-uuid',
    email: 'customer@example.com'
  })
})`,
      responseExample: `{
  "success": true,
  "voucher_code": "REWARD-XYZ123",
  "discount_value": 20,
  "discount_type": "percentage",
  "points_deducted": 200,
  "remaining_points": 250
}`,
      errorCodes: [
        { code: 'insufficient_points', description: 'Member does not have enough points' },
        { code: 'reward_not_found', description: 'Reward not found or not active' },
        { code: 'already_redeemed', description: 'Member already has an active code for this reward' },
      ],
    },
    {
      method: 'POST',
      path: '/functions/v1/redeem-brand-reward',
      description: 'Redeem a partner brand reward for a member. Deducts points and issues a brand voucher that can be used at the partner brand.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'reward_id', type: 'string', required: true, description: 'UUID of the brand reward' },
        { field: 'member_user_id', type: 'string', required: false, description: 'Member UUID' },
        { field: 'email', type: 'string', required: false, description: 'Customer email' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/redeem-brand-reward', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    reward_id: 'brand-reward-uuid',
    email: 'customer@example.com'
  })
})`,
      responseExample: `{
  "success": true,
  "voucher_code": "BRAND-ABC123",
  "brand_name": "Coffee Chain",
  "points_deducted": 500,
  "remaining_points": 150,
  "expires_at": "2026-12-31"
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/process-reward-redemption',
      description: 'Process a full reward redemption flow — validates eligibility, deducts points, creates discount code in Shopify, and logs the transaction.',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'reward_id', type: 'string', required: true, description: 'UUID of the reward' },
        { field: 'member_user_id', type: 'string', required: true, description: 'Member UUID' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/process-reward-redemption', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    reward_id: 'reward-uuid',
    member_user_id: 'member-uuid'
  })
})`,
      responseExample: `{ "success": true, "voucher_code": "REDEEMED-ABC", "shopify_discount_id": "gid://..." }`,
    },
    {
      method: 'POST',
      path: '/functions/v1/update-member-profile',
      description: 'Update a loyalty member\'s profile fields — date of birth and anniversary date. Used by the widget to let members self-update for birthday/anniversary triggers.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'member_user_id', type: 'string', required: true, description: 'UUID of the member' },
        { field: 'client_id', type: 'string', required: true, description: 'UUID of the client' },
        { field: 'date_of_birth', type: 'string (YYYY-MM-DD)', required: false, description: 'Member date of birth for birthday trigger' },
        { field: 'anniversary_date', type: 'string (YYYY-MM-DD)', required: false, description: 'Member anniversary date for anniversary trigger' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/update-member-profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    member_user_id: 'member-uuid',
    client_id: 'client-uuid',
    date_of_birth: '1990-05-15'
  })
})`,
      responseExample: `{ "success": true, "updated": { "date_of_birth": "1990-05-15" } }`,
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
      method: 'GET',
      path: '/functions/v1/widget-render?shop=mystore.myshopify.com',
      description: 'Returns the HTML/JS render of the loyalty widget for a specific store. Used by Shopify app extensions to embed the widget directly in the storefront.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop', type: 'string (query param)', required: true, description: 'Shopify shop domain' },
        { field: 'customer_email', type: 'string (query param)', required: false, description: 'Customer email for personalised render' },
      ],
      exampleRequest: `// Embed in Shopify extension
<script src="${supabaseUrl}/functions/v1/widget-render?shop=mystore.myshopify.com" defer></script>`,
      responseExample: `// Returns widget HTML/JS for the given shop
// Auto-initializes with store branding and customer data`,
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
      path: '/functions/v1/widget-rewards-portal',
      description: 'Returns data for the loyalty widget rewards portal — points balance, referral code, tier status, and recent transactions. Called by the widget script to render the rewards panel.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'customer_email', type: 'string', required: false, description: 'Customer email (shows personalised data if provided)' },
        { field: 'customer_phone', type: 'string', required: false, description: 'Customer phone (alternative identifier)' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/widget-rewards-portal', {
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
  },
  "rewards": [{ "id": "uuid", "title": "20% Off", "points_cost": 200, "can_redeem": true }]
}`,
    },
  ];

  // ─── EARN POINTS APIs ─────────────────────────────────────────────────────
  const earnEndpoints: ApiEndpoint[] = [
    {
      method: 'POST',
      path: '/functions/v1/submit-earn-action',
      description: 'Submit a "Ways to Earn" action for a member — e.g. completing a profile, writing a review, or celebrating a birthday. Checks cooldowns and max_times limits, then awards points.',
      authentication: 'No Authentication Required (Public)',
      badge: 'NEW',
      requestBody: [
        { field: 'member_user_id', type: 'string', required: true, description: 'UUID of the member performing the action' },
        { field: 'client_id', type: 'string', required: true, description: 'UUID of the client (loyalty program owner)' },
        { field: 'rule_id', type: 'string', required: true, description: 'UUID of the loyalty_earning_rules record' },
        { field: 'rule_type', type: 'string', required: true, description: 'Rule type: custom_action, review, profile_completion, birthday, anniversary, social_share' },
        { field: 'metadata', type: 'object', required: false, description: 'Extra data logged with the transaction (e.g. { review_id: "..." })' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/submit-earn-action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    member_user_id: 'member-uuid',
    client_id: 'client-uuid',
    rule_id: 'rule-uuid',
    rule_type: 'review',
    metadata: { review_id: 'shopify-review-123' }
  })
})`,
      responseExample: `{
  "success": true,
  "points_awarded": 50,
  "new_balance": 500,
  "transaction_id": "uuid"
}

// If cooldown active:
{ "success": false, "error": "cooldown_active", "next_eligible": "2026-03-14T00:00:00Z" }

// If max_times reached:
{ "success": false, "error": "max_times_reached" }`,
      errorCodes: [
        { code: 'cooldown_active', description: 'Member submitted this action too recently — includes next_eligible timestamp' },
        { code: 'max_times_reached', description: 'Member has already completed this action the maximum allowed times' },
        { code: 'rule_not_found', description: 'rule_id does not exist or does not belong to this client' },
        { code: 'member_not_found', description: 'member_user_id not found or not in this client\'s program' },
      ],
    },
    {
      method: 'GET',
      path: '/functions/v1/get-earning-rules?shop_domain=mystore.myshopify.com',
      description: 'Returns all active Ways to Earn rules for a store — e.g. earn points for reviews, profile completion, birthday, etc. Optionally pass member_user_id to include per-rule eligibility status.',
      authentication: 'No Authentication Required (Public)',
      requestBody: [
        { field: 'shop_domain', type: 'string (query param)', required: true, description: 'Shopify shop domain' },
        { field: 'member_user_id', type: 'string (query param)', required: false, description: 'Member UUID — if provided, includes can_earn and next_eligible for each rule' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/get-earning-rules?shop_domain=mystore.myshopify.com&member_user_id=uuid')`,
      responseExample: `{
  "rules": [
    {
      "id": "rule-uuid",
      "rule_type": "review",
      "name": "Write a Product Review",
      "points_reward": 50,
      "cooldown_days": 30,
      "max_times": 5,
      "can_earn": true
    },
    {
      "id": "rule-uuid2",
      "rule_type": "birthday",
      "name": "Birthday Bonus",
      "points_reward": 200,
      "cooldown_days": 365,
      "can_earn": false,
      "next_eligible": "2027-05-15T00:00:00Z"
    }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/functions/v1/sync-discount-to-shopify',
      description: 'Creates or updates a discount code in Shopify for a given reward. Called after points redemption to generate the actual Shopify discount code. Requires Shopify integration to be connected.',
      authentication: 'Bearer Token (Anon Key)',
      requestBody: [
        { field: 'shop_domain', type: 'string', required: true, description: 'Shopify shop domain' },
        { field: 'discount_code', type: 'string', required: true, description: 'The code string to create in Shopify' },
        { field: 'discount_type', type: 'string', required: true, description: 'percentage | fixed_amount | free_shipping' },
        { field: 'discount_value', type: 'number', required: true, description: 'Value of the discount (percentage or currency amount)' },
        { field: 'usage_limit', type: 'number', required: false, description: 'Max number of times this code can be used (default: 1)' },
        { field: 'expires_at', type: 'string (ISO 8601)', required: false, description: 'Expiry date for the discount code' },
      ],
      exampleRequest: `fetch('${supabaseUrl}/functions/v1/sync-discount-to-shopify', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${anonKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    shop_domain: 'mystore.myshopify.com',
    discount_code: 'LOYALTY-ABC123',
    discount_type: 'percentage',
    discount_value: 20,
    usage_limit: 1,
    expires_at: '2026-12-31T23:59:59Z'
  })
})`,
      responseExample: `{
  "success": true,
  "shopify_price_rule_id": "gid://shopify/PriceRule/123456",
  "shopify_discount_code_id": "gid://shopify/DiscountCode/789012"
}`,
      errorCodes: [
        { code: 'no_integration', description: 'No Shopify integration found for this shop domain' },
        { code: 'shopify_api_error', description: 'Shopify API rejected the request — check permissions' },
      ],
    },
  ];

  const tabs = [
    { id: 'referral' as const, label: 'Referral APIs', endpoints: referralEndpoints, isNew: true },
    { id: 'campaigns' as const, label: 'Campaign & Rewards', endpoints: campaignEndpoints },
    { id: 'loyalty' as const, label: 'Loyalty Points', endpoints: loyaltyEndpoints },
    { id: 'widgets' as const, label: 'Widget APIs', endpoints: [...widgetEndpoints, ...extraEndpoints] },
    { id: 'earn' as const, label: 'Earn Points', endpoints: earnEndpoints, isNew: true },
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
              <p><strong>Total Endpoints:</strong> {referralEndpoints.length + campaignEndpoints.length + loyaltyEndpoints.length + widgetEndpoints.length + extraEndpoints.length + earnEndpoints.length}</p>
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
