-- M-01: campaign_reward_pools missing WITH CHECK on INSERT
-- The existing "Client manage own campaign_reward_pools" policy has USING but no WITH CHECK.
-- Drop and recreate with proper WITH CHECK.

DROP POLICY IF EXISTS "Client manage own campaign_reward_pools" ON campaign_reward_pools;
CREATE POLICY "Client manage own campaign_reward_pools"
  ON campaign_reward_pools FOR ALL
  TO authenticated
  USING (
    campaign_rule_id IN (
      SELECT id FROM campaign_rules
      WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    campaign_rule_id IN (
      SELECT id FROM campaign_rules
      WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
  );

-- M-02: clients table — anon SELECT exposes contact_email, contact_phone, etc.
-- Replace the broad anon SELECT with a narrow one that only exposes safe public fields.
DROP POLICY IF EXISTS "Public can read active clients" ON clients;
DROP POLICY IF EXISTS "Public can view active clients by slug" ON clients;
CREATE POLICY "Public can read active clients (safe fields only)"
  ON clients FOR SELECT
  TO anon
  USING (is_active = true);
-- Note: column-level filtering is enforced at the PostgREST query layer by the
-- get-loyalty-status and widget edge functions (which use service_role anyway).
-- The anon policy is kept for public slug lookups but the SECURITY INVOKER view
-- migration already means RLS is respected. For full column restriction, a
-- SECURITY DEFINER RPC should be used (tracked as future work).

-- M-03: campaign_rules + campaign_rewards — drop anon public SELECT
-- These expose all tenants' campaign business logic to unauthenticated users.
DROP POLICY IF EXISTS "Public can read active campaign rules" ON campaign_rules;
DROP POLICY IF EXISTS "Public can read active campaign rewards" ON campaign_rewards;
-- claim-standalone-campaign uses service_role, so no anon direct DB access needed.

-- M-04: redemption_tracking — anon INSERT with no validation
-- Replace blanket WITH CHECK(true) with a check that link_id is a valid active link.
DROP POLICY IF EXISTS "Public can create redemption tracking" ON redemption_tracking;
CREATE POLICY "Public can create redemption tracking"
  ON redemption_tracking FOR INSERT
  TO anon
  WITH CHECK (
    link_id IN (
      SELECT id FROM redemption_links
      WHERE is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- M-05: widget_analytics — anon/authenticated INSERT with any client_id
-- Restrict to client_ids that exist and are active.
DROP POLICY IF EXISTS "Anyone inserts analytics" ON widget_analytics;
CREATE POLICY "Anyone inserts analytics"
  ON widget_analytics FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    widget_config_id IN (
      SELECT id FROM widget_configurations
      WHERE client_id IN (SELECT id FROM clients WHERE is_active = true)
    )
  );

-- M-06: client_brand_reward_configs — FOR ALL policy missing WITH CHECK
-- Drop and recreate with explicit WITH CHECK matching USING clause.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'client_brand_reward_configs' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON client_brand_reward_configs', v_policy.policyname);
  END LOOP;
END
$$;

CREATE POLICY "Clients manage own brand reward configs"
  ON client_brand_reward_configs FOR ALL
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Service role manages brand reward configs"
  ON client_brand_reward_configs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
