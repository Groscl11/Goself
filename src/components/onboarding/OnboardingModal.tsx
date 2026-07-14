/**
 * OnboardingModal
 *
 * Shown as an overlay on the client dashboard when
 * `clients.onboarding_completed = false`.
 *
 * Steps:
 *  0 – Goal selection   (new — which track(s) to set up)
 *  1 – Brand basics     (store name, logo, brand colour)
 *  2 – Contact details  (email, phone, website)
 *  3 – Industry         (category pick)
 *
 * Completing step 3 sets onboarding_completed = true and persists the
 * chosen goals to onboarding_goals[]. Clicking ✕ / Skip marks complete
 * immediately without saving goals.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StepGoalSelect } from './StepGoalSelect';
import { StepBrandBasics } from './StepBrandBasics';
import { StepContact } from './StepContact';
import { StepIndustry } from './StepIndustry';

interface OnboardingModalProps {
  clientId: string;
  initialData: {
    name: string;
    logo_url: string;
    primary_color: string;
    contact_email: string;
    contact_phone: string;
    website_url: string;
    industry: string;
    onboarding_goals: string[];
  };
  onComplete: () => void;
}

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ['Goals', 'Brand', 'Contact', 'Industry'];

export function OnboardingModal({ clientId, initialData, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialData);

  async function savePartial(patch: Record<string, unknown>) {
    await supabase.from('clients').update(patch).eq('id', clientId);
  }

  async function markComplete(goals?: string[]) {
    if (saving) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { onboarding_completed: true };
      if (goals) patch.onboarding_goals = goals;
      await supabase.from('clients').update(patch).eq('id', clientId);
    } finally {
      setSaving(false);
      onComplete();
    }
  }

  function handleGoalsNext(goals: string[]) {
    setForm((f) => ({ ...f, onboarding_goals: goals }));
    savePartial({ onboarding_goals: goals });
    setStep(1);
  }

  function handleBrandNext(data: { name: string; logo_url: string; primary_color: string }) {
    setForm((f) => ({ ...f, ...data }));
    savePartial(data);
    setStep(2);
  }

  function handleContactNext(data: { contact_email: string; contact_phone: string; website_url: string }) {
    setForm((f) => ({ ...f, ...data }));
    savePartial(data);
    setStep(3);
  }

  async function handleIndustryNext(industry: string) {
    setForm((f) => ({ ...f, industry }));
    await savePartial({ industry });
    await markComplete(form.onboarding_goals);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header + step progress */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Set up your store</h2>
              <p className="text-xs text-gray-400 mt-0.5">Takes less than 3 minutes · you can skip anytime</p>
            </div>
            <button
              onClick={() => markComplete()}
              disabled={saving}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 ml-3"
              title="Skip setup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step pills */}
          <div className="flex items-center">
            {STEP_LABELS.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                    style={{
                      background: i <= step ? '#7c3aed' : '#e5e7eb',
                      color: i <= step ? '#fff' : '#9ca3af',
                    }}
                  >
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mb-4 transition-all duration-300"
                    style={{ background: i < step ? '#7c3aed' : '#e5e7eb' }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {step === 0 && (
            <StepGoalSelect
              initial={form.onboarding_goals}
              onNext={handleGoalsNext}
            />
          )}
          {step === 1 && (
            <StepBrandBasics
              clientId={clientId}
              initial={{ name: form.name, logo_url: form.logo_url, primary_color: form.primary_color }}
              onNext={handleBrandNext}
            />
          )}
          {step === 2 && (
            <StepContact
              initial={{ contact_email: form.contact_email, contact_phone: form.contact_phone, website_url: form.website_url }}
              onNext={handleContactNext}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepIndustry
              initial={form.industry}
              onNext={handleIndustryNext}
              onBack={() => setStep(2)}
            />
          )}
        </div>

      </div>
    </div>
  );
}
