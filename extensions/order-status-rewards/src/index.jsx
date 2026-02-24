import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  Banner,
  Button,
  BlockStack,
  Text,
  Divider,
  useApi,
  useSettings,
} from '@shopify/ui-extensions-react/checkout';

const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0';

export default reactExtension(
  'purchase.order-status.block.render',
  () => <OrderStatusRewards />
);

function OrderStatusRewards() {
  const { order, shop } = useApi();
  const settings = useSettings();
  const [widgetData, setWidgetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const widgetId = settings.widget_id;

  useEffect(() => {
    if (!widgetId) {
      setLoading(false);
      return;
    }
    fetchRewardLink();
  }, [widgetId]);

  const fetchRewardLink = async () => {
    try {
      setLoading(true);

      // Fetch widget configuration
      const configResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/get-widget-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            widget_id: widgetId,
            shop_domain: shop.myshopifyDomain,
          }),
        }
      );

      if (!configResponse.ok) {
        setLoading(false);
        return;
      }

      const widgetConfig = await configResponse.json();

      if (!widgetConfig.success) {
        setLoading(false);
        return;
      }

      // Fetch redemption link from our edge function
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/get-order-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            order_id: order.id,
            shop_domain: shop.myshopifyDomain,
          }),
        }
      );

      const data = await response.json();

      if (data.has_rewards) {
        setWidgetData({
          ...widgetConfig,
          rewards: data,
        });
      }
    } catch (err) {
      console.error('Error fetching reward link:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (error || !widgetData || !widgetData.rewards) {
    return null;
  }

  const content = widgetData.content || {};
  const rewardLink = widgetData.rewards.redemption_link;

  const handleButtonClick = async () => {
    // Track click event
    if (widgetData.widget_config_id) {
      try {
        await fetch(
          `${SUPABASE_URL}/functions/v1/track-widget-event`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              widget_config_id: widgetData.widget_config_id,
              event_type: 'click',
              metadata: { action: 'view_rewards' },
            }),
          }
        );
      } catch (err) {
        console.error('Failed to track click:', err);
      }
    }

    // Open reward link in new tab
    if (typeof window !== 'undefined') {
      window.open(rewardLink, '_blank');
    }
  };

  return (
    <BlockStack spacing="base">
      <Divider />
      <Banner
        status="success"
        title={content.title || "Congratulations! You've earned rewards!"}
      >
        <BlockStack spacing="base">
          <Text>
            {content.description || "Thank you for your purchase! You've qualified for exclusive rewards from our loyalty program."}
          </Text>
          <Text size="small" appearance="subdued">
            {content.subtitle || "Click the button below to view and claim your rewards."}
          </Text>
          <Button
            kind="primary"
            onPress={handleButtonClick}
          >
            {content.buttonText || 'View My Rewards'}
          </Button>
        </BlockStack>
      </Banner>
    </BlockStack>
  );
}
