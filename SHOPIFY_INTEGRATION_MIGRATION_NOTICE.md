# Shopify Integration Migration Notice

## For Developers

The Shopify integration has been **completely refactored** to use OAuth 2.0 instead of manual API key entry.

### What This Means

**OLD SYSTEM (Deprecated):**
- Manual Custom App creation
- API Key/Secret/Token copy-paste
- Manual webhook configuration
- Multi-step error-prone process

**NEW SYSTEM (Current):**
- One-click OAuth connection
- Automatic webhook registration
- Zero manual setup
- Shopify 2024-2025 compliant

### Action Required

If you have merchants using the **old manual setup**, they should:

1. Go to Integrations page
2. Disconnect current integration
3. Click "Connect Shopify Store"
4. Approve OAuth permissions
5. Done!

### Developer Setup

See `SHOPIFY_OAUTH_QUICK_START.md` for 5-minute setup guide.

**Required Environment Variables:**
```bash
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
APP_URL=https://your-domain.com
```

### Files Changed

- ✅ Database migration applied
- ✅ New OAuth endpoints created
- ✅ Webhook handler updated
- ✅ UI completely refactored
- ✅ Old ShopifySetupGuide removed

### Backward Compatibility

- Existing integrations continue to work
- Old credentials preserved in database
- Gradual migration supported
- No breaking changes to order processing logic

### Testing

After deploying edge functions:
1. Test OAuth flow
2. Verify webhook registration
3. Create test order
4. Check webhook delivery

### Support

- Quick start: `SHOPIFY_OAUTH_QUICK_START.md`
- Full docs: `SHOPIFY_OAUTH_REFACTOR.md`
- Troubleshooting: See quick start guide

---

## For Merchants

### Your Shopify Integration Just Got Better!

We've upgraded how you connect your Shopify store.

**What's New:**
- ✅ Connect in 30 seconds (vs 5+ minutes before)
- ✅ No API keys to copy-paste
- ✅ Automatic setup
- ✅ More secure
- ✅ Real-time syncing

**How to Upgrade:**

If you're currently connected:
1. Go to **Integrations** page
2. Click **"Disconnect Shopify"**
3. Click **"Connect Shopify Store"**
4. Enter your shop domain
5. Approve permissions
6. Done!

**What if I don't upgrade?**
- Your current integration continues to work
- You miss out on easier setup and better reliability
- Future updates will require OAuth

**Need Help?**
Contact support or watch our setup video.

---

**Migration Timeline:**
- Phase 1 (Now): OAuth available, old method still works
- Phase 2 (TBD): Notify merchants to upgrade
- Phase 3 (TBD): Deprecate old method

**Questions?**
- See `SHOPIFY_OAUTH_QUICK_START.md`
- Contact: support@yourplatform.com
