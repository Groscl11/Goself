# Campaign Communications System - Complete Guide

## Overview

The campaign communications system automatically sends personalized messages to members when they're enrolled via campaign rules. It supports both secure login-required links and one-click temporary redemption links.

## Features Implemented

### 1. Database Structure

#### New Tables

**`member_redemption_tokens`**
- Stores individual member redemption tokens
- Supports two link types:
  - `auth_required`: Member must login to access rewards
  - `one_click`: Temporary link valid for X days, no login required
- Tracks access count and usage

**`communication_logs`**
- Tracks all communications sent to members
- Supports Email, SMS, WhatsApp
- Links to campaigns, members, and redemption tokens
- Tracks delivery status (pending, sent, delivered, failed, clicked)

#### Database Functions

**`create_member_redemption_token()`**
- Generates secure cryptographic tokens
- Creates personalized URLs for members
- Sets expiration dates for temporary links

**`validate_redemption_token()`**
- Validates token and checks expiration
- Returns member, client, and campaign details
- Tracks access count

**`prepare_campaign_communication()`**
- Creates redemption token
- Personalizes message template with variables: {name}, {client}, {program}, {link}, {validity}
- Logs communication for tracking

#### Automatic Triggers

**`auto_generate_campaign_communication()`**
- Automatically triggered when member is enrolled via campaign
- Reads campaign configuration from `trigger_conditions.communication`
- Creates personalized redemption link
- Logs pending communication

### 2. Campaign Configuration

When creating a campaign rule, you can configure communications in the `trigger_conditions` JSON:

```json
{
  "min_order_value": 1000,
  "communication": {
    "enabled": true,
    "type": "email",
    "link_type": "one_click",
    "valid_days": 30,
    "template": "Hi {name}! You've been enrolled in {program} at {client}. Click here to claim: {link} (Valid for {validity})"
  }
}
```

#### Configuration Options

- **enabled**: `true/false` - Enable/disable automatic communications
- **type**: `email`, `sms`, or `whatsapp` - Communication channel
- **link_type**:
  - `auth_required`: Member must login to access
  - `one_click`: Direct access, valid for specified days
- **valid_days**: Number of days link remains valid (for one_click links)
- **template**: Message template with variables

### 3. Edge Functions

#### `send-campaign-communication`

Sends communications to members. Supports:
- Single communication by ID
- Batch sending of all pending communications

**Usage:**
```typescript
// Send single communication
POST /functions/v1/send-campaign-communication
{
  "communication_id": "uuid"
}

// Send all pending communications
POST /functions/v1/send-campaign-communication
{
  "batch_send": true
}
```

**Note:** Currently simulated for demonstration. Replace with actual SMS/Email/WhatsApp providers.

#### Updated: `shopify-webhook`

Now includes automatic campaign communication processing:
1. Processes Shopify order
2. Checks and executes campaign rules
3. Auto-enrolls members who qualify
4. Triggers communication generation
5. Processes pending communications

### 4. Frontend Pages

#### `/client/communications` - Communication Logs

View and manage all communications:
- Filter by status (all, pending, sent, failed)
- View recipient details, campaign, and delivery status
- Send individual communications
- Batch send all pending communications
- View personalized redemption URLs

#### `/claim/:token` - Public Claim Page

Member-facing page for claiming rewards:
- Validates redemption token
- Displays member name and client info
- Shows available rewards
- One-click claim process
- Login redirect option for auth-required links

### 5. User Flow

#### Automatic Campaign Enrollment Flow

1. **Order Placed**: Customer places Shopify order
2. **Webhook Received**: Order synced to platform
3. **Campaign Check**: System checks active campaign rules
4. **Order Qualifies**: Order meets minimum value threshold
5. **Member Enrolled**: Member automatically enrolled in program
6. **Communication Triggered**: Database trigger generates communication
7. **Token Created**: Secure redemption token created
8. **Message Prepared**: Template personalized with member details
9. **Communication Logged**: Entry created in communication_logs (status: pending)
10. **Auto-Send**: Webhook processes pending communications
11. **Member Receives**: Email/SMS with personalized link
12. **Member Claims**: Clicks link to view/claim rewards

#### Link Types Comparison

**Auth Required (`auth_required`)**
- Member must login to access rewards
- Persistent access
- URL: `https://yourdomain.com/member/rewards?ref=TOKEN`
- Best for: Long-term memberships, recurring rewards

**One-Click Temporary (`one_click`)**
- Direct access, no login required
- Valid for specified days (default: 30)
- URL: `https://yourdomain.com/claim/TOKEN`
- Best for: Time-limited offers, promotions, one-time rewards

### 6. Message Template Variables

Available variables for message personalization:

- `{name}` - Member's full name
- `{client}` - Client business name
- `{program}` - Membership program name
- `{link}` - Personalized redemption URL
- `{validity}` - Validity period (e.g., "30 days")

**Example Template:**
```
Hi {name}! 🎉

Congratulations! You've been enrolled in {program} at {client}.

Click here to access your exclusive rewards: {link}

This link is valid for {validity}.

Thank you for being a valued customer!
```

### 7. Testing the Flow

#### Step 1: Create Campaign with Communication

1. Go to Admin → Campaign Rules
2. Create new campaign with `trigger_type: order_value`
3. Set `trigger_conditions`:
```json
{
  "min_order_value": 100,
  "communication": {
    "enabled": true,
    "type": "email",
    "link_type": "one_click",
    "valid_days": 30,
    "template": "Hi {name}! Welcome to {program}! Claim your rewards: {link}"
  }
}
```

#### Step 2: Test Order Processing

1. Ensure Shopify integration is connected
2. Place test order > minimum value
3. Check webhook logs for campaign rule execution
4. Verify member enrollment in database

#### Step 3: Check Communications

1. Go to Client Portal → Communication Logs
2. See pending communication for enrolled member
3. View personalized URL and message
4. Click "Send" to process communication

#### Step 4: Member Claims Reward

1. Copy the personalized URL from communication log
2. Open in browser (or send to member)
3. Member sees welcome page with rewards
4. Member clicks "Claim Rewards"
5. Success confirmation shown

### 8. Database Queries for Testing

**Check pending communications:**
```sql
SELECT * FROM communication_logs WHERE status = 'pending';
```

**View redemption tokens:**
```sql
SELECT * FROM member_redemption_tokens WHERE is_active = true;
```

**Check campaign enrollments:**
```sql
SELECT * FROM member_memberships
WHERE enrollment_source = 'campaign_auto'
ORDER BY created_at DESC;
```

**Validate a token:**
```sql
SELECT validate_redemption_token('your-token-here');
```

### 9. Customization Options

#### Custom Communication Providers

Update `send-campaign-communication` edge function to integrate:
- **Email**: SendGrid, AWS SES, Mailgun, Resend
- **SMS**: Twilio, AWS SNS, Vonage
- **WhatsApp**: Twilio WhatsApp API, MessageBird

#### Custom Template Fields

Add more variables in `prepare_campaign_communication()` function:
- Order details
- Reward specifics
- Expiration dates
- Custom client data

#### Link Behavior

Modify `validate_redemption_token()` for:
- Single-use tokens
- IP-based restrictions
- Device limits
- Custom expiration logic

### 10. Security Considerations

- Tokens are cryptographically secure (32-byte random)
- URL-safe encoding (no special characters)
- Token uniqueness enforced by database
- Access tracking for audit trail
- Expiration validation
- RLS policies protect sensitive data

## Next Steps

1. **Integrate Real Providers**: Replace simulated email/SMS sending with actual providers
2. **Email Templates**: Design HTML email templates for better presentation
3. **Click Tracking**: Add webhook for tracking when members click links
4. **A/B Testing**: Test different message templates and link types
5. **Analytics Dashboard**: Track communication effectiveness and conversion rates

## Support

For questions or issues with the campaign communications system, check:
- Communication Logs page for delivery status
- Database function logs in Supabase
- Edge function logs for webhook processing
- Browser console for token validation errors
