import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Mail, KeyRound, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ClientBranding {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  welcome_message: string | null;
}

type Step = 'email' | 'otp' | 'denied';

export default function PartnerLogin() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [branding, setBranding] = useState<ClientBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [brandingError, setBrandingError] = useState('');

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accent = branding?.primary_color || '#6366f1';

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('clients')
      .select('id, name, logo_url, primary_color, welcome_message')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        setBrandingLoading(false);
        if (error || !data) { setBrandingError('Brand portal not found.'); return; }
        setBranding(data as ClientBranding);
      });
  }, [slug]);

  // If already signed in with a valid partner session, skip to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate(`/partner/${slug}/dashboard`, { replace: true });
    });
  }, [slug, navigate]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (otpError) throw otpError;
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Could not send code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error('Verification failed. Please try again.');
      // Redirect — dashboard will verify partner access server-side
      navigate(`/partner/${slug}/dashboard`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (brandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (brandingError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{brandingError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-14 mx-auto mb-4 object-contain" />
          ) : (
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: accent + '20' }}
            >
              <Building2 className="h-7 w-7" style={{ color: accent }} />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{branding?.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Partner Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {step === 'email' && (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sign in</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {branding?.welcome_message || "Enter your email to access your partner dashboard."}
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 text-sm"
                      style={{ '--tw-ring-color': accent } as React.CSSProperties}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Send code <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5" style={{ color: accent }} />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Check your email</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  We sent a 6-digit code to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Verification code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 text-sm tracking-widest font-mono"
                      style={{ '--tw-ring-color': accent } as React.CSSProperties}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Verify &amp; continue <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-1"
                >
                  Use a different email
                </button>
              </form>
            </>
          )}

          {step === 'denied' && (
            <div className="text-center py-4">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Access not found</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                No partner account was found for <span className="font-medium">{email}</span> at {branding?.name}.
                Please contact the brand to get access.
              </p>
              <button
                onClick={() => { setStep('email'); setEmail(''); setOtp(''); setError(''); supabase.auth.signOut(); }}
                className="text-sm font-medium hover:underline"
                style={{ color: accent }}
              >
                Try a different email
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
          Powered by <span className="font-medium">Goself</span>
        </p>
      </div>
    </div>
  );
}
