import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ShoppingBag, Check, AlertCircle, Loader, ExternalLink, X, BookOpen, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';
import { RedemptionLinkManager } from '../../components/RedemptionLinkManager';
import { ApiDocumentation } from '../../components/ApiDocumentation';
import { getApiConfig, getOAuthRedirectUrl, getAppUrl } from '../../lib/api-config';

interface IntegrationConfig {
  id: string;
  platform: string;
  shop_domain: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  webhooks_registered: boolean;
  installed_at: string | null;
  last_event_at: string | null;
  scopes: string[];
  webhook_ids: any[];
  shopify_api_key: string | null;
  shopify_api_secret: string | null;
  credentials_configured: boolean;
}

export function Integrations() {
  const [integration, setIntegration] = useState<IntegrationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  const [shopDomain, setShopDomain] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [registeringWebhooks, setRegisteringWebhooks] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<'oauth' | 'token'>('token');
  const [accessToken, setAccessToken] = useState('');

  // Get API configuration
  const apiConfig = getApiConfig();
  const oauthRedirectUrl = getOAuthRedirectUrl();
  const appUrl = getAppUrl();

  useEffect(() => {
    loadClientId();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true') {
      setTimeout(() => loadIntegration(), 1000);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (urlParams.get('error') === 'oauth_failed') {
      alert('Failed to connect Shopify. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (clientId) {
      loadIntegration();
    }
  }, [clientId]);

  const loadClientId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (profile?.client_id) {
        setClientId(profile.client_id);
      }
    } catch (error) {
      console.error('Error loading client ID:', error);
    }
  };

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('integration_configs')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', 'shopify')
        .maybeSingle();

      if (error) throw error;
      setIntegration(data);
    } catch (error) {
      console.error('Error loading integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shopDomain) {
      alert('Please enter your Shopify store domain');
      return;
    }

    const cleanDomain = shopDomain.replace('https://', '').replace('http://', '').trim();
    // Handle various domain formats
    let fullDomain = cleanDomain;
    if (cleanDomain.endsWith('.myshopify.com')) {
      // Already has correct suffix
      fullDomain = cleanDomain;
    } else if (cleanDomain.endsWith('.shopify.com')) {
      // Remove .shopify.com and add .myshopify.com
      fullDomain = cleanDomain.replace(/\.shopify\.com$/, '') + '.myshopify.com';
    } else {
      // Just store name, add .myshopify.com
      fullDomain = `${cleanDomain}.myshopify.com`;
    }

    try {
      setConnecting(true);

      if (connectionMethod === 'token') {
        // Direct token connection for custom apps
        if (!accessToken) {
          alert('Please enter your Admin API access token');
          setConnecting(false);
          return;
        }

        // Trim the access token to remove any accidental whitespace
        const cleanToken = accessToken.trim();

        // Save the connection - credentials will be verified during webhook registration
        if (integration?.id) {
          const { error } = await supabase
            .from('integration_configs')
            .update({
              shop_domain: fullDomain,
              access_token: cleanToken,
              status: 'connected',
              is_active: true,
              installed_at: new Date().toISOString(),
              scopes: ['read_orders', 'write_orders', 'read_customers', 'read_products'],
              updated_at: new Date().toISOString(),
            })
            .eq('id', integration.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('integration_configs')
            .insert({
              client_id: clientId,
              platform: 'shopify',
              platform_name: fullDomain,
              shop_domain: fullDomain,
              access_token: cleanToken,
              status: 'connected',
              is_active: true,
              installed_at: new Date().toISOString(),
              scopes: ['read_orders', 'write_orders', 'read_customers', 'read_products'],
            });

          if (error) throw error;
        }

        console.log('Shopify connection saved successfully');
        await loadIntegration();
        setShowConnectForm(false);
        setAccessToken('');
        setShopDomain('');
        alert('Successfully connected to Shopify! Now register webhooks to enable real-time order tracking.');
      } else {
        // OAuth connection for public apps
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const response = await fetch(`${apiConfig.functionsUrl}/functions/v1/shopify-oauth-connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.anonKey}`,
          },
          body: JSON.stringify({
            shop: fullDomain,
            client_id: clientId,
            user_id: user.id,
            app_url: appUrl,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to initiate OAuth flow');
        }

        const { authorization_url } = await response.json();
        window.location.href = authorization_url;
      }
    } catch (error: any) {
      console.error('Error connecting Shopify:', error);
      const errorMessage = error?.message || error?.error?.message || 'Failed to connect Shopify. Please try again.';
      alert(`Connection failed: ${errorMessage}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Shopify store? This will stop order syncing and webhook delivery.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('integration_configs')
        .update({
          status: 'disconnected',
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration!.id);

      if (error) throw error;

      alert('Shopify store disconnected successfully');
      loadIntegration();
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Failed to disconnect Shopify store');
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey || !apiSecret) {
      alert('Please enter both API Key and API Secret');
      return;
    }

    try {
      setSavingCredentials(true);

      if (integration?.id) {
        const { error } = await supabase
          .from('integration_configs')
          .update({
            shopify_api_key: apiKey,
            shopify_api_secret: apiSecret,
            credentials_configured: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integration_configs')
          .insert({
            client_id: clientId,
            platform: 'shopify',
            shopify_api_key: apiKey,
            shopify_api_secret: apiSecret,
            credentials_configured: true,
            status: 'disconnected',
            is_active: false,
          });

        if (error) throw error;
      }

      alert('Credentials saved successfully! You can now connect your Shopify store.');
      setShowCredentialsForm(false);
      setApiKey('');
      setApiSecret('');
      loadIntegration();
    } catch (error) {
      console.error('Error saving credentials:', error);
      alert('Failed to save credentials. Please try again.');
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleRegisterWebhooks = async () => {
    if (!integration) return;

    try {
      setRegisteringWebhooks(true);
      setWebhookError(null);

      // Get the access token from database
      const { data: configData, error: configError } = await supabase
        .from('integration_configs')
        .select('access_token')
        .eq('id', integration.id)
        .single();

      if (configError || !configData?.access_token) {
        throw new Error('Access token not found');
      }

      const response = await fetch(`${apiConfig.functionsUrl}/functions/v1/shopify-register-webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.anonKey}`,
        },
        body: JSON.stringify({
          shop: integration.shop_domain,
          access_token: configData.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Show detailed error
        console.error('Webhook registration failed:', result);
        setWebhookError(JSON.stringify(result.details || result.error, null, 2));
        alert('Failed to register webhooks. Check the error details below.');
      } else {
        // Update the integration record
        await supabase
          .from('integration_configs')
          .update({
            webhooks_registered: true,
            webhook_ids: result.webhooks
          })
          .eq('id', integration.id);

        alert(`Successfully registered ${result.registered} of ${result.total} webhooks!`);
        loadIntegration();
      }
    } catch (error) {
      console.error('Error registering webhooks:', error);
      setWebhookError(error instanceof Error ? error.message : 'Unknown error');
      alert('Failed to register webhooks. Check the error details below.');
    } finally {
      setRegisteringWebhooks(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Integrations">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="inline-block animate-spin w-8 h-8 text-blue-600" />
            <p className="mt-2 text-gray-600">Loading integration...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Integrations">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shopify Integration</h1>
          <p className="text-gray-600 mt-2">
            Connect your Shopify store to automatically track orders and trigger rewards
          </p>
        </div>

        {integration?.status !== 'connected' && (
          <Card className="mb-6 border-blue-200 bg-white shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6" />
                <div>
                  <h3 className="text-xl font-bold">Shopify Integration Setup Guide</h3>
                  <p className="text-blue-100 text-sm mt-1">Complete setup before connecting your store</p>
                </div>
              </div>
            </CardHeader>

            {(
              <CardContent className="bg-white">
                <div className="space-y-6">
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-900 mb-2">API Credentials Required</h4>
                        <p className="text-sm text-red-800 mb-2">
                          Before connecting a Shopify store, you must configure your Shopify API credentials.
                        </p>
                        <p className="text-sm text-red-800 font-medium">
                          Follow all steps below to create your Shopify app and set the required environment variables.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <strong>Note:</strong> This guide is for platform administrators setting up the Shopify app integration.
                      Once configured, merchants can connect with just one click.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">1</span>
                      Create Shopify Partner Account
                    </h4>
                    <div className="ml-8 space-y-2 text-sm text-gray-700">
                      <p>1. Go to <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        partners.shopify.com <ExternalLink className="w-3 h-3" />
                      </a></p>
                      <p>2. Click "Join now" or "Log in"</p>
                      <p>3. Create your account and verify your email</p>
                      <p>4. Complete your partner profile</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">2</span>
                      Create Your Shopify App
                    </h4>
                    <div className="ml-8 space-y-3 text-sm text-gray-700">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="font-semibold text-blue-900 mb-2">Navigation in Shopify Partners:</p>
                        <ol className="space-y-1 text-blue-900">
                          <li><strong>1.</strong> Go to <a href="https://partners.shopify.com/organizations" target="_blank" rel="noopener noreferrer" className="underline">partners.shopify.com/organizations</a></li>
                          <li><strong>2.</strong> Select your organization (or create one)</li>
                          <li><strong>3.</strong> Click <strong>"Apps"</strong> in the left sidebar</li>
                          <li><strong>4.</strong> Click <strong>"Create app"</strong> button (top right)</li>
                          <li><strong>5.</strong> Choose <strong>"Create app manually"</strong></li>
                        </ol>
                      </div>

                      <div>
                        <p className="font-semibold mb-2">App Type Selection:</p>
                        <p className="mb-2">Choose based on your needs:</p>
                        <ul className="ml-4 space-y-1">
                          <li><strong>• Public app:</strong> For distribution to multiple stores via Shopify App Store</li>
                          <li><strong>• Custom app:</strong> For a single specific store</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-semibold mb-2">Enter App Information:</p>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium text-gray-900">App name: <span className="text-red-600">*</span></p>
                            <code className="block bg-gray-100 px-3 py-2 rounded text-xs mt-1">Rewards & Membership Integration</code>
                            <p className="text-xs text-gray-600 mt-1">This name will be visible to merchants when they install your app</p>
                          </div>

                          <div>
                            <p className="font-medium text-gray-900">App URL: <span className="text-red-600">*</span></p>
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-1">
                              <code className="block text-xs break-all">{appUrl}</code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(appUrl);
                                  alert('App URL copied to clipboard!');
                                }}
                                className="text-blue-600 hover:underline text-xs mt-1 inline-flex items-center gap-1"
                              >
                                <LinkIcon className="w-3 h-3" />
                                Copy App URL
                              </button>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">This is your main application URL where merchants will access the app</p>
                            {apiConfig.environment === 'production' && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-green-700">
                                <Check className="w-3 h-3" />
                                <span>Using production URL (auto-detected)</span>
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="font-medium text-gray-900">Allowed redirection URL(s): <span className="text-red-600">*</span></p>
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-1">
                              <code className="block text-xs break-all font-mono">{oauthRedirectUrl}</code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(oauthRedirectUrl);
                                  alert('OAuth Redirect URL copied to clipboard!');
                                }}
                                className="text-blue-600 hover:underline text-xs mt-1 inline-flex items-center gap-1"
                              >
                                <LinkIcon className="w-3 h-3" />
                                Copy OAuth Redirect URL
                              </button>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                              <p className="text-xs text-red-900">
                                <strong>Critical:</strong> This URL must be exact. Copy and paste it - do not type manually. This is where Shopify redirects after OAuth authorization.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 mt-3">
                        <p className="font-semibold text-gray-900 mb-1">After entering the details:</p>
                        <p className="text-xs text-gray-700">Click <strong>"Create app"</strong> button at the bottom to proceed to the next step</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">3</span>
                      Configure API Scopes
                    </h4>
                    <div className="ml-8 space-y-3 text-sm text-gray-700">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="font-semibold text-blue-900 mb-2">Navigation in App Dashboard:</p>
                        <ol className="space-y-1 text-blue-900">
                          <li><strong>1.</strong> After creating the app, you'll be on the app's Overview page</li>
                          <li><strong>2.</strong> Click the <strong>"Configuration"</strong> tab in the top navigation</li>
                          <li><strong>3.</strong> Scroll down to the <strong>"Admin API integration"</strong> section</li>
                          <li><strong>4.</strong> Click the <strong>"Configure"</strong> button</li>
                        </ol>
                      </div>

                      <div>
                        <p className="font-semibold mb-2">Required API Access Scopes:</p>
                        <p className="text-gray-600 mb-2">These permissions allow the app to read order and customer data and register webhooks:</p>
                        <div className="space-y-2 mt-2">
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-semibold">read_orders</code>
                                <p className="text-xs text-gray-600 mt-1">Required to access order information and track purchases</p>
                                <p className="text-xs text-gray-500 mt-1">Navigate: Orders → Read orders</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-semibold">read_customers</code>
                                <p className="text-xs text-gray-600 mt-1">Required to identify customers and match them to membership records</p>
                                <p className="text-xs text-gray-500 mt-1">Navigate: Customers → Read customers</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-semibold">read_products</code>
                                <p className="text-xs text-gray-600 mt-1">Required to access product details for order processing</p>
                                <p className="text-xs text-gray-500 mt-1">Navigate: Products → Read products</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="font-semibold text-blue-900 mb-1">Note about Webhooks:</p>
                        <p className="text-xs text-blue-900">Shopify automatically allows webhook creation when you have the appropriate read/write permissions for that resource. Since we request <strong>read_orders</strong> and <strong>read_customers</strong>, webhooks will be automatically enabled for these resources.</p>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="font-semibold text-yellow-900 mb-1">Important:</p>
                        <p className="text-xs text-yellow-900">Only select these three scopes (read_orders, read_customers, read_products). Do not add write_webhooks as it's deprecated.</p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="font-semibold text-gray-900 mb-1">After selecting scopes:</p>
                        <p className="text-xs text-gray-700">1. Click <strong>"Save"</strong> button at the bottom</p>
                        <p className="text-xs text-gray-700">2. Return to the Configuration tab</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">4</span>
                      Get API Credentials
                    </h4>
                    <div className="ml-8 space-y-3 text-sm text-gray-700">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="font-semibold text-blue-900 mb-2">Navigation in App Dashboard:</p>
                        <ol className="space-y-1 text-blue-900">
                          <li><strong>1.</strong> Click the <strong>"API credentials"</strong> tab in the top navigation</li>
                          <li><strong>2.</strong> You'll see your credentials in the "Admin API access token" section</li>
                        </ol>
                      </div>

                      <div>
                        <p className="font-semibold mb-2">Copy Your Credentials:</p>
                        <div className="space-y-3">
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start gap-2 mb-2">
                              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-semibold">1</div>
                              <div>
                                <p className="font-semibold text-gray-900">Client ID (API Key)</p>
                                <p className="text-xs text-gray-600 mt-1">This is visible at all times</p>
                              </div>
                            </div>
                            <div className="ml-8">
                              <p className="text-xs text-gray-700 mb-1">Look for the field labeled <strong>"Client ID"</strong></p>
                              <p className="text-xs text-gray-700">Click the copy icon next to it or select and copy the text</p>
                            </div>
                          </div>

                          <div className="bg-white border border-red-200 rounded-lg p-3">
                            <div className="flex items-start gap-2 mb-2">
                              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-semibold">2</div>
                              <div>
                                <p className="font-semibold text-gray-900">Client Secret (API Secret)</p>
                                <p className="text-xs text-red-600 mt-1 font-medium">Only shown once - save immediately!</p>
                              </div>
                            </div>
                            <div className="ml-8">
                              <p className="text-xs text-gray-700 mb-1">Look for the field labeled <strong>"Client secret"</strong></p>
                              <p className="text-xs text-gray-700 mb-1">Click the <strong>"Show"</strong> button to reveal the secret</p>
                              <p className="text-xs text-gray-700">Copy it immediately - you cannot view it again</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="flex gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-red-900 mb-1">Critical Security Warning:</p>
                            <ul className="text-xs text-red-900 space-y-1">
                              <li>• The Client Secret is only displayed once</li>
                              <li>• If you close the page without saving it, you'll need to regenerate it</li>
                              <li>• Save both credentials in a secure password manager</li>
                              <li>• Never commit these credentials to version control</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="font-semibold text-gray-900 mb-1">Next step:</p>
                        <p className="text-xs text-gray-700">You'll use these credentials in the Supabase Edge Functions configuration</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">5</span>
                      Save Your API Credentials
                    </h4>
                    <div className="ml-8 space-y-3 text-sm text-gray-700">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="font-semibold text-green-900 mb-1">Secure Credential Storage</p>
                        <p className="text-xs text-green-900">Your Shopify API credentials will be encrypted and stored securely in the database</p>
                      </div>

                      <div>
                        <p className="font-semibold mb-2">Save credentials using the form below:</p>
                        <ol className="space-y-2 ml-4">
                          <li><strong>1.</strong> Click the <strong>"Configure Shopify Credentials"</strong> button below</li>
                          <li><strong>2.</strong> Paste your <strong>Client ID</strong> (from Step 4) into the API Key field</li>
                          <li><strong>3.</strong> Paste your <strong>Client Secret</strong> (from Step 4) into the API Secret field</li>
                          <li><strong>4.</strong> Click <strong>"Save Credentials"</strong></li>
                        </ol>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <div className="flex gap-2">
                          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-blue-900 mb-1">Note:</p>
                            <p className="text-xs text-blue-900">These credentials are used by the OAuth system to authenticate with Shopify when merchants connect their stores</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-sm">6</span>
                      Connect Your Shopify Store
                    </h4>
                    <div className="ml-8 space-y-3 text-sm text-gray-700">
                      <p>After saving your credentials in Step 5, you can connect your Shopify store:</p>
                      <ol className="space-y-2 ml-4">
                        <li><strong>1.</strong> Click the <strong>"Connect Shopify Store"</strong> button below</li>
                        <li><strong>2.</strong> Enter your shop domain (e.g., <code className="bg-gray-100 px-1 rounded">yourstore.myshopify.com</code>)</li>
                        <li><strong>3.</strong> Click <strong>"Connect"</strong> - you'll be redirected to Shopify</li>
                        <li><strong>4.</strong> Review and approve the requested permissions</li>
                        <li><strong>5.</strong> You'll be redirected back automatically</li>
                      </ol>

                      <div className="bg-green-50 border border-green-200 rounded p-3 mt-3">
                        <div className="flex gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-green-900 mb-1">What Happens Automatically:</p>
                            <ul className="text-xs text-green-900 space-y-1">
                              <li>• OAuth connection established with Shopify</li>
                              <li>• Webhooks registered for order and customer events</li>
                              <li>• Real-time order tracking enabled</li>
                              <li>• Connection takes about 30 seconds</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="flex gap-2">
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-yellow-900 mb-1">Requested Permissions:</p>
                            <p className="text-xs text-yellow-900">Shopify will show that the app requests: <strong>read_orders</strong>, <strong>read_customers</strong>, <strong>read_products</strong>, and <strong>write_webhooks</strong>. These are required for the integration to work.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        Complete Documentation
                      </h4>
                      <p className="text-sm text-gray-700 mb-3">
                        For detailed setup instructions, troubleshooting, and technical details, see the documentation files:
                      </p>
                      <div className="space-y-1 text-xs">
                        <p>• <code className="bg-gray-200 px-1 py-0.5 rounded">SHOPIFY_INTEGRATION_INDEX.md</code> - Start here</p>
                        <p>• <code className="bg-gray-200 px-1 py-0.5 rounded">SHOPIFY_APP_SETUP_COMPLETE_GUIDE.md</code> - Detailed guide</p>
                        <p>• <code className="bg-gray-200 px-1 py-0.5 rounded">SHOPIFY_URL_REFERENCE.md</code> - URL configuration</p>
                        <p>• <code className="bg-gray-200 px-1 py-0.5 rounded">SHOPIFY_OAUTH_QUICK_START.md</code> - Quick reference</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Shopify</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Real-time order tracking via webhooks
                    </p>
                  </div>
                </div>
                {integration?.status === 'connected' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
                    <Check className="w-4 h-4 mr-2" />
                    Connected
                  </span>
                ) : (
                  <Button onClick={() => setShowConnectForm(true)}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect Shopify Store
                  </Button>
                )}
              </div>
            </CardHeader>

            {integration?.status === 'connected' ? (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Shop Domain</p>
                    <p className="font-medium text-gray-900">{integration.shop_domain}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Status</p>
                    <p className="font-medium text-green-600">OAuth Connected</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Connected Since</p>
                    <p className="font-medium text-gray-900">
                      {integration.installed_at
                        ? new Date(integration.installed_at).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Last Webhook Received</p>
                    <p className="font-medium text-gray-900">
                      {integration.last_event_at
                        ? new Date(integration.last_event_at).toLocaleString()
                        : 'No events yet'}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Permissions</p>
                  <div className="flex flex-wrap gap-2">
                    {(integration.scopes || []).map((scope: string) => (
                      <span
                        key={scope}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Webhook Status</p>
                  <div className="space-y-2">
                    {integration.webhooks_registered ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-gray-700">orders/create → Active</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-gray-700">orders/paid → Active</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-gray-700">customers/create → Active</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-sm text-yellow-700 mb-3">
                          <AlertCircle className="w-4 h-4" />
                          <span>Webhooks pending registration</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleRegisterWebhooks}
                          disabled={registeringWebhooks}
                        >
                          {registeringWebhooks ? (
                            <>
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                              Registering...
                            </>
                          ) : (
                            'Register Webhooks Manually'
                          )}
                        </Button>
                      </>
                    )}
                  </div>

                  {webhookError && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-900 mb-2">Webhook Registration Error</p>
                          <pre className="text-xs text-red-800 bg-red-100 p-2 rounded overflow-x-auto">
                            {webhookError}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-green-900">
                      <p className="font-semibold mb-1">Automatically synced via Shopify webhooks</p>
                      <p>Orders are tracked in real-time. No manual setup or polling required.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="secondary" size="sm" onClick={handleDisconnect}>
                    <X className="w-4 h-4 mr-2" />
                    Disconnect Shopify
                  </Button>
                </div>
              </CardContent>
            ) : (
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No Shopify Store Connected
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Connect your Shopify store using a Custom App access token. Orders will automatically sync
                      via webhooks.
                    </p>
                    <Button onClick={() => setShowConnectForm(true)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Connect Shopify Store
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        <div className="mt-8">
          <RedemptionLinkManager clientId={clientId} />
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>API Documentation for Shopify Extensions</CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Use these API endpoints in your Shopify extensions to integrate campaigns and rewards functionality.
              </p>
              {apiConfig.environment === 'production' && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800">
                    Showing production endpoints for: <strong>{appUrl}</strong>
                  </span>
                </div>
              )}
              {apiConfig.environment === 'local' && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Local development mode - endpoints will update automatically when deployed
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ApiDocumentation
                supabaseUrl={apiConfig.functionsUrl}
                anonKey={apiConfig.anonKey}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {showConnectForm && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowConnectForm(false);
            setShopDomain('');
            setAccessToken('');
          }}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Connect Shopify Store</h2>
              <p className="text-gray-600 mt-2">
                Choose your connection method based on your Shopify app type
              </p>
            </div>

            <form onSubmit={handleConnect} className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-blue-900 mb-3">
                  Connection Method
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 bg-white border-2 border-blue-600 rounded-lg cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      value="token"
                      checked={connectionMethod === 'token'}
                      onChange={(e) => setConnectionMethod(e.target.value as 'token')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Custom App (Recommended)</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Use Admin API access token. Best for connecting your own store. Has immediate access to protected customer data.
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 bg-white border-2 border-gray-300 rounded-lg cursor-pointer opacity-60">
                    <input
                      type="radio"
                      name="method"
                      value="oauth"
                      checked={connectionMethod === 'oauth'}
                      onChange={(e) => setConnectionMethod(e.target.value as 'oauth')}
                      className="mt-0.5"
                      disabled
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Public App (OAuth)</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Requires app review for protected customer data. Currently unavailable.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shop Domain *
                </label>
                <input
                  type="text"
                  required
                  placeholder="mystore.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={connecting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter just the store name (e.g., "mystore") or full domain (e.g., "mystore.myshopify.com")
                </p>
              </div>

              {connectionMethod === 'token' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Admin API Access Token *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="shpat_xxxxxxxxxxxxx"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    disabled={connecting}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500">
                      From your custom app's API credentials page (starts with "shpat_")
                    </p>
                    <p className="text-xs text-amber-600 font-medium">
                      Important: Your custom app must have write_orders scope to register webhooks
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-900">
                    <p className="font-semibold mb-1">Custom App Setup Steps:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Settings → Apps and sales channels → Develop apps</li>
                      <li>Create app with these scopes: <strong>read_orders, write_orders, read_customers, read_products</strong></li>
                      <li>Install the app to your store</li>
                      <li>Copy the Admin API access token (starts with "shpat_")</li>
                      <li>Paste token above and connect</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={connecting}>
                  {connecting ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Connect Store
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowConnectForm(false);
                    setShopDomain('');
                    setAccessToken('');
                  }}
                  disabled={connecting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCredentialsForm && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowCredentialsForm(false);
            setApiKey('');
            setApiSecret('');
          }}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h2 className="text-2xl font-bold">Configure Shopify App Credentials</h2>
              <p className="mt-2 text-blue-100">
                Enter your Shopify app API credentials to enable OAuth connection
              </p>
            </div>

            <form onSubmit={handleSaveCredentials} className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-2">Where to find these credentials:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to your Shopify Partners dashboard</li>
                      <li>Navigate to Apps and select your app</li>
                      <li>Go to "App setup" or "Configuration"</li>
                      <li>Find the "Client credentials" section</li>
                      <li>Copy the Client ID (API Key) and Client Secret</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shopify API Key (Client ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your Shopify API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={savingCredentials}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is labeled as "Client ID" in your Shopify app settings
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shopify API Secret (Client Secret) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your Shopify API Secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={savingCredentials}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is labeled as "Client secret" in your Shopify app settings
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <p className="font-semibold mb-1">Security Notice:</p>
                    <ul className="space-y-1">
                      <li>• These credentials will be stored securely in the database</li>
                      <li>• Only use credentials from your own Shopify app</li>
                      <li>• Never share these credentials publicly</li>
                      <li>• You can update them anytime if needed</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={savingCredentials}>
                  {savingCredentials ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Save Credentials
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCredentialsForm(false);
                    setApiKey('');
                    setApiSecret('');
                  }}
                  disabled={savingCredentials}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
