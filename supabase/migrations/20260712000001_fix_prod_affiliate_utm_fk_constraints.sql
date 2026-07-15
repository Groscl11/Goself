-- Fix: prod affiliate/utm tables were created without FK constraints.
-- Adds constraints idempotently so applying to staging (which already has them) is safe.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'affiliate_code_assignments_partner_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE affiliate_code_assignments
      ADD CONSTRAINT affiliate_code_assignments_partner_id_fkey
        FOREIGN KEY (partner_id) REFERENCES affiliate_partners(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'affiliate_code_assignments_client_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE affiliate_code_assignments
      ADD CONSTRAINT affiliate_code_assignments_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'affiliate_code_assignments_reward_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE affiliate_code_assignments
      ADD CONSTRAINT affiliate_code_assignments_reward_id_fkey
        FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attribution_utm_links_client_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE attribution_utm_links
      ADD CONSTRAINT attribution_utm_links_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attribution_utm_links_partner_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE attribution_utm_links
      ADD CONSTRAINT attribution_utm_links_partner_id_fkey
        FOREIGN KEY (partner_id) REFERENCES affiliate_partners(id) ON DELETE SET NULL;
  END IF;
END $$;
