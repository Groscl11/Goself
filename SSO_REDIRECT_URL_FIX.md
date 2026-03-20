# SSO Redirect URL Fix - "Requested Path is Invalid" Error

## Problem
When merchants install the app for the first time and are redirected to Goself portal for SSO, they receive the error:
```json
{"error":"requested path is invalid"}
```

This error occurs at the magic link authentication stage in Supabase.

## Root Cause
The error happens because:
1. The Shopify OAuth callback generates a Supabase magic link with `redirectTo: https://goself.netlify.app/auth/shopify-callback`
2. Supabase validates that this redirect URL is whitelisted in the project's **URL Configuration**
3. If the URL is not whitelisted, Supabase returns **"requested path is invalid"**

## Solution

### Step 1: Configure Supabase Auth URL Whitelist

1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: `lizgppzyyljqbmzdytia`
3. Navigate to: **Authentication** → **URL Configuration**
4. In **Site URL**, enter your Goself domain:
   ```
   https://goself.netlify.app
   ```
   (Or your actual production domain if different)

5. In **Redirect URLs**, add these entries:
   ```
   https://goself.netlify.app/**
   https://goself.netlify.app/auth/shopify-callback
   https://goself.netlify.app/auth/shopify-callback?*
   http://localhost:5173/**
   ```

6. Click **Save**

### Step 2: Update Environment Variables

Verify the `DASHBOARD_URL` environment variable is set in your Supabase functions:

**Option A: Via Supabase Dashboard**
1. Go to: **Project Settings** → **Environment**
2. Add or update:
   ```
   DASHBOARD_URL=https://goself.netlify.app
   ```

**Option B: Via Local `.env.local` (for local testing)**
```env
SUPABASE_URL=https://lizgppzyyljqbmzdytia.supabase.co
SUPABASE_ANON_KEY=your_anon_key
DASHBOARD_URL=http://localhost:5173
```

### Step 3: Redeploy Edge Functions

After updating environment variables, redeploy the affected function:

```bash
npx supabase functions deploy shopify-oauth-callback --project-ref lizgppzyyljqbmzdytia
```

### Step 4: Test the Full Flow

1. Go to your Shopify store
2. Try installing the app using the OAuth link
3. After approving on Shopify, you should be redirected through the magic link
4. Magic link should now process correctly and redirect to `/auth/shopify-callback`
5. You should see the success message and be redirected to `/client` dashboard

## Verification Checklist

- [ ] Supabase Site URL configured to your domain
- [ ] Supabase Redirect URLs include your callback path
- [ ] `DASHBOARD_URL` environment variable is set in Supabase
- [ ] Edge function has been redeployed
- [ ] Browser cache cleared (Ctrl+Shift+Del)
- [ ] Cookie cleared (or use incognito/private mode)

## Common Issues

### Issue: Still getting "requested path is invalid"
**Solution:**
1. Clear browser cache and cookies
2. Try in incognito/private mode
3. Check Supabase Dashboard logs for more details
4. Verify the exact domain matches (http vs https, .com vs .app, etc.)

### Issue: Magic link redirects to wrong page
**Solution:**
1. Check `DASHBOARD_URL` environment variable is correct
2. Verify `/auth/shopify-callback` route exists in React app (it does)
3. Redeploy edge function with correct `DASHBOARD_URL`

### Issue: OAuth callback fails entirely
**Solution:**
1. Check Supabase Function logs for errors
2. Verify Shopify API credentials are set
3. Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` environment variables

## Files Affected

- **Edge Function**: `supabase/functions/shopify-oauth-callback/index.ts`
  - Uses `DASHBOARD_URL` for magic link generation
  - Lines: 285-290 (magic link generation)

- **React Component**: `src/pages/auth/ShopifyCallback.tsx`
  - Handles the post-magic-link redirect
  - No changes needed

- **Configuration**: Supabase Dashboard (URL Configuration)
  - Must whitelist the redirect URL

## Testing Without SSL Issues

For local development with `http://localhost:5173`:
1. Magic links will work fine locally
2. No SSL certificate issues
3. Browser will accept the redirect

For production deployment:
1. Domain must have valid SSL certificate
2. All URLs must use `https://`
3. Domain must match exactly

## Additional Resources

- [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/concepts/redirect-urls)
- [Supabase Magic Links](https://supabase.com/docs/guides/auth/auth-magic-link/auth-magic-link)
- Supabase Dashboard Auth Logs: Check for specific error messages
