/**
 * Loyalty Bolt Widget - App Embed
 * Loads the loyalty widget on the storefront
 */

(function() {
  'use strict';

  // Get shop domain from Shopify
  const shopDomain = window.Shopify?.shop || null;

  if (!shopDomain) {
    console.warn('Loyalty Bolt: Shop domain not found');
    return;
  }

  // Widget configuration from theme settings
  const widgetEnabled = {{ app_embed.settings.enabled | json }};
  const widgetPosition = {{ app_embed.settings.position | json }} || 'bottom-right';

  if (!widgetEnabled) {
    console.log('Loyalty Bolt: Widget disabled in theme settings');
    return;
  }

  // Load widget script
  const scriptSrc = `https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-script?shop=${shopDomain}&position=${widgetPosition}`;

  const script = document.createElement('script');
  script.src = scriptSrc;
  script.async = true;
  script.setAttribute('data-loyalty-widget', 'true');

  script.onerror = function() {
    console.error('Loyalty Bolt: Failed to load widget script');
  };

  script.onload = function() {
    console.log('Loyalty Bolt: Widget loaded successfully');
  };

  document.head.appendChild(script);
})();
