/**
 * ShopifyCallback — SSO landing page
 *
 * Flow:
 * 1. shopify-session-login → magic link → Supabase /verify → 303
 * 2. Browser lands here: /auth/shopify-callback?shop=...&client_id=...#access_token=...
 * 3. Supabase processes hash/code and fires SIGNED_IN
 * 4. We upsert the profile, then watch AuthContext until profile is loaded,
 *    then navigate to /client.
 *
 * Navigation is driven by AuthContext profile state (not a fixed timer) so
 * it is immune to timing races between auth events and profile loads.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function ShopifyCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Setting up your Goself dashboard...');
  const [authComplete, setAuthComplete] = useState(false);

  const shop = searchParams.get('shop');
  const clientId = searchParams.get('client_id');

  // Navigate once auth + profile upsert are done AND AuthContext has loaded the profile
  useEffect(() => {
    if (!authComplete) return;
    if (loading) return; // still fetching profile — wait

    if (profile) {
      navigate('/client', { replace: true });
    } else {
      // Auth succeeded but profile is still null — shouldn't happen, but fallback gracefully
      setStatus('error');
      setMessage('Could not load your profile. Please log in manually.');
      setTimeout(() => {
        navigate(`/login?shop=${shop}&from=shopify`, { replace: true });
      }, 2000);
    }
  }, [authComplete, loading, profile]);

  useEffect(() => {
    handleSSOCallback();
  }, []);

  async function handleSSOCallback() {
    try {
      setMessage('Verifying your Shopify credentials...');

      // Supabase may have already processed the URL hash/code by the time this runs
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        await completeLogin(session.user.id, session.user.email!);
        return;
      }

      // Session not ready yet — wait for auth event (implicit hash OR PKCE code exchange)
      setMessage('Authenticating with Shopify...');
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          // Handle INITIAL_SESSION too: PKCE exchange may complete before this listener
          // is registered, causing INITIAL_SESSION (not SIGNED_IN) to fire first.
          if (
            (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
            session?.user
          ) {
            if (timeoutId) clearTimeout(timeoutId);
            subscription.unsubscribe();
            await completeLogin(session.user.id, session.user.email!);
          }
        }
      );

      timeoutId = setTimeout(() => {
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
      // Upsert profile (server-side already did this, but belt-and-suspenders)
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          role: 'client',
          ...(clientId ? { client_id: clientId } : {}),
        }, { onConflict: 'id', ignoreDuplicates: false });

      // Link auth_user_id in store_users (was null before first SSO login)
      await supabase
        .from('store_users')
        .update({ auth_user_id: userId, last_login_at: new Date().toISOString() })
        .eq('email', email)
        .is('auth_user_id', null);

      setStatus('success');
      setMessage('Welcome! Redirecting to your dashboard...');

      // Signal: let the useEffect above drive navigation once AuthContext profile loads
      setAuthComplete(true);

    } catch (err) {
      console.error('Profile sync error:', err);
      // Even on error, attempt navigation — profile may still be loaded
      setAuthComplete(true);
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
