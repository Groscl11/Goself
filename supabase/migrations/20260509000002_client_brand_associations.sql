-- ─── 1. Add brand_id to clients (the verified official link) ─────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;

-- ─── 2. client_brand_associations table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_brand_associations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_id         uuid        REFERENCES brands(id) ON DELETE SET NULL,
  submitted_name   text        NOT NULL,
  submitted_url    text,
  proof_notes      text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cba_client_id ON client_brand_associations(client_id);
CREATE INDEX IF NOT EXISTS idx_cba_status    ON client_brand_associations(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_cba_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cba_updated_at ON client_brand_associations;
CREATE TRIGGER trg_cba_updated_at
  BEFORE UPDATE ON client_brand_associations
  FOR EACH ROW EXECUTE FUNCTION set_cba_updated_at();

-- ─── 3. RLS on client_brand_associations ─────────────────────────────────────
ALTER TABLE client_brand_associations ENABLE ROW LEVEL SECURITY;

-- Clients see only their own association rows
CREATE POLICY "clients_view_own_associations" ON client_brand_associations
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Clients can INSERT their own rows
CREATE POLICY "clients_insert_own_associations" ON client_brand_associations
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Clients can UPDATE only their own pending rows (withdraw / re-submit)
CREATE POLICY "clients_update_own_pending_associations" ON client_brand_associations
  FOR UPDATE USING (
    status = 'pending' AND
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "admins_all_associations" ON client_brand_associations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── 4. Auto-create brand + association on client INSERT ──────────────────────
CREATE OR REPLACE FUNCTION auto_create_brand_for_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_brand_id uuid;
BEGIN
  -- Create a pending brand seeded with the client's data
  INSERT INTO brands (
    name, logo_url, website_url, contact_email, contact_phone,
    industry, status, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.logo_url,
    NEW.website_url,
    NEW.contact_email,
    NEW.contact_phone,
    NEW.industry,
    'pending'::brand_status,
    now(),
    now()
  )
  RETURNING id INTO new_brand_id;

  -- Link the new brand to the client association table (auto-submitted)
  INSERT INTO client_brand_associations (
    client_id, brand_id, submitted_name, submitted_url, status
  )
  VALUES (
    NEW.id, new_brand_id, NEW.name, NEW.website_url, 'pending'
  );

  -- Store the pending brand_id on the client row for quick lookup
  UPDATE clients SET brand_id = new_brand_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_brand_on_client_insert ON clients;
CREATE TRIGGER trg_auto_brand_on_client_insert
  AFTER INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION auto_create_brand_for_client();
