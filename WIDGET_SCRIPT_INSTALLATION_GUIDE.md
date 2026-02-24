# Widget Script Installation Guide

## Overview

The Widget Management interface now includes a **Script Installation** option for clients who don't have the Shopify app installed. This provides a quick, copy-paste solution for implementing widgets without going through the full app deployment process.

## Supported Widgets

Script installation is available for:

1. **Floating Widget** - Appears on all pages
2. **Thank You Card** - Appears on order confirmation page
3. **Product Banner** - Appears on product pages

## How It Works

### For Clients

1. **Create Widget Configuration**
   - Navigate to App Extensions page
   - Click "Add Widget"
   - Select widget type
   - Widget ID is automatically generated

2. **View Installation Script**
   - Click the green **Code icon** (</>) on any supported widget
   - Modal opens with step-by-step instructions
   - Script is pre-configured with Widget ID and API endpoints

3. **Copy & Install**
   - Click "Copy Script" button
   - Follow the installation steps for the specific widget type
   - Paste into appropriate location in Shopify
   - Save and test

### Widget-Specific Installation

#### Floating Widget
**Location:** Theme code (theme.liquid)
**Steps:**
1. Online Store → Themes → Edit code
2. Open Layout → theme.liquid
3. Scroll to bottom, before `</body>` tag
4. Paste script
5. Save

**Features:**
- Fixed position button (bottom-right)
- Gradient background with icon
- Hover animation
- Calls API on click
- Redirects to rewards portal

#### Thank You Card
**Location:** Checkout settings (Additional scripts)
**Steps:**
1. Settings → Checkout
2. Order status page → Additional scripts
3. Paste script in text box
4. Save

**Features:**
- Only appears after order completion
- Automatically gets order data from Shopify
- Beautiful gradient card design
- Shows reward details and claim button
- Conditional rendering based on eligibility

#### Product Banner
**Location:** Product template (product-template.liquid)
**Steps:**
1. Online Store → Themes → Edit code
2. Open Sections → product-template.liquid
3. Find good location (before/after product form)
4. Paste script
5. Save

**Features:**
- Only appears on product pages
- Gradient banner with icon
- Customizable title and description
- CTA button
- Responsive design

## Script Features

### Security
- Uses Supabase authentication
- Bearer token included
- HTTPS-only API calls
- No sensitive data in client code

### Performance
- Lightweight vanilla JavaScript
- No external dependencies
- Async loading
- Error handling included

### Functionality
- Auto-detects page context
- Fetches dynamic content from API
- Conditional rendering (only shows when eligible)
- Clean error handling (fails silently)

## Technical Details

### Script Generation
Scripts are dynamically generated with:
- Widget ID from configuration
- Supabase project URL
- Supabase anon key
- Widget-specific logic

### API Integration
All scripts call the `widget-render` edge function:
```
POST /functions/v1/widget-render
```

**Request Body:**
```json
{
  "widget_type": "floating|thankyou_card|product_banner",
  "widget_id": "uuid",
  "customer_email": "optional",
  "order_id": "optional",
  "order_total": 0,
  "page_context": { "type": "..." }
}
```

**Response:**
```json
{
  "should_render": true|false,
  "ui_payload": {
    "title": "...",
    "description": "...",
    "cta_text": "...",
    "redeem_url": "...",
    "reward_details": { ... }
  }
}
```

## User Interface

### Widget Card Enhancement
Supported widgets show a green **Code icon** button that opens the script modal.

### Script Modal Features
- Clear installation instructions
- Step-by-step numbered guide
- Syntax-highlighted code block
- Copy button with confirmation
- Important notes section
- Close/Copy & Close buttons

### Visual Indicators
- Green "No App Required" badge
- Widget-specific instructions
- Important notes customized per widget
- Responsive modal design

## Benefits

### For Clients Without App
- No Shopify CLI required
- No app installation needed
- No Partner account needed
- Immediate implementation
- Easy to test and iterate

### For Development
- Faster testing cycle
- No deployment delays
- Direct code access
- Easy debugging
- Quick updates

## Best Practices

### Before Installation
1. Test on development/staging theme first
2. Verify widget-render edge function is deployed
3. Check widget configuration is enabled
4. Confirm API credentials are correct

### After Installation
1. Test widget appears correctly
2. Verify API calls succeed
3. Check console for errors
4. Test on mobile devices
5. Monitor performance

### Troubleshooting
- Check browser console for errors
- Verify Supabase function logs
- Test API endpoint manually
- Confirm widget ID is correct
- Check theme compatibility

## Migration Path

Clients can start with script installation and migrate to Shopify app later:

1. **Start:** Use script installation for quick setup
2. **Test:** Validate functionality and design
3. **Scale:** Deploy full Shopify app when ready
4. **Migrate:** Replace scripts with app extensions
5. **Optimize:** Use native Shopify features

## Comparison

| Feature | Script Installation | Shopify App |
|---------|-------------------|-------------|
| Setup Time | 5 minutes | 1-2 hours |
| Requires CLI | No | Yes |
| App Review | No | Yes (public apps) |
| Updates | Manual | Automatic |
| Integration | Basic | Deep |
| Maintenance | Higher | Lower |
| Best For | Testing, small stores | Production, scale |

## Code Examples

### Floating Widget Output
```html
<!-- Fixed position button -->
<div style="position: fixed; bottom: 20px; right: 20px; ...">
  <svg>...</svg>
</div>
```

### Thank You Card Output
```html
<!-- Gradient card with reward info -->
<div style="background: gradient...; padding: 24px; ...">
  <h3>You've Earned a Reward!</h3>
  <p>Thank you for your purchase!</p>
  <a href="/redeem">Claim Your Reward</a>
</div>
```

### Product Banner Output
```html
<!-- Banner above/below product form -->
<div style="background: gradient...; padding: 20px; ...">
  <h3>Get Exclusive Rewards!</h3>
  <p>Purchase this product and unlock benefits</p>
  <a href="/rewards">Learn More</a>
</div>
```

## Future Enhancements

Potential additions:
- More widget types (cart, homepage, etc.)
- Visual customization options
- A/B testing capabilities
- Analytics integration
- Multi-language support
- Theme-specific optimizations

## Support

If widgets don't appear:
1. Check widget is enabled in configuration
2. Verify script is saved correctly
3. Clear browser cache
4. Test in incognito mode
5. Check Shopify theme compatibility
6. Review browser console for errors
7. Verify edge function is deployed

## Summary

The script installation feature provides a powerful alternative to full app deployment, enabling quick testing and implementation for clients who need immediate results without the complexity of Shopify app setup.
