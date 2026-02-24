# Automatic Endpoint Detection

The Integrations page now automatically detects whether the app is running locally or in production and updates all API endpoints accordingly.

## How It Works

### Environment Detection

The system automatically detects the current environment based on the URL:

- **Local Development**: `localhost`, `127.0.0.1`, or URLs containing `local.`
- **Production**: Any other URL (your deployed domain)

### Dynamic URL Updates

All API endpoints and configuration URLs are automatically updated:

1. **Shopify App URLs**
   - App URL for Shopify configuration
   - OAuth redirect URLs
   - Webhook endpoints

2. **API Documentation**
   - All endpoint examples in the API documentation section
   - Request examples with correct base URLs
   - Authentication URLs

3. **Integration Configuration**
   - OAuth connection flows
   - Webhook registration
   - API calls to edge functions

## What Updates Automatically

### In the Shopify Setup Guide

- ✅ **App URL**: Shows your current domain (local or production)
- ✅ **OAuth Redirect URL**: Uses correct Supabase function URL
- ✅ **Environment Indicator**: Shows whether you're in local or production mode

### In the API Documentation Section

- ✅ **All Endpoint URLs**: Campaign, Loyalty, and Widget APIs
- ✅ **Example Code**: Fetch requests with correct URLs
- ✅ **Authentication Headers**: Correct anon key
- ✅ **Environment Badge**: Visual indicator of current environment

## Benefits

1. **No Manual Configuration**: URLs update automatically based on deployment
2. **Copy-Paste Ready**: All URLs are correct for your current environment
3. **Development Friendly**: Test locally with local URLs, deploy with production URLs
4. **Error Prevention**: No need to manually change URLs when deploying

## Usage

### During Development

When running locally (`npm run dev`):
```
App URL: http://localhost:5173
OAuth Redirect: https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
Environment: Local Development
```

### In Production

When deployed (e.g., on Netlify):
```
App URL: https://your-app.netlify.app
OAuth Redirect: https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
Environment: Production
```

## Visual Indicators

### Production Mode
Green badge showing:
- "Using production URL (auto-detected)"
- "Showing production endpoints for: [your-domain]"

### Local Mode
Blue badge showing:
- "Local development mode - endpoints will update automatically when deployed"

## Technical Implementation

### API Configuration Utility

Location: `src/lib/api-config.ts`

Key functions:
- `getApiConfig()` - Detects environment and returns configuration
- `getAppUrl()` - Returns current application URL
- `getOAuthRedirectUrl()` - Returns OAuth callback URL
- `getApiEndpoints()` - Returns all formatted endpoint URLs

### Integration Page Updates

The Integrations page (`src/pages/client/Integrations.tsx`) now:
1. Imports API configuration utilities
2. Uses dynamic URLs instead of hardcoded values
3. Displays environment-specific badges
4. Updates all API calls with correct URLs

## Testing

### Test Locally
1. Run `npm run dev`
2. Navigate to Integrations page
3. Check that URLs show `localhost:5173`
4. Verify blue "local development" badge appears

### Test in Production
1. Deploy your app
2. Navigate to Integrations page
3. Check that URLs show your deployed domain
4. Verify green "production" badge appears
5. Copy URLs - they should be production-ready

## No Changes Needed

You don't need to:
- ❌ Manually update URLs when deploying
- ❌ Change environment variables
- ❌ Modify configuration files
- ❌ Update API documentation

Everything updates automatically based on your current URL!

## For Developers

If you need to add new API endpoints or URLs:

1. Use the utility functions from `src/lib/api-config.ts`
2. Import `getApiConfig()` in your component
3. Use `apiConfig.functionsUrl` instead of hardcoded URLs
4. Use `appUrl` for application URL references

Example:
```typescript
import { getApiConfig, getAppUrl } from '../../lib/api-config';

function MyComponent() {
  const apiConfig = getApiConfig();
  const appUrl = getAppUrl();

  // Use apiConfig.functionsUrl for API calls
  // Use appUrl for app references
}
```

## Troubleshooting

### URLs showing wrong environment
- Clear browser cache
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Check browser console for any errors

### Need to force a specific URL
The system detects based on `window.location.origin`. If you need custom logic, modify `src/lib/api-config.ts`.

---

**Note**: This automatic detection works seamlessly across all deployment platforms (Netlify, Vercel, etc.) without any configuration changes needed!
