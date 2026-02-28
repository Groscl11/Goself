import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { Plus, Edit2, Trash2, Tag, ToggleLeft, ToggleRight, Copy, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

interface Reward {
  id: string;
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

export default function RewardsCatalog() {
  const [clientId, setClientId] = useState<string>('');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'rewards' | 'codes'>('rewards');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [syncingCode, setSyncingCode] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadRewards();
      loadCodes();
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
      .select('*')
      .eq('client_id', clientId)
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
    if (!form.title || !form.discount_value || !form.points_cost) {
      alert('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('rewards').update({
          ...form,
          status: 'active',
          is_active: true,
          updated_at: new Date().toISOString(),
        }).eq('id', editingId);
      } else {
        // Get a brand_id (system default)
        await supabase.from('rewards').insert({
          ...form,
          client_id: clientId,
          status: 'active',
          is_active: true,
          coupon_type: 'unique',
          category: 'loyalty',
        });
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

  const currencySymbol = (c: string) => c === 'INR' ? '₹' : c === 'GBP' ? '£' : c === 'EUR' ? '€' : '$';

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

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        {(['rewards', 'codes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'rewards' ? '🎁 Reward Options' : '🎟️ Generated Codes'}
            {tab === 'codes' && codes.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{codes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
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
                onChange={e => setForm({ ...form, points_cost: parseInt(e.target.value) })}
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
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading rewards...</div>
          ) : rewards.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No rewards yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first reward so customers can redeem their points</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rewards.map(reward => (
                <div key={reward.id} className={`bg-white border rounded-xl p-5 flex items-center gap-4 ${!reward.is_active ? 'opacity-60' : ''}`}>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {reward.reward_type === 'percentage_discount' ? '%' : '₹'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{reward.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reward.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {reward.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{reward.description}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span>
                        <strong className="text-gray-700">
                          {reward.reward_type === 'percentage_discount' ? `${reward.discount_value}% off` : `₹${reward.discount_value} off`}
                        </strong>
                      </span>
                      <span>·</span>
                      <span><strong className="text-blue-600">{reward.points_cost} points</strong></span>
                      {reward.min_purchase_amount > 0 && <><span>·</span><span>Min. ₹{reward.min_purchase_amount}</span></>}
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
    </div>
    </DashboardLayout>
  );
}
