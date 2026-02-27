/**
 * ShopifyCallback — SSO landing page
 *
 * Flow:
 * 1. Shopify OAuth completes → Supabase sends merchant a magic link
 * 2. Magic link redirects here: /auth/shopify-callback?shop=...&client_id=...
 * 3. Supabase automatically sets the session from the URL hash (#access_token=...)
 * 4. We wait for session, then redirect merchant to their client dashboard
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ShopifyCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Setting up your Goself dashboard...');

  const shop = searchParams.get('shop');
  const clientId = searchParams.get('client_id');

  useEffect(() => {
    handleSSOCallback();
  }, []);

  async function handleSSOCallback() {
    try {
      setMessage('Verifying your Shopify credentials...');

      // Supabase magic link puts the session in the URL hash automatically.
      // onAuthStateChange fires once it's processed — we just need to wait.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (session?.user) {
        await completeLogin(session.user.id, session.user.email!);
        return;
      }

      // Session not ready yet — wait for auth state change (magic link processing)
      setMessage('Authenticating with Shopify...');
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            subscription.unsubscribe();
            await completeLogin(session.user.id, session.user.email!);
          } else if (event === 'TOKEN_REFRESHED') {
            // Already logged in from a previous session
            if (session?.user) {
              subscription.unsubscribe();
              await completeLogin(session.user.id, session.user.email!);
            }
          }
        }
      );

      // Timeout fallback after 8 seconds
      setTimeout(() => {
        subscription.unsubscribe();
        setStatus('error');
        setMessage('Authentication timed out. Please log in manually.');
        setTimeout(() => {
          navigate(`/login?shop=${shop}&client_id=${clientId}&from=shopify`);
        }, 2000);
      }, 8000);

    } catch (err: any) {
      console.error('SSO callback error:', err);
      setStatus('error');
      setMessage('Something went wrong. Redirecting to login...');
      setTimeout(() => {
        navigate(`/login?shop=${shop}&client_id=${clientId}&from=shopify`);
      }, 2000);
    }
  }

  async function completeLogin(userId: string, email: string) {
    setMessage('Loading your merchant profile...');

    try {
      // Load or create profile
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // If profile doesn't exist, create it with client role
      if (!profile) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email,
            full_name: email.split('@')[0],
            role: 'client',
            client_id: clientId || null,
          })
          .select()
          .single();
        profile = newProfile;
      }

      // If profile has no client_id but we have one from URL, update it
      if (profile && !profile.client_id && clientId) {
        await supabase
          .from('profiles')
          .update({ client_id: clientId, role: 'client' })
          .eq('id', userId);
        profile.client_id = clientId;
      }

      setStatus('success');
      setMessage(`Welcome! Redirecting to your dashboard...`);

      // Small delay so merchant sees the success state
      await new Promise(r => setTimeout(r, 800));

      // Route based on role
      if (profile?.role === 'admin') {
        navigate('/admin');
      } else if (profile?.role === 'client') {
        navigate('/client');
      } else {
        navigate('/client');
      }

    } catch (err) {
      console.error('Profile load error:', err);
      // Even if profile fails, navigate to client dashboard
      navigate('/client');
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
          {shop && (
            <p className="text-slate-400 text-sm mt-1">{shop}</p>
          )}
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
