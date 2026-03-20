# JWT Verification Issue - Fixed

## Problem Identified
Edge functions were deployed **with JWT verification enabled**, causing all public endpoints to return:
```json
{"code":401,"message":"Missing authorization header"}
```

This broke:
- ❌ Shopify OAuth callbacks (can't send JWT tokens)
- ❌ Shopify webhooks (external, unauthenticated)
- ❌ Public widget endpoints (must be accessible from storefronts)
- ❌ Campaign reward links (public sharing)
- ❌ GDPR data requests (Shopify requirement for public access)

## Root Cause
By default, Supabase edge functions require JWT authentication. However, many endpoints must be public:
1. **Shopify callbacks** - Shopify doesn't know about your JWT tokens
2. **Webhooks** - External systems calling your webhooks
3. **Public widgets** - Must work on customer storefronts
4. **Public links** - Campaign rewards shared via URL

## Solution Applied
Redeployed all public functions with `--no-verify-jwt` flag:

### Public Shopify Functions (Fixed ✅)
```bash
npx supabase functions deploy shopify-oauth-callback --no-verify-jwt
npx supabase functions deploy shopify-oauth-connect --no-verify-jwt
npx supabase functions deploy shopify-webhook --no-verify-jwt
npx supabase functions deploy shopify-app --no-verify-jwt
npx supabase functions deploy shopify-gdpr --no-verify-jwt
```

### Public Widget & API Functions (Fixed ✅)
```bash
npx supabase functions deploy widget-render --no-verify-jwt
npx supabase functions deploy widget-script --no-verify-jwt
npx supabase functions deploy widget-rewards-portal --no-verify-jwt
npx supabase functions deploy get-widget-config --no-verify-jwt
npx supabase functions deploy track-widget-event --no-verify-jwt
npx supabase functions deploy get-campaign-reward-link --no-verify-jwt
```

## What Changed
**Before:**
```typescript
// Functions deployed with JWT verification
// Result: 401 errors for all public requests
```

**After:**
```typescript
// Functions deployed with --no-verify-jwt
// Result: Public endpoints accept requests; internal endpoints still secure
```

## Testing
The OAuth callback should now work:
1. Click Shopify install link
2. Approve in Shopify
3. Redirected to `/auth/shopify-callback` ✅

## Why This Works
- **JWT verification ON**: Every request must have a valid Supabase JWT token
- **JWT verification OFF**: Requests don't need auth (but the code can still verify if needed)
- **Security**: The code handles its own authorization checks where needed

## Functions Still Deployed (Secure)
These keep JWT verification because they require authentication:
- `redeem-reward`
- `redeem-loyalty-points`
- `validate-campaign-token`
- `redeem-campaign-rewards`
- `register-loyalty-member`
- And other internal/protected endpoints

## Prevention
In the future, when deploying functions:
- Use `--no-verify-jwt` for any public/webhook endpoints
- Use default JWT verification for protected endpoints
- Always test public endpoints from external sources (Shopify API, browsers, etc.)

## Deployment Date
March 20, 2026 - Critical fix for OAuth flow
