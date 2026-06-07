/**
 * ShopifyInstall — embedded managed-installation bootstrap
 *
 * This is the Shopify App URL target (application_url = .../shopify/install) for the
 * managed-install flow (use_legacy_install_flow = false). Shopify loads it EMBEDDED
 * inside admin and provides a session token (id_token). We:
 *
 *   1. Obtain the Shopify session token (URL id_token param, App Bridge fallback)
 *   2. POST it to the shopify-token-exchange edge function, which exchanges it for an
 *      offline access token and creates store_installations + the merchant profile
 *   3. Break out of the Shopify iframe to the returned magic link → /auth/shopify-callback
 *      establishes the dashboard session (SSO)
 *
 * Safety net: if we cannot get a session token (App Bridge unavailable / id_token
 * missing), we fall back to the legacy authorization-code grant by redirecting the
 * top window to /admin/oauth/authorize, which hits shopify-oauth-callback.
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL    || '';
const SHOPIFY_API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || '';
const OAUTH_SCOPES    = 'read_customers,read_orders,read_discounts,write_discounts,read_price_rules,write_price_rules';

/** Navigate the TOP window (break out of Shopify's iframe) to an external URL. */
function breakoutTo(url: string) {
  try {
    // Preferred: open in the top frame. Works cross-origin for embedded apps.
    window.open(url, '_top');
  } catch {
    try { (window.top || window).location.href = url; }
    catch { window.location.href = url; }
  }
}

/** Load Shopify App Bridge v4 from the CDN and resolve once window.shopify is ready. */
function loadAppBridge(): Promise<any | null> {
  return new Promise((resolve) => {
    const w = window as any;
    if (w.shopify?.idToken) return resolve(w.shopify);
    if (!SHOPIFY_API_KEY) return resolve(null);

    if (!document.querySelector('meta[name="shopify-api-key"]')) {
      const meta = document.createElement('meta');
      meta.name = 'shopify-api-key';
      meta.content = SHOPIFY_API_KEY;
      document.head.appendChild(meta);
    }
    const existing = document.querySelector('script[data-shopify-app-bridge]') as HTMLScriptElement | null;
    const onReady = () => resolve((window as any).shopify ?? null);

    if (existing) { existing.addEventListener('load', onReady); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.shopify.com/shopifycloud/app-bridge.js';
    s.setAttribute('data-shopify-app-bridge', '1');
    s.onload = onReady;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);

    // Hard timeout so we never hang the install
    setTimeout(() => resolve((window as any).shopify ?? null), 4000);
  });
}

export default function ShopifyInstall() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('Setting up your store…');
  const [error, setError] = useState('');
  const ran = useRef(false);

  const shop    = params.get('shop') || '';
  const host    = params.get('host') || '';
  const idToken = params.get('id_token') || '';

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      if (!shop) { setError('Missing shop parameter. Please reopen the app from Shopify.'); return; }

      // 1. Obtain a session token: URL id_token first (present on embedded load),
      //    then App Bridge as a refreshable fallback.
      let sessionToken = idToken;
      if (!sessionToken) {
        setStatus('Connecting to Shopify…');
        const bridge = await loadAppBridge();
        if (bridge?.idToken) {
          try { sessionToken = await bridge.idToken(); } catch { /* fall through */ }
        }
      }

      // 2. No session token available → fall back to the legacy OAuth grant,
      //    which still persists the install via shopify-oauth-callback.
      if (!sessionToken) {
        setStatus('Authorizing…');
        const state = btoa(JSON.stringify({ app_url: window.location.origin, ts: Date.now() }));
        const redirectUri = `${SUPABASE_URL}/functions/v1/shopify-oauth-callback`;
        const authorizeUrl =
          `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(SHOPIFY_API_KEY)}` +
          `&scope=${encodeURIComponent(OAUTH_SCOPES)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&state=${encodeURIComponent(state)}`;
        breakoutTo(authorizeUrl);
        return;
      }

      // 3. Exchange the session token for an access token + persist the install.
      setStatus('Finalizing installation…');
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/shopify-token-exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: sessionToken, shop, app_url: window.location.origin }),
        });
        const data = await res.json().catch(() => ({}));

        if (data?.success && data.redirect) {
          setStatus('Signing you in…');
          breakoutTo(data.redirect);            // → magic link → /auth/shopify-callback
          return;
        }
        if (data?.success && !data.redirect) {
          // Install saved but SSO link unavailable — send to manual login.
          breakoutTo(`${window.location.origin}/login?shop=${encodeURIComponent(shop)}&from=shopify`);
          return;
        }
        throw new Error(data?.error || 'Token exchange failed');
      } catch (e: any) {
        console.error('[ShopifyInstall] exchange error:', e?.message ?? e);
        setError('We could not complete the installation automatically. You can sign in manually below.');
      }
    }

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#eff6ff,#ecfeff)', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 48px', maxWidth: 420, width: '90%',
        textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
      }}>
        {!error ? (
          <>
            <div style={{
              width: 48, height: 48, margin: '0 auto 20px', borderRadius: '50%',
              border: '3px solid #dbeafe', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite',
            }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Almost there</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>{status}</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
              {shop ? `Connecting ${shop}` : ''}
            </p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Setup needs a hand</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>{error}</p>
            <a
              href={`/login?shop=${encodeURIComponent(shop)}&from=shopify`}
              onClick={(e) => { e.preventDefault(); breakoutTo(`${window.location.origin}/login?shop=${encodeURIComponent(shop)}&from=shopify`); }}
              style={{
                display: 'inline-block', background: '#2563eb', color: '#fff', textDecoration: 'none',
                padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              }}
            >
              Continue to sign in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
