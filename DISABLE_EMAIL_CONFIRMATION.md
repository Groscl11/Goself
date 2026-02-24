# Disable Email Confirmation for Testing

By default, Supabase requires users to confirm their email before logging in. For development/testing purposes, you can disable this.

## Steps to Disable Email Confirmation:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Find the section **"Confirm email"**
4. **Disable** the "Confirm email" toggle
5. Click **Save**

## What This Does:

- Users will be automatically logged in after signup
- No email confirmation required
- Perfect for development and testing
- You can re-enable it for production

## Alternative: Test with Email Confirmation

If you want to keep email confirmation enabled, users will see a message:
"Please check your email to confirm your account"

They would need to:
1. Check their email inbox
2. Click the confirmation link
3. Then login with their credentials

For testing purposes, disabling email confirmation is recommended.
