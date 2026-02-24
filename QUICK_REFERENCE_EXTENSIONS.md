# Shopify Extensions - Quick Reference

## Installation Cheat Sheet

### 1. Floating Widget (Bottom-Right Corner)
**Path:** Theme Customizer → App Embeds
```
1. Online Store → Themes → Customize
2. Click "App Embeds" (left sidebar)
3. Find "Rewards Floating Widget"
4. Toggle ON
5. Enter Widget ID
6. Save
```

### 2. Thank You Card (Order Confirmation)
**Path:** Checkout Settings → Order Status Page
```
1. Settings → Checkout
2. Click "Customize"
3. Navigate to "Order Status Page"
4. Add Block → "Rewards Thank You Card"
5. Enter Widget ID
6. Save
```

### 3. Product Banner (Product Pages)
**Path:** Theme Customizer → Product Page
```
1. Online Store → Themes → Customize
2. Go to a Product Page
3. Add Block → "Rewards Banner"
4. Enter Widget ID
5. Customize text
6. Save
```

### 4. Cart Widget (Cart Drawer/Page)
**Path:** Theme Customizer → Cart
```
1. Online Store → Themes → Customize
2. Go to Cart section
3. Add Block → "Rewards Cart Widget"
4. Enter Widget ID
5. Choose position
6. Save
```

### 5. Announcement Bar (Top of Site)
**Path:** Theme Customizer → Header
```
1. Online Store → Themes → Customize
2. Go to Header section
3. Add Block → "Rewards Announcement"
4. Enter Widget ID
5. Customize message
6. Save
```

### 6. Membership Portal (Full Page)
**Path:** App Proxy + Navigation
```
1. Configure App Proxy in Partner Dashboard
   - Subpath: rewards
   - URL: YOUR_API/portal
2. Add Navigation Link
   - Online Store → Navigation
   - Add link to /apps/rewards
   - Label: "My Rewards"
3. Save
```

## Widget Type Quick Lookup

| Need | Use This Widget |
|------|----------------|
| Floating button on all pages | Floating Widget |
| Post-purchase reward offer | Thank You Card |
| Promote rewards on products | Product Banner |
| Show rewards in cart | Cart Widget |
| Site-wide announcement | Announcement Bar |
| Full rewards dashboard | Membership Portal |

## API Endpoint

**All widgets call:**
```
POST /api/widgets/render
```

**Edge Function Location:**
```
/supabase/functions/widget-render/index.ts
```

## Extension Locations

```
/extensions/
  ├── floating-widget/         (Theme App Extension)
  ├── thank-you-card/          (Checkout UI Extension)
  ├── product-banner/          (Theme App Extension)
  ├── cart-rewards/            (Cart UI Extension)
  ├── announcement-bar/        (Theme App Extension)
  └── membership-portal/       (App Proxy)
```

## Key Features

✅ **No Code Editing** - Install via admin UI only
✅ **Read-Only** - Does not modify cart/checkout
✅ **Privacy Compliant** - GDPR-safe
✅ **Auto Cleanup** - Uninstalls completely
✅ **App Store Ready** - Meets all requirements

## Testing Commands

```bash
# Start development server
shopify app dev

# Deploy extensions
shopify app deploy

# Deploy Edge Function
supabase functions deploy widget-render
```

## Common Tasks

### Create New Widget
1. Go to Admin → Shopify Widgets
2. Click "Create Widget"
3. Choose type
4. Configure settings
5. Copy Widget ID
6. Install in Shopify (see above)

### Preview Widget
1. Go to Admin → Shopify Widgets
2. Click "Preview" on any widget
3. See visual representation
4. No Shopify connection needed

### Update Widget
1. Edit widget in admin
2. Changes apply immediately
3. No reinstallation needed

### Remove Widget
1. Theme Customizer → Find widget block
2. Remove or toggle OFF
3. Or uninstall app (auto-removes all)

## Support

- Extension docs: `/extensions/[name]/README.md`
- Main guide: `/extensions/README.md`
- Refactor summary: `/SHOPIFY_EXTENSION_REFACTOR.md`

## Troubleshooting

**Widget not showing?**
- Check widget is enabled in admin
- Verify Widget ID is correct
- Check extension is installed in Theme Customizer
- Clear browser cache

**Checkout extension not working?**
- Verify installed in Checkout Settings
- Check Widget ID matches
- Test with real order

**Portal not loading?**
- Verify App Proxy configured
- Check navigation link is correct
- Test with logged-in customer

## Migration from Old System

**If using legacy script injection:**
1. Remove old `<script>` tags from theme
2. Install new extensions (see above)
3. Test thoroughly
4. Delete old widget.js file

## Production Checklist

- [ ] Deploy all extensions
- [ ] Configure API endpoints
- [ ] Set up App Proxy
- [ ] Test each widget type
- [ ] Verify mobile responsive
- [ ] Check privacy compliance
- [ ] Test uninstall cleanup
- [ ] Submit for App Store review
