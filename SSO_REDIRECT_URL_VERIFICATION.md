# SSH Redirect URL Verification Checklist

## Quick Diagnostic

Run these checks in order to identify where the issue is happening:

### 1. Check Supabase Dashboard Configuration

```url
https://supabase.com/dashboard/project/lizgppzyyljqbmzdytia/auth/url-configuration
```

**Required Values:**
- [ ] **Site URL**: Should be your production domain (e.g., `https://goself.netlify.app`)
- [ ] **Redirect URLs**: Should contain:
  - `https://goself.netlify.app/auth/shopify-callback`
  - `https://goself.netlify.app/**`

### 2. Check Environment Variables

Run this command to verify edge function environment variables:

```bash
# List all environment variables in your Supabase project
npx supabase secrets list --project-ref lizgppzyyljqbmzdytia
```

**Should include:**
- `DASHBOARD_URL` = `https://goself.netlify.app`
- `SHOPIFY_API_KEY` = Your Shopify key
- `SHOPIFY_API_SECRET` = Your Shopify secret

If `DASHBOARD_URL` is missing or empty, add it:

```bash
npx supabase secrets set DASHBOARD_URL="https://goself.netlify.app" --project-ref lizgppzyyljqbmzdytia
```

### 3. Check Edge Function Deployment

Verify the function was deployed with correct variables:

```bash
# Redeploy with variables
npx supabase functions deploy shopify-oauth-callback \
  --project-ref lizgppzyyljqbmzdytia \
  --no-verify-jwt
```

### 4. Test Magic Link Generation

Add temporary debugging to `shopify-oauth-callback/index.ts` to see the magic link URL:

```typescript
// Around line 285-290, add:
const magicLinkUrl = `${DASHBOARD_URL}/auth/shopify-callback?shop=${shop}&client_id=${clientId}`;
console.log('Magic link redirectTo URL:', magicLinkUrl);

const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: shopDetails.email,
  options: {
    redirectTo: magicLinkUrl,  // <- This is what gets validated by Supabase
  }
});
```

Then check the Supabase Function logs to verify the URL is correct.

### 5. Browser Network Inspection

When testing:
1. Open **Developer Tools** (F12)
2. Go to **Network** tab
3. Try the OAuth flow
4. Look for requests to `supabase.co/auth/...`
5. Check the response for the magic link
6. Verify the `redirectTo` parameter in the magic link is correct

## Error Messages Explained

| Error | Cause | Fix |
|-------|-------|-----|
| `{"error":"requested path is invalid"}` | Redirect URL not whitelisted in Supabase | Add URL to Redirect URLs in Supabase Dashboard |
| `{"error":"invalid_grant"}` | Magic link invalid or expired | Ensure email is correct, try again |
| `{"error":"invalid_request"}` | Missing parameters | Check magic link generation code |
| Blank page after magic link | Supabase session not loading | Check browser cache, try incognito mode |

## Automatic Domain Detection (Recommended Fix)

Instead of hardcoding `DASHBOARD_URL`, we can auto-detect it from the request referer:

**Current Code (shopify-oauth-callback/index.ts line 285):**
```typescript
const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') || 'https://goself.netlify.app';
```

**Better Approach:**
```typescript
// Try to get from environment first
let DASHBOARD_URL = Deno.env.get('DASHBOARD_URL');

// If not set, try to detect from request referer
if (!DASHBOARD_URL && stateData.app_url) {
  DASHBOARD_URL = stateData.app_url;
}

// Final fallback
if (!DASHBOARD_URL) {
  DASHBOARD_URL = 'https://goself.netlify.app'; // Production default
}

console.log(`Using DASHBOARD_URL: ${DASHBOARD_URL}`);
```

This ensures that:
1. Environment variable takes precedence (for consistency)
2. Request referer is used if not set (handles multiple deployments)
3. Safe fallback to production domain

## Manual Testing

### Local Development
```bash
# Terminal 1: Start React dev server
npm run dev
# Should be at http://localhost:5173

# Terminal 2: Run Supabase edge function locally
supabase functions serve shopify-oauth-callback
```

Then test with:
```url
http://localhost:54321/functions/v1/shopify-oauth-callback?code=test&shop=houmetest.myshopify.com
```

### Production Deployment
1. Deploy to Netlify/your host
2. Set `DASHBOARD_URL` environment variable
3. Redeploy edge functions
4. Test real OAuth flow with Shopify

## Next Steps

1. **Immediate**: Add redirect URL in Supabase Dashboard
2. **Important**: Set `DASHBOARD_URL` environment variable
3. **Critical**: Redeploy `shopify-oauth-callback` function
4. **Verify**: Test OAuth flow again

## Support

If still experiencing issues:
1. Check Supabase Dashboard Logs: **Logs** → **Auth Logs**
2. Check Edge Function Logs: **Functions** → **shopify-oauth-callback** → **Logs**
3. Check browser console for errors (F12 → Console)
4. Share the logs when seeking help
