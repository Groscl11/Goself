/**
 * ShopifyCallback — SSO landing page
 *
 * Flow:
 * 1. shopify-session-login → magic link → Supabase /verify → 303
 * 2. Browser lands here: /auth/shopify-callback?shop=...&client_id=...#access_token=...
 *
 * Auth approach (handles all timing races):
 * - Capture the hash tokens synchronously at mount time (before Supabase async-clears the hash)
 * - Call setSession() directly with the captured tokens — this always fires SIGNED_IN
 * - If no hash tokens (Supabase cleared the hash before mount), fall back to getSession()
 *   or onAuthStateChange with both INITIAL_SESSION and SIGNED_IN accepted
 *
 * Navigation is only triggered when AuthContext profile.id === the authenticated userId,
 * which is immune to SIGNED_OUT→SIGNED_IN race conditions during user switching.
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function ShopifyCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Setting up your Goself dashboard...');
  const [expectedUserId, setExpectedUserId] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shop = searchParams.get('shop');
  const clientId = searchParams.get('client_id');

  // Capture hash tokens synchronously at mount time — before Supabase's async
  // _initialize() clears them. This is the most reliable way to get them.
  const [hashTokens] = useState(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    return {
      accessToken: params.get('access_token'),
      refreshToken: params.get('refresh_token'),
    };
  });

  // Navigate only when AuthContext confirms the correct user's profile is loaded.
  useEffect(() => {
    if (!expectedUserId) return;
    if (loading) return;
    if (profile && profile.id === expectedUserId) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      navigate('/client', { replace: true });
    }
    // If profile is null or mismatched (transient SIGNED_OUT state), wait.
  }, [expectedUserId, loading, profile]);

  // Start error fallback timer once we know which user to expect.
  useEffect(() => {
    if (!expectedUserId) return;

    errorTimerRef.current = setTimeout(() => {
      if (!profile || profile.id !== expectedUserId) {
        setStatus('error');
        setMessage('Could not load your profile. Please log in manually.');
        setTimeout(() => {
          navigate(`/login?shop=${shop}&from=shopify`, { replace: true });
        }, 2000);
      }
    }, 10000);

    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [expectedUserId]);

  useEffect(() => {
    handleSSOCallback();
  }, []);

  async function handleSSOCallback() {
    setMessage('Verifying your Shopify credentials...');

    try {
      // ── Path A: hash tokens captured at mount ──────────────────────────────
      // setSession() explicitly sets the new session and fires SIGNED_IN,
      // bypassing all onAuthStateChange timing uncertainty.
      if (hashTokens.accessToken && hashTokens.refreshToken) {
        const { data: { session }, error } = await supabase.auth.setSession({
          access_token: hashTokens.accessToken,
          refresh_token: hashTokens.refreshToken,
        });
        if (error) throw error;
        if (session?.user) {
          await completeLogin(session.user.id, session.user.email!);
          return;
        }
      }

      // ── Path B: hash was cleared before mount (Supabase processed it first) ─
      // The session is already established — getSession() returns it directly.
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession?.user) {
        await completeLogin(existingSession.user.id, existingSession.user.email!);
        return;
      }

      // ── Path C: session not yet established — wait for auth events ──────────
      // Accepts both INITIAL_SESSION (hash processed during init) and SIGNED_IN.
      setMessage('Authenticating with Shopify...');
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let called = false;

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (called) return;
          if (!session?.user || event === 'SIGNED_OUT') return;
          if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN') return;

          called = true;
          if (timeoutId) clearTimeout(timeoutId);
          subscription.unsubscribe();
          await completeLogin(session.user.id, session.user.email!);
        }
      );

      timeoutId = setTimeout(() => {
        if (called) return;
        called = true;
        subscription.unsubscribe();
        setStatus('error');
        setMessage('Authentication timed out. Please log in manually.');
        setTimeout(() => {
          navigate(`/login?shop=${shop}&from=shopify`, { replace: true });
        }, 2000);
      }, 12000);

    } catch (err: any) {
      console.error('SSO callback error:', err);
      setStatus('error');
      setMessage('Something went wrong. Redirecting to login...');
      setTimeout(() => {
        navigate(`/login?shop=${shop}&from=shopify`, { replace: true });
      }, 2000);
    }
  }

  async function completeLogin(userId: string, email: string) {
    setMessage('Loading your merchant profile...');

    try {
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          role: 'client',
          ...(clientId ? { client_id: clientId } : {}),
        }, { onConflict: 'id', ignoreDuplicates: false });

      await supabase
        .from('store_users')
        .update({ auth_user_id: userId, last_login_at: new Date().toISOString() })
        .eq('email', email)
        .is('auth_user_id', null);

      setStatus('success');
      setMessage('Welcome! Redirecting to your dashboard...');
      setExpectedUserId(userId);

    } catch (err) {
      console.error('Profile sync error:', err);
      setExpectedUserId(userId);
    }
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
