#!/bin/bash

# Order Status Rewards - Quick Installation Script
# This script automates the deployment of the Order Status Rewards system

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Order Status Rewards Widget - Quick Installation          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Deploy Edge Functions
echo -e "${BLUE}Step 1/4: Deploying Edge Functions...${NC}"
echo "  → Deploying get-order-rewards..."
supabase functions deploy get-order-rewards

echo "  → Deploying process-reward-redemption..."
supabase functions deploy process-reward-redemption

echo -e "${GREEN}✓ Edge functions deployed successfully${NC}"
echo ""

# Step 2: Install Extension Dependencies
echo -e "${BLUE}Step 2/4: Installing Extension Dependencies...${NC}"
cd extensions/order-status-rewards
npm install
cd ../..
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Build the project
echo -e "${BLUE}Step 3/4: Building Project...${NC}"
npm run build
echo -e "${GREEN}✓ Project built successfully${NC}"
echo ""

# Step 4: Instructions for Shopify Deployment
echo -e "${BLUE}Step 4/4: Shopify Extension Deployment${NC}"
echo ""
echo -e "${YELLOW}Manual steps required:${NC}"
echo ""
echo "1. Deploy to Shopify (run one of these commands):"
echo "   → npm run deploy"
echo "   → shopify app deploy"
echo ""
echo "2. Configure in Shopify Admin:"
echo "   → Go to: Settings > Checkout > Checkout customization"
echo "   → Find: Order status page"
echo "   → Add: 'Order Status Rewards' extension"
echo "   → Position: After order summary (recommended)"
echo "   → Click: Save"
echo ""
echo "3. Test the flow:"
echo "   → Place a test order (> threshold amount)"
echo "   → Check Order Status page for rewards banner"
echo "   → Click 'View My Rewards' button"
echo "   → Complete redemption flow"
echo ""

# Verification
echo -e "${BLUE}Verification Commands:${NC}"
echo ""
echo "Check deployed functions:"
echo "  → supabase functions list"
echo ""
echo "Check Shopify extensions:"
echo "  → shopify app extensions list"
echo ""
echo "Test edge function:"
echo "  → curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/get-order-rewards \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "    -d '{\"order_id\":\"YOUR_ORDER_ID\",\"shop_domain\":\"your-shop.myshopify.com\"}'"
echo ""

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Installation Complete! Follow manual steps above.          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "📖 For detailed documentation, see: ORDER_STATUS_REWARDS_GUIDE.md"
echo ""
