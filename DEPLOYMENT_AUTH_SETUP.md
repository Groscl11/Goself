# Quick Deployment Authentication Setup

Follow these 3 critical steps to fix authentication on your deployed site:

## Step 1: Configure Supabase Site URL (REQUIRED)

1. Go to: https://supabase.com/dashboard
2. Select your project: `lizgppzyyljqbmzdytia`
3. Navigate to: **Authentication** → **URL Configuration**
4. Set **Site URL** to your deployed domain (e.g., `https://your-app.netlify.app`)
5. Add to **Redirect URLs**:
   ```
   https://your-app.netlify.app/**
   https://your-app.netlify.app/dashboard
   https://your-app.netlify.app/login
   http://localhost:5173/**
   ```
6. Click **Save**

## Step 2: Disable Email Confirmation (REQUIRED)

1. In Supabase Dashboard, go to: **Authentication** → **Providers**
2. Click on **Email** provider
3. Find **"Confirm email"** toggle
4. **Turn it OFF** (disable)
5. Click **Save**

> This allows users to sign up and log in immediately without email verification.

## Step 3: Verify Environment Variables

Make sure your deployment platform (Netlify/Vercel) has these variables:

```env
VITE_SUPABASE_URL=https://lizgppzyyljqbmzdytia.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0
```

### For Netlify:
1. Go to: **Site Settings** → **Environment Variables**
2. Add both variables above
3. Click **Save**
4. **Redeploy** your site

### For Vercel:
1. Go to: **Settings** → **Environment Variables**
2. Add both variables above
3. Click **Save**
4. **Redeploy** your site

## Step 4: Deploy & Test

1. Redeploy your site after making Supabase changes
2. Clear browser cache (Ctrl+Shift+Delete / Cmd+Shift+Delete)
3. Try signing up with a new email
4. You should be logged in immediately

## Common Issues & Solutions

### "Invalid login credentials"
- **Cause**: User doesn't exist or wrong password
- **Solution**: Make sure you've signed up first

### "Email not confirmed"
- **Cause**: Email confirmation is still enabled
- **Solution**: Follow Step 2 above to disable it

### "Network error" or blank page
- **Cause**: Site URL not configured
- **Solution**: Follow Step 1 above

### "User already registered"
- **Cause**: You tried to sign up with an existing email
- **Solution**: Use the login page instead

## Test Authentication Flow

After completing all steps:

1. Go to your deployed URL
2. Click "Sign Up"
3. Enter: name, email, password
4. Click "Sign Up" button
5. You should be automatically logged in and redirected to dashboard

If it works, authentication is now properly configured!

## Still Having Issues?

1. Check browser console (F12) for error messages
2. Check Supabase Auth Logs: **Dashboard** → **Logs** → **Auth Logs**
3. Make sure site was redeployed after configuration changes
4. Try in incognito/private browsing mode

## Need to Re-enable Email Confirmation Later?

When you're ready for production:

1. Go to **Authentication** → **Providers** → **Email**
2. Enable "Confirm email"
3. Configure email templates
4. Users will need to verify emails before accessing accounts

---

**Important**: These steps are mandatory for authentication to work on your deployed site!
