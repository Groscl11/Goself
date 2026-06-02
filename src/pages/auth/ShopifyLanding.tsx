/**
 * ShopifyLanding — handles the root URL when Shopify opens the app
 *
 * Security model (enterprise-grade):
 * - Install flow: shopify-oauth-callback generates the magic link server-side and
 *   redirects through it directly to /auth/shopify-callback. This page is only
 *   reached as a fallback (e.g. magic link generation failed in oauth callback).
 * - Re-open flow: Shopify sends HMAC-signed params (?shop=&hmac=&timestamp=&host=).
 *   We navigate the browser to shopify-session-login (edge function) which verifies
 *   the HMAC server-side, generates the magic link, and issues a 302 redirect.
 *   The magic link URL never reaches client JavaScript in either flow.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL    || 'https://lizgppzyyljqbmzdytia.supabase.co';
const SHOPIFY_API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || '';

export default function ShopifyLanding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Connecting to your store...');
  const [error, setError] = useState('');

  const shop       = searchParams.get('shop');
  const hmac       = searchParams.get('hmac');
  const timestamp  = searchParams.get('timestamp');
  const handled    = searchParams.get('_handled');
  const oauthError = searchParams.get('error');

  useEffect(() => {
    handleShopifyLanding();
  }, []);

  async function handleShopifyLanding() {
    if (!shop) {
      // No Shopify shop param. Supabase may have redirected the magic link to
      // the site root (instead of /auth/shopify-callback) because that URL
      // wasn't in the project's redirect allowlist. By the time this runs,
      // _initialize() has already processed the hash token and stored the
      // session in localStorage — so we check the session directly.
      setStatus('Checking your session...');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, client_id')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile?.role === 'client') {
          setStatus('Welcome! Redirecting to your dashboard...');
          window.location.replace('/client');
          return;
        }
        if (profile?.role === 'admin') {
          window.location.replace('/admin');
          return;
        }
      }
      navigate('/login');
      return;
    }

    if (oauthError) {
      console.warn(`[ShopifyLanding] OAuth error: ${oauthError}`);
    }

    // ── Re-open flow: Shopify sends HMAC-signed params ─────────────────────
    // Navigate the browser to shopify-session-login. That edge function verifies
    // the HMAC server-side, generates the magic link, and issues a 302 redirect.
    // The magic link URL never reaches this JavaScript context.
    if (hmac && timestamp) {
      setStatus('Authenticating with Shopify...');
      const allParams = new URLSearchParams(window.location.search);
      allParams.delete('_handled'); // not part of the original Shopify-signed request
      window.location.href = `${SUPABASE_URL}/functions/v1/shopify-session-login?${allParams}`;
      return;
    }

    // ── No HMAC: check if user already has a valid session ─────────────────
    if (!handled) {
      setStatus('Checking your session...');

      // Wait for the Supabase client to restore session from localStorage.
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
        setTimeout(() => {
          if (!resolved) { resolved = true; subscription.unsubscribe(); resolve(null); }
        }, 3000);
      });

      if (initialSession?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, client_id')
          .eq('id', initialSession.user.id)
          .maybeSingle();
        if (profile?.role === 'client' || profile?.role === 'admin') {
          console.log(`[ShopifyLanding] Already authenticated (${initialSession.user.email}), skipping SSO`);
          setStatus('Already logged in! Redirecting...');
          await new Promise(r => setTimeout(r, 500));
          window.location.href = profile.role === 'admin' ? '/admin' : '/client';
          return;
        }
      }

      // Not logged in — sign out any stale session and proceed with install check
      setStatus('Preparing your account...');
      await supabase.auth.signOut();
      const url = new URL(window.location.href);
      url.searchParams.set('_handled', '1');
      window.location.replace(url.toString());
      return;
    }

    // ── _handled=1: check for existing installation ────────────────────────
    setStatus(`Verifying ${shop}...`);
    try {
      const { data: installation } = await supabase
        .from('store_installations')
        .select('installation_status')
        .eq('shop_domain', shop)
        .maybeSingle();

      if (installation?.installation_status === 'active') {
        // Installation exists but no HMAC — merchant must login manually
        console.warn('[ShopifyLanding] Installation found but no HMAC params. Sending to login.');
        navigate(`/login?shop=${shop}&from=shopify`);
        return;
      }
    } catch {}

    // ── No installation yet — poll briefly (race condition after OAuth) ─────
    console.log(`[ShopifyLanding] No installation for ${shop}. Retrying...`);
    for (let i = 0; i < 12; i++) {
      setStatus(`Connecting to ${shop}... (${i + 1}/12)`);
      await new Promise(r => setTimeout(r, 1000));
      try {
        const { data: retryInstallation } = await supabase
          .from('store_installations')
          .select('installation_status')
          .eq('shop_domain', shop)
          .maybeSingle();
        if (retryInstallation?.installation_status === 'active') {
          console.log(`[ShopifyLanding] Installation found on retry ${i + 1}, reloading`);
          window.location.reload();
          return;
        }
      } catch {}
    }

    // ── No installation after retries — trigger OAuth install flow ──────────
    setStatus('Starting Shopify installation...');
    await new Promise(r => setTimeout(r, 400));

    // Full scopes — must match shopify.app.*.toml exactly.
    // No grant_options[]=per-user → Shopify issues a permanent offline token (shpat_).
    const scopes      = 'read_customers,read_orders,read_discounts,write_discounts,read_price_rules,write_price_rules';
    const redirectUri = `${SUPABASE_URL}/functions/v1/shopify-oauth-callback`;
    const state       = btoa(JSON.stringify({ app_url: window.location.origin, ts: Date.now() }));
    const authParams  = new URLSearchParams({ client_id: SHOPIFY_API_KEY, scope: scopes, redirect_uri: redirectUri, state });
    window.location.href = `https://${shop}/admin/oauth/authorize?${authParams}`;
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
