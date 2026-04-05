import { useCallback, useEffect, useState } from 'react';
import { RewardPickerModal } from '../../components/RewardPickerModal';
import { RuleBuilder } from '../../components/RuleBuilder';
import type { RewardPoolItem } from '../../components/RewardPickerModal';
import { useSearchParams } from 'react-router-dom';
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
  description?: string | null;
  campaign_id: string | null;
  client_id: string;
  program_id?: string | null;
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
  location_conditions?: any;
  attribution_conditions?: any;
  exclusion_rules?: any;
  reward_action: any;
  reward_selection_mode?: 'fixed' | 'choice';
  min_rewards_choice?: number;
  max_rewards_choice?: number;
  guardrails: any;
  created_at: string;
}

interface CampaignMetrics {
  rewardsSelected: number;
  triggered: number;
  executed: number;
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
 
const TRIGGER_LABELS: Record<string, string> = {
  order_value: 'Order Value', order_count: 'Order Count', signup: 'New Signup',
  birthday: 'Birthday', referral: 'Referral', custom_event: 'Custom Event', advanced: 'Advanced',
};
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeConditions(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any, i: number) => ({
    id: c.id || `cond_${Date.now()}_${i}`,
    type: c.type || '',
    operator: c.operator || '',
    value: c.value ?? '',
  }));
}

const TRIGGER_CONDITION_TYPES = [
  { value: 'collection_contains', label: 'Collection in Order', operators: [{ value: 'contains', label: 'Contains' }], inputType: 'text' as const, hint: 'Shopify collection ID/handle' },
  { value: 'order_value_gte', label: 'Order Value >=', operators: [{ value: 'gte', label: '>=' }], inputType: 'number' as const },
  { value: 'order_value_between', label: 'Order Value Between', operators: [{ value: 'between', label: 'Between' }], inputType: 'text' as const, hint: 'Format: min,max' },
  { value: 'order_item_count', label: 'Order Item Count', operators: [{ value: 'gte', label: '>=' }, { value: 'eq', label: '=' }, { value: 'lte', label: '<=' }], inputType: 'number' as const },
  { value: 'specific_product', label: 'Specific Product in Cart', operators: [{ value: 'contains', label: 'Contains' }, { value: 'not_contains', label: 'Does Not Contain' }], inputType: 'text' as const },
  { value: 'coupon_code', label: 'Coupon Code', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'starts_with', label: 'Starts With' }, { value: 'contains', label: 'Contains' }], inputType: 'text' as const },
];

const ELIGIBILITY_CONDITION_TYPES = [
  { value: 'customer_type', label: 'Customer Type', operators: [{ value: 'eq', label: 'Is' }], inputType: 'select' as const, options: [{ value: 'new', label: 'First-Time Customer' }, { value: 'returning', label: 'Returning Customer' }] },
  { value: 'order_number', label: 'Order Number (Nth)', operators: [{ value: 'eq', label: 'Exactly' }], inputType: 'number' as const },
  { value: 'lifetime_orders', label: 'Lifetime Order Count', operators: [{ value: 'gte', label: '>=' }, { value: 'lte', label: '<=' }], inputType: 'number' as const },
  { value: 'lifetime_spend', label: 'Lifetime Spend', operators: [{ value: 'gte', label: '>=' }, { value: 'lte', label: '<=' }], inputType: 'number' as const },
  { value: 'customer_tags', label: 'Customer Tags', operators: [{ value: 'has', label: 'Has Tag' }, { value: 'not_has', label: 'Does Not Have Tag' }], inputType: 'text' as const },
];

const LOCATION_CONDITION_TYPES = [
  { value: 'shipping_pincode', label: 'Shipping Pincode/ZIP', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'starts_with', label: 'Starts With' }, { value: 'in_list', label: 'In List' }], inputType: 'text' as const },
  { value: 'shipping_city', label: 'Shipping City', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'in_list', label: 'In List' }], inputType: 'text' as const },
  { value: 'shipping_state', label: 'Shipping State/Province', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'in_list', label: 'In List' }], inputType: 'text' as const },
  { value: 'shipping_country', label: 'Shipping Country', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'in_list', label: 'In List' }], inputType: 'text' as const },
];

const ATTRIBUTION_CONDITION_TYPES = [
  { value: 'utm_source', label: 'UTM Source', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'contains', label: 'Contains' }], inputType: 'text' as const },
  { value: 'utm_medium', label: 'UTM Medium', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'contains', label: 'Contains' }], inputType: 'text' as const },
  { value: 'utm_campaign', label: 'UTM Campaign', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'contains', label: 'Contains' }], inputType: 'text' as const },
];
 
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

  // Advanced reward fields
  const [rewardPool, setRewardPool] = useState<any[]>(initial?.reward_action?.reward_pool ?? []);
  const [allRewards, setAllRewards] = useState<RewardPoolItem[]>([]);
  const [allBrands, setAllBrands] = useState<{ id: string; name: string }[]>([]);
  const [showRewardPicker, setShowRewardPicker] = useState(false);
  const [rewardType, setRewardType] = useState(initial?.reward_action?.reward_type ?? 'auto');
  const [rewardSelectionMode, setRewardSelectionMode] = useState(initial?.reward_action?.reward_selection_mode ?? 'fixed');
  const [minRewardsChoice, setMinRewardsChoice] = useState(initial?.reward_action?.min_rewards_choice ?? 1);
  const [maxRewardsChoice, setMaxRewardsChoice] = useState(initial?.reward_action?.max_rewards_choice ?? 1);

  // Form fields
  const [mode, setMode]           = useState<RuleMode>(initial?.rule_mode ?? defaultMode ?? 'standalone');
  const [name, setName]           = useState(initial?.name ?? '');
  const [description, setDesc]    = useState(initial?.description ?? '');
  const [triggerType, setTrigger] = useState<TriggerType>(initial?.trigger_type ?? 'order_value');
  const [conditions, setConds]    = useState<any[]>(normalizeConditions(initial?.trigger_conditions));
  const [eligibilityConditions, setEligibilityConditions] = useState<any[]>(normalizeConditions(initial?.eligibility_conditions));
  const [locationConditions, setLocationConditions] = useState<any[]>(normalizeConditions(initial?.location_conditions));
  const [attributionConditions, setAttributionConditions] = useState<any[]>(normalizeConditions(initial?.attribution_conditions));
  const [exclusionRules, setExclusionRules] = useState<any>(initial?.exclusion_rules || {
    exclude_refunded: true,
    exclude_cancelled: true,
    exclude_test_orders: true,
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

  const resetForCreate = useCallback(() => {
    const nextMode = defaultMode ?? 'standalone';
    setMode(nextMode);
    setName('');
    setDesc('');
    setTrigger('order_value');
    setConds([]);
    setEligibilityConditions([]);
    setLocationConditions([]);
    setAttributionConditions([]);
    setExclusionRules({ exclude_refunded: true, exclude_cancelled: true, exclude_test_orders: true });
    setStart('');
    setEnd('');
    setMaxEnroll('');
    setLinkExp('72');
    setMinOrder('');
    setBudget('');
    setMaxTotal('');
    setMaxCust('');
    setRewardPool([]);
    setRewardType('auto');
    setRewardSelectionMode('fixed');
    setMinRewardsChoice(1);
    setMaxRewardsChoice(1);
    setStep(1);
    setError('');
  }, [defaultMode]);

  // Sync all fields with initial when editing
  useEffect(() => {
    if (open && initial) {
      setMode(initial.rule_mode ?? defaultMode ?? 'standalone');
      setName(initial.name ?? '');
      setDesc(initial.description ?? '');
      setTrigger(initial.trigger_type ?? 'order_value');
      setConds(Array.isArray(initial.trigger_conditions) ? initial.trigger_conditions : []);
      setEligibilityConditions(normalizeConditions(initial.eligibility_conditions));
      setLocationConditions(normalizeConditions(initial.location_conditions));
      setAttributionConditions(normalizeConditions(initial.attribution_conditions));
      setExclusionRules(initial.exclusion_rules || {
        exclude_refunded: true,
        exclude_cancelled: true,
        exclude_test_orders: true,
      });
      setStart(initial.start_date?.slice(0, 10) ?? '');
      setEnd(initial.end_date?.slice(0, 10) ?? '');
      setMaxEnroll(String(initial.max_enrollments ?? ''));
      setLinkExp(String(initial.link_expiry_hours ?? 72));
      setMinOrder(initial.rule_mode === 'membership' ? String(initial.trigger_conditions?.min_order_value ?? '') : '');
      setBudget(initial.guardrails?.budget_cap ?? '');
      setMaxTotal(initial.guardrails?.max_rewards_total ?? '');
      setMaxCust(initial.guardrails?.max_rewards_per_customer ?? '');
      setRewardPool(initial.reward_action?.reward_pool ?? []);
      setRewardType(initial.reward_action?.reward_type ?? 'auto');
      setRewardSelectionMode(initial.reward_action?.reward_selection_mode ?? 'fixed');
      setMinRewardsChoice(initial.reward_action?.min_rewards_choice ?? 1);
      setMaxRewardsChoice(initial.reward_action?.max_rewards_choice ?? 1);
      setStep(isEdit ? 2 : 1);
      setError('');
    }
    if (open && !initial) {
      resetForCreate();
    }
  }, [open, initial, defaultMode, isEdit, resetForCreate]);

  useEffect(() => {
    async function loadAvailableRewards() {
      if (!open || !clientId) return;
      const { data: brandsData } = await supabase.from('brands').select('id, name').eq('status', 'approved').order('name');
      setAllBrands((brandsData ?? []) as { id: string; name: string }[]);

      // Two separate simple queries avoids complex PostgREST OR syntax that causes 400s
      // Query 1: own rewards (all offer_types belonging to this client)
      const { data: ownRewards, error: e1 } = await supabase
        .from('rewards')
        .select(`
          id, title, description, value_description, image_url, category,
          coupon_type, status, expiry_date, owner_client_id, available_codes,
          offer_type,
          brands ( id, name, logo_url )
        `)
        .eq('owner_client_id', clientId)
        .or('expiry_date.is.null,expiry_date.gt.' + new Date().toISOString());

      if (e1) console.error('[loadAvailableRewards] own rewards:', e1);

      // Query 2: marketplace offers from all clients
      const { data: mktRewards, error: e2 } = await supabase
        .from('rewards')
        .select(`
          id, title, description, value_description, image_url, category,
          coupon_type, status, expiry_date, owner_client_id, available_codes,
          offer_type,
          brands ( id, name, logo_url )
        `)
        .eq('offer_type', 'marketplace_offer')
        .or('expiry_date.is.null,expiry_date.gt.' + new Date().toISOString());

      if (e2) console.error('[loadAvailableRewards] marketplace rewards:', e2);

      // Merge: own store_discount + partner_voucher + marketplace_offer from others only
      const combined = [
        ...(ownRewards ?? []).filter((r: any) => r.offer_type !== 'marketplace_offer'),
        ...(mktRewards ?? []).filter((r: any) => r.owner_client_id !== clientId),
      ];
      // Deduplicate by id
      const seen = new Set<string>();
      const rewardsData = combined.filter((r: any) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });

      const mapped: RewardPoolItem[] = rewardsData
        // Exclude expired/exhausted
        .filter((r: any) => r.status !== 'expired' && r.status !== 'exhausted')
        // unique coupon_type → must have available_codes > 0; generic → always include
        .filter((r: any) => r.coupon_type !== 'unique' || (r.available_codes ?? 0) > 0)
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          value_description: r.value_description,
          image_url: r.image_url,
          category: r.category,
          coupon_type: r.coupon_type || 'unique',
          status: r.status,
          expiry_date: r.expiry_date,
          available_vouchers: r.available_codes ?? 0,
          brand: r.brands ? { id: r.brands.id, name: r.brands.name, logo_url: r.brands.logo_url } : null,
        }));
      setAllRewards(mapped);
    }

    loadAvailableRewards();
  }, [open, clientId]);
 
  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
 
  if (!open) return null;
 
  const STEPS = ['Type', 'Details', 'Rewards', 'Guardrails'];
  const stepIdx = isEdit ? step - 1 : step - 1; // 0-indexed for display
 
  async function save() {
    if (!name.trim()) { setError('Campaign name is required'); return; }
    setSaving(true); setError('');
    try {
      const finalTriggerType: TriggerType = mode === 'standalone' ? 'advanced' : triggerType;
      const finalTriggerConditions = mode === 'standalone'
        ? conditions
        : { min_order_value: Number(minOrder) || 0, communication: { type: 'email', enabled: true, template: '', link_type: 'one_click', valid_days: 30 } };
 
      const payload = {
        client_id: clientId,
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: finalTriggerType,
        rule_mode: mode,
        is_active: true,
        priority: initial?.priority ?? 0,
        rule_version: 2,
        current_enrollments: initial?.current_enrollments ?? 0,
        program_id: mode === 'membership' ? (initial?.program_id ?? null) : null,
        start_date: startDate || null,
        end_date: endDate || null,
        max_enrollments: maxEnroll ? Number(maxEnroll) : null,
        link_expiry_hours: Number(linkExpiry) || 72,
        reward_selection_mode: rewardSelectionMode,
        min_rewards_choice: minRewardsChoice,
        max_rewards_choice: maxRewardsChoice,
        trigger_conditions: finalTriggerConditions,
        eligibility_conditions: mode === 'standalone' ? eligibilityConditions : {},
        location_conditions: mode === 'standalone' ? locationConditions : {},
        attribution_conditions: mode === 'standalone' ? attributionConditions : {},
        exclusion_rules: mode === 'standalone' ? exclusionRules : {
          exclude_refunded: true,
          exclude_cancelled: true,
          exclude_test_orders: true,
        },
        reward_action: mode === 'standalone' ? {
          expiry_days: 90,
          reward_type: rewardType,
          claim_method: 'auto',
          allocation_timing: 'instant',
          reward_pool: rewardPool,
          reward_selection_mode: rewardSelectionMode,
          min_rewards_choice: minRewardsChoice,
          max_rewards_choice: maxRewardsChoice,
        } : (initial?.reward_action ?? { expiry_days: 90, reward_type: 'auto', claim_method: 'auto', allocation_timing: 'instant' }),
        guardrails: { budget_cap: budgetCap, max_rewards_total: maxTotal, max_rewards_per_customer: maxPerCust },
      };
      let campaignId: string;
      if (isEdit) {
        if (!initial?.id) throw new Error('Missing campaign ID');
        const { error: err } = await (supabase as any).from('campaign_rules').update(payload).eq('id', initial.id);
        if (err) throw err;
        campaignId = initial.id;
      } else {
        const { data: newRule, error: err } = await (supabase as any).from('campaign_rules').insert(payload).select('id').single();
        if (err) throw err;
        campaignId = newRule.id;
      }
      // Sync reward pool to campaign_reward_pools table (used by validate-campaign-token)
      if (mode === 'standalone') {
        await (supabase as any).from('campaign_reward_pools').delete().eq('campaign_rule_id', campaignId);
        if (rewardPool.length > 0) {
          const poolInserts = rewardPool.map((r: any, i: number) => ({
            campaign_rule_id: campaignId,
            reward_id: r.id,
            sort_order: i,
          }));
          const { error: poolErr } = await (supabase as any).from('campaign_reward_pools').insert(poolInserts);
          if (poolErr) console.error('Pool sync error:', poolErr);
        }
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
    if (step === 3 && mode === 'standalone') return rewardPool.length > 0 && minRewardsChoice > 0 && maxRewardsChoice >= minRewardsChoice;
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
 
          {/* STEP 2: Details */}
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
 
              {/* Membership trigger (simple) */}
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
 
              {/* Standalone advanced triggers */}
              {mode === 'standalone' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Trigger conditions</label>
                  <RuleBuilder
                    conditions={conditions}
                    onChange={setConds}
                    conditionTypes={TRIGGER_CONDITION_TYPES}
                  />
                  <p className="text-xs text-gray-400">All trigger conditions must be true (AND logic). Leave empty to trigger on every order.</p>

                  <div className="pt-3 border-t border-gray-100">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Audience conditions</label>
                    <RuleBuilder
                      conditions={eligibilityConditions}
                      onChange={setEligibilityConditions}
                      conditionTypes={ELIGIBILITY_CONDITION_TYPES}
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Location conditions</label>
                    <RuleBuilder
                      conditions={locationConditions}
                      onChange={setLocationConditions}
                      conditionTypes={LOCATION_CONDITION_TYPES}
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attribution conditions</label>
                    <RuleBuilder
                      conditions={attributionConditions}
                      onChange={setAttributionConditions}
                      conditionTypes={ATTRIBUTION_CONDITION_TYPES}
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Exclusions</label>
                    {[{ key: 'exclude_refunded', label: 'Exclude refunded orders' }, { key: 'exclude_cancelled', label: 'Exclude cancelled orders' }, { key: 'exclude_test_orders', label: 'Exclude test/staff orders' }].map(opt => (
                      <label key={opt.key} className="flex items-center gap-2 py-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!exclusionRules?.[opt.key]}
                          onChange={e => setExclusionRules((prev: any) => ({ ...prev, [opt.key]: e.target.checked }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
 
          {/* STEP 3: Rewards */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Reward setup</h3>
                <p className="text-sm text-gray-500">Configure reward pool and selection experience.</p>
              </div>

              {mode === 'standalone' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reward Pool</label>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors mb-2"
                      onClick={() => setShowRewardPicker(true)}
                    >
                      {rewardPool.length === 0 ? '+ Add Rewards' : `Edit Rewards (${rewardPool.length} selected)`}
                    </button>
                    {rewardPool.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {rewardPool.map((r: any) => (
                          <span key={r.id} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">{r.title}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reward Type</label>
                      <select value={rewardType} onChange={e => setRewardType(e.target.value)} className="border rounded px-2 py-1 text-sm">
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Selection Mode</label>
                      <select value={rewardSelectionMode} onChange={e => setRewardSelectionMode(e.target.value as 'fixed' | 'choice')} className="border rounded px-2 py-1 text-sm">
                        <option value="fixed">Fixed</option>
                        <option value="choice">Choice</option>
                      </select>
                    </div>
                    {rewardSelectionMode === 'choice' && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Min Choices</label>
                          <input type="number" value={minRewardsChoice} onChange={e => setMinRewardsChoice(Number(e.target.value) || 1)} className="border rounded px-2 py-1 text-sm w-16" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Max Choices</label>
                          <input type="number" value={maxRewardsChoice} onChange={e => setMaxRewardsChoice(Math.max(minRewardsChoice, Number(e.target.value) || 1))} className="border rounded px-2 py-1 text-sm w-16" />
                        </div>
                      </>
                    )}
                  </div>

                  {showRewardPicker && (
                    <RewardPickerModal
                      rewards={allRewards}
                      brands={allBrands}
                      selected={rewardPool}
                      onToggle={reward => {
                        setRewardPool(prev => prev.some((r: any) => r.id === reward.id)
                          ? prev.filter((r: any) => r.id !== reward.id)
                          : [...prev, reward]);
                      }}
                      onClose={() => setShowRewardPicker(false)}
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">Membership campaign rewards are configured from your membership program.</p>
              )}
            </div>
          )}
 
          {/* STEP 4: Schedule + Guardrails */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Schedule & guardrails</h3>
                <p className="text-sm text-gray-500">Set campaign dates, limits, and budget controls.</p>
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
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Max enrollments <span className="text-gray-300">(optional)</span></label>
                  <input type="number" value={maxEnroll} onChange={e => setMaxEnroll(e.target.value)} placeholder="Unlimited"
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reward link expiry (hrs)</label>
                  <input type="number" value={linkExpiry} onChange={e => setLinkExp(e.target.value)} placeholder="72"
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                </div>
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
  const [copiedCampaignId, setCopiedCampaignId] = useState<string | null>(null);
  const [campaignMetrics, setCampaignMetrics] = useState<Record<string, CampaignMetrics>>({});
 
  const fetchCampaigns = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from('campaign_rules')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    const rules = (data ?? []) as CampaignRule[];
    setCampaigns(rules);

    const ruleIds = rules.map(r => r.id);
    if (ruleIds.length === 0) {
      setCampaignMetrics({});
      setLoading(false);
      return;
    }

    const [poolRes, logsRes, evalRes] = await Promise.all([
      supabase.from('campaign_reward_pools').select('campaign_rule_id, reward_id').in('campaign_rule_id', ruleIds),
      supabase.from('campaign_trigger_logs').select('campaign_rule_id, trigger_result').in('campaign_rule_id', ruleIds),
      supabase.from('campaign_rule_evaluations').select('campaign_rule_id, evaluation_result, reward_allocated').in('campaign_rule_id', ruleIds),
    ]);

    const metrics: Record<string, CampaignMetrics> = {};
    for (const r of rules) {
      metrics[r.id] = {
        rewardsSelected: Array.isArray(r.reward_action?.reward_pool) ? r.reward_action.reward_pool.length : 0,
        triggered: 0,
        executed: 0,
      };
    }

    const poolRows = (poolRes.data ?? []) as any[];
    if (poolRows.length > 0) {
      const poolCountByCampaign = new Map<string, Set<string>>();
      for (const row of poolRows) {
        if (!poolCountByCampaign.has(row.campaign_rule_id)) poolCountByCampaign.set(row.campaign_rule_id, new Set());
        poolCountByCampaign.get(row.campaign_rule_id)!.add(row.reward_id);
      }
      for (const [id, rewardSet] of poolCountByCampaign.entries()) {
        if (metrics[id]) metrics[id].rewardsSelected = rewardSet.size;
      }
    }

    const logsByCampaign: Record<string, { total: number; success: number }> = {};
    for (const row of ((logsRes.data ?? []) as any[])) {
      if (!row.campaign_rule_id) continue;
      if (!logsByCampaign[row.campaign_rule_id]) logsByCampaign[row.campaign_rule_id] = { total: 0, success: 0 };
      logsByCampaign[row.campaign_rule_id].total += 1;
      if (row.trigger_result === 'success') logsByCampaign[row.campaign_rule_id].success += 1;
    }

    const evalByCampaign: Record<string, { total: number; success: number }> = {};
    for (const row of ((evalRes.data ?? []) as any[])) {
      if (!row.campaign_rule_id) continue;
      if (!evalByCampaign[row.campaign_rule_id]) evalByCampaign[row.campaign_rule_id] = { total: 0, success: 0 };
      evalByCampaign[row.campaign_rule_id].total += 1;
      if (row.reward_allocated === true || row.evaluation_result === 'matched') evalByCampaign[row.campaign_rule_id].success += 1;
    }

    for (const id of ruleIds) {
      const logStats = logsByCampaign[id];
      const evalStats = evalByCampaign[id];
      if (metrics[id]) {
        metrics[id].triggered = logStats?.total ?? evalStats?.total ?? 0;
        metrics[id].executed = logStats?.success ?? evalStats?.success ?? 0;
      }
    }

    setCampaignMetrics(metrics);
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
    await (supabase as any).from('campaign_rules').update({ is_active: !c.is_active }).eq('id', c.id);
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
    await (supabase as any).from('campaign_rules').insert({ ...rest, name: `${c.name} (copy)`, is_active: false, current_enrollments: 0 });
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
                        <div className="text-xs text-gray-400 mt-0.5 font-mono flex items-center gap-2">
                          <span>{c.campaign_id}</span>
                          {!!c.campaign_id && (
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(c.campaign_id || '');
                                setCopiedCampaignId(c.id);
                                setTimeout(() => setCopiedCampaignId(prev => (prev === c.id ? null : prev)), 1200);
                              }}
                              className="text-gray-400 hover:text-gray-700"
                              title="Copy Campaign ID"
                            >
                              {copiedCampaignId === c.id ? 'Copied' : 'Copy'}
                            </button>
                          )}
                        </div>
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
                        <div className="text-[11px] text-gray-400 mt-1">
                          Rewards: {campaignMetrics[c.id]?.rewardsSelected ?? 0} | Triggered: {campaignMetrics[c.id]?.triggered ?? 0} | Executed: {campaignMetrics[c.id]?.executed ?? 0}
                        </div>
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

      // Step 1: fetch raw logs without embedded join (join can silently fail due to RLS on campaign_rules)
      const { data, error } = await supabase
        .from('campaign_trigger_logs')
        .select('id, created_at, trigger_result, customer_email, customer_phone, campaign_rule_id, order_id, order_number, order_value, shopify_order_name, transaction_id, campaign_display_id, reward_link, reason')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load campaign_trigger_logs:', error.message, error);
      }

      const rows = data ?? [];

      // Step 2: enrich with campaign names via a separate query
      let campaignMap: Record<string, { name: string; campaign_id: string; trigger_type: string }> = {};
      if (rows.length > 0) {
        const ruleIds = [...new Set(rows.map((r: any) => r.campaign_rule_id).filter(Boolean))];
        if (ruleIds.length > 0) {
          const { data: rules } = await supabase
            .from('campaign_rules')
            .select('id, name, campaign_id, trigger_type')
            .in('id', ruleIds);
          for (const r of (rules ?? [])) {
            campaignMap[r.id] = { name: r.name, campaign_id: r.campaign_id, trigger_type: r.trigger_type };
          }
        }
        const normalized = rows.map((row: any) => ({
          id: row.id,
          trigger_type: campaignMap[row.campaign_rule_id]?.trigger_type || 'advanced',
          status: row.trigger_result,
          member_email: row.customer_email,
          member_phone: row.customer_phone,
          triggered_at: row.created_at,
          campaign_rule: campaignMap[row.campaign_rule_id] ?? null,
          order_id: row.order_id,
          order_number: row.order_number,
          order_value: row.order_value,
          shopify_order_name: row.shopify_order_name,
          transaction_id: row.transaction_id,
          campaign_display_id: row.campaign_display_id,
          reward_link: row.reward_link,
          reason: row.reason,
        }));
        setLogs(normalized);
      }
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
                  {['Campaign', 'Order', 'Member', 'Value', 'Status', 'Reason', 'Tx ID', 'When'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{log.campaign_rule?.name ?? '—'}</div>
                      <div className="text-xs text-indigo-600 font-mono">{log.campaign_display_id || log.campaign_rule?.campaign_id}</div>
                      <div className="text-xs text-gray-400">{TRIGGER_LABELS[log.trigger_type] ?? log.trigger_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-900">{log.shopify_order_name || (log.order_number ? `#${log.order_number}` : '—')}</div>
                      <div className="text-xs text-gray-400 font-mono" title={log.order_id}>{log.order_id ? `${log.order_id}` : '—'}</div>
                      {log.reward_link && (
                        <a href={log.reward_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-800 mt-0.5">
                          ↗ Reward link
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">{log.member_email ?? '—'}</div>
                      {log.member_phone && <div className="text-xs text-gray-400">{log.member_phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {log.order_value != null ? `₹${Number(log.order_value).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                        log.status === 'failed' ? 'bg-red-50 text-red-600' :
                        log.status === 'below_threshold' ? 'bg-yellow-50 text-yellow-700' :
                        log.status === 'no_member' ? 'bg-orange-50 text-orange-700' :
                        log.status === 'already_enrolled' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{log.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-500 max-w-[180px] truncate" title={log.reason}>{log.reason ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {log.transaction_id ? (
                        <span className="font-mono text-xs text-gray-400 cursor-pointer hover:text-gray-700"
                          title={log.transaction_id}
                          onClick={() => navigator.clipboard.writeText(log.transaction_id)}>
                          {log.transaction_id.slice(0, 8)}…
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
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
 