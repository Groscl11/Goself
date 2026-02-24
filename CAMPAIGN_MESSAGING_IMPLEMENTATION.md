# Campaign & Messaging System - Implementation Summary

## ✅ Completed Features

### 1. Database Schema Created
- `message_templates` - Store reusable SMS/Email/WhatsApp templates
- `message_campaigns` - Track all messaging campaigns
- `campaign_recipients` - Individual recipient tracking with unique links
- `member_sources` - Track where members came from (organic, campaign, import, etc.)

### 2. Message Templates Page (`/client/templates`)
- Create/edit/delete templates
- Support for SMS, Email, WhatsApp
- Variable insertion ({name}, {link}, {program}, {client})
- Default templates for each type
- Character counter for SMS (160 limit)
- Preview and test functionality

## 🚧 Remaining Implementation

### 3. Campaign Wizard Page (`/client/campaigns/new`)

**Features Needed:**
- Step-by-step wizard interface
- Step 1: Campaign Details (name, description, type)
- Step 2: Select Template or Custom Message
- Step 3: Choose Audience (all members, specific members, Excel upload)
- Step 4: Preview & Schedule
- Generate unique links for each recipient
- Schedule for immediate or future sending

**Key Components:**
```typescript
// Campaign creation flow
1. Select campaign type (membership_enrollment, reward_distribution, general)
2. Choose message type (SMS, Email, WhatsApp, All)
3. Select or create template
4. Define audience:
   - All existing members
   - Specific members (multi-select)
   - Upload Excel file with new users
5. Preview messages with sample data
6. Schedule (now or later)
7. Confirm and launch
```

### 4. Campaigns List Page (`/client/campaigns`)

**Features:**
- View all campaigns with status
- Filter by status, type, date
- See metrics (sent, failed, clicked)
- View campaign details
- Track real-time progress
- Download recipient reports

### 5. Excel Upload for New Members

**File Format:**
```csv
full_name,email,phone,program_name
John Doe,john@example.com,+1234567890,Gold Membership
Jane Smith,jane@example.com,+1234567891,Silver Membership
```

**Processing:**
1. Validate file format
2. Check for duplicates
3. Create member_users records
4. Create campaign_recipients with unique links
5. Track source as 'import' with campaign_id

### 6. Unique Link Generation

**Link Structure:**
```
https://yourdomain.com/enroll/{unique_token}
```

**Token Generation:**
- SHA256 hash of campaign_id + email + timestamp + random
- Stored in campaign_recipients.unique_link
- Tracks clicks and conversions

**Landing Page (`/enroll/:token`):**
- Verify token
- Show personalized welcome
- Display program details
- One-click enrollment
- Track in database

### 7. Member Source Tracking

**Automatic Tracking:**
```typescript
// When member signs up via campaign link
await supabase.from('member_sources').insert({
  member_id: newMember.id,
  source_type: 'campaign',
  source_campaign_id: campaign.id,
  source_metadata: {
    clicked_at: timestamp,
    enrolled_at: timestamp,
    initial_program: program.name
  }
});
```

**Analytics Dashboard:**
- Members by source (pie chart)
- Campaign conversion rates
- Top performing campaigns
- Source attribution reports

## Database Functions Created

### 1. `generate_unique_link(campaign_id, member_id, email)`
Generates personalized links for each recipient.

### 2. `track_link_click(token)`
Records when a recipient clicks their unique link.

**Returns:**
```json
{
  "success": true,
  "campaign_id": "uuid",
  "campaign_type": "membership_enrollment",
  "member_id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe"
}
```

## Integration with Edge Functions

### Send Messages Edge Function
```typescript
// supabase/functions/send-campaign-messages/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { campaign_id } = await req.json();

  // Get campaign and recipients
  const { data: campaign } = await supabase
    .from('message_campaigns')
    .select('*, message_templates(*)')
    .eq('id', campaign_id)
    .single();

  const { data: recipients } = await supabase
    .from('campaign_recipients')
    .select('*')
    .eq('campaign_id', campaign_id)
    .eq('status', 'pending');

  // Update campaign status
  await supabase
    .from('message_campaigns')
    .update({ status: 'sending', sent_at: new Date().toISOString() })
    .eq('id', campaign_id);

  // Send messages
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const message = renderTemplate(campaign.message_templates.body, {
        name: recipient.full_name,
        link: recipient.unique_link,
        program: campaign.metadata?.program_name || 'Membership',
        client: campaign.metadata?.client_name || 'Our Platform'
      });

      if (campaign.message_type === 'email' || campaign.message_type === 'all') {
        await sendEmail({
          to: recipient.email,
          subject: renderTemplate(campaign.message_templates.subject, {}),
          body: message
        });
      }

      if (campaign.message_type === 'sms' || campaign.message_type === 'all') {
        if (recipient.phone) {
          await sendSMS({
            to: recipient.phone,
            message: message
          });
        }
      }

      if (campaign.message_type === 'whatsapp' || campaign.message_type === 'all') {
        if (recipient.phone) {
          await sendWhatsApp({
            to: recipient.phone,
            message: message
          });
        }
      }

      await supabase
        .from('campaign_recipients')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', recipient.id);

      sent++;
    } catch (error) {
      await supabase
        .from('campaign_recipients')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', recipient.id);

      failed++;
    }
  }

  // Update final counts
  await supabase
    .from('message_campaigns')
    .update({
      status: 'completed',
      sent_count: sent,
      failed_count: failed
    })
    .eq('id', campaign_id);

  return new Response(
    JSON.stringify({ sent, failed }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

## Menu Updates

Add to client menu:
```typescript
{
  label: 'Campaigns',
  path: '/client/campaigns',
  icon: <Megaphone className="w-5 h-5" />,
},
{
  label: 'Message Templates',
  path: '/client/templates',
  icon: <FileText className="w-5 h-5" />,
}
```

## Quick Implementation Steps

1. **Create CampaignWizard.tsx** - Multi-step form for campaign creation
2. **Create CampaignsList.tsx** - View and manage campaigns
3. **Create EnrollmentPage.tsx** - Landing page for unique links (`/enroll/:token`)
4. **Update clientMenuItems.tsx** - Add new menu items
5. **Update App.tsx** - Add new routes
6. **Create edge function** - For sending messages
7. **Create SourceAnalytics.tsx** - Dashboard for tracking member sources

## Testing Workflow

### Test Campaign Creation:
1. Go to `/client/templates`
2. Create email template with variables
3. Go to `/client/campaigns/new`
4. Select "Membership Enrollment"
5. Choose email template
6. Upload Excel with test users
7. Preview messages
8. Launch campaign

### Test Link Tracking:
1. Check campaign_recipients table for unique links
2. Copy a unique link
3. Open in browser
4. Verify token tracking
5. Complete enrollment
6. Check member_sources table

### Test Source Analytics:
1. Go to `/client/reports`
2. Add "Member Sources" section
3. Show pie chart of source distribution
4. Show campaign conversion table
5. Filter by date range

## Example Excel Template for Upload

```csv
full_name,email,phone,program_name
John Doe,john@example.com,+12345678901,Gold Membership
Jane Smith,jane@example.com,+12345678902,Silver Membership
Bob Johnson,bob@example.com,+12345678903,Gold Membership
Alice Williams,alice@example.com,+12345678904,Bronze Membership
```

**Validation Rules:**
- full_name: Required, 2-100 characters
- email: Required, valid email format, unique
- phone: Optional, valid phone format with country code
- program_name: Must match existing membership program

## Campaign Metrics to Track

1. **Delivery Metrics:**
   - Total recipients
   - Sent successfully
   - Failed deliveries
   - Bounce rate

2. **Engagement Metrics:**
   - Link clicks
   - Click-through rate
   - Time to first click
   - Unique clicks vs total clicks

3. **Conversion Metrics:**
   - Enrollments completed
   - Conversion rate
   - Time to conversion
   - Revenue attributed

4. **Source Analytics:**
   - Members by source type
   - Campaign performance comparison
   - ROI per campaign
   - Lifetime value by source

## Message Template Variables

Standard variables available:
- `{name}` - Recipient's full name
- `{link}` - Unique enrollment/activation link
- `{program}` - Membership program name
- `{client}` - Client/company name
- `{expiry}` - Link expiration date
- `{benefits}` - Program benefits list
- `{support_email}` - Support contact
- `{support_phone}` - Support phone

## Security Considerations

1. **Link Expiration:**
   - Set expiry date on unique links (default 30 days)
   - Verify token hasn't expired before processing
   - Clean up expired tokens regularly

2. **Rate Limiting:**
   - Limit campaigns per day per client
   - Throttle message sending (e.g., 100/minute)
   - Prevent spam/abuse

3. **Data Privacy:**
   - Encrypt sensitive data in database
   - Secure unique tokens
   - GDPR compliance for opt-outs
   - Allow users to unsubscribe

4. **Access Control:**
   - RLS policies for all tables
   - Clients see only their campaigns
   - Members see only their links
   - Admin oversight capabilities

## Summary

**Completed:**
- ✅ Database schema for campaigns and messaging
- ✅ Message templates management page
- ✅ Unique link generation function
- ✅ Link click tracking function
- ✅ RLS policies for security
- ✅ Member source tracking table

**To Complete:**
- ⏳ Campaign wizard UI
- ⏳ Campaigns list page
- ⏳ Excel upload processing
- ⏳ Enrollment landing page
- ⏳ Edge function for sending
- ⏳ Source analytics dashboard
- ⏳ Menu updates and routes

**All database infrastructure is ready - just need UI components!**
