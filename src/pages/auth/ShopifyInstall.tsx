/**
 * ShopifyInstall — embedded managed-installation bootstrap
 *
 * Shopify App URL target (application_url = .../shopify/install) for the managed
 * install flow (use_legacy_install_flow = false). Shopify loads this EMBEDDED and
 * provides a session token. We:
 *   1. Obtain the Shopify session token (URL id_token, then App Bridge)
 *   2. POST it to shopify-token-exchange (creates store_installations + profile)
 *   3. Break out of the iframe to the returned magic link → /auth/shopify-callback (SSO)
 *
 * IMPORTANT: App Bridge v4 strips shop/host/id_token from the URL when it
 * initializes, and may reload the iframe. So we capture shop/host into
 * sessionStorage on first paint (before App Bridge can strip them), and we can
 * also recover the shop from App Bridge's own config (window.shopify.config.shop)
 * or by decoding the `host` param. Safety net: if no token is obtainable, fall
 * back to the legacy /admin/oauth/authorize grant (still persists via oauth-callback).
 */

import { useEffect, useRef, useState } from 'react';

const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL    || '';
const SHOPIFY_API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || '';
const OAUTH_SCOPES    = 'read_customers,read_orders,read_discounts,write_discounts,read_price_rules,write_price_rules';

// ── Capture Shopify params at module load, BEFORE App Bridge can strip the URL ──
const INITIAL = new URLSearchParams(window.location.search);
const SS_KEY = 'goself_shopify_install';
(() => {
  const shop = INITIAL.get('shop') || '';
  const host = INITIAL.get('host') || '';
  if (shop || host) {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ shop, host, ts: Date.now() })); } catch { /* ignore */ }
  }
})();

function stashed(): { shop: string; host: string } {
  try { const v = JSON.parse(sessionStorage.getItem(SS_KEY) || '{}'); return { shop: v.shop || '', host: v.host || '' }; }
  catch { return { shop: '', host: '' }; }
}

/** Decode the Shopify `host` param → shop domain. host = base64(admin.shopify.com/store/<name>) */
function shopFromHost(host: string): string {
  if (!host) return '';
  try {
    const decoded = atob(host.replace(/-/g, '+').replace(/_/g, '/'));
    const m = decoded.match(/\/store\/([^/?#]+)/);
    if (m) return `${m[1]}.myshopify.com`;
    // older host form: <shop>.myshopify.com/admin
    const m2 = decoded.match(/^([^/]+\.myshopify\.com)/);
    if (m2) return m2[1];
  } catch { /* ignore */ }
  return '';
}

function resolveShop(): string {
  const fromUrl = INITIAL.get('shop') || '';
  if (fromUrl) return fromUrl;
  const s = stashed();
  if (s.shop) return s.shop;
  const w = window as any;
  if (w.shopify?.config?.shop) return w.shopify.config.shop;
  return shopFromHost(INITIAL.get('host') || s.host || '');
}

const isFramed = (() => { try { return window.top && window.top !== window.self; } catch { return true; } })();

/**
 * Break out of Shopify's iframe to an external URL.
 *
 * CRITICAL: when framed we ONLY ever navigate the TOP frame — never this iframe.
 * Navigating the iframe itself (window.location.href) would load the dashboard
 * EMBEDDED inside Shopify admin. And Shopify's iframe blocks *programmatic* top
 * navigation (it requires a user gesture), so an automatic attempt may silently
 * do nothing — that's expected; the visible "Continue" button (a native
 * target="_top" link) lets the merchant break out with a single click.
 */
function breakoutTo(url: string) {
  if (!isFramed) { window.location.href = url; return; } // standalone — self IS top
  try { window.top!.location.href = url; return; } catch { /* needs user gesture */ }
  try { window.open(url, '_top'); } catch { /* popup blocked — Continue button handles it */ }
}

/** Load App Bridge v4 and resolve once window.shopify is ready (or null on failure). */
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
    const ready = () => resolve((window as any).shopify ?? null);
    const existing = document.querySelector('script[data-shopify-app-bridge]') as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', ready); }
    else {
      const s = document.createElement('script');
      s.src = 'https://cdn.shopify.com/shopifycloud/app-bridge.js';
      s.setAttribute('data-shopify-app-bridge', '1');
      s.onload = ready;
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    }
    setTimeout(() => resolve((window as any).shopify ?? null), 4000);
  });
}

async function getSessionToken(): Promise<string> {
  // 1. URL id_token (present on some embedded loads)
  const urlToken = INITIAL.get('id_token') || '';
  if (urlToken) return urlToken;
  // 2. App Bridge — the reliable, refreshable source
  const bridge = await loadAppBridge();
  if (bridge?.idToken) {
    try { const t = await bridge.idToken(); if (t) return t; } catch { /* ignore */ }
  }
  return '';
}

export default function ShopifyInstall() {
  const [status, setStatus] = useState('Setting up your store…');
  const [error, setError] = useState('');
  // When SSO is ready we always surface a clickable link — a user click guarantees
  // the top-frame breakout works even if programmatic navigation is blocked.
  const [continueUrl, setContinueUrl] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      setStatus('Connecting to Shopify…');
      const sessionToken = await getSessionToken();
      const shop = resolveShop();

      if (!shop) { setError('We could not determine your store. Please reopen the app from Shopify admin.'); return; }

      // No session token → legacy OAuth grant fallback (still persists the install)
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
          try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
          // Surface a clickable link immediately (popup-blocked safety net), then
          // attempt the automatic breakout.
          setContinueUrl(data.redirect);
          breakoutTo(data.redirect);
          return;
        }
        if (data?.success && !data.redirect) {
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

  const manualShop = resolveShop();

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
            {continueUrl ? (
              <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            ) : (
              <div style={{
                width: 48, height: 48, margin: '0 auto 20px', borderRadius: '50%',
                border: '3px solid #dbeafe', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite',
              }} />
            )}
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              {continueUrl ? 'You’re all set 🎉' : 'Almost there'}
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              {continueUrl ? 'Open your GoSelf dashboard to continue.' : status}
            </p>
            {continueUrl && (
              // Native target="_top" anchor — a user click is the one reliable way
              // to break out of Shopify's iframe (satisfies the user-gesture
              // requirement for top-frame navigation). No JS override.
              <a
                href={continueUrl}
                target="_top"
                rel="noopener"
                style={{
                  display: 'inline-block', marginTop: 20, background: '#2563eb', color: '#fff',
                  textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                }}
              >
                Open Dashboard →
              </a>
            )}
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Setup needs a hand</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>{error}</p>
            <a
              href={`/login?shop=${encodeURIComponent(manualShop)}&from=shopify`}
              onClick={(e) => { e.preventDefault(); breakoutTo(`${window.location.origin}/login?shop=${encodeURIComponent(manualShop)}&from=shopify`); }}
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
