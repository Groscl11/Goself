-- ── Attribution UTM Links ─────────────────────────────────────────────────────
-- Trackable UTM links tied to affiliate partners for click attribution.

CREATE TABLE IF NOT EXISTS attribution_utm_links (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  partner_id              uuid        REFERENCES affiliate_partners(id) ON DELETE SET NULL,
  slug                    text        NOT NULL,
  destination_url         text        NOT NULL,
  utm_source              text,
  utm_medium              text,
  utm_campaign            text,
  utm_content             text,
  utm_term                text,
  attribution_window_days integer     NOT NULL DEFAULT 30,
  clicks                  integer     NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attribution_utm_links_client_id
  ON attribution_utm_links(client_id);
CREATE INDEX IF NOT EXISTS idx_attribution_utm_links_partner_id
  ON attribution_utm_links(partner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attribution_utm_links_slug
  ON attribution_utm_links(slug);

ALTER TABLE attribution_utm_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients manage own utm links"
  ON attribution_utm_links FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM profiles WHERE id = auth.uid()
    )
  );
