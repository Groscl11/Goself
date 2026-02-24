# Shopify Integration - UI Setup Guide Update

## Summary

Added comprehensive setup instructions directly in the Integrations page UI for easy access.

## What Was Added

### Interactive Setup Guide in UI

A collapsible setup guide now appears on the Integrations page (`/client/integrations`) when no Shopify store is connected.

### Features

1. **Expandable/Collapsible Section**
   - Click to show/hide the full setup guide
   - Only visible when not connected
   - Clear visual hierarchy with numbered steps

2. **6-Step Setup Process**

   **Step 1: Create Shopify Partner Account**
   - Direct link to partners.shopify.com
   - Account creation steps
   - Profile completion checklist

   **Step 2: Create Your Shopify App**
   - Where to create the app
   - App name suggestion
   - **Auto-populated App URL** (current site URL)
   - **OAuth Redirect URL with Copy Button** (auto-generated from Supabase URL)

   **Step 3: Configure API Scopes**
   - Required scopes listed with checkmarks:
     - `read_orders`
     - `read_customers`
     - `read_products`
   - Where to find and configure scopes

   **Step 4: Get API Credentials**
   - Where to find Client ID
   - Where to find Client Secret
   - Warning about secret only shown once

   **Step 5: Configure Environment Variables**
   - Exact Supabase navigation path
   - Three required secrets with names and format:
     - `SHOPIFY_API_KEY`
     - `SHOPIFY_API_SECRET`
     - `APP_URL` (auto-populated)

   **Step 6: Deploy Edge Functions**
   - Terminal commands with syntax highlighting
   - All three deployment commands listed

3. **Smart Features**

   - **Auto-populated URLs**: App URL and OAuth redirect URL are automatically generated from environment
   - **Copy to Clipboard**: One-click copy for OAuth redirect URL
   - **Visual Indicators**: Numbered badges, checkmarks, color-coded sections
   - **Warnings**: Red highlight for important security notes
   - **Success State**: Green checkmark when ready to connect

4. **Documentation Links**
   - References to complete documentation files
   - Quick guide for where to find detailed help

## User Experience

### Before Connection
1. User sees blue info card with "First Time Setup Guide"
2. Click to expand and see detailed 6-step instructions
3. All URLs are pre-filled and ready to copy
4. Follow steps in Shopify Partner Dashboard
5. Return and click "Connect Shopify Store"

### After Connection
- Setup guide disappears automatically
- Shows connection details instead
- Clean interface without clutter

## Visual Design

- **Blue theme** for info/setup sections
- **Numbered badges** (1-6) in blue circles
- **Green success indicators** for final step
- **Red warnings** for critical information
- **Code blocks** with proper styling:
  - Light gray for inline code
  - Yellow highlight for important URLs
  - Dark terminal for commands
- **Collapsible** to save space

## Technical Implementation

### New State
```typescript
const [showSetupGuide, setShowSetupGuide] = useState(false);
```

### New Icons
- `BookOpen` - Setup guide indicator
- `ChevronDown` / `ChevronUp` - Expand/collapse
- `Link` - Copy URL button

### Conditional Rendering
- Only shown when `!integration` (not connected)
- Automatically hidden when connection exists

## URL Auto-Generation

### App URL
```javascript
{window.location.origin}
```
Example: `https://yourapp.com`

### OAuth Redirect URL
```javascript
{import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth-callback
```
Example: `https://abcdef123.supabase.co/functions/v1/shopify-oauth-callback`

## Benefits

1. **No Context Switching**: Setup instructions right in the app
2. **Copy-Paste Ready**: URLs pre-generated and copyable
3. **Visual Progress**: Clear numbered steps
4. **Less Error-Prone**: No manual URL construction
5. **Self-Service**: Admins can set up without external docs
6. **Always Up-to-Date**: URLs reflect current environment

## Documentation Hierarchy

```
In-App Setup Guide (UI)
├─ Quick visual reference
├─ Pre-filled URLs
├─ Copy-paste commands
└─ Links to detailed docs
    ├─ SHOPIFY_INTEGRATION_INDEX.md
    ├─ SHOPIFY_APP_SETUP_COMPLETE_GUIDE.md
    ├─ SHOPIFY_URL_REFERENCE.md
    └─ SHOPIFY_OAUTH_QUICK_START.md
```

## When to Use What

**Use In-App Guide When:**
- First-time setup
- Quick reference during setup
- Need to copy URLs
- Step-by-step walkthrough

**Use Documentation Files When:**
- Need troubleshooting
- Want detailed explanations
- Understanding technical architecture
- Migrating existing setups

## Future Enhancements

Possible additions:
- [ ] Setup progress checkboxes
- [ ] Automatic verification of environment variables
- [ ] Test connection button
- [ ] Integration health checks
- [ ] Video tutorial links
- [ ] Estimated time per step

---

**Result:** Platform administrators can now complete the entire Shopify app setup without leaving the interface, with all URLs pre-generated and ready to copy.
