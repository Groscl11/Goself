import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
 
// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'earn' | 'surveys';
 
interface EarningRule {
  id: string;
  rule_type: string;
  name: string;
  description?: string;
  points_reward: number;
  is_active: boolean;
  // Purchase
  use_tier_rate?: boolean;
  points_earn_divisor?: number;
  // Referral
  referral_trigger?: 'signup' | 'first_order' | 'both';
  referral_signup_points?: number;
  referral_first_order_points?: number;
  referral_discount_type?: string;
  referral_discount_value?: number;
  referral_min_order_value?: number;
  max_referrals_per_day?: number;
  // Social
  social_platform?: string;
  social_url?: string;
  // General
  max_times_per_customer?: number;
  cooldown_days?: number;
}
 
interface LoyaltyTier {
  id: string;
  tier_name: string;
  tier_level: number;
  is_default: boolean;
  points_earn_rate: number;
  points_earn_divisor: number;
  points_value: number;
  max_redemption_percent: number;
  min_orders: number;
  min_spend: number;
}
 
interface Survey {
  id: string;
  title: string;
  description?: string;
  points_reward: number;
  questions: SurveyQuestion[];
  is_active: boolean;
  max_times_per_customer: number;
  cooldown_days: number;
  start_date?: string;
  end_date?: string;
  total_completions: number;
  created_at: string;
}
 
interface SurveyQuestion {
  id: string;
  type: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'nps';
  question: string;
  options?: string[];
  required: boolean;
}
 
interface LoyaltyProgram {
  id: string;
  program_name: string;
  points_name: string;
  points_name_singular: string;
}
 
// ─── Section config ───────────────────────────────────────────────────────────
const EARN_SECTIONS = [
  {
    rule_type: 'purchase',
    icon: '🛍️',
    color: 'blue',
    title: 'Purchase Points',
    subtitle: 'Points earned per purchase — rate set by your loyalty tiers',
    addLabel: null,
    tierDriven: true,
  },
  {
    rule_type: 'signup',
    icon: '👋',
    color: 'green',
    title: 'Sign Up Bonus',
    subtitle: 'Give points when a new customer joins your loyalty program',
    addLabel: 'Add signup rule',
    tierDriven: false,
  },
  {
    rule_type: 'referral',
    icon: '👥',
    color: 'purple',
    title: 'Referral Program',
    subtitle: 'Earn points when customers refer friends. Set rewards for signup, first order, or both.',
    addLabel: 'Add referral rule',
    tierDriven: false,
  },
  {
    rule_type: 'birthday',
    icon: '🎂',
    color: 'pink',
    title: 'Birthday Rewards',
    subtitle: 'Automatically reward customers with bonus points on their birthday',
    addLabel: 'Add birthday rule',
    tierDriven: false,
  },
  {
    rule_type: 'social_follow',
    icon: '📱',
    color: 'sky',
    title: 'Social Media',
    subtitle: 'Reward customers for following your social media channels',
    addLabel: 'Add social channel',
    tierDriven: false,
  },
  {
    rule_type: 'profile_complete',
    icon: '✅',
    color: 'teal',
    title: 'Profile Completion',
    subtitle: 'Reward customers for completing their profile (name, phone, birthday, etc.)',
    addLabel: 'Add completion rule',
    tierDriven: false,
  },
  {
    rule_type: 'survey',
    icon: '📋',
    color: 'amber',
    title: 'Surveys',
    subtitle: 'Reward customers for completing surveys. Manage surveys in the Surveys tab.',
    addLabel: null,
    tierDriven: false,
    external: true,
  },
];
 
const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; dot: string; btn: string }> = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',   btn: 'bg-blue-500 hover:bg-blue-600' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  btn: 'bg-green-500 hover:bg-green-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', btn: 'bg-purple-500 hover:bg-purple-600' },
  pink:   { bg: 'bg-pink-50',   border: 'border-pink-200',   badge: 'bg-pink-100 text-pink-700',     dot: 'bg-pink-500',   btn: 'bg-pink-500 hover:bg-pink-600' },
  sky:    { bg: 'bg-sky-50',    border: 'border-sky-200',    badge: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-500',    btn: 'bg-sky-500 hover:bg-sky-600' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500',   btn: 'bg-teal-500 hover:bg-teal-600' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',  btn: 'bg-amber-500 hover:bg-amber-600' },
};
 
const SOCIAL_PLATFORMS = ['instagram','facebook','youtube','twitter','tiktok','linkedin','pinterest'];
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} />;
}
 
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${checked ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}
 
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
 
// ─── Rule Editor ──────────────────────────────────────────────────────────────
function RuleEditor({
  open, onClose, rule, ruleType, clientId, programId, onSaved,
}: {
  open: boolean; onClose: () => void;
  rule: Partial<EarningRule> | null;
  ruleType: string; clientId: string; programId: string;
  onSaved: () => void;
}) {
  const isEdit = !!rule?.id;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<EarningRule>>({});
 
  const section = EARN_SECTIONS.find(s => s.rule_type === ruleType);
 
  useEffect(() => {
    if (open) {
      setError('');
      setForm({
        rule_type: ruleType,
        name: section?.title ?? '',
        points_reward: 100,
        is_active: true,
        max_times_per_customer: 1,
        cooldown_days: 0,
        referral_trigger: 'first_order',
        referral_signup_points: 0,
        referral_first_order_points: 100,
        referral_discount_type: 'flat',
        referral_discount_value: 0,
        referral_min_order_value: 0,
        max_referrals_per_day: 5,
        social_platform: 'instagram',
        social_url: '',
        use_tier_rate: true,
        points_earn_divisor: 100,
        ...rule,
      });
    }
  }, [open, rule, ruleType]);
 
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
 
  if (!open) return null;
 
  function set(k: keyof EarningRule, v: any) { setForm(f => ({ ...f, [k]: v })); }
 
  async function save() {
    if (!form.name?.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, client_id: clientId, loyalty_program_id: programId };
      if (isEdit) {
        const { error: e } = await supabase.from('loyalty_earning_rules').update(payload).eq('id', rule!.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('loyalty_earning_rules').insert(payload);
        if (e) throw e;
      }
      onSaved(); onClose();
    } catch (e: any) { setError(e?.message ?? 'Save failed'); }
    setSaving(false);
  }
 
  const showSignupPoints   = form.referral_trigger === 'signup' || form.referral_trigger === 'both';
  const showFirstOrdPoints = form.referral_trigger === 'first_order' || form.referral_trigger === 'both';
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
 
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{isEdit ? 'Edit rule' : `New ${section?.title ?? ruleType} rule`}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{section?.subtitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
 
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
 
          <Field label="Rule name *">
            <input value={form.name ?? ''} onChange={e => set('name', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
          </Field>
 
          {/* ── REFERRAL: full trigger UI ────────────────────────────── */}
          {ruleType === 'referral' && (
            <>
              {/* Trigger selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">When does the referrer earn points?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'signup',      label: 'On Signup',      icon: '👋', desc: 'When referred person signs up' },
                    { value: 'first_order', label: 'First Order',    icon: '📦', desc: 'When referred person places first order' },
                    { value: 'both',        label: 'Both',           icon: '🎯', desc: 'Signup + first order rewards' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => set('referral_trigger', opt.value)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        form.referral_trigger === opt.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-lg mb-1">{opt.icon}</div>
                      <div className="text-xs font-semibold text-gray-800">{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
 
              {/* Referrer points — split by trigger */}
              <div className={`p-4 rounded-xl border space-y-3 ${showSignupPoints && showFirstOrdPoints ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Referrer earns (you, the store)</p>
 
                {showSignupPoints && (
                  <Field label="Points on referred person's signup">
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} value={form.referral_signup_points ?? 0}
                        onChange={e => set('referral_signup_points', Number(e.target.value))}
                        className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                      <span className="text-sm text-gray-500">points</span>
                    </div>
                  </Field>
                )}
 
                {showFirstOrdPoints && (
                  <Field label="Points on referred person's first order">
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} value={form.referral_first_order_points ?? form.points_reward ?? 100}
                        onChange={e => set('referral_first_order_points', Number(e.target.value))}
                        className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                      <span className="text-sm text-gray-500">points</span>
                    </div>
                  </Field>
                )}
              </div>
 
              {/* Referee reward (discount to the referred person) */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Referred person gets (optional discount)</p>
                <Field label="Discount type & value">
                  <div className="flex items-center gap-2">
                    <select value={form.referral_discount_type ?? 'flat'} onChange={e => set('referral_discount_type', e.target.value)}
                      className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                      <option value="flat">Flat ₹</option>
                      <option value="percentage">Percentage %</option>
                      <option value="none">No discount</option>
                    </select>
                    {form.referral_discount_type !== 'none' && (
                      <>
                        <input type="number" min={0} value={form.referral_discount_value ?? 0}
                          onChange={e => set('referral_discount_value', Number(e.target.value))}
                          className="w-20 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                        <span className="text-sm text-gray-500">{form.referral_discount_type === 'percentage' ? '%' : '₹'} off</span>
                      </>
                    )}
                  </div>
                </Field>
                {form.referral_discount_type !== 'none' && (
                  <Field label="Min. order value for discount (₹)">
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} value={form.referral_min_order_value ?? 0}
                        onChange={e => set('referral_min_order_value', Number(e.target.value))}
                        className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                      <span className="text-sm text-gray-500">₹ minimum</span>
                    </div>
                  </Field>
                )}
              </div>
 
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max referrals per day">
                  <input type="number" min={1} value={form.max_referrals_per_day ?? 5}
                    onChange={e => set('max_referrals_per_day', Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </Field>
                <Field label="Cooldown (days)">
                  <input type="number" min={0} value={form.cooldown_days ?? 0}
                    onChange={e => set('cooldown_days', Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </Field>
              </div>
            </>
          )}
 
          {/* ── PURCHASE: tier-driven info ───────────────────────────── */}
          {ruleType === 'purchase' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-blue-800">Points rate is set by your Loyalty Tiers</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Each tier has its own earn rate (e.g. 50 pts per ₹100). Members automatically earn at their tier's rate.
                    Go to <strong>Loyalty Points</strong> to configure tier earn rates.
                  </p>
                </div>
              </div>
              <Field label="Points earn per ₹ (divisor)" hint="Reference value for display — actual rate set in tiers">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Per ₹</span>
                  <input type="number" min={1} value={form.points_earn_divisor ?? 100}
                    onChange={e => set('points_earn_divisor', Number(e.target.value))}
                    className="w-20 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <span className="text-sm text-gray-500">spent</span>
                </div>
              </Field>
            </div>
          )}
 
          {/* ── SOCIAL FOLLOW ────────────────────────────────────────── */}
          {ruleType === 'social_follow' && (
            <>
              <Field label="Points reward">
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={form.points_reward ?? 100}
                    onChange={e => set('points_reward', Number(e.target.value))}
                    className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                  <span className="text-sm text-gray-500">points</span>
                </div>
              </Field>
              <Field label="Platform">
                <select value={form.social_platform ?? 'instagram'} onChange={e => set('social_platform', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 capitalize">
                  {SOCIAL_PLATFORMS.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Profile URL">
                <input value={form.social_url ?? ''} onChange={e => set('social_url', e.target.value)}
                  placeholder="https://instagram.com/yourbrand"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </Field>
            </>
          )}
 
          {/* ── ALL OTHER RULES ──────────────────────────────────────── */}
          {ruleType !== 'referral' && ruleType !== 'purchase' && ruleType !== 'social_follow' && (
            <Field label="Points reward">
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={form.points_reward ?? 100}
                  onChange={e => set('points_reward', Number(e.target.value))}
                  className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                <span className="text-sm text-gray-500">points</span>
              </div>
            </Field>
          )}
 
          {/* Limits — all except purchase & referral */}
          {ruleType !== 'purchase' && ruleType !== 'referral' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max uses per customer">
                <input type="number" min={0} value={form.max_times_per_customer ?? 1}
                  onChange={e => set('max_times_per_customer', Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </Field>
              <Field label="Cooldown (days)">
                <input type="number" min={0} value={form.cooldown_days ?? 0}
                  onChange={e => set('cooldown_days', Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </Field>
            </div>
          )}
 
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{error}</div>}
        </div>
 
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-60 transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
 
// ─── Survey Editor ────────────────────────────────────────────────────────────
function SurveyEditor({ open, onClose, survey, clientId, onSaved }: {
  open: boolean; onClose: () => void;
  survey: Partial<Survey> | null;
  clientId: string; onSaved: () => void;
}) {
  const isEdit = !!survey?.id;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [points, setPoints] = useState(50);
  const [maxTimes, setMaxTimes] = useState(1);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [startDate, setStart] = useState('');
  const [endDate, setEnd] = useState('');
 
  useEffect(() => {
    if (open) {
      setError('');
      setTitle(survey?.title ?? '');
      setDesc(survey?.description ?? '');
      setPoints(survey?.points_reward ?? 50);
      setMaxTimes(survey?.max_times_per_customer ?? 1);
      setQuestions(survey?.questions ?? []);
      setStart(survey?.start_date?.slice(0, 10) ?? '');
      setEnd(survey?.end_date?.slice(0, 10) ?? '');
    }
  }, [open, survey]);
 
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
 
  if (!open) return null;
 
  function addQuestion() {
    setQuestions(q => [...q, { id: `q_${Date.now()}`, type: 'text', question: '', required: true }]);
  }
  function updateQ(id: string, field: keyof SurveyQuestion, value: any) {
    setQuestions(q => q.map(x => x.id === id ? { ...x, [field]: value } : x));
  }
  function removeQ(id: string) { setQuestions(q => q.filter(x => x.id !== id)); }
  function addOpt(qId: string) { setQuestions(q => q.map(x => x.id === qId ? { ...x, options: [...(x.options ?? []), ''] } : x)); }
  function updateOpt(qId: string, i: number, v: string) { setQuestions(q => q.map(x => x.id === qId ? { ...x, options: (x.options ?? []).map((o, j) => j === i ? v : o) } : x)); }
  function removeOpt(qId: string, i: number) { setQuestions(q => q.map(x => x.id === qId ? { ...x, options: (x.options ?? []).filter((_, j) => j !== i) } : x)); }
 
  async function save() {
    if (!title.trim()) { setError('Title is required'); return; }
    if (questions.length === 0) { setError('Add at least one question'); return; }
    setSaving(true); setError('');
    try {
      const payload: any = { client_id: clientId, title: title.trim(), description: description.trim() || null, points_reward: points, max_times_per_customer: maxTimes, questions, start_date: startDate || null, end_date: endDate || null, is_active: true };
      if (isEdit) {
        const { error: e } = await supabase.from('loyalty_surveys').update(payload).eq('id', survey!.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('loyalty_surveys').insert(payload);
        if (e) throw e;
      }
      onSaved(); onClose();
    } catch (e: any) { setError(e?.message ?? 'Save failed'); }
    setSaving(false);
  }
 
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{isEdit ? 'Edit survey' : 'New survey'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Members earn points for completing this survey</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
 
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Survey title *">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Product satisfaction survey"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Description">
                <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
                  placeholder="Tell members what this survey is about..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
              </Field>
            </div>
            <Field label="Points reward">
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={points} onChange={e => setPoints(Number(e.target.value))}
                  className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                <span className="text-sm text-gray-500">pts</span>
              </div>
            </Field>
            <Field label="Max per member">
              <input type="number" min={1} value={maxTimes} onChange={e => setMaxTimes(Number(e.target.value))}
                className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            </Field>
            <Field label="Start date">
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            </Field>
            <Field label="End date">
              <input type="date" value={endDate} onChange={e => setEnd(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            </Field>
          </div>
 
          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions</label>
              <span className="text-xs text-gray-400">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {questions.map((q, qi) => (
                <div key={q.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-400 mt-2.5 w-5 text-center flex-shrink-0">{qi + 1}</span>
                    <div className="flex-1 space-y-2">
                      <input value={q.question} onChange={e => updateQ(q.id, 'question', e.target.value)}
                        placeholder="Type your question..."
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white" />
                      <div className="flex items-center gap-2">
                        <select value={q.type} onChange={e => updateQ(q.id, 'type', e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
                          <option value="text">Short text</option>
                          <option value="single_choice">Single choice</option>
                          <option value="multiple_choice">Multiple choice</option>
                          <option value="rating">Rating (1–5)</option>
                          <option value="nps">NPS (0–10)</option>
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                          <input type="checkbox" checked={q.required} onChange={e => updateQ(q.id, 'required', e.target.checked)} className="accent-gray-900" />
                          Required
                        </label>
                      </div>
                      {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                        <div className="space-y-1.5 mt-1">
                          {(q.options ?? []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-4 flex-shrink-0">{oi + 1}.</span>
                              <input value={opt} onChange={e => updateOpt(q.id, oi, e.target.value)}
                                placeholder={`Option ${oi + 1}`}
                                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white" />
                              <button onClick={() => removeOpt(q.id, oi)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ))}
                          <button onClick={() => addOpt(q.id)} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 px-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Add option
                          </button>
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeQ(q.id)} className="p-1 text-gray-300 hover:text-red-400 mt-1 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addQuestion}
                className="w-full py-2.5 text-sm text-gray-500 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:text-gray-700 transition-colors flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add question
              </button>
            </div>
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{error}</div>}
        </div>
 
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create survey'}
          </button>
        </div>
      </div>
    </div>
  );
}
 
// ─── Earn Section Accordion ───────────────────────────────────────────────────
function EarnSection({ section, rules, tiers, loading, expanded, onToggle, onAdd, onEdit, onToggleRule, onDelete, surveys, onGoSurveys }: {
  section: typeof EARN_SECTIONS[0];
  rules: EarningRule[];
  tiers: LoyaltyTier[];
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (r: EarningRule) => void;
  onToggleRule: (r: EarningRule) => void;
  onDelete: (id: string) => void;
  surveys: Survey[];
  onGoSurveys: () => void;
}) {
  const colors = COLOR_MAP[section.color] ?? COLOR_MAP.blue;
  const activeCount = section.rule_type === 'survey'
    ? surveys.filter(s => s.is_active).length
    : rules.filter(r => r.is_active).length;
 
  // Referral trigger label helper
  function referralTriggerLabel(r: EarningRule) {
    if (r.referral_trigger === 'signup') return `+${r.referral_signup_points ?? 0} pts on signup`;
    if (r.referral_trigger === 'first_order') return `+${r.referral_first_order_points ?? r.points_reward} pts on first order`;
    if (r.referral_trigger === 'both') return `+${r.referral_signup_points ?? 0} signup · +${r.referral_first_order_points ?? r.points_reward} first order`;
    return `+${r.points_reward} pts`;
  }
 
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors text-left">
        <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center text-xl flex-shrink-0`}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{section.title}</span>
            {activeCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                {activeCount} active
              </span>
            )}
            {section.tierDriven && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Tier-driven</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{section.subtitle}</p>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
 
      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-100">
 
          {/* ── Purchase: show tiers inline ───────────────────────────── */}
          {section.tierDriven && section.rule_type === 'purchase' && (
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Earn rates are configured in your loyalty tiers below.</p>
                <a href="/client/loyalty-points" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit tiers →</a>
              </div>
              {tiers.length === 0 ? (
                <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
                  No tiers configured. <a href="/client/loyalty-points" className="text-blue-600 hover:underline">Set up tiers →</a>
                </div>
              ) : (
                <div className="space-y-2">
                  {tiers.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border ${t.is_default ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{t.tier_name}</span>
                          {t.is_default && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">Default</span>}
                          <span className="text-xs text-gray-400">Level {t.tier_level}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>
                            {t.points_earn_rate} pts / ₹{t.points_earn_divisor}
                          </span>
                          <span className="text-xs text-gray-400">Min spend ₹{t.min_spend}</span>
                          <span className="text-xs text-gray-400">Min orders {t.min_orders}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Keep the purchase rule toggle for on/off */}
              {rules.length > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-500">Purchase points enabled</span>
                  <Toggle checked={rules[0].is_active} onChange={() => onToggleRule(rules[0])} />
                </div>
              )}
            </div>
          )}
 
          {/* ── Survey section ────────────────────────────────────────── */}
          {(section as any).external && section.rule_type === 'survey' && (
            <div className="pt-4">
              {surveys.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400 mb-3">No surveys yet. Create one to reward members for feedback.</p>
                  <button onClick={onGoSurveys} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors">
                    Go to Surveys →
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {surveys.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{s.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${colors.badge}`}>+{s.points_reward} pts</span>
                          <span className="text-xs text-gray-400">{s.questions.length} questions · {s.total_completions} completions</span>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    </div>
                  ))}
                  <button onClick={onGoSurveys} className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 pt-1">
                    Manage all surveys →
                  </button>
                </div>
              )}
            </div>
          )}
 
          {/* ── Normal rules ─────────────────────────────────────────── */}
          {!section.tierDriven && !(section as any).external && (
            <>
              {loading ? (
                <div className="space-y-2 pt-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
              ) : rules.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400 mb-3">No rules configured yet</p>
                  {section.addLabel && (
                    <button onClick={onAdd} className={`px-4 py-2 text-sm text-white rounded-xl transition-colors ${colors.btn}`}>
                      + {section.addLabel}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-3">
                  {rules.map(rule => (
                    <div key={rule.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{rule.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>
                            {rule.rule_type === 'referral' ? referralTriggerLabel(rule) : `+${rule.points_reward} pts`}
                          </span>
                          {rule.rule_type === 'referral' && rule.referral_trigger && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium capitalize">
                              {rule.referral_trigger === 'both' ? 'Signup + First order' : rule.referral_trigger === 'first_order' ? 'First order' : 'Signup'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {rule.rule_type === 'referral' && rule.referral_discount_value && rule.referral_discount_value > 0 && (
                            <span className="text-xs text-gray-400">
                              Referred gets {rule.referral_discount_type === 'flat' ? `₹${rule.referral_discount_value}` : `${rule.referral_discount_value}%`} off
                            </span>
                          )}
                          {rule.max_times_per_customer != null && rule.max_times_per_customer > 0 && rule.rule_type !== 'referral' && (
                            <span className="text-xs text-gray-400">Max {rule.max_times_per_customer}x</span>
                          )}
                          {rule.cooldown_days != null && rule.cooldown_days > 0 && (
                            <span className="text-xs text-gray-400">{rule.cooldown_days}d cooldown</span>
                          )}
                          {rule.max_referrals_per_day != null && rule.rule_type === 'referral' && (
                            <span className="text-xs text-gray-400">Max {rule.max_referrals_per_day}/day</span>
                          )}
                          {rule.referral_min_order_value != null && rule.referral_min_order_value > 0 && (
                            <span className="text-xs text-gray-400">Min order ₹{rule.referral_min_order_value}</span>
                          )}
                          {rule.social_platform && (
                            <span className="text-xs text-gray-400 capitalize">{rule.social_platform}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(rule)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => onDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      <Toggle checked={rule.is_active} onChange={() => onToggleRule(rule)} />
                    </div>
                  ))}
                  {section.addLabel && (
                    <button onClick={onAdd} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors px-1 py-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      + {section.addLabel}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
 
// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LoyaltyProgramPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = profile?.client_id ?? '';
 
  const activeTab = (searchParams.get('tab') as TabId) || 'earn';
  const setTab = (t: TabId) => setSearchParams({ tab: t }, { replace: true });
 
  const [earningRules, setEarningRules] = useState<EarningRule[]>([]);
  const [surveys, setSurveys]           = useState<Survey[]>([]);
  const [tiers, setTiers]               = useState<LoyaltyTier[]>([]);
  const [program, setProgram]           = useState<LoyaltyProgram | null>(null);
  const [loading, setLoading]           = useState(true);
  const [expandedSections, setExpanded] = useState<Set<string>>(new Set(['purchase', 'referral']));
 
  const [ruleEditor, setRuleEditor]     = useState<{ open: boolean; rule: Partial<EarningRule> | null; type: string }>({ open: false, rule: null, type: 'signup' });
  const [surveyEditor, setSurveyEditor] = useState<{ open: boolean; survey: Partial<Survey> | null }>({ open: false, survey: null });
 
  const fetchAll = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [rulesRes, surveysRes, programRes] = await Promise.all([
      supabase.from('loyalty_earning_rules').select('*').eq('client_id', clientId).order('created_at'),
      supabase.from('loyalty_surveys').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('loyalty_programs').select('*').eq('client_id', clientId).maybeSingle(),
    ]);
    setEarningRules(rulesRes.data ?? []);
    setSurveys(surveysRes.data ?? []);
    setProgram(programRes.data ?? null);
 
    // Fetch tiers via program id
    if (programRes.data?.id) {
      const { data: tierData } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .eq('loyalty_program_id', programRes.data.id)
        .order('tier_level');
      setTiers(tierData ?? []);
    }
    setLoading(false);
  }, [clientId]);
 
  useEffect(() => { fetchAll(); }, [fetchAll]);
 
  function toggleSection(t: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }
 
  async function toggleRule(rule: EarningRule) {
    await supabase.from('loyalty_earning_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    setEarningRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  }
 
  async function deleteRule(id: string) {
    if (!window.confirm('Delete this rule?')) return;
    await supabase.from('loyalty_earning_rules').delete().eq('id', id);
    setEarningRules(prev => prev.filter(r => r.id !== id));
  }
 
  async function toggleSurvey(s: Survey) {
    await supabase.from('loyalty_surveys').update({ is_active: !s.is_active }).eq('id', s.id);
    setSurveys(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x));
  }
 
  async function deleteSurvey(id: string) {
    if (!window.confirm('Delete this survey?')) return;
    await supabase.from('loyalty_surveys').delete().eq('id', id);
    setSurveys(prev => prev.filter(x => x.id !== id));
  }
 
  const programId = program?.id ?? '';
  const totalActive = earningRules.filter(r => r.is_active).length + surveys.filter(s => s.is_active).length;
 
  const TABS = [
    { id: 'earn' as TabId,    label: 'Ways to Earn', icon: '⭐' },
    { id: 'surveys' as TabId, label: 'Surveys',      icon: '📋' },
  ];
 
  return (
    <>
      <DashboardLayout menuItems={clientMenuItems} title="Ways to Earn Points">
        <div className="max-w-4xl mx-auto px-4 py-2">
 
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Ways to Earn Points</h1>
              <p className="text-sm text-gray-500 mt-0.5">Configure how customers earn loyalty points in your program</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700">{totalActive} active rules</span>
            </div>
          </div>
 
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                  ${activeTab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                <span>{t.icon}</span>
                {t.label}
                {t.id === 'surveys' && surveys.length > 0 && (
                  <span className="ml-0.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{surveys.length}</span>
                )}
              </button>
            ))}
          </div>
 
          {/* ── Ways to Earn Tab ─────────────────────────────────────── */}
          {activeTab === 'earn' && (
            <div className="space-y-3">
              {EARN_SECTIONS.map(section => (
                <EarnSection
                  key={section.rule_type}
                  section={section}
                  rules={earningRules.filter(r => r.rule_type === section.rule_type)}
                  tiers={tiers}
                  loading={loading}
                  expanded={expandedSections.has(section.rule_type)}
                  onToggle={() => toggleSection(section.rule_type)}
                  onAdd={() => setRuleEditor({ open: true, rule: null, type: section.rule_type })}
                  onEdit={rule => setRuleEditor({ open: true, rule, type: section.rule_type })}
                  onToggleRule={toggleRule}
                  onDelete={deleteRule}
                  surveys={surveys}
                  onGoSurveys={() => setTab('surveys')}
                />
              ))}
            </div>
          )}
 
          {/* ── Surveys Tab ──────────────────────────────────────────── */}
          {activeTab === 'surveys' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Member Surveys</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Members earn points for completing surveys. Responses are recorded for your insights.</p>
                </div>
                <button onClick={() => setSurveyEditor({ open: true, survey: null })}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors">
                  + New Survey
                </button>
              </div>
 
              {loading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
              ) : surveys.length === 0 ? (
                <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl">
                  <div className="text-4xl mb-3">📋</div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">No surveys yet</h3>
                  <p className="text-sm text-gray-400 mb-4">Create surveys to collect customer feedback and reward members with points for participating.</p>
                  <button onClick={() => setSurveyEditor({ open: true, survey: null })}
                    className="px-4 py-2 text-sm bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors">
                    Create first survey
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {surveys.map(s => (
                    <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-colors group">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl flex-shrink-0">📋</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">+{s.points_reward} pts</span>
                            {!s.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Paused</span>}
                          </div>
                          {s.description && <p className="text-xs text-gray-500 mb-2">{s.description}</p>}
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-gray-400">{s.questions.length} question{s.questions.length !== 1 ? 's' : ''}</span>
                            <span className="text-xs text-gray-400">{s.total_completions} completion{s.total_completions !== 1 ? 's' : ''}</span>
                            {s.max_times_per_customer > 1 && <span className="text-xs text-gray-400">Max {s.max_times_per_customer}x per member</span>}
                            {s.end_date && <span className="text-xs text-gray-400">Ends {new Date(s.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSurveyEditor({ open: true, survey: s })}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => deleteSurvey(s.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <Toggle checked={s.is_active} onChange={() => toggleSurvey(s)} />
                      </div>
                      {s.questions.length > 0 && (
                        <div className="mt-3 pl-14">
                          <div className="flex gap-1.5 flex-wrap">
                            {s.questions.slice(0, 3).map((q, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full truncate max-w-[180px]">
                                {i + 1}. {q.question || `Question ${i + 1}`}
                              </span>
                            ))}
                            {s.questions.length > 3 && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">+{s.questions.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
 
      <RuleEditor
        open={ruleEditor.open}
        onClose={() => setRuleEditor(s => ({ ...s, open: false }))}
        rule={ruleEditor.rule}
        ruleType={ruleEditor.type}
        clientId={clientId}
        programId={programId}
        onSaved={fetchAll}
      />
 
      <SurveyEditor
        open={surveyEditor.open}
        onClose={() => setSurveyEditor(s => ({ ...s, open: false }))}
        survey={surveyEditor.survey}
        clientId={clientId}
        onSaved={fetchAll}
      />
    </>
  );
}
