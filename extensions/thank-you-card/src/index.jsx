/**
 * Thank You Card - Checkout UI Extension
 * Shopify 2024-2025 Compliant
 *
 * Renders on Order Status (Thank You) page ONLY
 * NO manual script injection
 * Installed via: Checkout Settings → Customize → Order Status Page
 */

import React, { useEffect, useState } from 'react';
import {
  reactExtension,
  Banner,
  Button,
  Text,
  BlockStack,
  InlineStack,
  useApi,
  useSettings
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.thank-you.block.render', () => <ThankYouCard />);

const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0';

function ThankYouCard() {
  const { query } = useApi();
  const settings = useSettings();
  const [rewardData, setRewardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const widgetId = settings.widget_id;

  useEffect(() => {
    if (!widgetId) {
      setLoading(false);
      return;
    }

    fetchRewardData();
  }, [widgetId]);

  async function fetchRewardData() {
    try {
      // Get comprehensive order and shop data from Shopify context
      const orderData = await query(
        `query {
          order {
            id
            totalPrice {
              amount
            }
            subtotalPrice {
              amount
              currencyCode
            }
            lineItems {
              id
              title
              quantity
              variant {
                id
                title
                sku
                price {
                  amount
                }
                product {
                  id
                  productType
                }
              }
            }
            shippingAddress {
              address1
              address2
              city
              province
              provinceCode
              country
              countryCode
              zip
              phone
            }
            billingAddress {
              address1
              address2
              city
              province
              provinceCode
              country
              countryCode
              zip
            }
            customer {
              id
              email
              phone
            }
            discountApplications {
              value {
                ... on PricingPercentageValue {
                  percentage
                }
                ... on MoneyValue {
                  amount {
                    amount
                  }
                }
              }
            }
          }
          shop {
            myshopifyDomain
          }
        }`
      );

      if (!orderData?.data?.order) {
        setLoading(false);
        return;
      }

      const order = orderData.data.order;
      const shopDomain = orderData.data.shop?.myshopifyDomain;

      // Build comprehensive order payload
      const orderPayload = {
        order_id: order.id,
        order_value: parseFloat(order.totalPrice?.amount || 0),
        currency: order.subtotalPrice?.currencyCode || 'USD',
        customer_email: order.customer?.email,
        customer_phone: order.customer?.phone || order.shippingAddress?.phone,
        shipping_address: order.shippingAddress ? {
          address1: order.shippingAddress.address1,
          address2: order.shippingAddress.address2,
          city: order.shippingAddress.city,
          province: order.shippingAddress.province,
          country: order.shippingAddress.country,
          zip: order.shippingAddress.zip,
        } : undefined,
        billing_address: order.billingAddress ? {
          address1: order.billingAddress.address1,
          address2: order.billingAddress.address2,
          city: order.billingAddress.city,
          province: order.billingAddress.province,
          country: order.billingAddress.country,
          zip: order.billingAddress.zip,
        } : undefined,
        line_items: order.lineItems?.map(item => ({
          product_id: item.variant?.product?.id,
          variant_id: item.variant?.id,
          title: item.title,
          quantity: item.quantity,
          price: parseFloat(item.variant?.price?.amount || 0),
          sku: item.variant?.sku,
          product_type: item.variant?.product?.productType,
        })),
        shop_domain: shopDomain,
      };

      // Check campaign eligibility
      const campaignResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/check-campaign-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(orderPayload),
        }
      );

      if (campaignResponse.ok) {
        const campaignData = await campaignResponse.json();
        if (campaignData.qualifies) {
          setRewardData({
            qualifies: true,
            content: {
              title: campaignData.bannerTitle,
              description: campaignData.bannerMessage,
              buttonText: campaignData.buttonText || 'Claim Your Rewards',
            },
            rewards: {
              redemption_link: campaignData.rewardUrl,
              client_name: campaignData.clientName,
              rewards_count: campaignData.rewardCount || 0,
            },
            widget_config_id: widgetId,
          });
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Thank you card error:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  if (loading) {
    return null;
  }

  if (error || !rewardData) {
    return null;
  }

  const content = rewardData.content || {};
  const styles = rewardData.styles || {};

  const handleButtonClick = async () => {
    // Track click event
    if (rewardData.widget_config_id) {
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
              widget_config_id: rewardData.widget_config_id,
              event_type: 'click',
              metadata: { action: 'view_rewards' },
            }),
          }
        );
      } catch (err) {
        console.error('Failed to track click:', err);
      }
    }
  };

  return (
    <BlockStack spacing="base">
      <Banner
        status="success"
        title={content.title || "Congratulations! You've earned rewards!"}
      >
        <BlockStack spacing="base">
          {content.description && (
            <Text size="base">{content.description}</Text>
          )}

          {rewardData.rewards && (
            <Text size="small" appearance="subdued">
              {rewardData.rewards.client_name && `${rewardData.rewards.client_name} - `}
              {rewardData.rewards.rewards_count} reward{rewardData.rewards.rewards_count !== 1 ? 's' : ''} available
            </Text>
          )}

          {rewardData.rewards?.redemption_link && (
            <Button
              kind="primary"
              to={rewardData.rewards.redemption_link}
              onPress={handleButtonClick}
            >
              {content.buttonText || 'View My Rewards'}
            </Button>
          )}

          {content.subtitle && (
            <Text size="small" appearance="info">
              {content.subtitle}
            </Text>
          )}
        </BlockStack>
      </Banner>
    </BlockStack>
  );
}
