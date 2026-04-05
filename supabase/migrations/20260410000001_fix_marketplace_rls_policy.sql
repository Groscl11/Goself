-- Fix marketplace offer visibility across clients.
--
-- Root cause: The "Clients can view marketplace and own rewards" RLS policy
-- uses `is_marketplace = true` to allow cross-client reads, but the
-- NewOfferDrawer insert never set is_marketplace=true — it only set
-- offer_type='marketplace_offer'. This caused houmetest's submitted offers
-- to be invisible to other clients (medibuddy etc.) at the DB level.
--
-- Fix:
--   1. Update the RLS SELECT policy to also allow offer_type='marketplace_offer'
--   2. Backfill existing marketplace offers to set is_marketplace=true
--   3. Fix NewOfferDrawer-created offers via offer_type backfill

-- Step 1: Replace the RLS SELECT policy
DROP POLICY IF EXISTS "Clients can view marketplace and own rewards" ON rewards;

CREATE POLICY "Clients can view marketplace and own rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (
    is_marketplace = true
    OR offer_type = 'marketplace_offer'
    OR client_id IN (
      SELECT client_id FROM profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- Step 2: Backfill existing marketplace offers so is_marketplace is consistent
UPDATE rewards
SET is_marketplace = true
WHERE offer_type = 'marketplace_offer'
  AND (is_marketplace IS NULL OR is_marketplace = false);
