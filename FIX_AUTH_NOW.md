# FIX AUTHENTICATION - DO THIS NOW

Your authentication isn't working because Supabase needs to be configured for your deployed domain.

## Quick Fix (5 minutes)

### 1. Add Your Site URL to Supabase

Open this link in a new tab:
**https://supabase.com/dashboard/project/lizgppzyyljqbmzdytia/auth/url-configuration**

Then:
- Copy your deployed site URL (e.g., `https://your-app.netlify.app`)
- Paste it in the **"Site URL"** field
- Add it to **"Redirect URLs"** as: `https://your-app.netlify.app/**`
- Click **Save**

### 2. Disable Email Confirmation

Open this link:
**https://supabase.com/dashboard/project/lizgppzyyljqbmzdytia/auth/providers**

Then:
- Click on **Email** provider
- Find the **"Confirm email"** toggle
- **Turn it OFF**
- Click **Save**

### 3. Redeploy Your Site

After making the above changes:
- Go to your deployment platform (Netlify/Vercel)
- Click **"Trigger Deploy"** or **"Redeploy"**
- Wait for deployment to complete

### 4. Test It

- Clear browser cache
- Go to your site
- Click "Sign Up"
- Create an account
- You should be logged in immediately!

## That's It!

Authentication should now work perfectly on your deployed site.

---

## What This Does

- **Site URL**: Tells Supabase which domain is allowed to use authentication
- **Disable Email Confirmation**: Allows users to sign up and log in immediately without verifying email
- **Redeploy**: Ensures the latest code is running with proper configuration

## If It Still Doesn't Work

Check these:

1. **Environment variables** in your deployment platform:
   - `VITE_SUPABASE_URL` = `https://lizgppzyyljqbmzdytia.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your anon key

2. **Browser console** (F12) - look for error messages

3. **Supabase logs** - Check Auth Logs in Supabase Dashboard

---

**Need more help?** Check `AUTHENTICATION_TROUBLESHOOTING.md` for detailed debugging steps.
