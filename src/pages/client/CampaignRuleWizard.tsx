import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Button } from '../../components/ui/Button';
import {
  ChevronRight, ChevronLeft, Check, Users, Zap, MapPin, TrendingUp, Shield,
  Gift, Search, X, Tag, Layers, Megaphone, Activity, ArrowLeft,
  Settings, Rocket, ListChecks,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';
import { RuleBuilder } from '../../components/RuleBuilder';
import { RewardPickerModal } from '../../components/RewardPickerModal';

// ── Types ─────────────────────────────────────────────────────────────────────
interface RewardPoolItem {
  id: string;
  title: string;
  description: string;
  value_description: string;
  image_url: string | null;
  category: string;
  coupon_type: 'generic' | 'unique';
  status: string;
  expiry_date: string | null;
  available_vouchers: number;
  brand: { id: string; name: string; logo_url: string | null } | null;
}

interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  type: 'custom' | 'smart';
}

function normalizeConditions(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any, i: number) => ({
    id: c.id || `cond_${Date.now()}_${i}`,
    type: c.type || '',
    operator: c.operator || '',
    value: c.value ?? '',
  }));
}

const STEPS = [
  { id: 1, label: 'Basics',   icon: Layers,  color: 'blue' },
  { id: 2, label: 'Triggers', icon: Zap,     color: 'yellow' },
  { id: 3, label: 'Audience', icon: Users,   color: 'green' },
  { id: 4, label: 'Rewards',  icon: Gift,    color: 'purple' },
  { id: 5, label: 'Launch',   icon: Rocket,  color: 'indigo' },
];

type ColorKey = 'blue' | 'yellow' | 'green' | 'purple' | 'indigo';
const colorMap: Record<ColorKey, { bg: string; text: string; ring: string; border: string; badge: string }> = {
  blue:   { bg: 'bg-blue-600',   text: 'text-blue-600',   ring: 'ring-blue-600',   border: 'border-blue-200',   badge: 'bg-blue-50 text-blue-700'   },
  yellow: { bg: 'bg-amber-500',  text: 'text-amber-600',  ring: 'ring-amber-500',  border: 'border-amber-200',  badge: 'bg-amber-50 text-amber-700'  },
  green:  { bg: 'bg-green-600',  text: 'text-green-600',  ring: 'ring-green-600',  border: 'border-green-200',  badge: 'bg-green-50 text-green-700'  },
  purple: { bg: 'bg-purple-600', text: 'text-purple-600', ring: 'ring-purple-600', border: 'border-purple-200', badge: 'bg-purple-50 text-purple-700' },
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', ring: 'ring-indigo-600', border: 'border-indigo-200', badge: 'bg-indigo-50 text-indigo-700' },
};

export function CampaignRuleWizard() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = Boolean(editId);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState('');
  const [programs, setPrograms] = useState<any[]>([]);
  const [allRewards, setAllRewards] = useState<RewardPoolItem[]>([]);
  const [allBrands, setAllBrands] = useState<any[]>([]);
  const [selectedPool, setSelectedPool] = useState<RewardPoolItem[]>([]);
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const [availableScopes, setAvailableScopes] = useState<string[]>([
    'read_orders', 'read_customers', 'read_products', 'read_discounts',
  ]);

  const [collectionQuery, setCollectionQuery] = useState('');
  const [collectionResults, setCollectionResults] = useState<ShopifyCollection[]>([]);
  const [collectionSearching, setCollectionSearching] = useState(false);
  const collectionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState({
    rule_mode: 'membership' as 'membership' | 'standalone',
    program_id: '',
    name: '',
    description: '',
    rule_version: 2,
    reward_selection_mode: 'choice' as 'choice' | 'fixed',
    min_rewards_choice: 1,
    max_rewards_choice: 1,
    link_expiry_hours: 72,
    trigger_conditions: [] as any[],
    eligibility_conditions: [] as any[],
    location_conditions: [] as any[],
    attribution_conditions: [] as any[],
    exclusion_rules: { exclude_refunded: true, exclude_cancelled: true, exclude_test_orders: true },
    reward_action: { reward_type: 'auto', allocation_timing: 'instant', claim_method: 'auto', expiry_days: 90 },
    guardrails: { max_rewards_per_customer: '', max_rewards_total: '', budget_cap: '' },
    priority: 0,
    start_date: '',
    end_date: '',
    max_enrollments: '',
    is_active: true,
  });

  useEffect(() => { loadClientId(); }, []);

  useEffect(() => {
    if (clientId) {
      loadPrograms();
      loadShopifyScopes();
      loadAvailableRewards().then(() => {
        if (isEditing && editId) loadExistingRule(editId);
      });
    }
  }, [clientId]);

  const loadClientId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single();
    if (profile?.client_id) setClientId(profile.client_id);
  };

  const loadPrograms = async () => {
    const { data } = await supabase.from('membership_programs').select('*').eq('client_id', clientId).eq('is_active', true).order('name');
    if (data) setPrograms(data);
  };

  const loadShopifyScopes = async () => {
    const { data } = await supabase.from('store_installations').select('scopes').eq('client_id', clientId).eq('installation_status', 'active').maybeSingle();
    if (data?.scopes) setAvailableScopes(data.scopes);
  };

  const loadAvailableRewards = async () => {
    const { data: brandsData } = await supabase.from('brands').select('id, name').eq('status', 'approved').order('name');
    if (brandsData) setAllBrands(brandsData);

    const { data: rewardsData } = await supabase.from('rewards').select(`
      id, title, description, value_description, image_url, category,
      coupon_type, status, expiry_date, owner_client_id, available_codes,
      offer_type,
      brands ( id, name, logo_url )
    `)
      .or(`owner_client_id.eq.${clientId},offer_type.eq.marketplace_offer`)
      .or('expiry_date.is.null,expiry_date.gt.' + new Date().toISOString());

    if (rewardsData) {
      const items: RewardPoolItem[] = rewardsData
        // Exclude own marketplace_offer rewards
        .filter((r: any) => !(r.offer_type === 'marketplace_offer' && r.owner_client_id === clientId))
        // Exclude unique rewards with no available codes
        .filter((r: any) => r.coupon_type !== 'unique' || (r.available_codes ?? 0) > 0)
        .map((r: any) => ({
          id: r.id, title: r.title, description: r.description,
          value_description: r.value_description, image_url: r.image_url,
          category: r.category, coupon_type: r.coupon_type || 'unique',
          status: r.status, expiry_date: r.expiry_date,
          available_vouchers: r.available_codes ?? 0,
          brand: r.brands ? { id: r.brands.id, name: r.brands.name, logo_url: r.brands.logo_url } : null,
        }));
      setAllRewards(items);
      return items;
    }
    return [];
  };

  const loadExistingRule = async (ruleId: string) => {
    const { data: rule } = await supabase.from('campaign_rules').select('*').eq('id', ruleId).single();
    if (!rule) return;
    setFormData({
      rule_mode: rule.rule_mode || 'membership',
      program_id: rule.program_id || '',
      name: rule.name,
      description: rule.description || '',
      rule_version: rule.rule_version,
      reward_selection_mode: rule.reward_selection_mode || 'choice',
      min_rewards_choice: rule.min_rewards_choice ?? 1,
      max_rewards_choice: rule.max_rewards_choice ?? 1,
      link_expiry_hours: rule.link_expiry_hours ?? 72,
      trigger_conditions: normalizeConditions(rule.trigger_conditions),
      eligibility_conditions: normalizeConditions(rule.eligibility_conditions),
      location_conditions: normalizeConditions(rule.location_conditions),
      attribution_conditions: normalizeConditions(rule.attribution_conditions),
      exclusion_rules: rule.exclusion_rules || { exclude_refunded: true, exclude_cancelled: true, exclude_test_orders: true },
      reward_action: rule.reward_action || { reward_type: 'auto', allocation_timing: 'instant', claim_method: 'auto', expiry_days: 90 },
      guardrails: rule.guardrails || { max_rewards_per_customer: '', max_rewards_total: '', budget_cap: '' },
      priority: rule.priority,
      start_date: rule.start_date || '',
      end_date: rule.end_date || '',
      max_enrollments: rule.max_enrollments?.toString() || '',
      is_active: rule.is_active,
    });
    if ((rule.rule_mode || 'membership') === 'standalone') {
      const { data: poolData } = await supabase.from('campaign_reward_pools').select('reward_id').eq('campaign_rule_id', ruleId).order('sort_order');
      if (poolData) {
        const poolIds = poolData.map((r: any) => r.reward_id);
        setAllRewards(prev => {
          setSelectedPool(prev.filter(r => poolIds.includes(r.id)));
          return prev;
        });
      }
    }
  };

  const handleSave = async (draft = false) => {
    if (!formData.name.trim()) { alert('Campaign name is required.'); setStep(1); return; }
    if (formData.rule_mode === 'membership' && !formData.program_id) { alert('Please select a membership program.'); setStep(1); return; }
    if (formData.rule_mode === 'standalone' && selectedPool.length === 0) { alert('Please add at least one reward to the pool.'); setStep(4); return; }

    setSaving(true);
    try {
      const ruleData = {
        client_id: clientId,
        program_id: formData.rule_mode === 'membership' ? formData.program_id : null,
        name: formData.name,
        description: formData.description || null,
        trigger_type: 'advanced',
        rule_version: 2,
        rule_mode: formData.rule_mode,
        reward_selection_mode: formData.reward_selection_mode,
        min_rewards_choice: formData.min_rewards_choice,
        max_rewards_choice: formData.max_rewards_choice,
        link_expiry_hours: formData.link_expiry_hours,
        trigger_conditions: formData.trigger_conditions,
        eligibility_conditions: formData.eligibility_conditions,
        location_conditions: formData.location_conditions,
        attribution_conditions: formData.attribution_conditions,
        exclusion_rules: formData.exclusion_rules,
        reward_action: formData.reward_action,
        guardrails: formData.guardrails,
        priority: formData.priority,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        max_enrollments: formData.max_enrollments ? parseInt(formData.max_enrollments) : null,
        is_active: draft ? false : formData.is_active,
        required_scopes: ['read_orders', 'read_customers'],
      };

      let ruleId: string;
      if (isEditing && editId) {
        const { error } = await supabase.from('campaign_rules').update(ruleData).eq('id', editId);
        if (error) throw error;
        ruleId = editId;
      } else {
        const { data: newRule, error } = await supabase.from('campaign_rules').insert([ruleData]).select('id').single();
        if (error) throw error;
        ruleId = newRule.id;
      }

      if (formData.rule_mode === 'standalone') {
        await supabase.from('campaign_reward_pools').delete().eq('campaign_rule_id', ruleId);
        if (selectedPool.length > 0) {
          const poolRows = selectedPool.map((r, i) => ({ campaign_rule_id: ruleId, reward_id: r.id, sort_order: i }));
          const { error: poolErr } = await supabase.from('campaign_reward_pools').insert(poolRows);
          if (poolErr) throw poolErr;
        }
      }

      navigate('/client/campaigns-advanced');
    } catch (err: any) {
      alert(err.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const searchCollections = useCallback(async (query: string) => {
    if (!query.trim()) { setCollectionResults([]); return; }
    setCollectionSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-shopify-collections', { body: { query } });
      if (!error && data?.collections) setCollectionResults(data.collections);
    } catch { /* ignore */ } finally {
      setCollectionSearching(false);
    }
  }, []);

  const handleCollectionQueryChange = (val: string) => {
    setCollectionQuery(val);
    if (collectionDebounce.current) clearTimeout(collectionDebounce.current);
    collectionDebounce.current = setTimeout(() => searchCollections(val), 400);
  };

  const addCollectionCondition = (col: ShopifyCollection) => {
    const newCond = { id: `cond_${Date.now()}`, type: 'collection_contains', operator: 'contains', value: col.id };
    setFormData(prev => ({ ...prev, trigger_conditions: [...prev.trigger_conditions, newCond] }));
    setCollectionQuery('');
    setCollectionResults([]);
  };

  const togglePoolReward = (reward: RewardPoolItem) =>
    setSelectedPool(prev => prev.some(r => r.id === reward.id) ? prev.filter(r => r.id !== reward.id) : [...prev, reward]);

  // ── Condition types ───────────────────────────────────────────────────────────
  const triggerConditionTypes = [
    { value: 'collection_contains', label: 'Collection in Order', operators: [{ value: 'contains', label: 'Contains' }], inputType: 'text' as const, hint: 'Shopify collection ID (use collection search below)', requiredScope: 'read_products' },
    { value: 'order_value_gte', label: 'Order Value ≥', operators: [{ value: 'gte', label: '≥' }], inputType: 'number' as const, hint: 'Minimum order value', requiredScope: 'read_orders' },
    { value: 'order_value_between', label: 'Order Value Between', operators: [{ value: 'between', label: 'Between' }], inputType: 'text' as const, hint: 'Format: min,max', requiredScope: 'read_orders' },
    { value: 'order_item_count', label: 'Order Item Count', operators: [{ value: 'gte', label: '≥' }, { value: 'eq', label: '=' }, { value: 'lte', label: '≤' }], inputType: 'number' as const, requiredScope: 'read_orders' },
    { value: 'specific_product', label: 'Specific Product in Cart', operators: [{ value: 'contains', label: 'Contains' }, { value: 'not_contains', label: 'Does Not Contain' }], inputType: 'text' as const, hint: 'Product ID or handle', requiredScope: 'read_products' },
    { value: 'product_collection', label: 'Product from Collection', operators: [{ value: 'in', label: 'In Collection' }, { value: 'not_in', label: 'Not In Collection' }], inputType: 'text' as const, hint: 'Collection ID or handle', requiredScope: 'read_products' },
    { value: 'coupon_code', label: 'Coupon Code', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'starts_with', label: 'Starts With' }, { value: 'contains', label: 'Contains' }], inputType: 'text' as const, requiredScope: 'read_discounts' },
    { value: 'payment_method', label: 'Payment Method', operators: [{ value: 'eq', label: 'Is' }], inputType: 'select' as const, options: [{ value: 'prepaid', label: 'Prepaid' }, { value: 'cod', label: 'Cash on Delivery' }], requiredScope: 'read_orders' },
  ];
  const eligibilityConditionTypes = [
    { value: 'customer_type', label: 'Customer Type', operators: [{ value: 'eq', label: 'Is' }], inputType: 'select' as const, options: [{ value: 'new', label: 'First-Time Customer' }, { value: 'returning', label: 'Returning Customer' }], requiredScope: 'read_customers' },
    { value: 'order_number', label: 'Order Number (Nth Order)', operators: [{ value: 'eq', label: 'Exactly' }], inputType: 'number' as const, hint: 'E.g., 2 for second order', requiredScope: 'read_customers' },
    { value: 'lifetime_orders', label: 'Lifetime Order Count', operators: [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }], inputType: 'number' as const, requiredScope: 'read_customers' },
    { value: 'lifetime_spend', label: 'Lifetime Spend', operators: [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }], inputType: 'number' as const, requiredScope: 'read_customers' },
    { value: 'customer_tags', label: 'Customer Tags', operators: [{ value: 'has', label: 'Has Tag' }, { value: 'not_has', label: 'Does Not Have Tag' }], inputType: 'text' as const, requiredScope: 'read_customers' },
  ];
  const locationConditionTypes = [
    { value: 'shipping_pincode', label: 'Shipping Pincode/ZIP', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'starts_with', label: 'Starts With' }, { value: 'in_list', label: 'In List' }], inputType: 'text' as const, hint: 'Comma-separated for list', requiredScope: 'read_orders' },
    { value: 'shipping_city', label: 'Shipping City', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'in_list', label: 'In List' }], inputType: 'text' as const, hint: 'Comma-separated for list', requiredScope: 'read_orders' },
    { value: 'shipping_state', label: 'Shipping State/Province', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'in_list', label: 'In List' }], inputType: 'text' as const, requiredScope: 'read_orders' },
    { value: 'shipping_country', label: 'Shipping Country', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'in_list', label: 'In List' }], inputType: 'text' as const, hint: 'Country code (e.g., US, IN)', requiredScope: 'read_orders' },
  ];
  const attributionConditionTypes = [
    { value: 'utm_source', label: 'UTM Source', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'contains', label: 'Contains' }], inputType: 'text' as const, requiredScope: 'read_orders' },
    { value: 'utm_medium', label: 'UTM Medium', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'contains', label: 'Contains' }], inputType: 'text' as const, requiredScope: 'read_orders' },
    { value: 'utm_campaign', label: 'UTM Campaign', operators: [{ value: 'exact', label: 'Exact Match' }, { value: 'contains', label: 'Contains' }], inputType: 'text' as const, requiredScope: 'read_orders' },
  ];

  // ── Sub-components ────────────────────────────────────────────────────────────
  const stepColor = colorMap[STEPS[step - 1].color as ColorKey];

  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((s, idx) => {
        const c = colorMap[s.color as ColorKey];
        const done = step > s.id;
        const active = step === s.id;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => (done || active) ? setStep(s.id) : undefined}
              className={`flex flex-col items-center gap-1 ${done ? 'cursor-pointer' : active ? 'cursor-default' : 'cursor-not-allowed opacity-40'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${done ? c.bg + ' text-white ring-2 ring-offset-2 ' + c.ring
                  : active ? c.bg + ' text-white shadow-lg scale-110'
                  : 'bg-gray-100 text-gray-400'}`}>
                {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs font-medium ${active ? c.text : done ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${step > s.id ? colorMap[STEPS[idx + 1].color as ColorKey].bg : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const StepHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className={`rounded-xl border ${stepColor.border} ${stepColor.badge} px-5 py-4 mb-6`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${stepColor.text} mb-0.5`}>Step {step} of {STEPS.length}</p>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
    </div>
  );

  const NavButtons = ({ nextLabel = 'Continue', nextDisabled = false }: { nextLabel?: string; nextDisabled?: boolean }) => (
    <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-200">
      <div className="flex gap-3">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => handleSave(true)} disabled={saving}>
          Save Draft
        </Button>
      </div>
      <Button
        type="button"
        onClick={() => { if (step < 5) setStep(s => s + 1); else handleSave(false); }}
        disabled={nextDisabled || saving}
      >
        {saving ? 'Saving…' : step === 5 ? (isEditing ? 'Update Campaign' : 'Launch Campaign') : nextLabel}
        {step < 5 && <ChevronRight className="w-4 h-4 ml-1" />}
      </Button>
    </div>
  );

  // ── STEP 1: Basics ─────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      <StepHeader title="Campaign Basics" subtitle="Start with the fundamentals — give your campaign a name and choose how it rewards customers." />

      {!isEditing && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Campaign Type</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'membership', label: 'Membership Campaign', icon: Users, color: 'blue' as ColorKey, hint: 'Rewards linked to a loyalty program tier.' },
              { value: 'standalone', label: 'Standalone Campaign', icon: Zap,   color: 'purple' as ColorKey, hint: 'One-off rewards on any eligible order — no program needed.' },
            ] as const).map(opt => {
              const Icon = opt.icon;
              const active = formData.rule_mode === opt.value;
              const c = colorMap[opt.color];
              return (
                <button key={opt.value} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, rule_mode: opt.value }))}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${active ? c.border + ' ' + c.badge + ' ring-2 ' + c.ring : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${active ? c.bg + ' text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-1 leading-relaxed">{opt.hint}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isEditing && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${formData.rule_mode === 'standalone' ? colorMap.purple.badge : colorMap.blue.badge}`}>
          {formData.rule_mode === 'standalone' ? <Zap className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          {formData.rule_mode === 'standalone' ? 'Standalone Campaign' : 'Membership Campaign'}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Campaign Name <span className="text-red-500">*</span></label>
        <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g., Premium Customer Reward" required
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

      {formData.rule_mode === 'membership' && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Membership Program <span className="text-red-500">*</span></label>
          <select value={formData.program_id} onChange={e => setFormData(p => ({ ...p, program_id: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="">Select a program...</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {programs.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No active programs found.{' '}
              <button type="button" onClick={() => navigate('/client/loyalty')} className="underline">Create one first →</button>
            </p>
          )}
        </div>
      )}

      {formData.rule_mode === 'standalone' && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Reward Link Expiry</label>
          <div className="flex items-center gap-3">
            <input type="number" min={1} max={8760} value={formData.link_expiry_hours}
              onChange={e => setFormData(p => ({ ...p, link_expiry_hours: parseInt(e.target.value) || 72 }))}
              className="w-28 px-3 py-2.5 border border-gray-300 rounded-lg" />
            <span className="text-sm text-gray-500">hours after the order is placed</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">After this period the reward selection link expires.</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
          rows={3} placeholder="Briefly describe what this campaign does, who it targets, and why..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none" />
      </div>

      <NavButtons nextLabel="Set Triggers →"
        nextDisabled={!formData.name.trim() || (formData.rule_mode === 'membership' && !formData.program_id)} />
    </div>
  );

  // ── STEP 2: Triggers ───────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-5">
      <StepHeader title="Trigger Conditions" subtitle="Define the order events that must occur for this campaign to fire. Leave empty to trigger on every order." />
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>How triggers work:</strong> All conditions you add here must match. If empty, every order triggers the campaign.
      </div>
      <RuleBuilder conditions={formData.trigger_conditions}
        onChange={c => setFormData(p => ({ ...p, trigger_conditions: c }))}
        conditionTypes={triggerConditionTypes} availableScopes={availableScopes} />

      <div className="border-t border-gray-200 pt-5">
        <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-600" /> Quick Add: Shopify Collection Trigger
        </label>
        <p className="text-xs text-gray-500 mb-3">Search and select a collection — adds a "Collection in Order" condition automatically.</p>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search Shopify collections..." value={collectionQuery}
            onChange={e => handleCollectionQueryChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          {collectionSearching && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {collectionResults.length > 0 && (
          <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto shadow-sm">
            {collectionResults.map(col => (
              <button key={col.id} type="button" onClick={() => addCollectionCondition(col)}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm flex items-center justify-between">
                <span>{col.title}</span>
                <span className="text-xs text-gray-400">{col.type} · {col.handle}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <NavButtons nextLabel="Set Audience →" />
    </div>
  );

  // ── STEP 3: Audience ───────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-6">
      <StepHeader title="Audience & Eligibility" subtitle="Filter who can earn from this campaign. All sections are optional — leave empty to allow everyone." />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center"><Users className="w-4 h-4 text-green-700" /></div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">Customer Eligibility</div>
            <div className="text-xs text-gray-500">Based on purchase history and customer record.</div>
          </div>
        </div>
        <RuleBuilder conditions={formData.eligibility_conditions}
          onChange={c => setFormData(p => ({ ...p, eligibility_conditions: c }))}
          conditionTypes={eligibilityConditionTypes} availableScopes={availableScopes} />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center"><MapPin className="w-4 h-4 text-red-700" /></div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">Location Targeting</div>
            <div className="text-xs text-gray-500">Restrict to shipping address: pincode, city, state, country.</div>
          </div>
        </div>
        <RuleBuilder conditions={formData.location_conditions}
          onChange={c => setFormData(p => ({ ...p, location_conditions: c }))}
          conditionTypes={locationConditionTypes} availableScopes={availableScopes} />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-purple-700" /></div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">Attribution / UTM</div>
            <div className="text-xs text-gray-500">Fire only for orders from a specific marketing channel.</div>
          </div>
        </div>
        <RuleBuilder conditions={formData.attribution_conditions}
          onChange={c => setFormData(p => ({ ...p, attribution_conditions: c }))}
          conditionTypes={attributionConditionTypes} availableScopes={availableScopes} />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center"><Shield className="w-4 h-4 text-orange-700" /></div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">Order Exclusions</div>
            <div className="text-xs text-gray-500">Automatically block these edge-case orders from earning.</div>
          </div>
        </div>
        {[
          { key: 'exclude_refunded',   label: 'Exclude orders that have been refunded' },
          { key: 'exclude_cancelled',  label: 'Exclude cancelled orders' },
          { key: 'exclude_test_orders', label: 'Exclude test / staff orders' },
        ].map(opt => (
          <label key={opt.key} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={(formData.exclusion_rules as any)[opt.key]}
              onChange={e => setFormData(p => ({ ...p, exclusion_rules: { ...p.exclusion_rules, [opt.key]: e.target.checked } }))}
              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>

      <NavButtons nextLabel="Set Rewards →" />
    </div>
  );

  // ── STEP 4: Rewards ────────────────────────────────────────────────────────────
  const renderStep4 = () => (
    <div className="space-y-6">
      <StepHeader title="Reward Setup"
        subtitle={formData.rule_mode === 'standalone'
          ? 'Build the reward pool and decide how many rewards customers can pick.'
          : 'Configure how and when rewards are delivered when this rule triggers.'} />

      {formData.rule_mode === 'standalone' ? (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Experience</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'choice', label: 'Customer Picks N Rewards', hint: 'A branded page — customer chooses from the pool.' },
                { value: 'fixed',  label: 'Auto-Give All Rewards',    hint: 'All rewards in the pool are automatically granted.' },
              ].map(opt => {
                const active = formData.reward_selection_mode === opt.value;
                return (
                  <button key={opt.value} type="button"
                    onClick={() => setFormData(p => ({ ...p, reward_selection_mode: opt.value as any }))}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${active ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-400' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
            {formData.reward_selection_mode === 'choice' && (
              <div className="flex items-center gap-4 mt-4 p-4 bg-purple-50 rounded-lg">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Min Picks</label>
                  <input type="number" min={1} value={formData.min_rewards_choice}
                    onChange={e => setFormData(p => ({ ...p, min_rewards_choice: parseInt(e.target.value) || 1 }))}
                    className="w-20 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-center" />
                </div>
                <span className="text-gray-400 pt-4">to</span>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Max Picks</label>
                  <input type="number" min={formData.min_rewards_choice} value={formData.max_rewards_choice}
                    onChange={e => setFormData(p => ({ ...p, max_rewards_choice: Math.max(p.min_rewards_choice, parseInt(e.target.value) || 1) }))}
                    className="w-20 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-center" />
                </div>
                <span className="text-xs text-gray-500 pt-5">reward(s) from the pool</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Reward Pool <span className="text-red-500">*</span></label>
            <p className="text-xs text-gray-500 mb-3">Add the rewards available in this campaign. Customers choose from these.</p>
            {selectedPool.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedPool.map(r => (
                  <span key={r.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                    <span className="max-w-[180px] truncate">{r.title}</span>
                    <button type="button" onClick={() => togglePoolReward(r)} className="hover:text-purple-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setShowPoolPicker(true)}
              className="w-full flex items-center justify-between px-4 py-4 border-2 border-dashed border-purple-300 rounded-xl text-sm text-purple-600 hover:border-purple-500 hover:bg-purple-50 transition-colors">
              <span className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                {selectedPool.length === 0
                  ? 'Browse & select rewards for this pool…'
                  : `${selectedPool.length} reward${selectedPool.length !== 1 ? 's' : ''} selected — click to change`}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
            {allRewards.length === 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                No active rewards found in the catalog.{' '}
                <button type="button" onClick={() => navigate('/client/rewards')} className="font-semibold underline">Go to Rewards →</button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            For membership campaigns, rewards are defined in your membership program. Configure delivery settings here.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Allocation Timing</label>
              <select value={formData.reward_action.allocation_timing}
                onChange={e => setFormData(p => ({ ...p, reward_action: { ...p.reward_action, allocation_timing: e.target.value } }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg">
                <option value="instant">Instant (on order)</option>
                <option value="delayed">Delayed (after fulfillment)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Claim Method</label>
              <select value={formData.reward_action.claim_method}
                onChange={e => setFormData(p => ({ ...p, reward_action: { ...p.reward_action, claim_method: e.target.value } }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg">
                <option value="auto">Auto-Allocate</option>
                <option value="click">Click to Claim</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Reward Expiry (days after earning)</label>
            <input type="number" min={1} value={formData.reward_action.expiry_days}
              onChange={e => setFormData(p => ({ ...p, reward_action: { ...p.reward_action, expiry_days: parseInt(e.target.value) } }))}
              className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg" />
          </div>
        </div>
      )}

      <NavButtons nextLabel="Final Settings →"
        nextDisabled={formData.rule_mode === 'standalone' && selectedPool.length === 0} />
    </div>
  );

  // ── STEP 5: Launch ─────────────────────────────────────────────────────────────
  const renderStep5 = () => (
    <div className="space-y-6">
      <StepHeader title="Settings & Launch" subtitle="Set limits, a schedule, and guardrails to protect your campaign budget before going live." />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-600" /> Schedule & Priority
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
            <input type="number" value={formData.priority}
              onChange={e => setFormData(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <p className="text-xs text-gray-400 mt-1">Higher = evaluated first</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input type="date" value={formData.start_date}
              onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input type="date" value={formData.end_date}
              onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" /> Guardrails & Budget Caps
        </h3>
        <p className="text-xs text-gray-500 mb-3">Leave blank for unlimited.</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'max_rewards_per_customer', label: 'Max per customer' },
            { key: 'max_rewards_total',        label: 'Max total rewards' },
            { key: 'budget_cap',               label: 'Budget cap (value)' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input type="number"
                value={(formData.guardrails as any)[f.key]}
                onChange={e => setFormData(p => ({ ...p, guardrails: { ...p.guardrails, [f.key]: e.target.value } }))}
                placeholder="Unlimited"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Max Total Enrollments</label>
          <input type="number" value={formData.max_enrollments}
            onChange={e => setFormData(p => ({ ...p, max_enrollments: e.target.value }))}
            placeholder="Unlimited"
            className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <p className="text-xs text-gray-400 mt-1">Stop after this many customers have enrolled.</p>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={formData.is_active}
              onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Activate campaign immediately</div>
              <div className="text-xs text-gray-600 mt-0.5">Unchecked = saved as draft. You can activate from the rules list later.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ListChecks className="w-4 h-4" /> Campaign Summary
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-600">
          <div><span className="font-medium">Name:</span> {formData.name || '—'}</div>
          <div><span className="font-medium">Type:</span> {formData.rule_mode === 'standalone' ? 'Standalone' : 'Membership'}</div>
          <div><span className="font-medium">Triggers:</span> {formData.trigger_conditions.length} condition{formData.trigger_conditions.length !== 1 ? 's' : ''}</div>
          <div><span className="font-medium">Audience filters:</span> {formData.eligibility_conditions.length + formData.location_conditions.length + formData.attribution_conditions.length}</div>
          {formData.rule_mode === 'standalone' && <div><span className="font-medium">Reward pool:</span> {selectedPool.length} reward{selectedPool.length !== 1 ? 's' : ''}</div>}
          {formData.rule_mode === 'membership' && <div><span className="font-medium">Allocation:</span> {formData.reward_action.allocation_timing} / {formData.reward_action.claim_method}</div>}
          <div><span className="font-medium">Status on save:</span> {formData.is_active ? '✓ Active' : '— Draft'}</div>
        </div>
      </div>

      <NavButtons />
    </div>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  return (
    <>
      <DashboardLayout menuItems={clientMenuItems} title="Campaign Wizard">
        <div className="space-y-2">
          <div className="border-b border-gray-200 -mx-4 px-4">
            <nav className="flex gap-1">
              <button onClick={() => navigate('/client/campaigns')} className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                <Megaphone className="w-4 h-4" /> Campaign Rules
              </button>
              <button onClick={() => navigate('/client/campaigns-advanced')} className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
                <Layers className="w-4 h-4" /> Advanced Rules
              </button>
              <button onClick={() => navigate('/client/campaign-logs')} className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                <Activity className="w-4 h-4" /> Trigger Logs
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3 pt-4 pb-2">
            <button type="button" onClick={() => navigate('/client/campaigns-advanced')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit Campaign Rule' : 'New Campaign Rule'}</h1>
              <p className="text-sm text-gray-500">Follow the steps to configure your campaign.</p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mt-2">
            <StepIndicator />
            {stepRenderers[step - 1]()}
          </div>
        </div>
      </DashboardLayout>

      {showPoolPicker && (
        <RewardPickerModal
          rewards={allRewards}
          brands={allBrands}
          selected={selectedPool}
          onToggle={togglePoolReward}
          onClose={() => setShowPoolPicker(false)}
        />
      )}
    </>
  );
}
