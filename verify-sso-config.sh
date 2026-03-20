#!/bin/bash
# SSO Configuration Verification Script

echo "=== Checking SSO Configuration ==="
echo ""

# Get DASHBOARD_URL from Supabase
echo "1. Current DASHBOARD_URL (from Supabase secrets):"
npx supabase secrets get DASHBOARD_URL --project-ref lizgppzyyljqbmzdytia

echo ""
echo "2. Expected value should match your deployed domain"
echo "   Examples:"
echo "   - https://goself.netlify.app"
echo "   - https://your-app.vercel.app"
echo "   - https://yourdomain.com"

echo ""
echo "3. To verify what it's set to:"
echo "   npx supabase secrets get DASHBOARD_URL --project-ref lizgppzyyljqbmzdytia"

echo ""
echo "4. To update if incorrect:"
echo "   npx supabase secrets set DASHBOARD_URL='https://your-actual-domain.app' --project-ref lizgppzyyljqbmzdytia"

echo ""
echo "5. After updating, redeploy the function:"
echo "   npx supabase functions deploy shopify-oauth-callback --project-ref lizgppzyyljqbmzdytia"
