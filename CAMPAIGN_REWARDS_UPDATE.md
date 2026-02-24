# Campaign Rewards Update - Marketplace Integration

## What Changed

Campaign reward selection now includes **both** your own rewards and marketplace rewards, giving you more flexibility and value to offer customers.

## Key Features

### Dual Reward Sources

**Your Rewards** (Green "My Reward" badge):
- Rewards you create in "My Rewards"
- Full control over terms and codes
- Exclusive to your brand

**Marketplace Rewards** (Blue "Marketplace" badge):
- Rewards from partner brands
- Professionally managed
- No setup required

### Visual Indicators

The campaign configuration UI now shows clear badges:
- 🟢 **My Reward** - Your custom rewards
- 🔵 **Marketplace** - Partner brand rewards
- Brand names displayed for marketplace items
- Hover effects for better interaction

### Selection Process

1. Go to **Campaigns** → Create/Edit campaign
2. Scroll to **"Rewards to Offer"** section
3. See all available rewards with badges
4. Select any combination of rewards
5. Mix your rewards with marketplace rewards
6. Save campaign

## UI Preview

```
Campaign Configuration - Rewards Section:

┌──────────────────────────────────────────────┐
│ Rewards to Offer                             │
│ Select from your rewards and marketplace     │
│ rewards                                      │
├──────────────────────────────────────────────┤
│                                              │
│ ☑ 25% Off [My Reward]                       │
│   Your exclusive discount                   │
│   25% off • Shopping                        │
│                                              │
│ ☑ Free Shipping [My Reward]                 │
│   Free shipping on any order                │
│   Voucher • Shopping                        │
│                                              │
│ ☑ $15 Uber Credit [Marketplace]             │
│   Ride credit for your next trip            │
│   Credit • Transportation • Uber            │
│                                              │
│ ☐ Spa Day Pass [Marketplace]                │
│   Relaxation day at premium spa             │
│   Experience • Wellness • RelaxSpa          │
│                                              │
├──────────────────────────────────────────────┤
│ 3 rewards selected                           │
└──────────────────────────────────────────────┘
```

## Benefits

### For You (Client)

1. **More Value**: Offer premium brand rewards without creating them
2. **Less Work**: Marketplace rewards are pre-configured
3. **Better Engagement**: Customers love brand-name rewards
4. **Flexibility**: Mix your rewards with marketplace options
5. **Scalability**: Access growing marketplace catalog

### For Customers

1. **More Choice**: Select from diverse reward options
2. **Brand Recognition**: Familiar brands they trust
3. **Higher Value**: Mix of store and partner rewards
4. **Better Experience**: Seamless selection regardless of source

## Example Use Cases

### Scenario 1: New Customer Welcome
**Campaign**: "First Purchase Bonus"
- Trigger: First order >= $50
- Rewards:
  - Your 15% discount (My Reward)
  - $5 Starbucks gift card (Marketplace)
  - Free shipping voucher (My Reward)

### Scenario 2: VIP Customer Rewards
**Campaign**: "Premium Member Benefits"
- Trigger: Order >= $200
- Rewards:
  - Your 30% discount (My Reward)
  - Premium gym membership (Marketplace)
  - $25 restaurant voucher (Marketplace)
  - Exclusive early access (My Reward)

### Scenario 3: Holiday Campaign
**Campaign**: "Holiday Special"
- Trigger: Orders in December
- Rewards:
  - Your 20% off (My Reward)
  - Movie tickets (Marketplace)
  - Spa voucher (Marketplace)
  - Gift wrapping service (My Reward)

## Technical Details

### Database Query

The system now loads rewards using:
```sql
SELECT *, brands(name, logo_url)
FROM rewards
WHERE (client_id = 'your-id' OR is_marketplace = true)
  AND status = 'active'
ORDER BY title
```

This returns:
- All rewards you created (`client_id` matches)
- All active marketplace rewards (`is_marketplace = true`)

### Badge Logic

```typescript
const isMarketplace = reward.is_marketplace === true;
const isOwnReward = reward.client_id === clientId;

// Display appropriate badge
if (isMarketplace) {
  // Show blue "Marketplace" badge
} else if (isOwnReward) {
  // Show green "My Reward" badge
}
```

### Brand Information

Marketplace rewards include brand details:
```typescript
reward.brands = {
  name: "Starbucks",
  logo_url: "https://..."
}
```

This displays as: `Starbucks` in the reward details.

## Backward Compatibility

✅ Existing campaigns continue to work
✅ Previously selected rewards remain associated
✅ No migration required
✅ Old reward selections preserved

## Best Practices

### Reward Selection

1. **Mix Sources**: Combine 2-3 of your rewards with 1-2 marketplace rewards
2. **Value Balance**: Ensure total value is appropriate for trigger condition
3. **Theme Consistency**: Group related rewards (all shopping, all dining, etc.)
4. **Brand Quality**: Choose marketplace rewards from recognized brands
5. **Customer Preference**: Consider your audience demographics

### Campaign Design

1. **Clear Messaging**: Campaign description should mention variety
2. **Fair Triggers**: Order value should justify reward value
3. **Testing**: Test with both reward types selected
4. **Updates**: Refresh marketplace selections periodically
5. **Analytics**: Track which reward types perform better

### Common Combinations

**Budget-Friendly**:
- Your 10% discount + $5 coffee gift card

**Mid-Range**:
- Your 20% discount + Free shipping + $10 brand voucher

**Premium**:
- Your 30% discount + Premium membership + Multiple brand rewards

## Troubleshooting

### No Marketplace Rewards Showing

**Check**:
1. Are there active marketplace rewards? (Browse marketplace)
2. Is your account verified? (Some rewards require verification)
3. Filter settings? (Check "active" status)

**Solution**: Contact brand partners or create your own rewards

### Badge Not Showing

**Check**:
1. Refresh browser cache
2. Verify `is_marketplace` field in database
3. Check `client_id` matches for "My Reward" badge

### Brand Name Missing

**Check**:
1. Reward has `brand_id` set
2. Brand record exists and is active
3. Brand has `name` field populated

**Solution**: Update reward to link to brand

## Future Enhancements

Planned improvements:
- Filter rewards by category in campaign UI
- Search functionality for large reward lists
- Preview how rewards look to customers
- Bulk reward import from marketplace
- Recommended reward combinations
- Analytics on reward performance

## Support

Need help?
- Check CAMPAIGN_MULTI_REWARD_GUIDE.md for detailed setup
- Review sample campaigns in demo data
- Test with small campaigns first
- Contact support with campaign ID if issues arise

---

**Update Complete!**

Start mixing your rewards with marketplace offerings to create compelling campaigns that drive customer engagement and loyalty!
