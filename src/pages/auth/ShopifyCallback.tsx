/**
 * ShopifyCallback — SSO landing page
 *
 * Flow:
 * 1. shopify-session-login → magic link → Supabase /verify → 303
 * 2. Browser lands here: /auth/shopify-callback?shop=...&client_id=...#access_token=...
 *
 * Auth approach:
 * Supabase's _initialize() automatically detects #access_token in the URL hash
 * and establishes the session in localStorage. We register onAuthStateChange
 * SYNCHRONOUSLY in useEffect (before any awaits) so we never miss the SIGNED_IN
 * or INITIAL_SESSION event. We also call getSession() immediately as a fallback
 * in case _initialize() already completed before our listener was registered.
 *
 * Once we have a valid session → upsert profile + store_users →
 * window.location.replace('/client') for a clean page load.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ShopifyCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Setting up your Goself dashboard...');

  const shop = searchParams.get('shop');
  const clientId = searchParams.get('client_id');

  useEffect(() => {
    let done = false;
    let timer: ReturnType<typeof setTimeout>;

    async function processSession(userId: string, email: string) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      await completeLogin(userId, email);
    }

    // ── 1. Register listener SYNCHRONOUSLY before any awaits ─────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (done || !session?.user) return;
        if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
        await processSession(session.user.id, session.user.email!);
      }
    );

    // ── 2. Explicit setSession() for the client-side navigation case ─────────
    // When the SPA navigates HERE via React Router (without a full page reload),
    // _initialize() already ran at /shopify/install and won't re-process the
    // new #access_token hash. We extract it manually and call setSession().
    //
    // CRITICAL: Do NOT strip the hash before setSession() resolves.
    // _initialize() reads window.location.hash asynchronously; stripping it
    // early (before the lock is acquired) means _initialize() finds an empty
    // hash, fires INITIAL_SESSION(null), and leaves no session in localStorage.
    // Strip the hash inside .then() — after the token has been processed.
    const rawHash = window.location.hash;
    if (rawHash.includes('access_token=')) {
      const params = new URLSearchParams(rawHash.substring(1));
      const access_token = params.get('access_token') || '';
      const refresh_token = params.get('refresh_token') || '';
      if (access_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data }) => {
          // Strip hash AFTER processing to prevent credential bookmarking
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          if (data.session?.user && !done) {
            processSession(data.session.user.id, data.session.user.email!);
          }
        });
      }
    }

    // ── 3. getSession() fallback ──────────────────────────────────────────────
    // getSession() acquires the same internal lock as _initialize(), so it always
    // waits for _initialize() to complete. If _initialize() processed the
    // #access_token from the URL, this returns the merchant session immediately.
    // This covers the race where _initialize() fires SIGNED_IN before our
    // onAuthStateChange listener was registered (listener misses the event).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !done) {
        processSession(session.user.id, session.user.email!);
      }
    });

    // ── 4. Timeout fallback ───────────────────────────────────────────────────
    timer = setTimeout(() => {
      if (!done) {
        done = true;
        subscription.unsubscribe();
        setStatus('error');
        setMessage('Authentication timed out. Please log in manually.');
        setTimeout(() => {
          window.location.replace(
            `/login?shop=${encodeURIComponent(shop || '')}&from=shopify`
          );
        }, 2000);
      }
    }, 15000);

    return () => {
      done = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function completeLogin(userId: string, email: string) {
    setMessage('Loading your merchant profile...');

    try {
      // Safety-net upsert — edge function already set client_id server-side
      // via service_role. We intentionally do NOT spread client_id from the
      // URL here: a crafted callback URL could reassign this profile to any
      // tenant (C-12 in the InfoSec audit). client_id is only ever set
      // server-side by shopify-session-login / shopify-oauth-callback.
      await supabase
        .from('profiles')
        .upsert(
          { id: userId, email, role: 'client' },
          { onConflict: 'id', ignoreDuplicates: true }  // ignoreDuplicates: don't overwrite existing fields
        );

      // Link store_users to this auth session
      await supabase
        .from('store_users')
        .update({ auth_user_id: userId, last_login_at: new Date().toISOString() })
        .eq('email', email)
        .is('auth_user_id', null);

    } catch (err) {
      // Non-fatal — profile was already upserted server-side by the edge function
      console.warn('[ShopifyCallback] Profile sync warning:', err);
    }

    // Session is in localStorage. Full page replace → AuthContext reads it
    // fresh on load, exactly like email/password login. No React timing races.
    setStatus('success');
    setMessage('Welcome! Redirecting to your dashboard...');
    setTimeout(() => {
      window.location.replace('/client');
    }, 600);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">

        {/* Goself Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Loyalty by Goself</h1>
          {shop && <p className="text-slate-400 text-sm mt-1">{shop}</p>}
        </div>

        {/* Status */}
        <div className="mb-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-300 text-sm">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-400 font-medium">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="text-red-400 text-sm">{message}</p>
            </div>
          )}
        </div>

        {/* Steps indicator */}
        <div className="flex justify-center gap-2 mt-4">
          {['Shopify', 'Verify', 'Dashboard'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                status === 'loading' && i === 1 ? 'bg-violet-400 animate-pulse' :
                status === 'success' ? 'bg-green-400' :
                i === 0 ? 'bg-violet-400' : 'bg-slate-600'
              }`} />
              {i < 2 && <div className="w-4 h-px bg-slate-600" />}
            </div>
          ))}
        </div>

        <p className="text-slate-500 text-xs mt-6">
          Powered by Goself · Loyalty & Rewards Platform
        </p>
      </div>
    </div>
  );
}
