/*
  # Fix get_widget_config function

  Updates the function to use correct column names from integration_configs
*/

-- Drop and recreate the function with correct column reference
DROP FUNCTION IF EXISTS get_widget_config(TEXT, TEXT);

CREATE FUNCTION get_widget_config(p_widget_id TEXT, p_shop_domain TEXT)
RETURNS TABLE (
  id UUID,
  widget_type TEXT,
  config JSONB,
  styles JSONB,
  content JSONB,
  placement JSONB,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT wc.id, wc.widget_type, wc.config, wc.styles, wc.content, wc.placement, wc.is_active
  FROM widget_configurations wc
  JOIN clients c ON wc.client_id = c.id
  LEFT JOIN integration_configs ic ON c.id = ic.client_id AND ic.platform = 'shopify'
  WHERE wc.widget_id = p_widget_id
    AND wc.is_active = true
    AND (wc.start_date IS NULL OR wc.start_date <= now())
    AND (wc.end_date IS NULL OR wc.end_date >= now())
    AND (ic.shop_domain = p_shop_domain OR p_shop_domain IS NULL)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
