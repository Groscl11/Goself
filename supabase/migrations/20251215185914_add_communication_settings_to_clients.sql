/*
  # Add Communication Settings to Clients

  1. New Fields
    - `communication_settings` (jsonb) - Stores communication configuration
      - provider: 'internal' (default) or 'external'
      - webhook_url: URL for external communication providers
      - default_template: Template for campaign communications
      - email_from: Custom sender email (optional)
      - email_from_name: Custom sender name (optional)
  
  2. Notes
    - Default template includes placeholders: {name}, {client}, {program}, {link}, {validity}
    - Internal provider uses our system (emails via edge function)
    - External provider sends data to client's webhook
*/

-- Add communication_settings field to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'communication_settings'
  ) THEN
    ALTER TABLE clients ADD COLUMN communication_settings jsonb DEFAULT jsonb_build_object(
      'provider', 'internal',
      'default_template', 'Hi {name}! Congratulations on being enrolled in {program} at {client}! Click here to access your exclusive rewards and benefits: {link} (This link is valid for {validity})'
    );
  END IF;
END $$;

-- Update existing clients to have default communication settings
UPDATE clients
SET communication_settings = jsonb_build_object(
  'provider', 'internal',
  'default_template', 'Hi {name}! Congratulations on being enrolled in {program} at {client}! Click here to access your exclusive rewards and benefits: {link} (This link is valid for {validity})'
)
WHERE communication_settings IS NULL;
