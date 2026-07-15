-- Add merchant-toggleable auto-enrollment to loyalty programs.
-- When true, the storefront widget silently enrolls any logged-in Shopify
-- customer who is not yet a member. When false (default), non-members see a
-- manual "join" CTA in the widget and no member record is created without the
-- merchant opting in (enterprise: no PII member records created by default).

ALTER TABLE loyalty_programs
  ADD COLUMN IF NOT EXISTS auto_enroll_members boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN loyalty_programs.auto_enroll_members IS
  'When true, the storefront widget silently enrolls any logged-in Shopify customer who is not yet a member. When false, non-members see a manual join CTA (no member record created without merchant opt-in).';
