-- Add missing FK from rewards.owner_client_id → clients(id)
-- Required for PostgREST to resolve the owner_client join in AdminMarketplaceApprovals.
-- Without this FK, the embedded select owner_client:clients!owner_client_id(...)
-- silently returns null, making the admin approval queue appear empty.
ALTER TABLE rewards
  ADD CONSTRAINT rewards_owner_client_id_fkey
  FOREIGN KEY (owner_client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- Add FK from rewards.brand_id → brands(id) if missing (same pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rewards_brand_id_fkey' AND table_name = 'rewards'
  ) THEN
    ALTER TABLE rewards
      ADD CONSTRAINT rewards_brand_id_fkey
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;
  END IF;
END $$;
