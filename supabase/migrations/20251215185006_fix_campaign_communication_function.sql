/*
  # Fix Campaign Communication Function

  1. Changes
    - Fix prepare_campaign_communication function to properly handle program information
    - Change v_campaign variable from campaign_rules type to RECORD type
    - This allows it to hold the joined program_name and program_description fields
  
  2. Notes
    - This fixes the "record has no field program_name" error during campaign enrollment
*/

CREATE OR REPLACE FUNCTION public.prepare_campaign_communication(
  p_client_id uuid,
  p_member_id uuid,
  p_membership_id uuid,
  p_campaign_rule_id uuid,
  p_communication_type text,
  p_message_template text,
  p_link_type text DEFAULT 'one_click'::text,
  p_valid_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_member member_users;
  v_client clients;
  v_campaign RECORD;
  v_token_result jsonb;
  v_personalized_message text;
  v_communication_id uuid;
  v_subject text;
BEGIN
  SELECT * INTO v_member FROM member_users WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = p_client_id;

  SELECT cr.*, mp.name as program_name, mp.description as program_description
  INTO v_campaign
  FROM campaign_rules cr
  JOIN membership_programs mp ON mp.id = cr.program_id
  WHERE cr.id = p_campaign_rule_id;

  v_token_result := create_member_redemption_token(
    p_client_id,
    p_member_id,
    p_membership_id,
    p_campaign_rule_id,
    p_link_type,
    p_valid_days
  );

  v_personalized_message := p_message_template;
  v_personalized_message := replace(v_personalized_message, '{name}', COALESCE(v_member.full_name, 'Valued Customer'));
  v_personalized_message := replace(v_personalized_message, '{client}', v_client.name);
  v_personalized_message := replace(v_personalized_message, '{program}', v_campaign.name);
  v_personalized_message := replace(v_personalized_message, '{link}', v_token_result->>'url');
  v_personalized_message := replace(v_personalized_message, '{validity}', p_valid_days::text || ' days');

  v_subject := 'Welcome to ' || v_client.name;
  IF v_campaign.name IS NOT NULL THEN
    v_subject := v_subject || ' - ' || v_campaign.name;
  END IF;

  INSERT INTO communication_logs (
    client_id,
    member_id,
    membership_id,
    campaign_rule_id,
    communication_type,
    recipient_email,
    recipient_phone,
    subject,
    message_body,
    redemption_token_id,
    personalized_url,
    status,
    metadata
  ) VALUES (
    p_client_id,
    p_member_id,
    p_membership_id,
    p_campaign_rule_id,
    p_communication_type,
    v_member.email,
    v_member.phone,
    v_subject,
    v_personalized_message,
    (v_token_result->>'token_id')::uuid,
    v_token_result->>'url',
    'pending',
    jsonb_build_object(
      'link_type', p_link_type,
      'valid_days', p_valid_days,
      'campaign_name', v_campaign.name,
      'program_name', v_campaign.program_name
    )
  )
  RETURNING id INTO v_communication_id;

  RETURN jsonb_build_object(
    'success', true,
    'communication_id', v_communication_id,
    'redemption_token', v_token_result,
    'personalized_message', v_personalized_message,
    'subject', v_subject,
    'recipient', jsonb_build_object(
      'email', v_member.email,
      'phone', v_member.phone,
      'name', v_member.full_name
    )
  );
END;
$function$;
