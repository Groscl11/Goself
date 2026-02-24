/**
 * Cart Rewards Widget - Cart UI Extension
 * Shopify 2024-2025 Compliant
 *
 * Displays in cart drawer or cart page
 * Read-only messaging (no cart mutation)
 * Installed via: Theme Customizer → Cart → Add App Block
 */

import React, { useEffect, useState } from 'react';
import {
  render,
  Banner,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Icon,
  useExtensionApi,
  useSettings,
  useCartLines
} from '@shopify/checkout-ui-extensions-react';

render('purchase.cart.block.render', () => <CartRewards />);

const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0';

function CartRewards() {
  const { query } = useExtensionApi();
  const settings = useSettings();
  const cartLines = useCartLines();
  const [rewardInfo, setRewardInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const widgetId = settings.widget_id;

  useEffect(() => {
    if (!widgetId || !cartLines || cartLines.length === 0) {
      setLoading(false);
      return;
    }

    fetchRewardInfo();
  }, [widgetId, cartLines]);

  async function fetchRewardInfo() {
    try {
      // Calculate cart value
      const cartValue = cartLines.reduce((total, line) => {
        return total + (parseFloat(line.cost?.totalAmount?.amount || 0));
      }, 0);

      // Get customer data if available
      let customerId = null;
      try {
        const buyerData = await query(
          `query {
            cart {
              buyerIdentity {
                customer {
                  id
                }
              }
            }
          }`
        );
        customerId = buyerData?.data?.cart?.buyerIdentity?.customer?.id;
      } catch (e) {
        // Customer not logged in
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/get-widget-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            widget_id: widgetId,
            context: {
              type: 'cart',
              customer_id: customerId,
              cart_value: cartValue,
              cart_line_count: cartLines.length,
            }
          })
        }
      );

      if (!response.ok) {
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        const content = data.config.content || {};
        setRewardInfo({
          title: content.title || 'Rewards Available',
          description: content.description,
          cta_text: content.buttonText || 'View Rewards',
          footer_text: content.subtitle,
        });
      }

      setLoading(false);
    } catch (err) {
      console.error('Cart rewards error:', err);
      setLoading(false);
    }
  }

  if (loading || !rewardInfo) {
    return null;
  }

  return (
    <BlockStack spacing="base" border="base" padding="base" cornerRadius="base">
      <InlineStack spacing="tight" blockAlignment="start">
        <Icon source="gift" size="base" />
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            {rewardInfo.title || 'Rewards Available'}
          </Text>
          {rewardInfo.description && (
            <Text size="small" appearance="subdued">
              {rewardInfo.description}
            </Text>
          )}
        </BlockStack>
      </InlineStack>

      {rewardInfo.reward_preview && (
        <BlockStack spacing="extraTight" border="base" padding="tight" cornerRadius="small">
          <Text size="small" emphasis="bold">
            {rewardInfo.reward_preview.title}
          </Text>
          {rewardInfo.reward_preview.description && (
            <Text size="extraSmall" appearance="subdued">
              {rewardInfo.reward_preview.description}
            </Text>
          )}
        </BlockStack>
      )}

      {rewardInfo.redeem_url && (
        <Button
          kind="secondary"
          to={rewardInfo.redeem_url}
        >
          {rewardInfo.cta_text || 'View Rewards'}
        </Button>
      )}

      {rewardInfo.footer_text && (
        <Text size="extraSmall" appearance="info">
          {rewardInfo.footer_text}
        </Text>
      )}
    </BlockStack>
  );
}
