-- Auto-provision Growth subscriptions for clients with active store installations but no subscription
INSERT INTO client_subscriptions (client_id, plan_id, status, billing_cycle, amount_inr, payment_method, notes)
SELECT
  si.client_id,
  'growth',
  'active',
  'monthly',
  4999,
  'manual',
  'Auto-provisioned: active Shopify store installation detected'
FROM store_installations si
LEFT JOIN client_subscriptions cs ON cs.client_id = si.client_id
WHERE si.installation_status = 'active'
  AND cs.client_id IS NULL
ON CONFLICT (client_id) DO NOTHING;
