# API Endpoint Auto-Update - Quick Guide

All API endpoints in the Integrations page now automatically update based on your deployment URL!

## What Changed

### Before
URLs were hardcoded using environment variables:
```typescript
// ❌ Old way - hardcoded
const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/...`
const appUrl = window.location.origin
```

### After
URLs are dynamically detected:
```typescript
// ✅ New way - automatic
import { getApiConfig, getAppUrl } from '../../lib/api-config';

const apiConfig = getApiConfig();
const appUrl = getAppUrl();
```

## Where It Works

### 1. Shopify App Configuration
- **App URL** → Automatically shows current domain
- **OAuth Redirect URL** → Always correct Supabase function URL
- Shows green checkmark in production mode

### 2. API Documentation
- **All endpoint examples** → Update based on environment
- **Request code samples** → Ready to copy-paste
- **Authentication examples** → Correct anon key included

### 3. Integration Features
- **OAuth connections** → Use correct URLs
- **Webhook registration** → Proper callback URLs
- **API calls** → Correct base URLs

## Environment Indicators

### Local Development
```
🔵 Local development mode
   Endpoints will update automatically when deployed
```

### Production
```
✅ Using production URL (auto-detected)
   Showing production endpoints for: https://your-app.com
```

## How to Use

### For Testing Locally
1. Run `npm run dev`
2. Open Integrations page
3. All URLs will show `localhost:5173`
4. Use these URLs for local testing

### For Production
1. Deploy your app
2. Open Integrations page
3. All URLs will show your deployed domain
4. Copy these URLs for Shopify configuration

## Copy-Paste Ready

All URLs can be copied directly:
- Click the "Copy" button next to each URL
- URLs are already formatted correctly for your environment
- No manual editing needed

## Key Features

✅ **Auto-Detection**: Knows if you're local or production
✅ **Zero Configuration**: Works out of the box
✅ **Visual Feedback**: Clear badges show current mode
✅ **Copy-Friendly**: One-click copy for all URLs
✅ **API Documentation**: All examples update automatically
✅ **Error Prevention**: No wrong URLs in production

## Technical Details

### New Utility File
`src/lib/api-config.ts` - Handles all environment detection

### Updated Components
- `src/pages/client/Integrations.tsx` - Uses dynamic URLs
- `src/components/ApiDocumentation.tsx` - Receives correct URLs

### Detection Logic
```typescript
const isLocal = currentUrl.includes('localhost') ||
                currentUrl.includes('127.0.0.1') ||
                currentUrl.includes('local.');
```

## Benefits for Deployment

1. **Deploy Once**: URLs update automatically
2. **No Env Changes**: Same environment variables work everywhere
3. **Platform Agnostic**: Works on Netlify, Vercel, etc.
4. **Documentation Sync**: API docs always match your deployment

## Example: What You'll See

### Localhost (Development)
```
App URL: http://localhost:5173
API Base: https://lizgppzyyljqbmzdytia.supabase.co
Environment: Local
Status: 🔵 Development Mode
```

### Netlify (Production)
```
App URL: https://my-app.netlify.app
API Base: https://lizgppzyyljqbmzdytia.supabase.co
Environment: Production
Status: ✅ Production Mode
```

## No Action Required

This feature works automatically! You don't need to:
- Change any configuration
- Update environment variables
- Modify any code
- Set deployment flags

Just deploy and it works!

---

**Questions?** Check `AUTOMATIC_ENDPOINT_DETECTION.md` for detailed technical information.
