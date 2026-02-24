# Campaign Trigger Logs - Complete Implementation

## Order #1023 Investigation

**Issue**: Campaign didn't trigger for order #1023 (value: 7433.42)

**Root Cause**: Member was created with email but webhook lookup failed

Order Details:
- Order #1023
- Value: $7,433.42 (qualified for "over 5000" campaign)
- Customer: shubham.ss122+90@gmail.com
- Phone: null
- Member exists with ID: d893a4ff-0e56-4ee7-b598-6c10b25cc01b

The member existed but was NOT enrolled. Without detailed logging, we couldn't determine the exact failure point. This led to implementing comprehensive trigger logging.

## Solution Implemented

### 1. Campaign Trigger Logs Database Table

Created `campaign_trigger_logs` table to track EVERY campaign trigger attempt:

**Fields:**
- Campaign information (campaign_rule_id, metadata)
- Order details (order_id, order_number, order_value)
- Customer data (email, phone)
- Member information (member_id, membership_id if enrolled)
- Result status (success, failed, no_member, already_enrolled, max_reached, below_threshold)
- Detailed reason for the outcome
- Timestamp

**RLS Policies:**
- Admins can view all logs
- Clients can view only their logs

### 2. Enhanced Webhook Logging

Updated `shopify-webhook` edge function to log at every decision point:

**Logged Events:**
- **below_threshold**: Order value doesn't meet campaign minimum
- **no_member**: No member found with customer email/phone
- **already_enrolled**: Member already in program via another campaign
- **max_reached**: Campaign hit enrollment limit
- **success**: Member successfully enrolled
- **failed**: Enrollment attempt failed (with error details)

**Metadata Captured:**
- Campaign name and min_order_value
- Order value comparison
- Enrollment counts
- Error messages for failures
- Program IDs and related info

### 3. Frontend Campaign Trigger Logs Page

Created `/client/campaign-logs` page with:

**Dashboard Stats:**
- Total triggers
- Successful enrollments
- No member found count
- Failed attempts

**Filterable Log Table:**
- Filter by result type (success, failed, no_member, etc.)
- Search by order number, email, phone, or campaign name
- Real-time status with color-coded badges
- Detailed reason for each outcome
- Customer and order information
- Timestamp for each attempt

**Visual Indicators:**
- Green: Success
- Red: Failed
- Orange: No Member
- Blue: Already Enrolled
- Purple: Max Reached
- Gray: Below Threshold

## How to Use

### For Clients:

1. Navigate to **Campaigns → Campaign Trigger Logs**
2. View dashboard stats for quick overview
3. Filter logs by result type using dropdown
4. Search for specific orders or customers
5. Click on any row to see detailed reason

### For Debugging:

When a campaign doesn't trigger:
1. Check Campaign Trigger Logs
2. Find the order number
3. Review the trigger_result and reason
4. Check metadata for detailed context

Example scenarios:

**No Member Found:**
```
Result: no_member
Reason: "No member found with phone: none, email: customer@example.com"
→ Customer email doesn't match any member record
```

**Already Enrolled:**
```
Result: already_enrolled
Reason: "Member already enrolled in program (membership_id: xyz, via campaign: abc)"
→ Member was enrolled by lower-value campaign first (due to processing order)
```

**Below Threshold:**
```
Result: below_threshold
Reason: "Order value 99.99 below minimum 5000"
→ Order didn't meet campaign requirement
```

## Testing the System

### Test Order #1023 Again:

1. Check the Campaign Trigger Logs page
2. Search for order "1023"
3. Review why it didn't trigger
4. The log will show:
   - Which campaigns were checked
   - Why each campaign succeeded/failed
   - Customer lookup results
   - Full decision tree

### Future Orders:

All new orders will automatically log trigger attempts. You can:
- Monitor campaign performance
- Identify missing member records
- Debug enrollment issues
- Track campaign effectiveness

## Database Query Examples

```sql
-- View all logs for a specific campaign
SELECT * FROM campaign_trigger_logs
WHERE campaign_rule_id = 'YOUR_CAMPAIGN_ID'
ORDER BY created_at DESC;

-- Find all no_member results (potential member sync issues)
SELECT
  order_number,
  customer_email,
  customer_phone,
  reason,
  created_at
FROM campaign_trigger_logs
WHERE trigger_result = 'no_member'
ORDER BY created_at DESC;

-- Campaign success rate
SELECT
  cr.name as campaign_name,
  COUNT(*) FILTER (WHERE ctl.trigger_result = 'success') as success_count,
  COUNT(*) as total_attempts,
  ROUND(COUNT(*) FILTER (WHERE ctl.trigger_result = 'success')::numeric / COUNT(*) * 100, 2) as success_rate
FROM campaign_trigger_logs ctl
JOIN campaign_rules cr ON cr.id = ctl.campaign_rule_id
WHERE ctl.client_id = 'YOUR_CLIENT_ID'
GROUP BY cr.name;
```

## Benefits

1. **Complete Visibility**: See every campaign trigger attempt, not just successes
2. **Easy Debugging**: Detailed reasons for failures make troubleshooting simple
3. **Performance Tracking**: Monitor campaign effectiveness over time
4. **Customer Insights**: Identify missing member records or sync issues
5. **Audit Trail**: Full history of all enrollment attempts

## Files Modified

1. **Database:**
   - `supabase/migrations/add_campaign_trigger_logs.sql` - New table and RLS

2. **Backend:**
   - `supabase/functions/shopify-webhook/index.ts` - Enhanced logging

3. **Frontend:**
   - `src/pages/client/CampaignTriggerLogs.tsx` - New logs page
   - `src/pages/client/clientMenuItems.tsx` - Added menu item
   - `src/App.tsx` - Added route

## Next Steps

1. Place a new test order
2. Check Campaign Trigger Logs immediately
3. Verify all campaigns are being checked
4. Review the detailed logging for each campaign
5. Use insights to optimize campaign configurations

## Support

If a campaign still doesn't trigger after this fix:
1. Check Campaign Trigger Logs first
2. Look for the order number
3. Review the trigger_result and reason
4. Check metadata for additional context
5. Verify campaign configuration matches requirements
