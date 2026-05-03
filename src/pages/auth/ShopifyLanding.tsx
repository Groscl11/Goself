/**
 * ShopifyLanding — handles the root URL when Shopify opens the app
 * Signs out existing session, finds merchant by shop, creates auth user if needed, sends magic link
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseAnonKey } from '../../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lizgppzyyljqbmzdytia.supabase.co';
const SHOPIFY_API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || '3290e6e4e5cb6711e4a7876ef40f87e8';

export default function ShopifyLanding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Connecting to your store...');
  const [error, setError] = useState('');

  const shop = searchParams.get('shop');
  const handled = searchParams.get('_handled');
  const oauthError = searchParams.get('error');

  useEffect(() => {
    handleShopifyLanding();
  }, []);

  async function handleShopifyLanding() {
    if (!shop) {
      navigate('/login');
      return;
    }

    // If OAuth returned an error param, show it but still try to find the installation
    if (oauthError) {
      console.warn(`OAuth error param received: ${oauthError}`);
      setStatus('Verifying installation...');
    }

    // Step 1: Check if user is already logged in for this shop — if so, skip everything
    if (!handled) {
      setStatus('Checking your session...');

      // supabase.auth.getSession() can return null on first load before the client
      // has finished restoring the session from localStorage (async).
      // We MUST wait for the INITIAL_SESSION event to get the true auth state.
      const initialSession = await new Promise<Session | null>((resolve) => {
        let resolved = false;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (resolved) return;
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            resolved = true;
            subscription.unsubscribe();
            resolve(session ?? null);
          }
        });
        // Safety fallback: if INITIAL_SESSION never fires, fall through after 3s
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            subscription.unsubscribe();
            resolve(null);
          }
        }, 3000);
      });

      if (initialSession?.user) {
        // User is already authenticated — check they have a profile with client role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, client_id')
          .eq('id', initialSession.user.id)
          .maybeSingle();
        if (profile?.role === 'client' || profile?.role === 'admin') {
          console.log(`ShopifyLanding: Already authenticated (${initialSession.user.email}), skipping SSO`);
          setStatus('Already logged in! Redirecting...');
          await new Promise(r => setTimeout(r, 500));
          window.location.href = profile.role === 'admin' ? '/admin' : '/client';
          return;
        }
      }

      // Not logged in (or no valid profile) — sign out any stale session and proceed
      setStatus('Preparing your account...');
      await supabase.auth.signOut();
      const url = new URL(window.location.href);
      url.searchParams.set('_handled', '1');
      window.location.replace(url.toString());
      return;
    }

    // Step 2: Session cleared — look up merchant by shop domain
    setStatus(`Verifying ${shop}...`);

    try {
      console.log(`ShopifyLanding: Looking up store_installation for shop_domain=${shop}`);
      
      const { data: installation, error: dbError } = await supabase
        .from('store_installations')
        .select('client_id, shop_email, shop_name, shop_owner, installation_status')
        .eq('shop_domain', shop)
        .maybeSingle();

      if (dbError) {
        console.error('Database error:', dbError);
      }

      console.log(`ShopifyLanding: Found installation:`, installation);

      // Generate magic link immediately if installation exists and is active
      // (even if enrichment hasn't updated with real email yet)
      if (installation?.installation_status === 'active' && installation?.shop_email) {
        const email = installation.shop_email;
        const clientId = installation.client_id;

        setStatus(`Welcome back, ${installation.shop_name || shop}!`);
        await new Promise(r => setTimeout(r, 500));
        setStatus('Generating your secure login...');

        // Call our edge function to create user + generate magic link server-side
        const res = await fetch(`${SUPABASE_URL}/functions/v1/shopify-merchant-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            shop_domain: shop,
            email,
            client_id: clientId,
            shop_name: installation.shop_name,
            shop_owner: installation.shop_owner,
            redirect_to: `${window.location.origin}/auth/shopify-callback?shop=${shop}${clientId ? `&client_id=${clientId}` : ''}`,
          })
        });

        const data = await res.json();

        if (data.magic_link) {
          setStatus('Logging you in...');
          // Redirect through the magic link — auto login, no email needed!
          window.location.href = data.magic_link;
          return;
        }

        if (data.email_sent) {
          setStatus('Check your email for a sign-in link!');
          setTimeout(() => navigate(`/login?shop=${shop}&from=shopify&email_sent=true`), 1500);
          return;
        }

        throw new Error(data.error || 'Login failed');
      }
    } catch (e: any) {
      console.error('Merchant login error:', e);
      // Installation not found or error occurred — trigger OAuth install flow
    }

    // Installation not found yet — may be a race condition right after OAuth
    // Wait up to 12 seconds for the store installation record to be created
    console.log(`ShopifyLanding: Installation not found for ${shop}. Retrying...`);
    for (let i = 0; i < 12; i++) {
      setStatus(`Connecting to ${shop}... (${i + 1}/12)`);
      await new Promise(r => setTimeout(r, 1000));
      try {
        const { data: retryInstallation } = await supabase
          .from('store_installations')
          .select('client_id, shop_email, shop_name, shop_owner, installation_status')
          .eq('shop_domain', shop)
          .maybeSingle();
        if (retryInstallation?.installation_status === 'active') {
          console.log(`ShopifyLanding: Installation found on retry ${i + 1}, reloading page`);
          window.location.reload();
          return;
        }
      } catch (_) {}
    }

    // Truly no installation — trigger OAuth install flow
    console.log(`ShopifyLanding: No installation after retries. Triggering OAuth for ${shop}`);
    setStatus('Starting Shopify installation...');
    await new Promise(r => setTimeout(r, 500));

    // Must match app.toml exactly — any mismatch triggers Shopify "misconfigured" error
    const scopes = 'read_customers,read_orders,read_discounts,write_discounts';

    const redirectUri = `${SUPABASE_URL}/functions/v1/shopify-oauth-callback`;
    const state = btoa(JSON.stringify({ app_url: window.location.origin, ts: Date.now() }));
    const oauthUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
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
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <p className="text-slate-500 text-xs mt-8">Powered by Goself · Loyalty & Rewards Platform v3</p>
      </div>
    </div>
  );
}