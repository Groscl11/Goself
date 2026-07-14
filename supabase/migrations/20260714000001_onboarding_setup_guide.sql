-- ── Onboarding setup guide ───────────────────────────────────────────────────
-- Adds two columns to clients to support the persistent "Getting Started"
-- dashboard widget introduced in the first-time onboarding journey.
--
--  setup_guide_dismissed  — merchant clicked "Dismiss" on the setup guide card
--  onboarding_goals       — tracks selected goal(s) ('loyalty','campaigns','affiliates')

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS setup_guide_dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_goals      text[]  NOT NULL DEFAULT '{}';
