# Simple Thank You Page Setup (No Shopify CLI Required)

## Why Your Extension Isn't Showing

Checkout UI Extensions require Shopify CLI deployment and a published Shopify app. For a simpler setup, use this alternative approach.

## Quick Alternative: Custom Script Method

### Step 1: Enable Additional Scripts

1. Go to **Settings → Checkout** in Shopify Admin
2. Scroll to **Order status page**
3. Find **Additional scripts** section
4. Paste the script below

### Step 2: Add This Script

```html
<script>
(function() {
  // Configuration
  const WIDGET_API = 'YOUR_SUPABASE_URL/functions/v1/widget-render';
  const WIDGET_ID = 'YOUR_WIDGET_ID';

  // Get order data from Shopify's thank you page
  const orderData = {
    order_id: Shopify.checkout?.order_id || null,
    order_number: Shopify.checkout?.order_number || null,
    email: Shopify.checkout?.email || null,
    total_price: Shopify.checkout?.total_price || 0,
    currency: Shopify.checkout?.currency || 'USD'
  };

  // Only run on thank you page
  if (!orderData.order_id) return;

  // Fetch reward data
  fetch(WIDGET_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({
      widget_type: 'thankyou_card',
      widget_id: WIDGET_ID,
      order_id: orderData.order_id,
      customer_email: orderData.email,
      order_total: parseFloat(orderData.total_price) / 100,
      page_context: {
        type: 'thank_you',
        order_number: orderData.order_number
      }
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.should_render) return;

    // Create reward card element
    const card = document.createElement('div');
    card.className = 'rewards-thank-you-card';
    card.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        border-radius: 12px;
        margin: 20px 0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      ">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="
            background: white;
            color: #667eea;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
          ">🎁</div>
          <div style="flex: 1;">
            <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">
              ${data.ui_payload.title || "You've Earned a Reward!"}
            </h3>
            <p style="margin: 0; opacity: 0.9; font-size: 14px;">
              ${data.ui_payload.description || "Thank you for your purchase!"}
            </p>
          </div>
        </div>

        ${data.ui_payload.reward_details ? `
          <div style="
            background: rgba(255,255,255,0.15);
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
          ">
            <div style="font-weight: 600; margin-bottom: 4px;">
              ${data.ui_payload.reward_details.title}
            </div>
            <div style="opacity: 0.9; font-size: 14px;">
              ${data.ui_payload.reward_details.description || ''}
            </div>
          </div>
        ` : ''}

        ${data.ui_payload.redeem_url ? `
          <a href="${data.ui_payload.redeem_url}" style="
            display: inline-block;
            background: white;
            color: #667eea;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 12px;
            transition: transform 0.2s;
          " onmouseover="this.style.transform='scale(1.05)'"
             onmouseout="this.style.transform='scale(1)'">
            ${data.ui_payload.cta_text || 'Claim Your Reward'}
          </a>
        ` : ''}

        ${data.ui_payload.instructions ? `
          <p style="margin: 12px 0 0 0; opacity: 0.8; font-size: 13px;">
            ${data.ui_payload.instructions}
          </p>
        ` : ''}
      </div>
    `;

    // Insert after order confirmation
    const mainContent = document.querySelector('.main__content, .step__sections, main');
    if (mainContent) {
      mainContent.insertBefore(card, mainContent.firstChild);
    }
  })
  .catch(error => {
    console.error('Rewards widget error:', error);
  });
})();
</script>
```

### Step 3: Configure the Script

Replace these values in the script:
- `YOUR_SUPABASE_URL` - Your Supabase project URL
- `YOUR_WIDGET_ID` - Widget ID from your rewards dashboard
- `YOUR_SUPABASE_ANON_KEY` - Your Supabase anon key

### Step 4: Save and Test

1. Click **Save** in Checkout settings
2. Place a test order
3. Check the thank you page
4. The reward card should appear if eligible

## Advantages of This Approach

✓ No Shopify CLI required
✓ No app installation needed
✓ Works immediately
✓ Easy to update
✓ No monthly app fees

## Disadvantages

- Appears in "Additional scripts" (less organized)
- Manual updates required
- Not as integrated as native extensions
- Limited to Order Status page

## When to Use Full Extension Deployment

Use the full Checkout UI Extension approach when:
- Building a public Shopify app
- Need multiple checkout touchpoints
- Want app store distribution
- Require deeper Shopify integration
- Have development resources

## Troubleshooting

### Card Doesn't Appear
- Check browser console for errors
- Verify API endpoint is accessible
- Confirm Widget ID is correct
- Test with eligible order

### Styling Issues
- Adjust CSS in the `innerHTML` section
- Test on mobile devices
- Check theme compatibility

### API Errors
- Verify Supabase credentials
- Check CORS settings
- Confirm edge function is deployed

## Next Steps

1. Add the script to Order Status page
2. Configure your Widget ID
3. Test with a sample order
4. Customize styling as needed
5. Monitor performance in Supabase logs
