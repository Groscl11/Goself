import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
 
// ─── Types ────────────────────────────────────────────────────────────────────
type TriggerType = 'order_value' | 'order_count' | 'signup' | 'birthday' | 'referral' | 'custom_event' | 'advanced';
type RuleMode = 'membership' | 'standalone';
 
interface CampaignRule {
  id: string;
  name: string;
  description?: string;
  campaign_id: string;
  trigger_type: TriggerType;
  rule_mode: RuleMode;
  is_active: boolean;
  priority: number;
  current_enrollments: number;
  max_enrollments?: number;
  start_date?: string;
  end_date?: string;
  link_expiry_hours?: number;
  trigger_conditions: any;
  eligibility_conditions: any;
  reward_action: any;
  guardrails: any;
  created_at: string;
}
 
interface ConditionRow {
  id: string;
  type: string;
  operator: string;
  value: string;
}
 
// ─── Constants ────────────────────────────────────────────────────────────────
const SIMPLE_TRIGGERS: { value: TriggerType; label: string; icon: string; desc: string }[] = [
  { value: 'order_value',   label: 'Order Value',   icon: '💰', desc: 'Trigger when order amount hits a threshold' },
  { value: 'order_count',   label: 'Order Count',   icon: '📦', desc: 'Trigger after N purchases' },
  { value: 'signup',        label: 'New Signup',    icon: '👋', desc: 'Trigger when a member joins' },
  { value: 'birthday',      label: 'Birthday',      icon: '🎂', desc: 'Trigger on member birthday' },
  { value: 'referral',      label: 'Referral',      icon: '👥', desc: 'Trigger when a referral converts' },
  { value: 'custom_event',  label: 'Custom Event',  icon: '⚡', desc: 'Trigger on any custom event' },
];
 
const CONDITION_TYPES = [
  { value: 'order_value_gte', label: 'Order Value ≥', operator: 'gte', placeholder: '500' },
  { value: 'order_value_lte', label: 'Order Value ≤', operator: 'lte', placeholder: '5000' },
  { value: 'order_count_gte', label: 'Order Count ≥', operator: 'gte', placeholder: '3' },
  { value: 'product_tag',     label: 'Product Tag',   operator: 'eq',  placeholder: 'featured' },
  { value: 'customer_tag',    label: 'Customer Tag',  operator: 'eq',  placeholder: 'vip' },
  { value: 'first_order',     label: 'First Order',   operator: 'eq',  placeholder: 'true' },
];
 
const TRIGGER_LABELS: Record<string, string> = {
  order_value: 'Order Value', order_count: 'Order Count', signup: 'New Signup',
  birthday: 'Birthday', referral: 'Referral', custom_event: 'Custom Event', advanced: 'Advanced',
};
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
function newCondition(): ConditionRow {
  return { id: `cond_${Date.now()}`, type: 'order_value_gte', operator: 'gte', value: '' };
}
 
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
 
function isExpired(end?: string) {
  if (!end) return false;
  return new Date(end) < new Date();
}
 
// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ active, end }: { active: boolean; end?: string }) {
  if (!active) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Paused</span>;
  if (isExpired(end)) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Expired</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Active</span>;
}
 
// ─── Mode badge ───────────────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: RuleMode }) {
  if (mode === 'membership') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">Membership</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">Reward</span>;
}
 
// ─── Skeleton ─────────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <tr className="border-b border-gray-50">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} /></td>
      ))}
    </tr>
  );
}
 
// ─── Condition builder row ────────────────────────────────────────────────────
function ConditionBuilder({
  conditions, onChange,
}: { conditions: ConditionRow[]; onChange: (c: ConditionRow[]) => void }) {
  function update(id: string, field: keyof ConditionRow, val: string) {
    onChange(conditions.map(c => c.id === id ? { ...c, [field]: val } : c));
  }
  function remove(id: string) { onChange(conditions.filter(c => c.id !== id)); }
  function add() { onChange([...conditions, newCondition()]); }
 
  return (
    <div className="space-y-2">
      {conditions.map((c, i) => {
        const meta = CONDITION_TYPES.find(t => t.value === c.type);
        return (
          <div key={c.id} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-xs font-bold text-gray-400 w-7 text-center">AND</span>
            )}
            {i === 0 && <span className="w-7" />}
            <select
              value={c.type}
              onChange={e => update(c.id, 'type', e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              {CONDITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="text"
              placeholder={meta?.placeholder ?? 'value'}
              value={c.value}
              onChange={e => update(c.id, 'value', e.target.value)}
              className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <button onClick={() => remove(c.id)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        );
      })}
      <button onClick={add} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50 mt-1">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Add condition
      </button>
    </div>
  );
}
 
// ─── Campaign drawer ───────────────────────────────────────────────────────────
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<CampaignRule> | null;
  clientId: string;
  onSaved: () => void;
  defaultMode?: RuleMode;
}
 
function CampaignDrawer({ open, onClose, initial, clientId, onSaved, defaultMode }: DrawerProps) {
  const isEdit = !!initial?.id;
 
  // Step: 1=type, 2=trigger, 3=details, 4=rewards  (step 1 skipped on edit)
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
 
  // Form fields
  const [mode, setMode]           = useState<RuleMode>(initial?.rule_mode ?? defaultMode ?? 'standalone');
  const [name, setName]           = useState(initial?.name ?? '');
  const [description, setDesc]    = useState(initial?.description ?? '');
  const [triggerType, setTrigger] = useState<TriggerType>(initial?.trigger_type ?? 'order_value');
  const [conditions, setConds]    = useState<ConditionRow[]>(() => {
    const tc = initial?.trigger_conditions;
    if (Array.isArray(tc)) return tc;
    return [];
  });
  const [startDate, setStart]     = useState(initial?.start_date?.slice(0, 10) ?? '');
  const [endDate, setEnd]         = useState(initial?.end_date?.slice(0, 10) ?? '');
  const [maxEnroll, setMaxEnroll] = useState(String(initial?.max_enrollments ?? ''));
  const [linkExpiry, setLinkExp]  = useState(String(initial?.link_expiry_hours ?? 72));
  const [minOrder, setMinOrder]   = useState(
    mode === 'membership' ? String(initial?.trigger_conditions?.min_order_value ?? '') : ''
  );
  const [budgetCap, setBudget]    = useState(initial?.guardrails?.budget_cap ?? '');
  const [maxTotal, setMaxTotal]   = useState(initial?.guardrails?.max_rewards_total ?? '');
  const [maxPerCust, setMaxCust]  = useState(initial?.guardrails?.max_rewards_per_customer ?? '');
 
  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(isEdit ? 2 : 1);
      setError('');
    }
  }, [open, isEdit]);
 
  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
 
  if (!open) return null;
 
  const STEPS = isEdit ? ['Trigger', 'Details', 'Guardrails'] : ['Type', 'Trigger', 'Details', 'Guardrails'];
  const stepIdx = isEdit ? step - 1 : step - 1; // 0-indexed for display
 
  async function save() {
    if (!name.trim()) { setError('Campaign name is required'); return; }
    setSaving(true); setError('');
    try {
      const finalTriggerType: TriggerType = mode === 'standalone' ? 'advanced' : triggerType;
      const finalTriggerConditions = mode === 'standalone'
        ? conditions
        : { min_order_value: Number(minOrder) || 0, communication: { type: 'email', enabled: true, template: '', link_type: 'one_click', valid_days: 30 } };
 
      const payload: any = {
        client_id: clientId,
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: finalTriggerType,
        rule_mode: mode,
        is_active: true,
        priority: 0,
        start_date: startDate || null,
        end_date: endDate || null,
        max_enrollments: maxEnroll ? Number(maxEnroll) : null,
        link_expiry_hours: Number(linkExpiry) || 72,
        trigger_conditions: finalTriggerConditions,
        eligibility_conditions: mode === 'standalone' ? [] : {},
        reward_action: initial?.reward_action ?? { expiry_days: 90, reward_type: 'auto', claim_method: 'auto', allocation_timing: 'instant' },
        guardrails: { budget_cap: budgetCap, max_rewards_total: maxTotal, max_rewards_per_customer: maxPerCust },
      };
 
      if (isEdit) {
        const { error: err } = await supabase.from('campaign_rules').update(payload).eq('id', initial!.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('campaign_rules').insert(payload);
        if (err) throw err;
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
    setSaving(false);
  }
 
  const canNext = () => {
    if (step === 1) return true;
    if (step === 2) return !!name.trim();
    return true;
  };
 
  const totalSteps = STEPS.length;
 
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
 
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{isEdit ? `Edit "${initial?.name}"` : 'New Campaign'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of {totalSteps} — {STEPS[stepIdx]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
 
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-gray-900 transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
 
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
 
          {/* STEP 1: Campaign type */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">What kind of campaign?</h3>
                <p className="text-sm text-gray-500">Choose how this campaign works for your members.</p>
              </div>
              <div className="grid gap-3">
                {[
                  {
                    value: 'standalone' as RuleMode,
                    icon: '🎁',
                    title: 'Reward Campaign',
                    desc: 'Send reward links to customers after orders. Use advanced conditions to target the right customers at the right time.',
                    tags: ['Post-purchase', 'Thank-you page', 'Multi-condition'],
                  },
                  {
                    value: 'membership' as RuleMode,
                    icon: '⭐',
                    title: 'Membership Campaign',
                    desc: 'Automatically enroll members into your loyalty program when a trigger condition is met.',
                    tags: ['Auto-enroll', 'Order-based', 'Event-based'],
                  },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      mode === opt.value
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{opt.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{opt.title}</span>
                          {mode === opt.value && (
                            <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{opt.desc}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {opt.tags.map(t => (
                            <span key={t} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
 
          {/* STEP 2: Trigger + Name */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Campaign details</h3>
                <p className="text-sm text-gray-500">
                  {mode === 'standalone' ? 'Set conditions that trigger your reward campaign.' : 'Pick what fires this campaign.'}
                </p>
              </div>
 
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Campaign name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Post-purchase reward, Birthday treat"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
 
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description <span className="text-gray-300">(optional)</span></label>
                <textarea
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                  rows={2}
                  placeholder="Internal notes about this campaign..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                />
              </div>
 
              {/* Trigger — Membership */}
              {mode === 'membership' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Trigger type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SIMPLE_TRIGGERS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setTrigger(t.value)}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          triggerType === t.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-lg mb-1">{t.icon}</div>
                        <div className="text-xs font-semibold text-gray-800">{t.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5 leading-tight">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                  {(triggerType === 'order_value' || triggerType === 'order_count') && (
                    <div className="mt-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        {triggerType === 'order_value' ? 'Minimum order value (₹)' : 'Minimum order count'}
                      </label>
                      <input
                        type="number"
                        value={minOrder}
                        onChange={e => setMinOrder(e.target.value)}
                        placeholder={triggerType === 'order_value' ? '500' : '3'}
                        className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                  )}
                </div>
              )}
 
              {/* Trigger — Standalone / Advanced */}
              {mode === 'standalone' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Trigger conditions</label>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    {conditions.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-400 mb-3">No conditions yet — campaign fires for all orders</p>
                        <button
                          onClick={() => setConds([newCondition()])}
                          className="text-sm text-gray-700 font-medium border border-gray-300 rounded-lg px-4 py-2 hover:bg-white transition-colors"
                        >
                          + Add first condition
                        </button>
                      </div>
                    ) : (
                      <ConditionBuilder conditions={conditions} onChange={setConds} />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">All conditions must be true (AND logic). Leave empty to trigger on every order.</p>
                </div>
              )}
            </div>
          )}
 
          {/* STEP 3: Dates + limits */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Schedule & limits</h3>
                <p className="text-sm text-gray-500">Set when this campaign runs and how many times it fires.</p>
              </div>
 
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
                  <input type="date" value={startDate} onChange={e => setStart(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End date</label>
                  <input type="date" value={endDate} onChange={e => setEnd(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
              </div>
 
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Max enrollments <span className="text-gray-300">(optional)</span>
                  </label>
                  <input type="number" value={maxEnroll} onChange={e => setMaxEnroll(e.target.value)}
                    placeholder="Unlimited"
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Reward link expiry (hrs)
                  </label>
                  <input type="number" value={linkExpiry} onChange={e => setLinkExp(e.target.value)}
                    placeholder="72"
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
              </div>
            </div>
          )}
 
          {/* STEP 4: Guardrails */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Guardrails</h3>
                <p className="text-sm text-gray-500">Optionally cap how much this campaign spends or gives out.</p>
              </div>
 
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Budget cap (₹) <span className="text-gray-300">(optional)</span>
                  </label>
                  <input type="number" value={budgetCap} onChange={e => setBudget(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                  <p className="text-xs text-gray-400 mt-1">Campaign pauses automatically when this amount is reached.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Max total rewards <span className="text-gray-300">(optional)</span>
                  </label>
                  <input type="number" value={maxTotal} onChange={e => setMaxTotal(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Max rewards per customer <span className="text-gray-300">(optional)</span>
                  </label>
                  <input type="number" value={maxPerCust} onChange={e => setMaxCust(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
              </div>
 
              {/* Summary card */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Campaign summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium text-gray-900">{name || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-900">{mode === 'standalone' ? 'Reward Campaign' : 'Membership Campaign'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Trigger</span>
                  <span className="font-medium text-gray-900">{mode === 'standalone' ? `${conditions.length} condition(s)` : TRIGGER_LABELS[triggerType]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium text-gray-900">{startDate && endDate ? `${fmtDate(startDate)} → ${fmtDate(endDate)}` : 'No end date'}</span>
                </div>
              </div>
            </div>
          )}
 
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{error}</div>
          )}
        </div>
 
        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-colors"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < totalSteps ? (
            <button
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className="px-5 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : '🚀 Launch campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
 
// ─── Main page ────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = profile?.client_id ?? '';
 
  const [campaigns, setCampaigns] = useState<CampaignRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CampaignRule | null>(null);
  const [defaultMode, setDefaultMode] = useState<RuleMode>('standalone');
  const [filter, setFilter] = useState<'all' | 'standalone' | 'membership'>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [triggerLogsOpen, setTriggerLogsOpen] = useState(false);
 
  const fetchCampaigns = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from('campaign_rules')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  }, [clientId]);
 
  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
 
  // Support ?offer_id= query param from Offers page
  const offerIdParam = searchParams.get('offer_id');
  useEffect(() => {
    if (offerIdParam && !drawerOpen) {
      setDefaultMode('standalone');
      setEditTarget(null);
      setDrawerOpen(true);
    }
  }, [offerIdParam]);
 
  async function toggleActive(c: CampaignRule) {
    await supabase.from('campaign_rules').update({ is_active: !c.is_active }).eq('id', c.id);
    setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
  }
 
  async function deleteCampaign(id: string) {
    if (!window.confirm('Delete this campaign? This cannot be undone.')) return;
    setDeleting(id);
    await supabase.from('campaign_rules').delete().eq('id', id);
    setCampaigns(prev => prev.filter(x => x.id !== id));
    setDeleting(null);
  }
 
  async function duplicateCampaign(c: CampaignRule) {
    const { id, campaign_id, created_at, current_enrollments, ...rest } = c;
    await supabase.from('campaign_rules').insert({ ...rest, name: `${c.name} (copy)`, is_active: false, current_enrollments: 0 });
    fetchCampaigns();
  }
 
  const filtered = campaigns.filter(c => {
    if (filter === 'all') return true;
    return c.rule_mode === filter;
  });
 
  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.is_active && !isExpired(c.end_date)).length,
    totalEnrollments: campaigns.reduce((s, c) => s + (c.current_enrollments ?? 0), 0),
    reward: campaigns.filter(c => c.rule_mode === 'standalone').length,
    membership: campaigns.filter(c => c.rule_mode === 'membership').length,
  };
 
  return (
    <>
      <DashboardLayout menuItems={clientMenuItems} title="Campaigns">
        <div className="max-w-6xl mx-auto px-4 py-2">
 
          {/* Page header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
              <p className="text-sm text-gray-500 mt-0.5">Automate rewards and membership enrollment for your customers</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTriggerLogsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Trigger Logs
              </button>
              <button
                onClick={() => { setEditTarget(null); setDefaultMode('standalone'); setDrawerOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                + New Campaign
              </button>
            </div>
          </div>
 
          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total',       value: stats.total,           color: 'text-gray-900' },
              { label: 'Active',      value: stats.active,          color: 'text-emerald-600' },
              { label: 'Enrollments', value: stats.totalEnrollments, color: 'text-blue-600' },
              { label: 'Reward',      value: stats.reward,          color: 'text-violet-600' },
              { label: 'Membership',  value: stats.membership,      color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
 
          {/* Filter chips */}
          <div className="flex gap-2 mb-4">
            {[
              { id: 'all',        label: `All (${stats.total})` },
              { id: 'standalone', label: `Reward (${stats.reward})` },
              { id: 'membership', label: `Membership (${stats.membership})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
 
          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {loading ? (
              <table className="w-full text-sm">
                <tbody>{[...Array(3)].map((_, i) => <RowSkeleton key={i} />)}</tbody>
              </table>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No campaigns yet</h3>
                <p className="text-sm text-gray-400 mb-4">Create your first campaign to start rewarding customers automatically.</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => { setEditTarget(null); setDefaultMode('standalone'); setDrawerOpen(true); }}
                    className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors"
                  >
                    🎁 Reward Campaign
                  </button>
                  <button
                    onClick={() => { setEditTarget(null); setDefaultMode('membership'); setDrawerOpen(true); }}
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    ⭐ Membership Campaign
                  </button>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Campaign', 'Type', 'Trigger', 'Enrollments', 'Duration', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">{c.campaign_id}</div>
                      </td>
 
                      {/* Type badge */}
                      <td className="px-4 py-3"><ModeBadge mode={c.rule_mode} /></td>
 
                      {/* Trigger */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {c.rule_mode === 'standalone' && Array.isArray(c.trigger_conditions) && c.trigger_conditions.length > 0
                            ? `${c.trigger_conditions.length} condition${c.trigger_conditions.length > 1 ? 's' : ''}`
                            : TRIGGER_LABELS[c.trigger_type] ?? c.trigger_type}
                        </span>
                      </td>
 
                      {/* Enrollments */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-900">{c.current_enrollments ?? 0}</span>
                        {c.max_enrollments && (
                          <span className="text-gray-400 text-xs"> / {c.max_enrollments}</span>
                        )}
                      </td>
 
                      {/* Duration */}
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.start_date ? (
                          <div>
                            <div>{fmtDate(c.start_date)}</div>
                            <div className="text-gray-300">→ {fmtDate(c.end_date)}</div>
                          </div>
                        ) : '—'}
                      </td>
 
                      {/* Status */}
                      <td className="px-4 py-3"><StatusBadge active={c.is_active} end={c.end_date} /></td>
 
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Toggle active */}
                          <button
                            onClick={() => toggleActive(c)}
                            title={c.is_active ? 'Pause' : 'Activate'}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            {c.is_active ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                            )}
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => { setEditTarget(c); setDrawerOpen(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          {/* Duplicate */}
                          <button
                            onClick={() => duplicateCampaign(c)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => deleteCampaign(c.id)}
                            disabled={deleting === c.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
 
          {/* Trigger logs panel */}
          {triggerLogsOpen && (
            <TriggerLogsPanel clientId={clientId} onClose={() => setTriggerLogsOpen(false)} />
          )}
 
        </div>
      </DashboardLayout>
 
      <CampaignDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
        initial={editTarget}
        clientId={clientId}
        onSaved={fetchCampaigns}
        defaultMode={defaultMode}
      />
    </>
  );
}
 
// ─── Trigger Logs Panel ───────────────────────────────────────────────────────
function TriggerLogsPanel({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('campaign_trigger_logs')
        .select(`
          id, triggered_at, trigger_type, status, member_email,
          campaign_rule:campaign_rules(name, campaign_id)
        `)
        .eq('client_id', clientId)
        .order('triggered_at', { ascending: false })
        .limit(50);
      setLogs(data ?? []);
      setLoading(false);
    }
    load();
  }, [clientId]);
 
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Trigger Logs</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 50 campaign trigger events</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm text-gray-500">No trigger logs yet. Logs appear here when campaigns fire.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Campaign', 'Trigger', 'Member', 'Status', 'When'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{log.campaign_rule?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400 font-mono">{log.campaign_rule?.campaign_id}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{TRIGGER_LABELS[log.trigger_type] ?? log.trigger_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{log.member_email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                        log.status === 'failed' ? 'bg-red-50 text-red-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>{log.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(log.triggered_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
 