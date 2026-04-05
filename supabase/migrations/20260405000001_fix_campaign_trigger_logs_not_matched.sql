-- Fix: campaign_trigger_logs trigger_result CHECK constraint was missing 'not_matched'
-- This caused silent insert failures whenever conditions were not met, resulting in blank trigger logs.

ALTER TABLE campaign_trigger_logs DROP CONSTRAINT IF EXISTS campaign_trigger_logs_trigger_result_check;

ALTER TABLE campaign_trigger_logs
  ADD CONSTRAINT campaign_trigger_logs_trigger_result_check
  CHECK (trigger_result IN (
    'success', 'failed', 'skipped', 'no_member',
    'already_enrolled', 'max_reached', 'below_threshold', 'not_matched'
  ));
