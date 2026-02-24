# Fix: Missing Authorization Header Error

## Current Issue

Getting `{"code":401,"message":"Missing authorization header"}` when accessing:
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-app
```

## Root Cause

Supabase edge functions have JWT verification enabled by default. Even though we deployed with `verify_jwt: false`, it may need time to propagate or there may be project-level settings blocking it.

## Solution 1: Wait for Deployment (Try This First)

1. Wait 2-3 minutes for deployment to fully propagate
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try accessing the app again from Shopify admin
4. If still fails, try in incognito/private window

## Solution 2: Check Supabase Project Settings

Go to: https://supabase.com/dashboard → Your Project → Settings

### Check API Settings

1. Go to **Settings** → **API**
2. Look for **JWT Settings** or **Authentication** settings
3. Make sure edge functions can be accessed without auth

### Check Edge Function Settings

1. Go to **Edge Functions**
2. Click on `shopify-app` function
3. Check if there's a toggle for "Require authentication"
4. Make sure it's **OFF** or set to **Allow anonymous access**

## Solution 3: Use Shopify App Proxy (Recommended Alternative)

If the edge function auth can't be disabled, we can use Shopify's app proxy instead:

### Set Up App Proxy in Shopify Partners

1. Go to: https://partners.shopify.com → Apps → Loyalty Bolt 2.0
2. Go to **App setup** section
3. Find **App proxy** settings
4. Set:
   - **Subpath prefix:** `apps`
   - **Subpath:** `loyalty`
   - **Proxy URL:** `https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-app`

5. Click **Save**

### Update App URL to Use Proxy

Change App URL from:
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-app
```

To:
```
https://houmetest.myshopify.com/apps/loyalty
```

This routes through Shopify's proxy, which bypasses the auth requirement.

## Solution 4: Use Vercel/Netlify Instead (Last Resort)

If Supabase edge functions continue to have auth issues, we can deploy a simple server on Vercel or Netlify that serves the HTML without auth requirements.

## Testing the Fix

After implementing any solution, test by:

1. Go to: https://houmetest.myshopify.com/admin/apps
2. Click on "Loyalty Bolt 2.0"
3. Should see the success page with instructions
4. No auth errors

## Current Status

- ✅ Edge function deployed with verify_jwt: false
- ✅ OAuth callback working correctly
- ✅ App URL updated in local config
- ⏳ Waiting for deployment to propagate (2-3 minutes)
- ❓ May need to check Supabase project settings

## What to Do Right Now

**Option A: Wait and retry (easiest)**
1. Wait 3 minutes
2. Clear browser cache
3. Try opening app from Shopify admin again

**Option B: Check Supabase settings**
1. Go to Supabase dashboard
2. Check Edge Functions settings for shopify-app
3. Ensure "Require authentication" is disabled

**Option C: Use app proxy (most reliable)**
1. Set up app proxy in Shopify Partners (see Solution 3)
2. Update App URL to use proxy URL
3. Reinstall app

## Need Help?

If none of these work, the issue is likely:
1. Supabase project-level auth enforcement
2. Edge function deployment caching
3. Supabase plan limits on public edge functions

Let me know which solution you'd like to try!
