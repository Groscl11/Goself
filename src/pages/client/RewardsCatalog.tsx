import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { Plus, Edit2, Trash2, Tag, ToggleLeft, ToggleRight, Copy, CheckCircle, RefreshCw, AlertCircle, Building2, Wrench, Search, Filter, Clock } from 'lucide-react';

interface Reward {
  id: string;
  reward_id: string;
  title: string;
  description: string;
  reward_type: 'flat_discount' | 'percentage_discount';
  discount_value: number;
  points_cost: number;
  min_purchase_amount: number;
  currency: string;
  is_active: boolean;
  status: string;
  terms_conditions: string;
  expiry_date: string | null;
  created_at: string;
}

interface DiscountCode {
  id: string;
  code: string;
  discount_value: number;
  discount_type: string;
  points_redeemed: number;
  member_email: string;
  is_used: boolean;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
  shopify_synced: boolean;
  shop_domain: string | null;
  reward: { title: string } | null;
}

interface MarketplaceReward {
  id: string;
  title: string;
  description: string;
  value_description: string;
  voucher_count: number;
  category: string;
  expiry_date: string | null;
  coupon_type: string | null;
  generic_coupon_code: string | null;
  brands: { id: string; name: string; logo_url: string | null };
}

interface BrandConfig {
  id: string;
  reward_id: string;
  points_cost: number;
  is_active: boolean;
  note: string | null;
  reward: { title: string; value_description: string; brands: { name: string } };
}

interface ManualReward {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  terms_conditions: string;
  is_active: boolean;
  status: string;
  expiry_date: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  reward_type: 'flat_discount' as const,
  discount_value: 100,
  points_cost: 500,
  min_purchase_amount: 0,
  currency: 'INR',
  terms_conditions: '',
};

const EMPTY_MANUAL_FORM = {
  title: '',
  description: '',
  points_cost: 200,
  terms_conditions: '',
};

export default function RewardsCatalog() {
  const [clientId, setClientId] = useState<string>('');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'rewards' | 'codes' | 'brand_config'>('rewards');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [syncingCode, setSyncingCode] = useState<string | null>(null);

  // Filters
  const [rewardSearch, setRewardSearch] = useState('');
  const [rewardTypeFilter, setRewardTypeFilter] = useState('all');
  const [rewardStatusFilter, setRewardStatusFilter] = useState('all');
  const [brandSearch, setBrandSearch] = useState('');
  const [brandCategoryFilter, setBrandCategoryFilter] = useState('all');
  const [manualSearch, setManualSearch] = useState('');

  // Brand & Manual rewards state
  const [marketplaceRewards, setMarketplaceRewards] = useState<MarketplaceReward[]>([]);
  const [brandConfigs, setBrandConfigs] = useState<BrandConfig[]>([]);
  const [manualRewards, setManualRewards] = useState<ManualReward[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [showBrandConfig, setShowBrandConfig] = useState<MarketplaceReward | null>(null);
  const [brandConfigPoints, setBrandConfigPoints] = useState(500);
  const [brandConfigNote, setBrandConfigNote] = useState('');
  const [savingBrandConfig, setSavingBrandConfig] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [savingManual, setSavingManual] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadRewards();
      loadCodes();
      loadBrandSection();
      loadManualRewards();
    }
  }, [clientId]);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).maybeSingle();
    if (profile?.client_id) setClientId(profile.client_id);
  }

  async function loadRewards() {
    setLoading(true);
    const { data } = await supabase
      .from('rewards')
      .select('id, reward_id, title, description, reward_type, discount_value, points_cost, min_purchase_amount, currency, is_active, status, terms_conditions, expiry_date, created_at')
      .eq('client_id', clientId)
      .not('reward_type', 'in', '(manual)')
      .order('points_cost', { ascending: true });
    setRewards(data || []);
    setLoading(false);
  }

  async function loadCodes() {
    const { data } = await supabase
      .from('loyalty_discount_codes')
      .select('*, reward:rewards(title)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);
    setCodes(data || []);
  }

  async function saveReward() {
    const pointsCost = Number(form.points_cost);
    const discountValue = Number(form.discount_value);
    if (!form.title || !discountValue || !pointsCost || pointsCost < 1) {
      alert('Please fill in all required fields');
      return;
    }
    const payload = { ...form, points_cost: pointsCost, discount_value: discountValue };
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('rewards').update({
          ...payload,
          status: 'active',
          is_active: true,
          updated_at: new Date().toISOString(),
        }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rewards').insert({
          ...payload,
          client_id: clientId,
          status: 'active',
          is_active: true,
          coupon_type: 'unique',
          category: 'loyalty',
        });
        if (error) throw error;
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      loadRewards();
    } catch (err: any) {
      alert('Error saving reward: ' + err.message);
    }
    setSaving(false);
  }

  async function toggleActive(reward: Reward) {
    await supabase.from('rewards').update({
      is_active: !reward.is_active,
      status: !reward.is_active ? 'active' : 'draft',
    }).eq('id', reward.id);
    loadRewards();
  }

  async function deleteReward(id: string) {
    if (!confirm('Delete this reward? Members will no longer be able to redeem it.')) return;
    await supabase.from('rewards').delete().eq('id', id);
    loadRewards();
  }

  function editReward(r: Reward) {
    setForm({
      title: r.title,
      description: r.description || '',
      reward_type: r.reward_type,
      discount_value: r.discount_value,
      points_cost: r.points_cost,
      min_purchase_amount: r.min_purchase_amount || 0,
      currency: r.currency || 'INR',
      terms_conditions: r.terms_conditions || '',
    });
    setEditingId(r.id);
    setShowForm(true);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function syncToShopify(codeId: string) {
    setSyncingCode(codeId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-discount-to-shopify', {
        body: { discount_code_id: codeId },
      });
      if (error || !data?.success) {
        alert('Sync failed: ' + (data?.error || error?.message || 'Unknown error'));
      } else {
        loadCodes();
      }
    } catch (e: any) {
      alert('Sync error: ' + e.message);
    }
    setSyncingCode(null);
  }

  async function loadBrandSection() {
    setMarketplaceLoading(true);
    const [{ data: mktData }, { data: cfgData }] = await Promise.all([
      supabase
        .from('rewards')
        .select('id, title, description, value_description, voucher_count, category, expiry_date, coupon_type, generic_coupon_code, brands(id, name, logo_url)')
        .eq('is_marketplace', true)
        .eq('status', 'active'),   // removed voucher_count > 0 so RWD-352F67D4 shows
      supabase
        .from('client_brand_reward_configs')
        .select('id, reward_id, points_cost, is_active, note, reward:rewards(id, title, value_description, voucher_count, category, expiry_date, brands(name))')
        .eq('client_id', clientId),
    ]);
    setMarketplaceRewards((mktData as any) || []);
    setBrandConfigs((cfgData as any) || []);
    setMarketplaceLoading(false);
  }

  async function loadManualRewards() {
    const { data } = await supabase
      .from('rewards')
      .select('id, title, description, points_cost, terms_conditions, is_active, status, expiry_date, created_at')
      .eq('client_id', clientId)
      .eq('category', 'manual')
      .order('created_at', { ascending: false });
    setManualRewards(data || []);
  }

  async function saveBrandConfig() {
    if (!showBrandConfig) return;
    setSavingBrandConfig(true);
    try {
      const existing = brandConfigs.find(c => c.reward_id === showBrandConfig.id);
      if (existing) {
        await supabase
          .from('client_brand_reward_configs')
          .update({ points_cost: brandConfigPoints, note: brandConfigNote, is_active: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('client_brand_reward_configs')
          .insert({ client_id: clientId, reward_id: showBrandConfig.id, points_cost: brandConfigPoints, note: brandConfigNote, is_active: true });
      }
      setShowBrandConfig(null);
      loadBrandSection();
    } catch (e: any) {
      alert('Error saving brand config: ' + e.message);
    }
    setSavingBrandConfig(false);
  }

  async function toggleBrandConfig(cfg: BrandConfig) {
    await supabase
      .from('client_brand_reward_configs')
      .update({ is_active: !cfg.is_active, updated_at: new Date().toISOString() })
      .eq('id', cfg.id);
    loadBrandSection();
  }

  async function removeBrandConfig(cfg: BrandConfig) {
    if (!confirm('Remove this brand reward from your program?')) return;
    await supabase.from('client_brand_reward_configs').delete().eq('id', cfg.id);
    loadBrandSection();
  }

  async function saveManualReward() {
    const pts = Number(manualForm.points_cost);
    if (!manualForm.title || !pts || pts < 1) {
      alert('Please fill in all required fields');
      return;
    }
    setSavingManual(true);
    try {
      if (editingManualId) {
        await supabase.from('rewards').update({
          ...manualForm,
          points_cost: pts,
          updated_at: new Date().toISOString(),
        }).eq('id', editingManualId);
      } else {
        await supabase.from('rewards').insert({
          ...manualForm,
          points_cost: pts,
          client_id: clientId,
          reward_type: 'manual',
          status: 'active',
          is_active: true,
          is_marketplace: false,
          coupon_type: 'manual',
          category: 'manual',
          currency: 'INR',
          discount_value: 0,
        });
      }
      setShowManualForm(false);
      setEditingManualId(null);
      setManualForm(EMPTY_MANUAL_FORM);
      loadManualRewards();
    } catch (e: any) {
      alert('Error saving manual reward: ' + e.message);
    }
    setSavingManual(false);
  }

  async function toggleManualReward(r: ManualReward) {
    await supabase.from('rewards').update({
      is_active: !r.is_active,
      status: !r.is_active ? 'active' : 'draft',
    }).eq('id', r.id);
    loadManualRewards();
  }

  async function deleteManualReward(id: string) {
    if (!confirm('Delete this manual reward?')) return;
    await supabase.from('rewards').delete().eq('id', id);
    loadManualRewards();
  }

  const currencySymbol = (c: string) => c === 'INR' ? '₹' : c === 'GBP' ? '£' : c === 'EUR' ? '€' : '$';

  // Filtered lists
  const filteredRewards = useMemo(() => rewards.filter(r => {
    const matchSearch = !rewardSearch || r.title.toLowerCase().includes(rewardSearch.toLowerCase()) || r.reward_id?.toLowerCase().includes(rewardSearch.toLowerCase());
    const matchType = rewardTypeFilter === 'all' || r.reward_type === rewardTypeFilter;
    const matchStatus = rewardStatusFilter === 'all' || (rewardStatusFilter === 'active' ? r.is_active : !r.is_active);
    return matchSearch && matchType && matchStatus;
  }), [rewards, rewardSearch, rewardTypeFilter, rewardStatusFilter]);

  const filteredMarketplace = useMemo(() => marketplaceRewards.filter(r => {
    const matchSearch = !brandSearch || r.title.toLowerCase().includes(brandSearch.toLowerCase()) || r.brands?.name?.toLowerCase().includes(brandSearch.toLowerCase());
    const matchCat = brandCategoryFilter === 'all' || r.category === brandCategoryFilter;

    // Stock check: unique codes need voucher_count > 0; generic codes need a code set
    const isOutOfStock = r.coupon_type === 'generic'
      ? !r.generic_coupon_code
      : r.voucher_count === 0;

    // Hide expired and out-of-stock
    const expired = isExpired(r.expiry_date);

    return matchSearch && matchCat && !isOutOfStock && !expired;
  }), [marketplaceRewards, brandSearch, brandCategoryFilter]);

  const filteredManual = useMemo(() => manualRewards.filter(r => {
    return !manualSearch || r.title.toLowerCase().includes(manualSearch.toLowerCase());
  }), [manualRewards, manualSearch]);

  const marketplaceCategories = useMemo(() =>
    [...new Set(marketplaceRewards.map(r => r.category).filter(Boolean))],
    [marketplaceRewards]);

  // Summary stats
  const summaryStats = useMemo(() => ({
    totalRewards: rewards.length,
    activeRewards: rewards.filter(r => r.is_active).length,
    totalCodes: codes.length,
    usedCodes: codes.filter(c => c.is_used).length,
    brandRewards: brandConfigs.filter(c => c.is_active).length,
    manualRewards: manualRewards.filter(r => r.is_active).length,
  }), [rewards, codes, brandConfigs, manualRewards]);

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const days = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  };
  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date).getTime() < Date.now();
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Rewards Catalog">
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rewards Catalog</h1>
            <p className="text-gray-500 text-sm mt-1">Create discount rewards customers can redeem with their points</p>
          </div>
          {activeTab === 'rewards' && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Reward
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Discount Rewards', value: summaryStats.totalRewards, sub: `${summaryStats.activeRewards} active`, color: 'blue' },
          { label: 'Codes Generated', value: summaryStats.totalCodes, sub: `${summaryStats.usedCodes} used`, color: 'purple' },
          { label: 'Brand Rewards', value: summaryStats.brandRewards, sub: 'active configs', color: 'indigo' },
          { label: 'Manual Rewards', value: summaryStats.manualRewards, sub: 'active', color: 'orange' },
          { label: 'Marketplace', value: marketplaceRewards.length, sub: 'available', color: 'green' },
          { label: 'Configured', value: brandConfigs.length, sub: 'brand setups', color: 'teal' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold text-${s.color}-600`}>{s.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('rewards')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rewards' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          🎁 Reward Options
        </button>
        <button
          onClick={() => setActiveTab('codes')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'codes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          🎟️ Generated Codes
          {codes.length > 0 && (
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{codes.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('brand_config')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'brand_config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          🏷️ Brand &amp; Manual Rewards
          {(brandConfigs.length + manualRewards.length) > 0 && (
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{brandConfigs.length + manualRewards.length}</span>
          )}
        </button>
      </div>

      {/* Add/Edit Form — only for Shopify reward tab */}
      {showForm && activeTab === 'rewards' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit Reward' : 'New Reward'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. ₹100 Off Coupon"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Get ₹100 off your next purchase"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
              <select
                value={form.reward_type}
                onChange={e => setForm({ ...form, reward_type: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="flat_discount">Fixed Amount (₹ off)</option>
                <option value="percentage_discount">Percentage (% off)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.reward_type === 'flat_discount' ? 'Discount Amount (₹) *' : 'Discount % *'}
              </label>
              <input
                type="number"
                value={form.discount_value}
                onChange={e => setForm({ ...form, discount_value: parseFloat(e.target.value) })}
                min="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points Cost *</label>
              <input
                type="number"
                value={form.points_cost}
                onChange={e => setForm({ ...form, points_cost: parseInt(e.target.value) || 0 })}
                min="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min. Order Amount (₹)</label>
              <input
                type="number"
                value={form.min_purchase_amount}
                onChange={e => setForm({ ...form, min_purchase_amount: parseFloat(e.target.value) })}
                min="0"
                placeholder="0 = no minimum"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
              <input
                type="text"
                value={form.terms_conditions}
                onChange={e => setForm({ ...form, terms_conditions: e.target.value })}
                placeholder="e.g. Valid once per customer. Cannot be combined."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={saveReward}
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Reward' : 'Create Reward'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
              className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rewards Tab */}
      {activeTab === 'rewards' && (
        <div>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={rewardSearch}
                onChange={e => setRewardSearch(e.target.value)}
                placeholder="Search by title or RWD-..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={rewardTypeFilter}
              onChange={e => setRewardTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="flat_discount">Fixed Amount</option>
              <option value="percentage_discount">Percentage</option>
            </select>
            <select
              value={rewardStatusFilter}
              onChange={e => setRewardStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading rewards...</div>
          ) : filteredRewards.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">{rewards.length === 0 ? 'No rewards yet' : 'No rewards match your filters'}</p>
              <p className="text-gray-400 text-sm mt-1">Create your first reward so customers can redeem their points</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRewards.map(reward => (
                <div key={reward.id} className={`bg-white border rounded-xl p-5 flex items-center gap-4 ${!reward.is_active ? 'opacity-60' : ''} ${isExpired(reward.expiry_date) ? 'border-red-200' : ''}`}>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {reward.reward_type === 'percentage_discount' ? '%' : '₹'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{reward.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reward.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {reward.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {reward.reward_id && (
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{reward.reward_id}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{reward.description}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                      <span>
                        <strong className="text-gray-700">
                          {reward.reward_type === 'percentage_discount' ? `${reward.discount_value}% off` : `₹${reward.discount_value} off`}
                        </strong>
                      </span>
                      <span>·</span>
                      <span><strong className="text-blue-600">{reward.points_cost} points</strong></span>
                      {reward.min_purchase_amount > 0 && <><span>·</span><span>Min. ₹{reward.min_purchase_amount}</span></>}
                      {reward.expiry_date && (
                        <>
                          <span>·</span>
                          <span className={`inline-flex items-center gap-1 ${isExpired(reward.expiry_date) ? 'text-red-500 font-medium' : isExpiringSoon(reward.expiry_date) ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                            <Clock className="w-3 h-3" />
                            {isExpired(reward.expiry_date) ? 'Expired' : `Expires ${new Date(reward.expiry_date).toLocaleDateString('en-IN')}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleActive(reward)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50" title={reward.is_active ? 'Deactivate' : 'Activate'}>
                      {reward.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => editReward(reward)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteReward(reward.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Codes Tab */}
      {activeTab === 'codes' && (
        <div>
          {codes.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No discount codes generated yet</p>
              <p className="text-gray-400 text-sm mt-1">Codes will appear here when customers redeem their points</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Reward</th>
                    <th className="px-4 py-3 text-left">Value</th>
                    <th className="px-4 py-3 text-left">Points</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Shopify</th>
                    <th className="px-4 py-3 text-left">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {codes.map(code => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-gray-900">{code.code}</span>
                          <button
                            onClick={() => copyCode(code.code)}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded"
                          >
                            {copiedCode === code.code ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{code.member_email || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{code.reward?.title || '—'}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {code.discount_type === 'percentage' ? `${code.discount_value}%` : `₹${code.discount_value}`}
                      </td>
                      <td className="px-4 py-3 text-blue-600 font-medium">{code.points_redeemed} pts</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${code.is_used ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                          {code.is_used ? 'Used' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {code.shopify_synced ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Synced
                          </span>
                        ) : (
                          <button
                            onClick={() => syncToShopify(code.id)}
                            disabled={syncingCode === code.id}
                            className="text-xs px-2 py-1 rounded-full font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 inline-flex items-center gap-1 disabled:opacity-50"
                            title="Create this code in Shopify so it works at checkout"
                          >
                            {syncingCode === code.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {syncingCode === code.id ? 'Syncing...' : 'Not in Shopify'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(code.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Brand & Manual Rewards Configuration Tab */}
      {activeTab === 'brand_config' && (
        <div className="space-y-10">

          {/* ── BRAND REWARDS FROM MARKETPLACE ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">Brand Rewards (Marketplace)</h2>
              </div>
              <span className="text-sm text-gray-400">{brandConfigs.length} configured</span>
            </div>
            <p className="text-sm text-gray-500 mb-5">Choose partner-brand rewards from the marketplace and set how many points members need to redeem them.</p>

            {/* Configured brand rewards */}
            {brandConfigs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Currently Configured</h3>
                <div className="grid gap-3">
                  {brandConfigs.map(cfg => {
                    const cfgReward = cfg.reward as any;
                    return (
                    <div key={cfg.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${!cfg.is_active ? 'opacity-60' : ''}`}>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{cfgReward?.title || '—'}</p>
                        <p className="text-sm text-gray-500">{cfgReward?.value_description || ''}</p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                          <span>Brand: {cfgReward?.brands?.name || '—'}</span>
                          {cfgReward?.voucher_count != null && (
                            <span className={cfgReward.voucher_count === 0 ? 'text-red-500 font-medium' : 'text-green-600'}>
                              {cfgReward.voucher_count === 0 ? '⚠ No vouchers left' : `${cfgReward.voucher_count} vouchers`}
                            </span>
                          )}
                          {cfgReward?.expiry_date && (
                            <span className={`inline-flex items-center gap-1 ${isExpired(cfgReward.expiry_date) ? 'text-red-500 font-medium' : isExpiringSoon(cfgReward.expiry_date) ? 'text-orange-500 font-medium' : ''}`}>
                              <Clock className="w-3 h-3" />
                              {isExpired(cfgReward.expiry_date) ? 'Expired' : `Expires ${new Date(cfgReward.expiry_date).toLocaleDateString('en-IN')}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-600 font-semibold">{cfg.points_cost} pts</p>
                        {cfg.note && <p className="text-xs text-gray-400">{cfg.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleBrandConfig(cfg)}
                          className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"
                          title={cfg.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {cfg.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => {
                            // Find in marketplace list or build fallback from config join data
                            const mr = marketplaceRewards.find(m => m.id === cfg.reward_id) || {
                              id: cfg.reward_id,
                              title: cfgReward?.title || '—',
                              description: cfgReward?.value_description || '',
                              value_description: cfgReward?.value_description || '',
                              voucher_count: cfgReward?.voucher_count ?? 0,
                              category: cfgReward?.category || '',
                              expiry_date: cfgReward?.expiry_date || null,
                              brands: cfgReward?.brands || { id: '', name: '—', logo_url: null },
                            } as MarketplaceReward;
                            setShowBrandConfig(mr);
                            setBrandConfigPoints(cfg.points_cost);
                            setBrandConfigNote(cfg.note || '');
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeBrandConfig(cfg)}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Marketplace rewards to configure */}
            {marketplaceLoading ? (
              <div className="text-center py-8 text-gray-400">Loading marketplace rewards...</div>
            ) : (
              <div>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      placeholder="Search rewards or brand..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {marketplaceCategories.length > 0 && (
                    <select
                      value={brandCategoryFilter}
                      onChange={e => setBrandCategoryFilter(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Categories</option>
                      {marketplaceCategories.map(c => (
                        <option key={c} value={c} className="capitalize">{c}</option>
                      ))}
                    </select>
                  )}
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Available from Marketplace ({filteredMarketplace.length})
                </h3>
                {filteredMarketplace.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500 text-sm">No marketplace rewards match your search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredMarketplace.map(reward => {
                      const alreadyConfigured = brandConfigs.some(c => c.reward_id === reward.id);
                      return (
                        <div key={reward.id} className="bg-white border rounded-xl p-4 flex items-start gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{reward.title}</p>
                            <p className="text-xs text-gray-500 mb-1">{reward.brands?.name}</p>
                            <p className="text-xs text-gray-400 truncate">{reward.description}</p>
                            <div className="flex gap-2 mt-1.5 flex-wrap text-xs">
                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{reward.category}</span>
                              <span className={`px-2 py-0.5 rounded-full ${
                                reward.coupon_type === 'generic'
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {reward.coupon_type === 'generic'
                                  ? 'Generic Code'
                                  : `${reward.voucher_count} vouchers left`}
                              </span>
                              {reward.expiry_date && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isExpired(reward.expiry_date) ? 'bg-red-100 text-red-600' : isExpiringSoon(reward.expiry_date) ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                                  <Clock className="w-3 h-3" />
                                  {isExpired(reward.expiry_date) ? 'Expired' : new Date(reward.expiry_date).toLocaleDateString('en-IN')}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setShowBrandConfig(reward);
                              const existing = brandConfigs.find(c => c.reward_id === reward.id);
                              setBrandConfigPoints(existing?.points_cost || 500);
                              setBrandConfigNote(existing?.note || '');
                            }}
                            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                              alreadyConfigured
                                ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                                : 'border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                            }`}
                          >
                            {alreadyConfigured ? '✓ Configured' : '+ Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Configure brand reward modal */}
            {showBrandConfig && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-semibold mb-1">Configure Brand Reward</h3>
                  <p className="text-sm text-gray-500 mb-5">{showBrandConfig.title}</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Points Cost *</label>
                      <input
                        type="number"
                        value={brandConfigPoints}
                        onChange={e => setBrandConfigPoints(parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 500"
                      />
                      <p className="text-xs text-gray-400 mt-1">How many loyalty points a member must spend to redeem this reward.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Internal Note (optional)</label>
                      <input
                        type="text"
                        value={brandConfigNote}
                        onChange={e => setBrandConfigNote(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Premium tier only"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={saveBrandConfig}
                      disabled={savingBrandConfig}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingBrandConfig ? 'Saving...' : 'Save Configuration'}
                    </button>
                    <button
                      onClick={() => setShowBrandConfig(null)}
                      className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── MANUAL REWARDS ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">Manual Rewards</h2>
              </div>
              <button
                onClick={() => { setShowManualForm(true); setEditingManualId(null); setManualForm(EMPTY_MANUAL_FORM); }}
                className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add Manual Reward
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">Create custom rewards that you fulfill manually — physical gifts, experiences, free shipping, etc. No Shopify discount code is generated.</p>

            {/* Add/Edit Manual Form */}
            {showManualForm && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
                <h3 className="text-base font-semibold mb-4">{editingManualId ? 'Edit Manual Reward' : 'New Manual Reward'}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={manualForm.title}
                      onChange={e => setManualForm({ ...manualForm, title: e.target.value })}
                      placeholder="e.g. Free Shipping Voucher"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={manualForm.description}
                      onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                      placeholder="Short description visible to members"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points Cost *</label>
                    <input
                      type="number"
                      value={manualForm.points_cost}
                      onChange={e => setManualForm({ ...manualForm, points_cost: parseInt(e.target.value) || 0 })}
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                    <input
                      type="text"
                      value={manualForm.terms_conditions}
                      onChange={e => setManualForm({ ...manualForm, terms_conditions: e.target.value })}
                      placeholder="e.g. One per customer. Valid for 30 days after redemption."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={saveManualReward}
                    disabled={savingManual}
                    className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                  >
                    {savingManual ? 'Saving...' : editingManualId ? 'Update Reward' : 'Create Reward'}
                  </button>
                  <button
                    onClick={() => { setShowManualForm(false); setEditingManualId(null); setManualForm(EMPTY_MANUAL_FORM); }}
                    className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Manual rewards list */}
            {manualRewards.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium text-sm">No manual rewards yet</p>
                <p className="text-gray-400 text-xs mt-1">Add your first manual reward above</p>
              </div>
            ) : (
              <div>
                {/* Filter */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={e => setManualSearch(e.target.value)}
                    placeholder="Search manual rewards..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="grid gap-3">
                  {filteredManual.map(reward => (
                    <div key={reward.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${!reward.is_active ? 'opacity-60' : ''} ${isExpired(reward.expiry_date) ? 'border-red-200' : ''}`}>
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-5 h-5 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{reward.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reward.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {reward.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{reward.description}</p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                          <span className="text-blue-600 font-medium">{reward.points_cost} points</span>
                          {reward.expiry_date && (
                            <span className={`inline-flex items-center gap-1 ${isExpired(reward.expiry_date) ? 'text-red-500 font-medium' : isExpiringSoon(reward.expiry_date) ? 'text-orange-500 font-medium' : ''}`}>
                              <Clock className="w-3 h-3" />
                              {isExpired(reward.expiry_date) ? 'Expired' : `Expires ${new Date(reward.expiry_date).toLocaleDateString('en-IN')}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => toggleManualReward(reward)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                          {reward.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => {
                            setManualForm({
                              title: reward.title,
                              description: reward.description || '',
                              points_cost: reward.points_cost,
                              terms_conditions: reward.terms_conditions || '',
                            });
                            setEditingManualId(reward.id);
                            setShowManualForm(true);
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteManualReward(reward.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
