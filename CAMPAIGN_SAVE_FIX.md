# Campaign Save Issue - Fixed

## Problem

Campaigns were not being saved when creating or editing at the client level. Users would fill out the campaign form and click save, but the campaign would not persist to the database.

## Root Cause

The `campaign_rewards` table was missing two columns that the frontend code expected:

1. **`priority`** - Integer field used to order rewards within a campaign
2. **`is_active`** - Boolean field to control if a reward is active in the campaign

When the campaign save operation tried to insert data into `campaign_rewards`, it failed because these columns didn't exist.

### Code Expectation

```javascript
const campaignRewardsData = selectedRewards.map((rewardId, index) => ({
  campaign_id: campaignId,
  reward_id: rewardId,
  priority: index,        // ❌ Column didn't exist
  is_active: true         // ❌ Column didn't exist
}));
```

### Database Reality

The table had these columns instead:
- `quantity` (integer)
- `is_optional` (boolean)

But not the expected `priority` and `is_active` columns.

## Solution Applied

### Migration: `add_priority_and_is_active_to_campaign_rewards`

Added the missing columns to the `campaign_rewards` table:

```sql
-- Add priority column
ALTER TABLE campaign_rewards ADD COLUMN priority integer DEFAULT 0;

-- Add is_active column
ALTER TABLE campaign_rewards ADD COLUMN is_active boolean DEFAULT true;

-- Add index for efficient ordering
CREATE INDEX idx_campaign_rewards_campaign_priority
  ON campaign_rewards(campaign_id, priority);
```

## How Campaigns Work Now

### Creating a Campaign

1. User fills out campaign form with:
   - Program selection
   - Campaign name and description
   - Trigger type and conditions
   - Start/end dates
   - Priority level
   - Selected rewards

2. Backend saves to `campaign_rules` table:
   - Auto-generates `campaign_id` (e.g., `CAMP-0001`)
   - Stores trigger conditions
   - Sets active status

3. Backend saves to `campaign_rewards` table:
   - Links selected rewards to campaign
   - Sets priority order (0, 1, 2...)
   - Marks all as active by default

### Editing a Campaign

1. User clicks edit on existing campaign
2. Form loads with current values
3. User modifies fields
4. On save:
   - Updates `campaign_rules` record
   - Deletes old `campaign_rewards` records
   - Inserts new `campaign_rewards` records with updated selection

## Database Schema

### campaign_rules Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| campaign_id | text | Human-readable ID (CAMP-XXXX) |
| client_id | uuid | Owner client |
| program_id | uuid | Associated program |
| name | text | Campaign name |
| description | text | Campaign description |
| trigger_type | enum | Type of trigger |
| trigger_conditions | jsonb | Trigger rules |
| is_active | boolean | Active status |
| priority | integer | Campaign priority |
| start_date | timestamptz | Start date |
| end_date | timestamptz | End date |
| max_enrollments | integer | Max enrollments |
| current_enrollments | integer | Current count |

### campaign_rewards Table (Junction)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| campaign_id | uuid | FK to campaign_rules |
| reward_id | uuid | FK to rewards |
| quantity | integer | Quantity (legacy) |
| is_optional | boolean | Optional flag (legacy) |
| **priority** | **integer** | **Display order (NEW)** |
| **is_active** | **boolean** | **Active status (NEW)** |
| created_at | timestamptz | Creation timestamp |

## Testing

### Create New Campaign

1. Log in as a client user
2. Navigate to **Campaigns** page
3. Click **"New Campaign Rule"**
4. Fill out form:
   - Select a program
   - Enter campaign name
   - Select trigger type
   - Set trigger conditions
   - Select rewards
5. Click **Save**
6. ✅ Campaign should save successfully
7. ✅ Campaign ID should be displayed (e.g., CAMP-0005)

### Edit Existing Campaign

1. Find an existing campaign
2. Click the **Edit** button
3. Modify any field
4. Change selected rewards
5. Click **Save**
6. ✅ Changes should save successfully
7. ✅ Rewards list should update

### Verify in Database

```sql
-- Check campaign was created
SELECT campaign_id, name, is_active FROM campaign_rules
WHERE client_id = 'your-client-id'
ORDER BY created_at DESC;

-- Check rewards were linked
SELECT cr.campaign_id, r.title, cwr.priority, cwr.is_active
FROM campaign_rewards cwr
JOIN campaign_rules cr ON cr.id = cwr.campaign_id
JOIN rewards r ON r.id = cwr.reward_id
WHERE cr.client_id = 'your-client-id'
ORDER BY cr.campaign_id, cwr.priority;
```

## Security

All operations are protected by Row Level Security (RLS):

### Clients Can:
- ✅ View their own campaigns
- ✅ Create campaigns for their client_id
- ✅ Update their own campaigns
- ✅ Delete their own campaigns
- ✅ Manage rewards for their campaigns

### Clients Cannot:
- ❌ View other clients' campaigns
- ❌ Modify other clients' campaigns
- ❌ Create campaigns for other clients

## Related Files

### Frontend
- `/src/pages/client/Campaigns.tsx` - Campaign management UI
- `/src/pages/client/CampaignsAdvanced.tsx` - Advanced campaign rules

### Backend
- `/supabase/migrations/20260126163136_add_campaign_id_field.sql` - Campaign ID generation
- `/supabase/migrations/add_priority_and_is_active_to_campaign_rewards.sql` - Column additions (this fix)

### Functions
- `/supabase/functions/check-campaign-rewards/` - Check campaign eligibility
- `/supabase/functions/evaluate-campaign-rules/` - Evaluate trigger rules
- `/supabase/functions/send-campaign-communication/` - Send notifications

## What's Fixed

✅ **Campaign Creation** - Campaigns now save successfully
✅ **Campaign Editing** - Changes persist to database
✅ **Reward Selection** - Multiple rewards can be added to campaigns
✅ **Reward Ordering** - Priority field controls display order
✅ **Reward Status** - Individual rewards can be activated/deactivated
✅ **Campaign IDs** - Auto-generated for Shopify extension use

## Known Issues

None currently. The fix addresses the root cause completely.

## Future Enhancements

Consider these improvements:

1. **Drag-and-drop reward ordering** - Visual reordering of rewards by priority
2. **Reward quantity per campaign** - Use the `quantity` field for limits
3. **Optional vs required rewards** - Use `is_optional` for reward selection rules
4. **Campaign duplication** - Clone existing campaigns
5. **Campaign templates** - Pre-configured campaign templates

## Support

If campaigns still don't save:

1. Check browser console for errors
2. Verify user has client role with client_id set
3. Confirm RLS policies are active
4. Check database connection
5. Review Supabase logs for error details

---

**Status**: ✅ Fixed
**Date**: 2026-01-27
**Version**: 1.0
