-- Recalculate current_enrollments from actual successful trigger logs
-- (previous duplicate webhook events inflated the counter)
UPDATE campaign_rules cr
SET current_enrollments = (
  SELECT COUNT(*)
  FROM campaign_trigger_logs ctl
  WHERE ctl.campaign_rule_id = cr.id
    AND ctl.trigger_result = 'success'
);

-- Atomic increment helper so webhooks can't race-condition the counter
CREATE OR REPLACE FUNCTION increment_campaign_enrollments(campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  UPDATE campaign_rules
  SET current_enrollments = current_enrollments + 1
  WHERE id = campaign_id;
END;
$func$;
