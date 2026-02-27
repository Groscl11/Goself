/**
 * ShopifyLanding — handles the root URL when Shopify opens the app
 * Forces correct merchant login by looking up shop in database
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SHOPIFY_API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || 'b67eb82e24174ca46842cfe13df81a5d';

export default function ShopifyLanding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Connecting to your store...');

  const shop = searchParams.get('shop');
  const handled = searchParams.get('_handled');

  useEffect(() => {
    handleShopifyLanding();
  }, []);

  async function handleShopifyLanding() {
    if (!shop) {
      navigate('/login');
      return;
    }

    // Step 1: Sign out completely, then hard-reload with _handled=1 to ensure clean state
    if (!handled) {
      setStatus('Signing out previous session...');
      await supabase.auth.signOut();
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('_handled', '1');
      window.location.replace(currentUrl.toString());
      return;
    }

    // Step 2: Clean state — look up the merchant for this specific shop
    setStatus(`Looking up ${shop}...`);

    try {
      const { data: installation, error } = await supabase
        .from('store_installations')
        .select('client_id, shop_email, shop_name')
        .eq('shop_domain', shop)
        .eq('installation_status', 'active')
        .maybeSingle();

      if (error) console.error('DB lookup error:', error);

      if (installation?.shop_email) {
        setStatus(`Sending sign-in link to ${installation.shop_email}...`);

        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: installation.shop_email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/shopify-callback?shop=${shop}&client_id=${installation.client_id}`,
          }
        });

        if (!otpError) {
          setStatus('Check your email for a sign-in link!');
          setTimeout(() => {
            navigate(`/login?shop=${shop}&from=shopify&email_sent=true`);
          }, 1500);
          return;
        } else {
          console.error('OTP error:', otpError);
          setStatus('Error sending link. Redirecting...');
          setTimeout(() => navigate(`/login?shop=${shop}&from=shopify`), 2000);
          return;
        }
      }
    } catch (e) {
      console.error('Store lookup failed:', e);
    }

    // Not installed yet — trigger OAuth
    setStatus('Starting Shopify installation...');
    await new Promise(r => setTimeout(r, 500));

    const scopes = [
      'read_orders','write_orders','read_customers','write_customers',
      'read_products','write_products','read_checkouts','write_checkouts',
      'read_discounts','write_discounts','read_price_rules','write_price_rules',
      'read_analytics','read_reports','write_reports',
      'read_script_tags','write_script_tags','read_themes','write_themes',
      'read_marketing_events','write_marketing_events','read_pixels','write_pixels',
    ].join(',');

    const redirectUri = `${SUPABASE_URL}/functions/v1/shopify-oauth-callback`;
    const state = btoa(JSON.stringify({ app_url: window.location.origin, ts: Date.now() }));
    const oauthUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    window.location.href = oauthUrl;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Loyalty by Goself</h1>
          {shop && <p className="text-slate-400 text-sm mt-1">{shop}</p>}
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 text-sm">{status}</p>
        </div>
        <p className="text-slate-500 text-xs mt-8">Powered by Goself · Loyalty & Rewards Platform</p>
      </div>
    </div>
  );
}
