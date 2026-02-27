/**
 * ShopifyLanding — handles the root URL when Shopify opens the app
 *
 * Shopify calls your App URL with:
 *   ?hmac=...&host=...&shop=STORE.myshopify.com&timestamp=...
 *
 * Two cases:
 * 1. Merchant already has a session → redirect to /client dashboard
 * 2. No session → trigger OAuth install flow → SSO magic link → /client
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const SUPABASE_URL = 'https://lizgppzyyljqbmzdytia.supabase.co';
const SHOPIFY_API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || '';

export default function ShopifyLanding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Connecting to your store...');

  const shop = searchParams.get('shop');
  const host = searchParams.get('host');
  const hmac = searchParams.get('hmac');
  const timestamp = searchParams.get('timestamp');

  useEffect(() => {
    handleShopifyLanding();
  }, []);

  async function handleShopifyLanding() {
    if (!shop) {
      // No Shopify params — just redirect to login
      navigate('/login');
      return;
    }

    setStatus(`Connecting to ${shop}...`);

    // Check if this merchant already has an active session
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      // Already logged in — check if their profile matches this shop
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, client_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.role === 'client' || profile?.role === 'admin') {
        setStatus('Welcome back! Loading your dashboard...');
        await new Promise(r => setTimeout(r, 600));
        navigate(profile.role === 'admin' ? '/admin' : '/client');
        return;
      }
    }

    // No session — check if shop is already installed (has a client record)
    try {
      setStatus('Checking store installation...');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-loyalty-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_domain: shop, check_installation: true })
      });
      const data = await res.json();

      if (data.installed && data.merchant_email) {
        // Shop is installed — send magic link to merchant email
        setStatus('Sending you a sign-in link...');
        const { error } = await supabase.auth.signInWithOtp({
          email: data.merchant_email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/shopify-callback?shop=${shop}&client_id=${data.client_id}`,
          }
        });

        if (!error) {
          setStatus('Check your email for a sign-in link!');
          navigate(`/login?shop=${shop}&from=shopify&email_sent=true`);
          return;
        }
      }
    } catch (e) {
      // Installation check failed — proceed to OAuth
    }

    // Trigger Shopify OAuth install flow
    setStatus('Starting Shopify authentication...');
    await new Promise(r => setTimeout(r, 500));

    const scopes = [
      'read_orders', 'write_orders',
      'read_customers', 'write_customers',
      'read_products', 'write_products',
      'read_checkouts', 'write_checkouts',
      'read_discounts', 'write_discounts',
      'read_price_rules', 'write_price_rules',
      'read_analytics', 'read_reports', 'write_reports',
      'read_script_tags', 'write_script_tags',
      'read_themes', 'write_themes',
      'read_marketing_events', 'write_marketing_events',
      'read_pixels', 'write_pixels',
    ].join(',');

    const redirectUri = `${SUPABASE_URL}/functions/v1/shopify-oauth-callback`;
    const state = btoa(JSON.stringify({ app_url: window.location.origin, ts: Date.now() }));

    const oauthUrl = `https://${shop}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_API_KEY}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;

    window.location.href = oauthUrl;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">

        {/* Logo */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Loyalty by Goself</h1>
          {shop && <p className="text-slate-400 text-sm mt-1">{shop}</p>}
        </div>

        {/* Spinner + status */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 text-sm">{status}</p>
        </div>

        <p className="text-slate-500 text-xs mt-8">
          Powered by Goself · Loyalty & Rewards Platform
        </p>
      </div>
    </div>
  );
}
