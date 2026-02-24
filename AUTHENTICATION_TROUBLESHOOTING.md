# Authentication Troubleshooting Guide

If you're experiencing authentication issues on your deployed site, follow these steps:

## 1. Configure Site URL in Supabase

Your deployed URL needs to be whitelisted in Supabase.

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Add your deployed URL to **Site URL** (e.g., `https://your-app.netlify.app`)
5. Add your deployed URL to **Redirect URLs** list:
   - `https://your-app.netlify.app/**`
   - `https://your-app.netlify.app/dashboard`
   - `https://your-app.netlify.app/login`
6. Click **Save**

## 2. Disable Email Confirmation (Recommended for Testing)

By default, Supabase requires email confirmation which can cause signup issues.

1. Go to **Authentication** → **Providers** → **Email**
2. Find **"Confirm email"** section
3. **Disable** the "Confirm email" toggle
4. Click **Save**

This allows users to sign up and log in immediately without email verification.

## 3. Check CORS Configuration

1. Go to **Settings** → **API**
2. Scroll to **CORS Configuration**
3. Add your deployed domain to the allowed origins
4. Click **Save**

## 4. Verify Environment Variables

Make sure your deployed site has the correct environment variables:

```
VITE_SUPABASE_URL=https://lizgppzyyljqbmzdytia.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

For Netlify:
1. Go to **Site settings** → **Environment variables**
2. Add both variables
3. Redeploy your site

## 5. Common Error Messages

### "Email not confirmed"
- Email confirmation is enabled in Supabase
- Solution: Disable email confirmation (see step 2) or check email for confirmation link

### "Invalid login credentials"
- Wrong email/password
- User doesn't exist
- Solution: Try signing up first

### "Network error" or "Failed to fetch"
- CORS issue
- Site URL not configured
- Solution: Follow steps 1 and 3

### "User already registered"
- User exists but email wasn't confirmed
- Solution: Disable email confirmation, then user can log in directly

## 6. Testing Authentication

After configuration:

1. Clear browser cache and cookies
2. Try signing up with a new email
3. If successful, you should be automatically logged in
4. Try logging out and logging back in

## 7. Database RLS Policies

Make sure your database has proper Row Level Security policies. Check that:

1. `profiles` table allows INSERT for new users
2. Users can SELECT their own profile
3. The profile creation trigger is working

To test:
```sql
-- Check if user profile was created
SELECT * FROM profiles WHERE email = 'your-test-email@example.com';
```

## 8. Browser Console Check

Open browser developer tools (F12) and check for errors:

1. Go to **Console** tab
2. Try to sign up/login
3. Look for any red error messages
4. Common errors to look for:
   - CORS errors
   - 401 Unauthorized
   - Network errors

## Need More Help?

If issues persist:

1. Check Supabase logs: **Logs** → **Auth Logs**
2. Verify your API keys are correct
3. Ensure your deployment built successfully
4. Try accessing the site in incognito mode

## Quick Fix Checklist

- [ ] Site URL configured in Supabase
- [ ] Redirect URLs added
- [ ] Email confirmation disabled (for testing)
- [ ] CORS configured
- [ ] Environment variables set in deployment
- [ ] Site redeployed after changes
- [ ] Browser cache cleared
