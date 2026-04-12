import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { StepBrandBasics } from '../../components/onboarding/StepBrandBasics';
import { StepContact } from '../../components/onboarding/StepContact';
import { StepIndustry } from '../../components/onboarding/StepIndustry';
import { StepConnectShopify } from '../../components/onboarding/StepConnectShopify';

type Step = 0 | 1 | 2 | 3;

const STEP_LABELS = ['Brand', 'Contact', 'Industry', 'Shopify'];

interface FormState {
  name: string;
  logo_url: string;
  primary_color: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  industry: string;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: '',
    logo_url: '',
    primary_color: '#7c3aed',
    contact_email: profile?.email || '',
    contact_phone: '',
    website_url: '',
    industry: '',
  });

  // Load existing client data
  useEffect(() => {
    if (!profile?.client_id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('clients')
          .select('id, name, logo_url, primary_color, contact_email, contact_phone, website_url, industry, onboarding_completed')
          .eq('id', profile.client_id)
          .maybeSingle();
        if (data) {
          setClientId(data.id);
          // If somehow onboarding was already completed, send to dashboard
          if (data.onboarding_completed) {
            navigate('/client', { replace: true });
            return;
          }
          setForm({
            name: data.name || '',
            logo_url: data.logo_url || '',
            primary_color: data.primary_color || '#7c3aed',
            contact_email: data.contact_email || profile?.email || '',
            contact_phone: data.contact_phone || '',
            website_url: data.website_url || '',
            industry: data.industry || '',
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  // Save current step data to DB immediately (progressive save)
  async function savePartial(patch: Partial<FormState>) {
    if (!clientId) return;
    await supabase.from('clients').update(patch).eq('id', clientId);
  }

  // Step handlers
  function handleBrandNext(data: { name: string; logo_url: string; primary_color: string }) {
    setForm((f) => ({ ...f, ...data }));
    savePartial(data);
    setStep(1);
  }

  function handleContactNext(data: { contact_email: string; contact_phone: string; website_url: string }) {
    setForm((f) => ({ ...f, ...data }));
    savePartial(data);
    setStep(2);
  }

  function handleIndustryNext(industry: string) {
    setForm((f) => ({ ...f, industry }));
    savePartial({ industry });
    setStep(3);
  }

  async function handleFinish() {
    if (!clientId) return;
    setSaving(true);
    try {
      await supabase
        .from('clients')
        .update({ onboarding_completed: true })
        .eq('id', clientId);
      navigate('/client', { replace: true });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-violet-600 border-gray-200 rounded-full animate-spin" />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No client account found. Contact support.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600 text-white mb-4 shadow-lg">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to GoSelf</h1>
          <p className="text-sm text-gray-500 mt-1">Let's set up your account in 4 quick steps</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-0 mb-8">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: i < step ? '#7c3aed' : i === step ? '#7c3aed' : '#e5e7eb',
                    color: i <= step ? '#fff' : '#9ca3af',
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-[10px] text-gray-500 font-medium">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className="flex-1 h-0.5 mb-5 transition-all duration-300"
                  style={{ background: i < step ? '#7c3aed' : '#e5e7eb' }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {step === 0 && (
            <StepBrandBasics
              clientId={clientId}
              initial={{ name: form.name, logo_url: form.logo_url, primary_color: form.primary_color }}
              onNext={handleBrandNext}
            />
          )}
          {step === 1 && (
            <StepContact
              initial={{ contact_email: form.contact_email, contact_phone: form.contact_phone, website_url: form.website_url }}
              onNext={handleContactNext}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepIndustry
              initial={form.industry}
              onNext={handleIndustryNext}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepConnectShopify
              clientId={clientId}
              onNext={handleFinish}
              onBack={() => setStep(2)}
            />
          )}
        </div>

        {/* Skip all */}
        {step === 0 && (
          <div className="text-center mt-4">
            <button
              onClick={handleFinish}
              disabled={saving}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Skip setup — go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
