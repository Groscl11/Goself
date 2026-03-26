-- Reset stale installations that were never properly uninstalled
-- (webhook handler was missing before, so installation_status stayed 'active' after uninstall)
-- This allows merchants to reinstall cleanly through the full OAuth flow.
UPDATE store_installations
SET installation_status = 'uninstalled'
WHERE shop_domain IN ('medibuddy-6559.myshopify.com')
  AND installation_status = 'active';
