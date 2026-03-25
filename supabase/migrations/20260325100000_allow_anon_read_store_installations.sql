-- Fix: Allow unauthenticated (anon) clients to read store_installations by shop_domain.
-- Required because ShopifyLanding runs AFTER signing out the user session —
-- with no auth session, the anon role is used, and without this policy the
-- table returns [] regardless of whether a record exists, causing an infinite
-- re-OAuth loop and Shopify's "misconfigured" error.
CREATE POLICY "Anon can lookup store installation by shop domain"
  ON store_installations FOR SELECT
  TO anon
  USING (true);
