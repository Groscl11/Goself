# Client Campaign System - Complete Guide

## Overview
Clients can now create comprehensive campaigns to enroll members in programs, distribute rewards/coupons, and send personalized messages via SMS, Email, and WhatsApp with unique tracking links.

---

## ✅ Features Implemented

### 1. Campaign Wizard (`/client/campaigns/new`)

**4-Step Process:**

#### Step 1: Campaign Details
- Enter campaign name and description
- Choose campaign type:
  - **Membership Enrollment** - Enroll members in programs
  - **Reward Distribution** - Send coupons/vouchers
  - **General Message** - Custom communications
- Select program (for enrollment) or reward (for distribution)

#### Step 2: Message Configuration
- Choose message type: SMS, Email, WhatsApp, or All
- Use existing template or write custom message
- Variable support: `{name}`, `{link}`, `{program}`, `{client}`
- Email subject line (for email campaigns)
- Character counter for SMS (160 limit)

#### Step 3: Select Recipients
Three options:
- **All Existing Members** - Send to everyone
- **Specific Members** - Choose individuals with checkboxes
- **Upload New Users** - Excel upload with automatic member creation

#### Step 4: Preview & Launch
- View campaign summary
- Preview personalized message with sample data
- Schedule for later or send immediately
- Final confirmation before launch

---

### 2. Campaigns List (`/client/campaigns`)

**Features:**
- View all campaigns with status badges
- See metrics: Total recipients, sent, failed
- Filter and search campaigns
- View detailed campaign reports
- Track individual recipient status
- Monitor delivery progress

**Campaign Statuses:**
- 🟡 **Draft** - Being configured
- 🔵 **Scheduled** - Waiting to send
- 🟠 **Sending** - In progress
- 🟢 **Completed** - Successfully sent
- 🔴 **Failed** - Encountered errors

---

### 3. Excel Upload for Bulk Member Creation

**File Format:**
```csv
full_name,email,phone
John Doe,john@example.com,+1234567890
Jane Smith,jane@example.com,+1234567891
Bob Johnson,bob@example.com,+1234567892
```

**Process:**
1. Upload Excel file
2. System validates format
3. Checks for duplicate emails
4. Creates new member_users records
5. Tracks source as 'campaign'
6. Generates unique enrollment links
7. Automatically enrolls in programs (if membership campaign)

**Validation:**
- Required: full_name, email
- Optional: phone
- Email uniqueness checked per client
- Phone format validated if provided

---

### 4. Unique Link Generation

**Link Structure:**
```
https://yourapp.com/enroll/{campaign_id}-{member_id}-{timestamp}
```

**Features:**
- Each recipient gets unique link
- Tracks clicks and conversions
- Links stored in campaign_recipients table
- Can be used for enrollment, redemption, or tracking
- Expirable (optional)

**Link Tracking:**
- When clicked: status changes to 'clicked'
- Timestamp recorded (clicked_at)
- Source attribution saved
- Conversion tracked

---

### 5. Member Source Tracking

**Source Types:**
- **organic** - Self-signup
- **campaign** - From campaign link
- **import** - Excel upload
- **referral** - Referred by existing member
- **api** - Programmatic creation

**Campaign Attribution:**
- Links members to originating campaign
- Tracks campaign ROI
- Measures conversion rates
- Enables source-based analytics

**Database:**
```sql
member_sources table:
- member_id
- source_type (enum)
- source_campaign_id (nullable)
- source_metadata (jsonb)
- created_at
```

---

## Campaign Types Explained

### 1. Membership Enrollment

**Use Case:** Enroll new or existing members in membership programs

**Process:**
1. Select program (Gold, Silver, Bronze, etc.)
2. Choose recipients
3. Send personalized enrollment messages
4. Members click unique link
5. Automatic enrollment with expiry date
6. Welcome email/SMS sent

**Benefits:**
- Automated onboarding
- Personalized welcome messages
- Track enrollment conversions
- Set validity periods

**Example Message:**
```
Hi {name}!

Welcome to {program}!

Click here to activate your membership: {link}

As a member, you'll enjoy exclusive benefits and rewards.

Thanks,
{client} Team
```

### 2. Reward Distribution

**Use Case:** Distribute coupons, vouchers, or exclusive offers

**Process:**
1. Select reward from marketplace or custom rewards
2. Choose recipients
3. Send distribution messages
4. Members receive unique voucher codes
5. Track redemptions
6. Monitor usage

**Benefits:**
- Instant coupon delivery
- Personalized offers
- Track redemption rates
- Measure campaign ROI

**Example Message:**
```
Hi {name}!

You've received an exclusive reward: {reward}

Redeem here: {link}

Enjoy your savings!

{client}
```

### 3. General Message

**Use Case:** Send announcements, updates, or custom communications

**Process:**
1. Write custom message
2. Select audience
3. Schedule or send immediately
4. Track delivery
5. Monitor engagement

**Benefits:**
- Flexible communications
- No program/reward required
- Custom messaging
- Full tracking

---

## Message Variables

All campaigns support these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{name}` | Recipient's full name | John Doe |
| `{link}` | Unique enrollment/action link | https://app.com/enroll/abc123 |
| `{program}` | Membership program name | Gold Membership |
| `{client}` | Client/company name | TechCorp |
| `{reward}` | Reward title | 20% Off Coupon |
| `{expiry}` | Link/offer expiration | Dec 31, 2024 |

**Usage in Templates:**
```
Hi {name},

Welcome to {program}!

Activate your membership: {link}

Best regards,
The {client} Team
```

---

## Campaign Metrics & Tracking

### Delivery Metrics
- **Total Recipients** - How many will receive message
- **Sent Count** - Successfully delivered
- **Failed Count** - Delivery failures
- **Pending Count** - Awaiting send

### Engagement Metrics
- **Click Rate** - % who clicked unique link
- **Conversion Rate** - % who completed action
- **Time to Click** - Average time to engagement
- **Active Recipients** - Currently engaged users

### Campaign Performance
- **Success Rate** - (Sent / Total) * 100
- **Engagement Score** - Click rate + conversion rate
- **ROI Attribution** - Revenue from campaign members
- **Source Performance** - Compare campaign sources

---

## Database Schema

### message_campaigns
```sql
- id (uuid)
- client_id (uuid)
- name (text)
- description (text)
- campaign_type (enum)
- message_type (enum)
- template_id (uuid, nullable)
- custom_message (text)
- target_audience (text)
- status (enum)
- scheduled_at (timestamp)
- sent_at (timestamp)
- total_recipients (integer)
- sent_count (integer)
- failed_count (integer)
- created_by (uuid)
```

### campaign_recipients
```sql
- id (uuid)
- campaign_id (uuid)
- member_id (uuid, nullable)
- email (text)
- phone (text)
- full_name (text)
- unique_link (text)
- status (enum: pending, sent, failed, clicked)
- sent_at (timestamp)
- clicked_at (timestamp)
- error_message (text)
- metadata (jsonb)
```

### member_sources
```sql
- id (uuid)
- member_id (uuid)
- source_type (enum)
- source_campaign_id (uuid, nullable)
- source_metadata (jsonb)
- created_at (timestamp)
```

---

## Testing Guide

### Test Scenario 1: Membership Enrollment Campaign

1. **Login as Client:**
   ```
   Email: client@test.com
   ```

2. **Create Campaign:**
   - Go to `/client/campaigns`
   - Click "Create Campaign"
   - Name: "Q4 Gold Member Enrollment"
   - Type: Membership Enrollment
   - Select: Gold Membership program
   - Click "Next"

3. **Configure Message:**
   - Type: Email
   - Use template or write custom
   - Subject: "Welcome to Gold Membership!"
   - Body: Use variables {name}, {link}, {program}
   - Click "Next"

4. **Upload Users:**
   - Select "Upload New Users"
   - Upload Excel with:
     ```csv
     full_name,email,phone
     John Doe,john@test.com,+1234567890
     Jane Smith,jane@test.com,+1234567891
     ```
   - Verify users loaded
   - Click "Next"

5. **Preview & Launch:**
   - Review campaign summary
   - Check message preview
   - Leave schedule empty (send now)
   - Click "Launch Campaign"

6. **Verify Results:**
   - Campaign appears in list
   - Status: "Completed"
   - Check campaign_recipients table
   - Verify unique links generated
   - Check member_users created
   - Verify member_memberships created
   - Check member_sources tracked

### Test Scenario 2: Reward Distribution to Existing Members

1. **Create Campaign:**
   - Type: Reward Distribution
   - Select reward from marketplace
   - Click "Next"

2. **Configure Message:**
   - Type: WhatsApp
   - Custom message with {reward} variable
   - Click "Next"

3. **Select Recipients:**
   - Choose "Specific Members"
   - Check 5 existing members
   - Click "Next"

4. **Launch:**
   - Review and launch
   - Verify recipients updated
   - Check unique links

### Test Scenario 3: Scheduled Campaign

1. **Create Campaign:**
   - Type: General Message
   - Custom announcement

2. **Schedule:**
   - Set scheduled_at to tomorrow 10 AM
   - Launch campaign
   - Status should be "Scheduled"

3. **Verify:**
   - Campaign appears as scheduled
   - Will send at specified time
   - Can be edited before send

---

## Integration with Existing Features

### Programs (`/client/programs`)
- Existing membership programs used in campaigns
- Campaign enrollments auto-create memberships
- Expiry dates calculated from program validity

### Rewards (`/client/my-rewards` & `/client/rewards`)
- Both custom and marketplace rewards available
- Campaign distribution creates allocations
- Tracking integrates with reward analytics

### Templates (`/client/templates`)
- Pre-configured message templates
- Support all message types
- Variable substitution automatic

### Reports (`/client/reports`)
- Campaign performance metrics
- Source attribution analysis
- Member acquisition reports
- ROI tracking by campaign

---

## API Endpoints

### Create Campaign
```typescript
POST /message_campaigns
Body: {
  client_id: uuid,
  name: string,
  campaign_type: enum,
  message_type: enum,
  target_audience: string,
  ...
}
```

### Create Recipients
```typescript
POST /campaign_recipients
Body: [{
  campaign_id: uuid,
  member_id: uuid,
  email: string,
  phone: string,
  full_name: string,
  unique_link: string,
  status: 'pending'
}]
```

### Create Members from Upload
```typescript
POST /member_users
Body: [{
  client_id: uuid,
  full_name: string,
  email: string,
  phone: string,
  is_active: true
}]
```

### Track Source
```typescript
POST /member_sources
Body: {
  member_id: uuid,
  source_type: 'campaign',
  source_campaign_id: uuid
}
```

### Enroll in Program
```typescript
POST /member_memberships
Body: {
  member_id: uuid,
  program_id: uuid,
  status: 'active',
  start_date: timestamp,
  expiry_date: timestamp
}
```

---

## Best Practices

### For Campaign Creation:
1. **Use Clear Names** - Descriptive campaign names
2. **Test Templates** - Preview before sending
3. **Segment Audience** - Target right members
4. **Schedule Wisely** - Consider time zones
5. **Track Results** - Monitor performance

### For Message Writing:
1. **Be Personal** - Use {name} variable
2. **Clear CTA** - Make action obvious
3. **Short & Sweet** - Especially for SMS
4. **Brand Voice** - Consistent tone
5. **Mobile-Friendly** - Test on devices

### For Excel Uploads:
1. **Clean Data** - Remove duplicates
2. **Validate Format** - Check before upload
3. **Include Phone** - For SMS/WhatsApp
4. **Test Small** - Try 5-10 records first
5. **Backup Data** - Keep original file

---

## Troubleshooting

### Campaign Not Sending:
- Check campaign status
- Verify recipients exist
- Confirm template selected or message written
- Check scheduled_at date

### Links Not Working:
- Verify link format
- Check campaign_recipients table
- Ensure member_id valid
- Test link generation function

### Members Not Created:
- Check Excel format
- Verify email uniqueness
- Check client_id
- Look for validation errors

### Source Not Tracking:
- Verify campaign_id in recipients
- Check member_sources insertion
- Ensure RLS policies correct

---

## Security & Privacy

### Data Protection:
- Unique links are non-guessable
- Email/phone encrypted in database
- RLS policies enforce client isolation
- Audit trail for all actions

### GDPR Compliance:
- Members can opt-out
- Data deletion on request
- Export capability
- Privacy policy integration

### Rate Limiting:
- Campaigns per day limit
- Messages per minute throttle
- Prevent spam/abuse
- Admin monitoring

---

## Summary

**Completed Features:**
- ✅ Campaign wizard with 4-step process
- ✅ Membership enrollment campaigns
- ✅ Reward distribution campaigns
- ✅ General messaging campaigns
- ✅ Excel bulk upload
- ✅ Unique link generation
- ✅ Member source tracking
- ✅ Campaign list and details
- ✅ Message templates integration
- ✅ Program and reward selection
- ✅ Scheduling capability
- ✅ Status tracking
- ✅ Delivery metrics

**Database:**
- ✅ message_campaigns table
- ✅ campaign_recipients table
- ✅ member_sources table
- ✅ RLS policies
- ✅ Helper functions

**Menu:**
- Dashboard
- Membership Programs
- Members
- My Rewards
- Rewards Marketplace
- **Campaigns** (NEW)
- Message Templates
- Integrations
- Reports
- Settings

**Everything is production-ready!**
