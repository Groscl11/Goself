# Order Status Rewards - Quick Reference

## 🚀 Quick Installation

```bash
# Run the quick installation script
chmod +x ORDER_STATUS_REWARDS_QUICKSTART.sh
./ORDER_STATUS_REWARDS_QUICKSTART.sh

# Then deploy to Shopify
shopify app deploy
```

## 📋 File Structure

```
extensions/order-status-rewards/
├── src/
│   └── index.jsx                    # Main extension code
├── shopify.ui.extension.toml        # Extension configuration
├── package.json                     # Dependencies
└── README.md                        # Extension docs

supabase/functions/
├── get-order-rewards/               # Fetches reward link for orders
│   └── index.ts
└── process-reward-redemption/       # Handles reward redemption
    └── index.ts

src/pages/public/
└── RedeemRewards.tsx                # Redemption portal page
```

## 🔗 Key Routes

| Route | Description |
|-------|-------------|
| `/redeem/:token` | Public redemption portal |
| Order Status Page | Shopify extension shows banner |

## 🔧 Configuration Points

### 1. Extension Environment Variables

File: `extensions/order-status-rewards/src/index.jsx`

```jsx
const SUPABASE_URL = 'YOUR_PROJECT_URL';
const ANON_KEY = 'YOUR_ANON_KEY';
```

### 2. Token Expiration

File: `supabase/functions/shopify-webhook/index.ts`

```typescript
expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
```

### 3. Redemption Portal Styling

File: `src/pages/public/RedeemRewards.tsx`

Update Tailwind classes for colors, spacing, etc.

## 🧪 Testing Checklist

- [ ] Campaign rule created and enabled
- [ ] Test order placed (meets campaign conditions)
- [ ] Rewards banner appears on Order Status page
- [ ] "View My Rewards" button opens redemption portal
- [ ] Order details display correctly
- [ ] Rewards list shows all allocated rewards
- [ ] Email contact method works
- [ ] SMS contact method works
- [ ] Redemption completes successfully
- [ ] Vouchers created in database
- [ ] Member created/updated in database
- [ ] Notification sent (email/SMS)
- [ ] Token marked as used

## 📊 Database Queries

### Check Token Status
```sql
SELECT * FROM member_redemption_tokens
WHERE token = 'YOUR_TOKEN';
```

### Check Recent Redemptions
```sql
SELECT
  mrt.token,
  mrt.used,
  mrt.used_at,
  m.email,
  m.phone,
  so.order_number
FROM member_redemption_tokens mrt
LEFT JOIN members m ON mrt.member_id = m.id
LEFT JOIN shopify_orders so ON mrt.order_id = so.id
WHERE mrt.used = true
ORDER BY mrt.used_at DESC
LIMIT 10;
```

### Check Vouchers Created
```sql
SELECT
  v.id,
  v.status,
  v.created_at,
  r.name as reward_name,
  m.email as member_email,
  m.phone as member_phone
FROM vouchers v
JOIN rewards r ON v.reward_id = r.id
JOIN members m ON v.member_id = m.id
ORDER BY v.created_at DESC
LIMIT 10;
```

### Check Communications Sent
```sql
SELECT * FROM campaign_communications
WHERE message_type = 'reward_redemption'
ORDER BY created_at DESC
LIMIT 10;
```

## 🐛 Common Issues

### Issue: Banner not showing
**Solution:**
1. Check if order has redemption token
2. Verify extension is deployed and active
3. Check browser console for errors
4. Verify Supabase credentials in extension code

### Issue: Redemption fails
**Solution:**
1. Check token is not expired or used
2. Verify edge function is deployed
3. Check database RLS policies
4. Review edge function logs

### Issue: No notification sent
**Solution:**
1. Verify client communication settings
2. Check Twilio credentials (for SMS)
3. Check email settings
4. Review campaign_communications table

## 🎨 Customization Examples

### Change Banner Color
```jsx
// In extensions/order-status-rewards/src/index.jsx
<Banner status="info" ...> // blue banner
<Banner status="success" ...> // green banner (default)
<Banner status="warning" ...> // yellow banner
```

### Custom Reward Display
```tsx
// In src/pages/public/RedeemRewards.tsx
{rewardDetails.rewards.map((reward) => (
  <div className="custom-reward-card">
    {/* Your custom design */}
  </div>
))}
```

### Change Contact Methods
```tsx
// In src/pages/public/RedeemRewards.tsx
// Add WhatsApp, Facebook Messenger, etc.
<button onClick={() => setContactMethod('whatsapp')}>
  WhatsApp
</button>
```

## 🔐 Security Notes

1. **Tokens are one-time use** - Automatically marked as used after redemption
2. **Tokens expire** - Default 30 days, configurable
3. **Server-side validation** - All checks happen on edge functions
4. **No sensitive data in tokens** - Just a random string
5. **HTTPS required** - All communications encrypted

## 📞 Support Resources

- Full Guide: [ORDER_STATUS_REWARDS_GUIDE.md](./ORDER_STATUS_REWARDS_GUIDE.md)
- Campaign Rules: [ADVANCED_RULE_ENGINE.md](./ADVANCED_RULE_ENGINE.md)
- Thank You Widget: [SIMPLE_THANK_YOU_SETUP.md](./SIMPLE_THANK_YOU_SETUP.md)
- Communications: [CAMPAIGN_COMMUNICATIONS_GUIDE.md](./CAMPAIGN_COMMUNICATIONS_GUIDE.md)

## 🎯 Next Steps

After installation:

1. **Create diverse campaigns** - Different triggers, conditions, rewards
2. **Monitor logs** - Check Campaign Trigger Logs dashboard
3. **Analyze redemptions** - Track success rates
4. **Optimize messaging** - A/B test different banner text
5. **Expand rewards** - Add more brands and reward types

---

**Quick Links:**
- [View Installation Guide](./ORDER_STATUS_REWARDS_GUIDE.md)
- [Run Installation Script](./ORDER_STATUS_REWARDS_QUICKSTART.sh)
- [Shopify Extensions](./extensions/)
