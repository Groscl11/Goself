/**
 * ShopifyCallback — SSO landing page
 *
 * Flow:
 * 1. shopify-session-login → magic link → Supabase /verify → 303
 * 2. Browser lands here: /auth/shopify-callback?shop=...&client_id=...#access_token=...
 *
 * Auth approach:
 * - Capture hash tokens synchronously at mount (before Supabase async-clears the hash)
 * - Call setSession() with captured tokens to establish the session in localStorage
 * - Fall back to getSession() if Supabase already processed the hash before mount
 * - Fall back to onAuthStateChange if neither worked
 * - After session is confirmed: upsert profile + store_users, then
 *   window.location.replace('/client') — a full page reload so AuthContext
 *   reads the session from localStorage fresh, exactly like email/password login.
 *   No React state timing races.
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

  // Capture hash tokens synchronously at mount — before Supabase's async
  // _initialize() clears them via window.history.replaceState.
  const [hashTokens] = useState(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    return {
      accessToken: params.get('access_token'),
      refreshToken: params.get('refresh_token'),
    };
  });

  useEffect(() => {
    handleSSOCallback();
  }, []);

  async function handleSSOCallback() {
    setMessage('Verifying your Shopify credentials...');

    try {
      let userId: string | null = null;
      let userEmail: string | null = null;

      // ── Path A: hash tokens captured at mount ──────────────────────────────
      if (hashTokens.accessToken && hashTokens.refreshToken) {
        const { data: { session }, error } = await supabase.auth.setSession({
          access_token: hashTokens.accessToken,
          refresh_token: hashTokens.refreshToken,
        });
        if (error) throw error;
        if (session?.user) {
          userId = session.user.id;
          userEmail = session.user.email!;
        }
      }

      // ── Path B: Supabase already processed the hash before mount ───────────
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          userId = session.user.id;
          userEmail = session.user.email!;
        }
      }

      // ── Path C: wait for auth state change ─────────────────────────────────
      if (!userId) {
        setMessage('Authenticating with Shopify...');

        const result = await new Promise<{ id: string; email: string } | null>((resolve) => {
          let called = false;

          const timeoutId = setTimeout(() => {
            if (!called) { called = true; subscription.unsubscribe(); resolve(null); }
          }, 12000);

          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
              if (called) return;
              if (!session?.user || _event === 'SIGNED_OUT') return;
              if (_event !== 'INITIAL_SESSION' && _event !== 'SIGNED_IN') return;
              called = true;
              clearTimeout(timeoutId);
              subscription.unsubscribe();
              resolve({ id: session.user.id, email: session.user.email! });
            }
          );
        });

        if (result) {
          userId = result.id;
          userEmail = result.email;
        }
      }

      if (!userId || !userEmail) {
        throw new Error('Authentication timed out. Could not establish session.');
      }

      await completeLogin(userId, userEmail);

    } catch (err: any) {
      console.error('[ShopifyCallback] SSO error:', err);
      setStatus('error');
      setMessage('Something went wrong. Redirecting to login...');
      setTimeout(() => {
        window.location.replace(`/login?shop=${encodeURIComponent(shop || '')}&from=shopify`);
      }, 2000);
    }
  }

  async function completeLogin(userId: string, email: string) {
    setMessage('Loading your merchant profile...');

    try {
      // Upsert profile client-side (edge function already did this server-side,
      // this is a safety net in case the server-side upsert was missed)
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          role: 'client',
          ...(clientId ? { client_id: clientId } : {}),
        }, { onConflict: 'id', ignoreDuplicates: false });

      // Link store_users row to this auth session
      await supabase
        .from('store_users')
        .update({ auth_user_id: userId, last_login_at: new Date().toISOString() })
        .eq('email', email)
        .is('auth_user_id', null);

    } catch (err) {
      // Non-fatal — edge function already upserted the profile server-side
      console.warn('[ShopifyCallback] Profile sync warning:', err);
    }

    // Session is now in localStorage. Do a full page replace to /client so
    // AuthContext reads it fresh on load — no React state timing races.
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
