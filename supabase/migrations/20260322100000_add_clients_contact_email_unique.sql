-- Fix: Add UNIQUE constraint on clients.contact_email
-- Required for ON CONFLICT to work in shopify-oauth-callback edge function.
-- Step 1: Safely deduplicate — keep the oldest row per email, delete newer dupes.
DELETE FROM clients
WHERE id NOT IN (
  SELECT DISTINCT ON (contact_email) id
  FROM clients
  ORDER BY contact_email, created_at ASC
);

-- Step 2: Add the unique index (IF NOT EXISTS is safe to re-run).
CREATE UNIQUE INDEX IF NOT EXISTS clients_contact_email_unique
ON clients(contact_email);
