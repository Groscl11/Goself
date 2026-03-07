/*
  # Fix campaign_id generation to bypass RLS

  The generate_campaign_id() function queries campaign_rules to find the MAX
  campaign number. Without SECURITY DEFINER it is subject to RLS, so each
  client only sees their own rows. When two different clients both have zero
  campaigns visible to the function it returns "CAMP-0001" for both,
  causing a duplicate key violation on the UNIQUE(campaign_id) constraint.

  Fix: recreate the function as SECURITY DEFINER so it always queries the
  full table and guarantees a globally unique ID.
*/

CREATE OR REPLACE FUNCTION generate_campaign_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id  text;
  max_num integer;
BEGIN
  -- Must see ALL rows regardless of RLS to guarantee uniqueness
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(campaign_id FROM 'CAMP-(\d+)') AS integer
      )
    ), 0
  ) INTO max_num
  FROM campaign_rules
  WHERE campaign_id ~ '^CAMP-\d+$';

  new_id := 'CAMP-' || LPAD((max_num + 1)::text, 4, '0');
  RETURN new_id;
END;
$$;
