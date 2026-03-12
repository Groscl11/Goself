import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';
import { supabase } from '../../lib/supabase';
import { Plus, X, Save, ToggleLeft, ToggleRight, GitBranch } from 'lucide-react';

interface Client { id: string; name: string; }
interface Rule {
  id: string;
  name: string;
  description: string | null;
  issuing_client_id: string;
  receiving_client_id: string;
  trigger_type: 'first_order' | 'any_order' | 'signup' | 'referral';
  trigger_threshold: number | null;
  reward_type: 'points' | 'discount_flat' | 'discount_percentage';
  reward_value: number;
  min_order_value: number | null;
  expiry_days: number | null;
  max_issuances: number | null;
  current_issuances: number;
  is_active: boolean;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  issuing_client_id: '',
  receiving_client_id: '',
  trigger_type: 'first_order' as Rule['trigger_type'],
  trigger_threshold: '',
  reward_type: 'points' as Rule['reward_type'],
  reward_value: '',
  min_order_value: '',
  expiry_days: '',
  max_issuances: '',
};

const TRIGGER_LABELS: Record<Rule['trigger_type'], string> = {
  first_order: 'First Order',
  any_order: 'Any Order',
  signup: 'Signup',
  referral: 'Referral',
};

const REWARD_LABELS: Record<Rule['reward_type'], string> = {
  points: 'Points',
  discount_flat: 'Flat Discount (₹)',
  discount_percentage: 'Percentage Discount (%)',
};

export function NetworkRewardRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [rulesRes, clientsRes] = await Promise.all([
      supabase.from('network_reward_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ]);
    if (rulesRes.data) setRules(rulesRes.data as Rule[]);
    if (clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(r: Rule) {
    setEditId(r.id);
    setForm({
      name: r.name,
      description: r.description || '',
      issuing_client_id: r.issuing_client_id,
      receiving_client_id: r.receiving_client_id,
      trigger_type: r.trigger_type,
      trigger_threshold: r.trigger_threshold?.toString() || '',
      reward_type: r.reward_type,
      reward_value: r.reward_value.toString(),
      min_order_value: r.min_order_value?.toString() || '',
      expiry_days: r.expiry_days?.toString() || '',
      max_issuances: r.max_issuances?.toString() || '',
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.name || !form.issuing_client_id || !form.receiving_client_id || !form.reward_value) {
      alert('Please fill all required fields.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      issuing_client_id: form.issuing_client_id,
      receiving_client_id: form.receiving_client_id,
      trigger_type: form.trigger_type,
      trigger_threshold: form.trigger_threshold ? Number(form.trigger_threshold) : null,
      reward_type: form.reward_type,
      reward_value: Number(form.reward_value),
      min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
      expiry_days: form.expiry_days ? Number(form.expiry_days) : null,
      max_issuances: form.max_issuances ? Number(form.max_issuances) : null,
    };
    if (editId) {
      await supabase.from('network_reward_rules').update(payload).eq('id', editId);
    } else {
      await supabase.from('network_reward_rules').insert({ ...payload, is_active: true, current_issuances: 0 });
    }
    setSaving(false);
    setShowModal(false);
    fetchData();
  }

  async function toggleActive(r: Rule) {
    await supabase.from('network_reward_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x));
  }

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || id;

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Network Reward Rules">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Network Reward Rules</h1>
              <p className="text-sm text-gray-500">Cross-brand reward rules issued from one client to another</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-gray-400">Loading…</div>
          ) : rules.length === 0 ? (
            <div className="py-20 text-center">
              <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No network rules yet</p>
              <p className="text-sm text-gray-400 mt-1">Create the first cross-brand reward rule</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600">Rule</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Issuer → Receiver</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Trigger</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Reward</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Issuances</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Active</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.name}</div>
                        {r.description && <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          {clientName(r.issuing_client_id)}
                        </span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="inline-block bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                          {clientName(r.receiving_client_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                          {TRIGGER_LABELS[r.trigger_type]}
                        </span>
                        {r.trigger_threshold != null && (
                          <div className="text-xs text-gray-400 mt-0.5">≥ ₹{r.trigger_threshold.toLocaleString()}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-900">
                          {r.reward_type === 'points' ? `${r.reward_value} pts` :
                            r.reward_type === 'discount_flat' ? `₹${r.reward_value}` : `${r.reward_value}%`}
                        </span>
                        <div className="text-xs text-gray-400">{REWARD_LABELS[r.reward_type]}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.current_issuances}
                        {r.max_issuances != null && (
                          <span className="text-gray-400"> / {r.max_issuances}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(r)} className="text-gray-400 hover:text-gray-600 transition-colors">
                          {r.is_active
                            ? <ToggleRight className="w-6 h-6 text-green-500" />
                            : <ToggleLeft className="w-6 h-6" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600 transition-colors text-xs font-medium">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{editId ? 'Edit Rule' : 'New Network Rule'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Issuing Client *</label>
                  <select value={form.issuing_client_id} onChange={e => setForm(f => ({ ...f, issuing_client_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
                    <option value="">Select client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Receiving Client *</label>
                  <select value={form.receiving_client_id} onChange={e => setForm(f => ({ ...f, receiving_client_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
                    <option value="">Select client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Trigger</label>
                  <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as Rule['trigger_type'] }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
                    {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Min. Order Value (₹)</label>
                  <input type="number" min="0" value={form.min_order_value}
                    onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reward Type *</label>
                  <select value={form.reward_type} onChange={e => setForm(f => ({ ...f, reward_type: e.target.value as Rule['reward_type'] }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
                    {Object.entries(REWARD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reward Value *</label>
                  <input type="number" min="0" value={form.reward_value}
                    onChange={e => setForm(f => ({ ...f, reward_value: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Issuances</label>
                  <input type="number" min="0" value={form.max_issuances}
                    onChange={e => setForm(f => ({ ...f, max_issuances: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Days</label>
                  <input type="number" min="0" value={form.expiry_days}
                    onChange={e => setForm(f => ({ ...f, expiry_days: e.target.value }))}
                    placeholder="No expiry"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
