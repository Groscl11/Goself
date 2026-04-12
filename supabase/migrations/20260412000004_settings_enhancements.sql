-- Add extended settings columns to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS support_email     TEXT,
  ADD COLUMN IF NOT EXISTS timezone          VARCHAR(60) DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS branding_settings JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}';

-- Create a public media storage bucket for logo/asset uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  5242880,
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml','image/x-icon']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from the public media bucket
CREATE POLICY "Public media read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Allow authenticated users to upload/update in the media bucket
CREATE POLICY "Authenticated media upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Authenticated media update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media');
