/**
 * API Configuration Utility
 * Automatically detects the current environment and returns appropriate API endpoints
 */

export interface ApiConfig {
  baseUrl: string;
  functionsUrl: string;
  supabaseUrl: string;
  anonKey: string;
  environment: 'local' | 'production';
}

/**
 * Get the current API configuration based on environment
 * Automatically uses the deployed URL when in production
 */
export function getApiConfig(): ApiConfig {
  const currentUrl = window.location.origin;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Determine if we're in local development
  const isLocal = currentUrl.includes('localhost') ||
                  currentUrl.includes('127.0.0.1') ||
                  currentUrl.includes('local.');

  const environment = isLocal ? 'local' : 'production';

  return {
    baseUrl: currentUrl,
    functionsUrl: supabaseUrl,
    supabaseUrl,
    anonKey,
    environment,
  };
}

/**
 * Get formatted API endpoints for documentation
 * Shows the correct URLs based on current environment
 */
export function getApiEndpoints() {
  const config = getApiConfig();

  return {
    // Campaign & Rewards
    getOrderRewards: `${config.functionsUrl}/functions/v1/get-order-rewards`,
    checkCampaignRewards: `${config.functionsUrl}/functions/v1/check-campaign-rewards`,
    redeemCampaignRewards: `${config.functionsUrl}/functions/v1/redeem-campaign-rewards`,
    getCustomerRewards: `${config.functionsUrl}/functions/v1/get-customer-rewards`,

    // Loyalty Points
    getLoyaltyStatus: `${config.functionsUrl}/functions/v1/get-loyalty-status`,
    calculateLoyaltyPoints: `${config.functionsUrl}/functions/v1/calculate-loyalty-points`,
    redeemLoyaltyPoints: `${config.functionsUrl}/functions/v1/redeem-loyalty-points`,
    checkLoyaltyRedemption: `${config.functionsUrl}/functions/v1/check-loyalty-redemption`,

    // Widgets
    getWidgetConfig: `${config.functionsUrl}/functions/v1/get-widget-config`,
    trackWidgetEvent: `${config.functionsUrl}/functions/v1/track-widget-event`,

    // Shopify OAuth
    shopifyOAuthConnect: `${config.functionsUrl}/functions/v1/shopify-oauth-connect`,
    shopifyOAuthCallback: `${config.functionsUrl}/functions/v1/shopify-oauth-callback`,
    shopifyRegisterWebhooks: `${config.functionsUrl}/functions/v1/shopify-register-webhooks`,
    shopifyWebhook: `${config.functionsUrl}/functions/v1/shopify-webhook`,
  };
}

/**
 * Get environment-specific information for display
 */
export function getEnvironmentInfo() {
  const config = getApiConfig();

  return {
    environment: config.environment,
    baseUrl: config.baseUrl,
    apiUrl: config.functionsUrl,
    isProduction: config.environment === 'production',
    isLocal: config.environment === 'local',
    displayMessage: config.environment === 'production'
      ? `Running in production mode at ${config.baseUrl}`
      : `Running in local development mode at ${config.baseUrl}`,
  };
}

/**
 * Format an API endpoint for display in documentation
 */
export function formatEndpointUrl(path: string): string {
  const config = getApiConfig();
  return `${config.functionsUrl}${path}`;
}

/**
 * Get the OAuth redirect URL for Shopify
 */
export function getOAuthRedirectUrl(): string {
  const config = getApiConfig();
  return `${config.functionsUrl}/functions/v1/shopify-oauth-callback`;
}

/**
 * Get the app URL for Shopify app configuration
 */
export function getAppUrl(): string {
  return window.location.origin;
}
