# Shopify Installation URLs

## Your Shopify API Credentials

**Client ID:** `0341c8495ce44f2a98b3ac0d43fce5bc`
**Secret:** `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` (Keep secure!)

---

## Installation URL Template

To create an installation URL for any store, use this format:

```
https://[STORE-NAME].myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

Replace `[STORE-NAME]` with the actual store ID.

---

## Example Installation URLs

### houmetest Store

**URL:**
```
https://houmetest.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**Clickable Link:**
[Install on houmetest](https://houmetest.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback)

---

### Example Store: demo-store

**URL:**
```
https://demo-store.myshopify.com/admin/oauth/authorize?client_id=0341c8495ce44f2a98b3ac0d43fce5bc&scope=read_orders,write_customers,read_customers,write_discounts,read_price_rules,write_price_rules&redirect_uri=https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

---

## Quick Installation Methods

### Method 1: Use the Installation Page

1. Open `public/install.html` in your browser
2. Merchant enters their store name (e.g., "houmetest")
3. Click "Install Now"
4. Redirects to Shopify OAuth automatically

**The installation page is already configured with your API key!**

### Method 2: Send Direct Link

Simply replace `[STORE-NAME]` in the template above and send the URL to your client via:
- Email
- WhatsApp
- Slack
- Support ticket

### Method 3: QR Code

Generate a QR code for the installation URL and share it with merchants.

---

## Installation Flow

When a merchant clicks the installation URL:

1. **Redirects to Shopify** → Shows OAuth approval screen
2. **Merchant clicks "Install app"** → Shopify redirects to your callback
3. **Your callback processes** → Exchanges code for access token
4. **Store data saved** → Creates entry in `store_installations` table
5. **Webhooks registered** → Listens for orders, customers, etc.
6. **Widget activated** → Appears on merchant's store
7. **Merchant redirected** → To success page or dashboard

**Total time: 20-30 seconds**

---

## Testing the Installation

### Test with Development Store

1. **Create test store** in Shopify Partners
2. **Use installation URL** with test store name
3. **Verify installation:**
   - Check `store_installations` table in Supabase
   - Visit store and look for loyalty widget
   - Test customer registration and points

### Verify Installation Success

**Check Database:**
```sql
SELECT *
FROM store_installations
WHERE shop_domain = 'houmetest.myshopify.com';
```

**Expected Result:**
- Access token stored
- Installation timestamp recorded
- Store details captured

---

## Important URLs

**OAuth Callback:**
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
```

**Webhook Endpoint:**
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-webhook
```

**Widget Script:**
```
https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-render
```

---

## Scopes Explained

Your app requests these permissions:

- `read_orders` - View order data for points calculation
- `write_customers` - Update customer metadata with loyalty info
- `read_customers` - Access customer data for registration
- `write_discounts` - Create discount codes for rewards
- `read_price_rules` - View existing discount rules
- `write_price_rules` - Create price rules for loyalty discounts

---

## Troubleshooting

### Error: "Invalid client_id"

**Problem:** API key is incorrect or app not found

**Solution:**
- Verify API key: `0341c8495ce44f2a98b3ac0d43fce5bc`
- Check app exists in Shopify Partners dashboard

### Error: "redirect_uri mismatch"

**Problem:** Callback URL not whitelisted

**Solution:**
1. Go to Shopify Partners → Your App → Configuration
2. Add to "Allowed redirection URL(s)":
   ```
   https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/shopify-oauth-callback
   ```
3. Save and retry

### Installation Hangs

**Problem:** Callback not responding

**Solution:**
1. Check Supabase function logs
2. Verify `shopify-oauth-callback` is deployed
3. Test callback manually

---

## Security Notes

**Keep API Secret Secure:**
- Never expose in client-side code
- Store in Supabase Edge Function secrets
- Don't commit to git

**Verify HMAC:**
- Always verify HMAC signature in callback
- Prevents unauthorized access
- See `shopify-oauth-callback` function

**Store Access Tokens Safely:**
- Encrypted in database
- Access via server-side only
- Regular rotation recommended

---

## Next Steps

1. **Test installation** with houmetest store
2. **Verify widget appears** on storefront
3. **Create test customer** and check points tracking
4. **Share installation link** with other clients

Need help? Check `SHOPIFY_API_KEY_SETUP.md` for detailed setup instructions!
