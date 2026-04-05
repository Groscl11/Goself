-- Fix offers that were submitted to marketplace via the "Submit an Offer" button
-- but were incorrectly created with offer_type='store_discount' instead of 'marketplace_offer'.
-- These are identifiable by having 'marketplace' in their title (from the user naming them
-- "Marketplace Offer Submission") while still having offer_type='store_discount'.

UPDATE rewards
SET 
  offer_type = 'marketplace_offer',
  is_marketplace_listed = true
WHERE 
  offer_type = 'store_discount'
  AND LOWER(title) LIKE '%marketplace%'
  AND owner_client_id IS NOT NULL;
