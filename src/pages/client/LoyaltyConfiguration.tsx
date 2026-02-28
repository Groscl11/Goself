import { useEffect, useState, type ReactNode } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { supabase } from '../../lib/supabase';
import {
  Users, Gift, Calendar, Share2, Star, UserCheck, Plus, Edit2, Trash2,
  ToggleLeft, ToggleRight, Save, X, ChevronDown, ChevronUp, Instagram,
  Youtube, Twitter, Facebook, Linkedin, Coins,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RuleType = 'referral' | 'birthday' | 'social_follow' | 'signup' | 'profile_complete' | 'review' | 'custom';
type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'twitter' | 'tiktok' | 'linkedin' | 'pinterest';

interface EarningRule {
  id: string;
  client_id: string;
  loyalty_program_id: string | null;
  rule_type: RuleType;
  name: string;
  description: string | null;
  points_reward: number;
  referral_discount_type: 'flat' | 'percentage' | null;
  referral_discount_value: number | null;
  referral_min_order_value: number | null;
  max_referrals_per_day: number | null;
  social_platform: SocialPlatform | null;
  social_url: string | null;
  max_times_per_customer: number | null;
  cooldown_days: number | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_RULE = (type: RuleType): Omit<EarningRule, 'id' | 'client_id' | 'created_at' | 'loyalty_program_id'> => ({
  rule_type: type,
  name: '',
  description: '',
  points_reward: 100,
  referral_discount_type: type === 'referral' ? 'flat' : null,
  referral_discount_value: type === 'referral' ? 100 : null,
  referral_min_order_value: null,
  max_referrals_per_day: type === 'referral' ? 5 : null,
  social_platform: type === 'social_follow' ? 'instagram' : null,
  social_url: null,
  max_times_per_customer: type === 'birthday' || type === 'signup' || type === 'profile_complete' ? 1 : null,
  cooldown_days: type === 'birthday' ? 365 : null,
  is_active: true,
});

// ─── Section config ───────────────────────────────────────────────────────────

const SECTIONS: { type: RuleType; label: string; icon: ReactNode; color: string; description: string }[] = [
  {
    type: 'referral',
    label: 'Referral Program',
    icon: <Users className="w-5 h-5" />,
    color: 'blue',
    description: 'Earn points when customers refer friends. Optionally give a discount to the referred person.',
  },
  {
    type: 'birthday',
    label: 'Birthday Rewards',
    icon: <Calendar className="w-5 h-5" />,
    color: 'pink',
    description: 'Automatically reward customers with bonus points on their birthday.',
  },
  {
    type: 'social_follow',
    label: 'Social Media',
    icon: <Share2 className="w-5 h-5" />,
    color: 'purple',
    description: 'Reward customers for following your social media channels.',
  },
  {
    type: 'signup',
    label: 'Sign Up Bonus',
    icon: <UserCheck className="w-5 h-5" />,
    color: 'green',
    description: 'Give points when a new customer joins your loyalty program.',
  },
  {
    type: 'profile_complete',
    label: 'Profile Completion',
    icon: <Star className="w-5 h-5" />,
    color: 'yellow',
    description: 'Reward customers for completing their profile (name, phone, birthday, etc.).',
  },
  {
    type: 'review',
    label: 'Product Review',
    icon: <Star className="w-5 h-5" />,
    color: 'orange',
    description: 'Give points when a customer leaves a product review.',
  },
  {
    type: 'custom',
    label: 'Custom Rules',
    icon: <Gift className="w-5 h-5" />,
    color: 'indigo',
    description: 'Create your own point-earning actions for any customer activity.',
  },
];

const SECTION_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  pink: 'bg-pink-50 border-pink-200 text-pink-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
};

const ICON_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  pink: 'bg-pink-100 text-pink-600',
  purple: 'bg-purple-100 text-purple-600',
  green: 'bg-green-100 text-green-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  orange: 'bg-orange-100 text-orange-600',
  indigo: 'bg-indigo-100 text-indigo-600',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LoyaltyConfiguration() {
  const [clientId, setClientId] = useState<string>('');
  const [rules, setRules] = useState<EarningRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<RuleType | null>('referral');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editingType, setEditingType] = useState<RuleType | null>(null);
  const [form, setForm] = useState<ReturnType<typeof EMPTY_RULE> | null>(null);

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => { if (clientId) loadRules(); }, [clientId]);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('client_id').eq('id', user.id).maybeSingle();
    if (data?.client_id) setClientId(data.client_id);
  }

  async function loadRules() {
    setLoading(true);
    const { data } = await supabase
      .from('loyalty_earning_rules')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    setRules(data || []);
    setLoading(false);
  }

  function openAdd(type: RuleType) {
    setEditingId('new');
    setEditingType(type);
    const defaults = EMPTY_RULE(type);
    defaults.name = type === 'referral' ? 'Referral Bonus'
      : type === 'birthday' ? 'Birthday Reward'
      : type === 'signup' ? 'Welcome Bonus'
      : type === 'profile_complete' ? 'Profile Complete Bonus'
      : type === 'review' ? 'Review Reward'
      : '';
    setForm(defaults);
  }

  function openEdit(rule: EarningRule) {
    setEditingId(rule.id);
    setEditingType(rule.rule_type);
    setForm({
      rule_type: rule.rule_type,
      name: rule.name,
      description: rule.description || '',
      points_reward: rule.points_reward,
      referral_discount_type: rule.referral_discount_type,
      referral_discount_value: rule.referral_discount_value,
      referral_min_order_value: rule.referral_min_order_value,
      max_referrals_per_day: rule.max_referrals_per_day,
      social_platform: rule.social_platform,
      social_url: rule.social_url || '',
      max_times_per_customer: rule.max_times_per_customer,
      cooldown_days: rule.cooldown_days,
      is_active: rule.is_active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingType(null);
    setForm(null);
  }

  async function saveRule() {
    if (!form) return;
    if (!form.name.trim()) { alert('Name is required'); return; }
    if (!form.points_reward || form.points_reward < 1) { alert('Points reward must be at least 1'); return; }
    if (form.rule_type === 'social_follow' && !form.social_url?.trim()) { alert('Social media URL is required'); return; }

    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        rule_type: form.rule_type,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        points_reward: Number(form.points_reward),
        referral_discount_type: form.referral_discount_type || null,
        referral_discount_value: form.referral_discount_value ? Number(form.referral_discount_value) : null,
        referral_min_order_value: form.referral_min_order_value ? Number(form.referral_min_order_value) : null,
        max_referrals_per_day: form.max_referrals_per_day ? Number(form.max_referrals_per_day) : null,
        social_platform: form.social_platform || null,
        social_url: form.social_url?.trim() || null,
        max_times_per_customer: form.max_times_per_customer ? Number(form.max_times_per_customer) : null,
        cooldown_days: form.cooldown_days ? Number(form.cooldown_days) : null,
        is_active: form.is_active,
      };

      if (editingId === 'new') {
        const { error } = await supabase.from('loyalty_earning_rules').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('loyalty_earning_rules')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId!);
        if (error) throw error;
      }
      cancelEdit();
      loadRules();
    } catch (err: any) {
      alert('Error saving rule: ' + err.message);
    }
    setSaving(false);
  }

  async function toggleRule(rule: EarningRule) {
    const { error } = await supabase.from('loyalty_earning_rules')
      .update({ is_active: !rule.is_active, updated_at: new Date().toISOString() })
      .eq('id', rule.id);
    if (!error) setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this earning rule? This cannot be undone.')) return;
    await supabase.from('loyalty_earning_rules').delete().eq('id', id);
    setRules(prev => prev.filter(r => r.id !== id));
  }

  function setF<K extends keyof ReturnType<typeof EMPTY_RULE>>(k: K, v: ReturnType<typeof EMPTY_RULE>[K]) {
    setForm(prev => prev ? { ...prev, [k]: v } : prev);
  }

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Ways to Earn Points">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Ways to Earn Points">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Ways to Earn Points</h1>
          <p className="text-gray-500 text-sm mt-1">Configure how customers earn loyalty points in your program</p>
        </div>

        {SECTIONS.map(section => {
          const sectionRules = rules.filter(r => r.rule_type === section.type);
          const isOpen = expanded === section.type;
          const activeCount = sectionRules.filter(r => r.is_active).length;

          return (
            <div key={section.type} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : section.type)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ICON_COLORS[section.color]}`}>
                    {section.icon}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{section.label}</span>
                      {sectionRules.length > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SECTION_COLORS[section.color]}`}>
                          {activeCount} active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                  </div>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-6 pb-6">
                  {sectionRules.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {sectionRules.map(rule => (
                        <div key={rule.id}>
                          {editingId === rule.id && form ? (
                            <RuleForm form={form} type={section.type} saving={saving} onSave={saveRule} onCancel={cancelEdit} setF={setF} />
                          ) : (
                            <RuleCard rule={rule} onEdit={() => openEdit(rule)} onToggle={() => toggleRule(rule)} onDelete={() => deleteRule(rule.id)} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {editingId === 'new' && editingType === section.type && form ? (
                    <div className="mt-4">
                      <RuleForm form={form} type={section.type} saving={saving} onSave={saveRule} onCancel={cancelEdit} setF={setF} />
                    </div>
                  ) : (
                    <button
                      onClick={() => openAdd(section.type)}
                      className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      {sectionRules.length === 0 ? `Set up ${section.label}` : `Add another ${section.label} rule`}
                    </button>
                  )}

                  {sectionRules.length === 0 && editingId !== 'new' && (
                    <div className="mt-2 text-sm text-gray-400 italic">No rules configured yet.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}

// ─── RuleCard ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, onEdit, onToggle, onDelete }: {
  rule: EarningRule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const currency = '₹';
  const badges: string[] = [];

  if (rule.rule_type === 'referral') {
    if (rule.referral_discount_value) {
      badges.push(rule.referral_discount_type === 'percentage'
        ? `Referred gets ${rule.referral_discount_value}% off`
        : `Referred gets ${currency}${rule.referral_discount_value} off`);
    }
    if (rule.max_referrals_per_day) badges.push(`Max ${rule.max_referrals_per_day}/day`);
    if (rule.referral_min_order_value) badges.push(`Min order ${currency}${rule.referral_min_order_value}`);
  }
  if (rule.rule_type === 'social_follow') {
    if (rule.social_platform) badges.push(rule.social_platform.charAt(0).toUpperCase() + rule.social_platform.slice(1));
    if (rule.social_url) badges.push(rule.social_url);
  }
  if (rule.max_times_per_customer === 1) badges.push('Once per customer');
  else if (rule.max_times_per_customer) badges.push(`Max ${rule.max_times_per_customer}x per customer`);
  if (rule.cooldown_days === 365) badges.push('Once per year');
  else if (rule.cooldown_days) badges.push(`${rule.cooldown_days}d cooldown`);

  return (
    <div className={`border rounded-lg p-4 flex items-start justify-between gap-3 ${rule.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{rule.name}</span>
          <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-semibold">
            <Coins className="w-3 h-3" /> +{rule.points_reward} pts
          </span>
          {!rule.is_active && <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Inactive</span>}
        </div>
        {rule.description && <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {badges.map((b, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{b}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onToggle} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title={rule.is_active ? 'Disable' : 'Enable'}>
          {rule.is_active
            ? <ToggleRight className="w-5 h-5 text-green-500" />
            : <ToggleLeft className="w-5 h-5 text-gray-400" />}
        </button>
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Edit2 className="w-4 h-4" /></button>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ─── RuleForm ─────────────────────────────────────────────────────────────────

type FormData = ReturnType<typeof EMPTY_RULE>;

function RuleForm({ form, type, saving, onSave, onCancel, setF }: {
  form: FormData;
  type: RuleType;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  setF: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
}) {
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const lbl = 'block text-xs font-medium text-gray-700 mb-1';

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-4">
      <h4 className="font-semibold text-gray-800 text-sm">Configure Rule</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Rule Name *</label>
          <input className={inp} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Referral Bonus" />
        </div>
        <div>
          <label className={lbl}>Description</label>
          <input className={inp} value={form.description || ''} onChange={e => setF('description', e.target.value)} placeholder="Short description for customers" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Points Rewarded *</label>
          <input className={inp} type="number" min="1" value={form.points_reward}
            onChange={e => setF('points_reward', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className={lbl}>Max Times per Customer</label>
          <input className={inp} type="number" min="1" value={form.max_times_per_customer ?? ''}
            onChange={e => setF('max_times_per_customer', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Blank = unlimited" />
        </div>
      </div>

      {/* Referral-specific */}
      {type === 'referral' && (
        <div className="border-t border-blue-200 pt-3 space-y-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Referred Person Discount</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Discount Type</label>
              <select className={inp} value={form.referral_discount_type || 'flat'}
                onChange={e => setF('referral_discount_type', e.target.value as 'flat' | 'percentage')}>
                <option value="flat">Flat (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className={lbl}>{form.referral_discount_type === 'percentage' ? 'Discount %' : 'Discount Amount (₹)'}</label>
              <input className={inp} type="number" min="1" value={form.referral_discount_value ?? ''}
                onChange={e => setF('referral_discount_value', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder={form.referral_discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 100'} />
            </div>
            <div>
              <label className={lbl}>Min Order Value (₹)</label>
              <input className={inp} type="number" min="0" value={form.referral_min_order_value ?? ''}
                onChange={e => setF('referral_min_order_value', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Max Referrals per Day (per customer)</label>
              <input className={inp} type="number" min="1" value={form.max_referrals_per_day ?? ''}
                onChange={e => setF('max_referrals_per_day', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Blank = no limit" />
            </div>
            <div>
              <label className={lbl}>Cooldown between referrals (days)</label>
              <input className={inp} type="number" min="0" value={form.cooldown_days ?? ''}
                onChange={e => setF('cooldown_days', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Optional" />
            </div>
          </div>
        </div>
      )}

      {/* Birthday-specific */}
      {type === 'birthday' && (
        <div className="border-t border-blue-200 pt-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Birthday Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Cooldown (days) — 365 = once per year</label>
              <input className={inp} type="number" min="1" value={form.cooldown_days ?? 365}
                onChange={e => setF('cooldown_days', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
          </div>
        </div>
      )}

      {/* Social follow-specific */}
      {type === 'social_follow' && (
        <div className="border-t border-blue-200 pt-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Social Platform</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Platform *</label>
              <select className={inp} value={form.social_platform || 'instagram'}
                onChange={e => setF('social_platform', e.target.value as SocialPlatform)}>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">X / Twitter</option>
                <option value="tiktok">TikTok</option>
                <option value="linkedin">LinkedIn</option>
                <option value="pinterest">Pinterest</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Profile URL *</label>
              <input className={inp} value={form.social_url || ''}
                onChange={e => setF('social_url', e.target.value)}
                placeholder="https://instagram.com/yourbrand" />
            </div>
          </div>
        </div>
      )}

      {/* Active toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-700">Active</label>
        <button type="button" onClick={() => setF('is_active', !form.is_active)} className="p-1 rounded">
          {form.is_active
            ? <ToggleRight className="w-7 h-7 text-green-500" />
            : <ToggleLeft className="w-7 h-7 text-gray-400" />}
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Rule'}
        </button>
        <button onClick={onCancel}
          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>
    </div>
  );
}
