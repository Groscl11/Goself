-- Fix: remove client_brand_associations insert from auto_create_brand_for_client trigger.
--
-- Previously the trigger auto-inserted a CBA row (submitted_name = clients.name),
-- which blocked clients from ever seeing the verification form in Settings
-- (the form only appears when no CBA exists or when one is rejected).
--
-- Now the trigger only creates the pending brands placeholder and sets clients.brand_id.
-- The CBA row is exclusively created by the client when they explicitly submit
-- their legal verification details (GST + PAN) through Settings → Brand Verification.

CREATE OR REPLACE FUNCTION auto_create_brand_for_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_brand_id uuid;
BEGIN
  INSERT INTO brands (
    name, logo_url, website_url, contact_email, contact_phone,
    industry, status, created_at, updated_at
  )
  VALUES (
    NEW.name, NEW.logo_url, NEW.website_url, NEW.contact_email, NEW.contact_phone,
    NEW.industry, 'pending'::brand_status, now(), now()
  )
  RETURNING id INTO new_brand_id;

  UPDATE clients SET brand_id = new_brand_id WHERE id = NEW.id;

  -- NOTE: intentionally no INSERT into client_brand_associations here.
  -- That row is only created when the client submits their legal verification form.
  RETURN NEW;
END;
$$;
