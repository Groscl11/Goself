-- Add unique constraint on store_users(store_installation_id, email)
-- Required for the ON CONFLICT clause in createMasterAdmin upsert
CREATE UNIQUE INDEX IF NOT EXISTS store_users_install_email_unique
  ON store_users (store_installation_id, email);
