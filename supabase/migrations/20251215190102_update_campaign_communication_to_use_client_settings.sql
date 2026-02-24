/*
  # Update Campaign Communication to Use Client Settings

  1. Changes
    - Update auto_generate_campaign_communication function to check client communication settings
    - Use client's default template if no campaign-specific template is configured
    - Support external webhook mode for clients who want to use their own tools
  
  2. Behavior
    - If provider is 'internal': use our system to prepare communication
    - If provider is 'external': send data to client's webhook (future implementation)
    - Uses client's default_template as fallback
*/

CREATE OR REPLACE FUNCTION public.auto_generate_campaign_communication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_campaign RECORD;
  v_client RECORD;
  v_communication_config jsonb;
  v_result jsonb;
  v_template text;
BEGIN
  IF NEW.campaign_rule_id IS NULL OR NEW.enrollment_source != 'campaign_auto' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_campaign FROM campaign_rules WHERE id = NEW.campaign_rule_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_campaign.client_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_communication_config := v_campaign.trigger_conditions->'communication';

  IF v_communication_config IS NULL THEN
    v_template := COALESCE(
      v_client.communication_settings->>'default_template',
      'Hi {name}! Congratulations on being enrolled in {program} at {client}! ' ||
      'Click here to access your exclusive rewards and benefits: {link} ' ||
      '(This link is valid for {validity})'
    );

    v_communication_config := jsonb_build_object(
      'enabled', true,
      'type', 'email',
      'link_type', 'one_click',
      'valid_days', 30,
      'template', v_template
    );
  ELSE
    v_template := COALESCE(
      v_communication_config->>'template',
      v_client.communication_settings->>'default_template',
      'Hi {name}! Congratulations on being enrolled in {program} at {client}! ' ||
      'Click here to access your exclusive rewards and benefits: {link} ' ||
      '(This link is valid for {validity})'
    );
  END IF;

  IF COALESCE((v_communication_config->>'enabled')::boolean, true) = true THEN
    IF COALESCE(v_client.communication_settings->>'provider', 'internal') = 'internal' THEN
      v_result := prepare_campaign_communication(
        v_campaign.client_id,
        NEW.member_id,
        NEW.id,
        NEW.campaign_rule_id,
        COALESCE(v_communication_config->>'type', 'email'),
        v_template,
        COALESCE(v_communication_config->>'link_type', 'one_click'),
        COALESCE((v_communication_config->>'valid_days')::integer, 30)
      );

      RAISE NOTICE 'Auto-generated communication for member % membership %: %', 
        NEW.member_id, NEW.id, v_result->>'communication_id';
    ELSE
      RAISE NOTICE 'External webhook communication for member % membership % - webhook: %',
        NEW.member_id, NEW.id, v_client.communication_settings->>'webhook_url';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
