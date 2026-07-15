/**
 * useShopifySession — fires once when the embedded dashboard mounts inside
 * the Shopify admin frame.
 *
 * What it does:
 *  1. Detects App Bridge (window.shopify.idToken) — no-ops if not embedded.
 *  2. Gets a fresh session token from App Bridge.
 *  3. POSTs it to shopify-token-exchange with Authorization: Bearer.
 *     → Shopify App Store scanner expects this pattern on ongoing backend calls.
 *  4. If the exchange returns fresh Supabase tokens, silently refreshes the session.
 */

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

async function loadAppBridge(): Promise<any | null> {
  return new Promise((resolve) => {
    const w = window as any;
    if (w.shopify?.idToken) return resolve(w.shopify);
    const existing = document.querySelector('script[data-shopify-app-bridge]') as HTMLScriptElement | null;
    if (!existing) return resolve(null);
    existing.addEventListener('load', () => resolve((window as any).shopify ?? null));
    setTimeout(() => resolve((window as any).shopify ?? null), 3000);
  });
}

export function useShopifySession() {
  useEffect(() => {
    let cancelled = false;

    async function pingSessionToken() {
      // Skip if already authenticated — avoids a redundant setSession() call that
      // would trigger onAuthStateChange → setLoading(true) → unnecessary loading flash.
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing || cancelled) return;

      const w = window as any;
      const bridge = w.shopify ?? (await loadAppBridge());
      if (!bridge?.idToken) return;

      let sessionToken: string;
      try {
        sessionToken = await bridge.idToken();
        if (!sessionToken) return;
      } catch {
        return;
      }

      const shopDomain = (bridge as any).config?.shop as string | undefined;
      if (!shopDomain) return;

      if (cancelled) return;

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/shopify-token-exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ session_token: sessionToken, shop: shopDomain }),
        });

        if (!res.ok || cancelled) return;

        const data = await res.json().catch(() => null);
        if (data?.success && data.access_token && !cancelled) {
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token || '',
          });
        }
      } catch {
        // fire-and-forget — never surface errors to the UI
      }
    }

    pingSessionToken();
    return () => { cancelled = true; };
  }, []);
}
