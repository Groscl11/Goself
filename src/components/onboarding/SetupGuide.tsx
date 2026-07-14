/**
 * SetupGuide — persistent "Getting Started" dashboard widget.
 *
 * Shown above the stats row whenever setup_guide_dismissed = false.
 * Step completion is derived from live DB counts — no extra tracking columns.
 *
 * Steps:
 *  1. Connect Shopify store   — always ✓ (merchant arrived via OAuth)
 *  2. Brand profile complete  — clients.onboarding_completed
 *  3. Loyalty program set up  — loyalty_programs row exists for client
 *  4. First campaign created  — campaign_rules row exists for client
 *  5. Affiliate partner added — affiliate_partners row exists for client
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SetupGuideProps {
  clientId: string;
  brandProfileDone: boolean; // clients.onboarding_completed
  onDismiss: () => void;
}

interface StepStatus {
  loyalty: boolean;
  campaign: boolean;
  affiliate: boolean;
}

const STEPS = [
  {
    key: 'shopify',
    label: 'Connect your Shopify store',
    path: null,
    cta: null,
  },
  {
    key: 'brand',
    label: 'Complete your brand profile',
    path: null, // handled by OnboardingModal re-trigger; or Settings
    cta: 'Edit profile',
  },
  {
    key: 'loyalty',
    label: 'Set up your loyalty program',
    path: '/client/loyalty-config',
    cta: 'Configure →',
  },
  {
    key: 'campaign',
    label: 'Create your first campaign',
    path: '/client/campaigns',
    cta: 'Create →',
  },
  {
    key: 'affiliate',
    label: 'Add an affiliate partner',
    path: '/client/affiliates',
    cta: 'Add partner →',
  },
] as const;

export function SetupGuide({ clientId, brandProfileDone, onDismiss }: SetupGuideProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StepStatus>({ loyalty: false, campaign: false, affiliate: false });
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    async function checkSteps() {
      const [{ count: lc }, { count: cc }, { count: ac }] = await Promise.all([
        supabase.from('loyalty_programs').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('campaign_rules').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('affiliate_partners').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      ]);
      setStatus({ loyalty: (lc ?? 0) > 0, campaign: (cc ?? 0) > 0, affiliate: (ac ?? 0) > 0 });
      setLoading(false);
    }
    checkSteps();
  }, [clientId]);

  const stepsDone = [
    true,             // shopify always done
    brandProfileDone,
    status.loyalty,
    status.campaign,
    status.affiliate,
  ];
  const completedCount = stepsDone.filter(Boolean).length;
  const totalCount = stepsDone.length;
  const allDone = completedCount === totalCount;

  const circumference = 2 * Math.PI * 22; // r=22
  const progress = completedCount / totalCount;
  const dashOffset = circumference * (1 - progress);

  async function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
    await supabase.from('clients').update({ setup_guide_dismissed: true }).eq('id', clientId);
    onDismiss();
  }

  function isDone(key: string) {
    if (key === 'shopify') return true;
    if (key === 'brand') return brandProfileDone;
    if (key === 'loyalty') return status.loyalty;
    if (key === 'campaign') return status.campaign;
    if (key === 'affiliate') return status.affiliate;
    return false;
  }

  function firstIncomplete() {
    return STEPS.find((s) => !isDone(s.key));
  }

  if (loading) return null;

  // Collapsed mini-rail
  if (collapsed) {
    return (
      <div
        className="flex items-center gap-4 bg-white border border-gray-100 border-l-4 border-l-indigo-600 rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setCollapsed(false)}
      >
        <div className="text-lg">🏆</div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900">{completedCount} of {totalCount} setup steps done</span>
          <span className="text-xs text-gray-400 ml-2">— keep going to go live</span>
        </div>
        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
          <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${(completedCount / totalCount) * 100}%` }} />
        </div>
        <span className="text-xs text-indigo-600 font-semibold whitespace-nowrap flex items-center gap-1">
          Resume <ChevronDown className="w-3 h-3" />
        </span>
      </div>
    );
  }

  // All done — show celebration strip
  if (allDone) {
    return (
      <div className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-xl px-5 py-4">
        <span className="text-2xl">🎉</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-800">You're all set! Everything is live.</p>
          <p className="text-xs text-green-600 mt-0.5">Your loyalty program, first campaign, and affiliate link are active.</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 relative overflow-hidden shadow-lg">
      {/* Decorative circles */}
      <div className="absolute -right-6 -top-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute right-10 -bottom-12 w-28 h-28 rounded-full bg-white/4 pointer-events-none" />

      {/* Header row */}
      <div className="flex items-start gap-4 relative z-10">
        {/* SVG ring */}
        <div className="relative flex-shrink-0 w-14 h-14">
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              stroke="#a5b4fc" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset .4s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
            {completedCount}/{totalCount}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-indigo-200 text-[11px] font-semibold tracking-widest uppercase mb-1">Getting started</p>
          <p className="text-white text-base font-bold leading-tight mb-3">Finish setting up your store</p>

          {/* Steps */}
          <div className="flex flex-col gap-1.5">
            {STEPS.map((step) => {
              const done = isDone(step.key);
              const isCurrent = !done && step.key === firstIncomplete()?.key;
              return (
                <div
                  key={step.key}
                  onClick={() => step.path && !done && navigate(step.path)}
                  className={[
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-colors',
                    done ? 'bg-white/10 border-white/15' : 'bg-white/10 border-white/15',
                    !done && step.path ? 'cursor-pointer hover:bg-white/20' : '',
                  ].join(' ')}
                >
                  <div className={[
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                    done ? 'bg-emerald-400 text-white' : isCurrent ? 'bg-white text-indigo-700' : 'bg-white/15 border border-white/25 text-white/50',
                  ].join(' ')}>
                    {done ? '✓' : STEPS.indexOf(step) + 1}
                  </div>
                  <span className={`text-[12.5px] flex-1 font-medium ${done ? 'text-white/90' : 'text-white'}`}>
                    {step.label}
                  </span>
                  {done && (
                    <span className="text-[11px] text-emerald-300 font-semibold whitespace-nowrap">Done</span>
                  )}
                  {!done && step.cta && (
                    <span className="text-[11px] text-indigo-200 font-semibold whitespace-nowrap">{step.cta}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top-right controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Collapse"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Dismiss setup guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
