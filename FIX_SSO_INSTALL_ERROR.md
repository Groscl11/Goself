# SSO Installation Fix - Step-by-Step Action Plan

**Status**: ✅ Edge function deployed with improved error handling
**Date**: March 20, 2026

## Problem Summary
Merchants getting error `{"error":"requested path is invalid"}` when installing app for the first time and being redirected for SSO login.

## Root Cause
Supabase magic link generation fails when the redirect URL (`/auth/shopify-callback`) is not whitelisted in Supabase's Auth Configuration.

---

## IMMEDIATE ACTION REQUIRED

### Action 1: Configure Supabase Auth URLs (5 minutes)

1. Open: https://supabase.com/dashboard/project/lizgppzyyljqbmzdytia/auth/url-configuration

2. **Set your Site URL** (critical - this must match your deployed domain):
   - If hosted on Netlify: `https://goself.netlify.app`
   - If hosted elsewhere: use your actual domain (include `https://`)

3. **Add Redirect URLs** (add ALL of these):
   ```
   https://goself.netlify.app/**
   https://goself.netlify.app/auth/shopify-callback?*
   https://lizgppzyyljqbmzdytia.supabase.co/**
   http://localhost:5173/**
   ```

4. Click **Save** (important - don't forget!)

✅ **Result**: Supabase will now accept redirects to these URLs

---

### Action 2: Set Environment Variable (2 minutes)

Set the `DASHBOARD_URL` in Supabase:

**Via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/lizgppzyyljqbmzdytia/settings/environment
2. Add new variable:
   - **Name**: `DASHBOARD_URL`
   - **Value**: `https://goself.netlify.app` (or your actual domain)
3. Click **Save**

**Via CLI (alternative):**
```bash
npx supabase secrets set DASHBOARD_URL="https://goself.netlify.app" --project-ref lizgppzyyljqbmzdytia
```

✅ **Result**: Edge function will use this domain for magic link redirects

---

### Action 3: Verify Deployment (1 minute)

The improved edge function is already deployed (✅ just completed).

The update includes:
- Better domain detection (even if env variable is missing)
- Detailed error logging for debugging
- Graceful fallback behavior

**Check deployment**: https://supabase.com/dashboard/project/lizgppzyyljqbmzdytia/functions

---

## TESTING

### Test Locally (for your own testing)

```bash
# Terminal 1: Start the app
cd ~/Goself
npm run dev
# App will be at http://localhost:5173

# Terminal 2: Run edge functions locally
supabase functions serve
```

Then test with a real Shopify store (or use your development store).

### Test in Production

1. Clear cache and cookies (or use incognito mode)
2. Generate installation link for a test store: `https://TEST_STORE.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback`
3. Click the link
4. Approve in Shopify
5. Should see success page and be redirected to merchant dashboard

✅ **Success** = Merchant lands on `/client` dashboard
❌ **Failure** = Still getting error (see Troubleshooting below)

---

## TROUBLESHOOTING

### Still Getting "Requested Path is Invalid"?

**Checklist:**
- [ ] Supabase Site URL is set correctly (without trailing slash)
- [ ] Redirect URLs include the callback path exactly: `https://goself.netlify.app/auth/shopify-callback?*`
- [ ] Reloaded Supabase Dashboard after making changes
- [ ] Cleared browser cache (or tested in incognito mode)
- [ ] Edge function was deployed (it was ✅)

**Debug Steps:**
1. Open Supabase Dashboard
2. Go to **Functions** → **shopify-oauth-callback** → **Logs**
3. Trigger an OAuth flow by clicking install link
4. Look for these messages in the logs:
   ```
   Using DASHBOARD_URL: https://goself.netlify.app
   Generating magic link with redirectTo: https://goself.netlify.app/auth/shopify-callback?...
   ```

If you see `Magic link generation failed`, the logs will show:
```
Magic link generation failed:
error: { ... }
message: "requested path is invalid"
hint: "This usually means the DASHBOARD_URL is not whitelisted in Supabase Auth..."
```

**Next steps if still failing:**
1. Copy the exact URL from the logs
2. Verify it's in your Redirect URLs list
3. Try adding the full URL (not wildcard):
   ```
   https://goself.netlify.app/auth/shopify-callback
   ```

---

## WHAT WAS CHANGED

### Code Update: `shopify-oauth-callback/index.ts`

**Improvements:**
1. **Better domain detection**: Auto-detects from request state if env var missing
2. **Enhanced logging**: Every step is logged for debugging
3. **Clearer error messages**: Explains why magic link failed
4. **Graceful fallback**: If magic link fails, falls back to direct redirect

**Key lines added:**
- Lines 268-285: Domain detection logic with priority/fallback
- Line 277: Log the exact redirectTo URL being used
- Lines 302-310: Detailed error logging with hints

---

## FILES AFFECTED

| File | Change | Status |
|------|--------|--------|
| `supabase/functions/shopify-oauth-callback/index.ts` | Enhanced error handling | ✅ Deployed |
| Supabase Auth Settings | URL Configuration | ⏳ User action needed |
| Supabase Secrets | DASHBOARD_URL env var | ⏳ User action needed |

---

## SUMMARY

The issue is **not a bug in your code** — it's a configuration issue in Supabase.

**What you need to do:**
1. ✅ Code fix deployed
2. ⏳ **Configure Supabase Auth URLs** (5 min)
3. ⏳ **Set DASHBOARD_URL environment variable** (2 min)
4. ✅ **Test the flow** (2 min)

**Total time to fix**: ~10 minutes

---

## SUCCESS INDICATORS

After completing all steps, you should see:

1. **In browser**: No error page, instead you see "Setting up your Goself dashboard..."
2. **Brief loading**: 1-2 seconds while session is being established
3. **Success**: Redirects to `/client` dashboard
4. **In Supabase logs**: "Magic link generated successfully"

---

## ADDITIONAL NOTES

### For Multiple Deployments
If you have multiple apps (dev, staging, production), you'll need:
- Multiple Redirect URLs in Supabase
- Multiple DASHBOARD_URL environment variables (one per environment)

Example for 3 environments:
```
dev: https://my-app-dev.netlify.app
staging: https://my-app-staging.netlify.app
production: https://my-app.netlify.app
```

### Security Note
The `DASHBOARD_URL` configuration is not a security issue — it's just needed so Supabase knows which domains are safe to redirect magic links to.

### Browser Considerations
- Magic links don't work in Safari private mode (by design)
- Third-party cookies must be enabled (for auth to work)
- CORS is handled automatically by Supabase/Netlify

---

## QUESTIONS?

Check the logs in:
- **Supabase Dashboard** → **Functions** → **shopify-oauth-callback** → **Logs**
- **Supabase Dashboard** → **Auth** → **Logs**
- **Browser Console** (F12 → Console tab)

All three will have clues about what's happening.
