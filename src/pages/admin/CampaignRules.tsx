import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Play, Pause ,ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { adminMenuItems } from './adminMenuItems';

interface CampaignRule {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  program_id: string;
  trigger_type: string;
  trigger_conditions: any;
  is_active: boolean;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  max_enrollments: number | null;
  current_enrollments: number;
  clients: {
    name: string;
  };
  membership_programs: {
    name: string;
  };
}

export function CampaignRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<CampaignRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CampaignRule | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    client_id: '',
    program_id: '',
    name: '',
    description: '',
    trigger_type: 'order_value' as 'order_value' | 'order_count' | 'signup' | 'birthday' | 'referral' | 'custom_event',
    trigger_conditions: {
      min_order_value: '',
      min_order_count: '',
      custom_field: '',
      custom_value: ''
    },
    priority: 0,
    start_date: '',
    end_date: '',
    max_enrollments: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, clientsRes, programsRes] = await Promise.all([
        supabase
          .from('campaign_rules')
          .select('*, clients(name), membership_programs(name)')
          .order('priority', { ascending: false }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('membership_programs').select('*').eq('is_active', true).order('name')
      ]);

      if (rulesRes.data) setRules(rulesRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (programsRes.data) setPrograms(programsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const conditions: any = {};

      if (formData.trigger_type === 'order_value' && formData.trigger_conditions.min_order_value) {
        conditions.min_order_value = parseFloat(formData.trigger_conditions.min_order_value);
      }
      if (formData.trigger_type === 'order_count' && formData.trigger_conditions.min_order_count) {
        conditions.min_order_count = parseInt(formData.trigger_conditions.min_order_count);
      }
      if (formData.trigger_type === 'custom_event') {
        conditions.custom_field = formData.trigger_conditions.custom_field;
        conditions.custom_value = formData.trigger_conditions.custom_value;
      }

      const ruleData = {
        client_id: formData.client_id,
        program_id: formData.program_id,
        name: formData.name,
        description: formData.description || null,
        trigger_type: formData.trigger_type,
        trigger_conditions: conditions,
        priority: formData.priority,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        max_enrollments: formData.max_enrollments ? parseInt(formData.max_enrollments) : null,
        is_active: formData.is_active
      };

      if (editingRule) {
        const { error } = await supabase
          .from('campaign_rules')
          .update(ruleData)
          .eq('id', editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('campaign_rules')
          .insert([ruleData]);
        if (error) throw error;
      }

      setShowModal(false);
      setEditingRule(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving campaign rule:', error);
      alert('Failed to save campaign rule');
    }
  };

  const handleEdit = (rule: CampaignRule) => {
    setEditingRule(rule);
    setFormData({
      client_id: rule.client_id,
      program_id: rule.program_id,
      name: rule.name,
      description: rule.description || '',
      trigger_type: rule.trigger_type as any,
      trigger_conditions: {
        min_order_value: rule.trigger_conditions?.min_order_value?.toString() || '',
        min_order_count: rule.trigger_conditions?.min_order_count?.toString() || '',
        custom_field: rule.trigger_conditions?.custom_field || '',
        custom_value: rule.trigger_conditions?.custom_value || ''
      },
      priority: rule.priority,
      start_date: rule.start_date ? rule.start_date.split('T')[0] : '',
      end_date: rule.end_date ? rule.end_date.split('T')[0] : '',
      max_enrollments: rule.max_enrollments?.toString() || '',
      is_active: rule.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign rule?')) return;

    try {
      const { error } = await supabase
        .from('campaign_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('campaign_rules')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      program_id: '',
      name: '',
      description: '',
      trigger_type: 'order_value',
      trigger_conditions: {
        min_order_value: '',
        min_order_count: '',
        custom_field: '',
        custom_value: ''
      },
      priority: 0,
      start_date: '',
      end_date: '',
      max_enrollments: '',
      is_active: true
    });
  };

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Campaign Rules">
      <div className="space-y-6">
        <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campaign Rules</h1>
            <p className="text-gray-600 mt-1">Automate membership enrollment based on triggers</p>
          </div>
          <Button onClick={() => { resetForm(); setEditingRule(null); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign Rule
          </Button>
        </div>

        <Card>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading campaign rules...</div>
            ) : rules.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No campaign rules configured yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enrollments</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                          <div className="text-xs text-gray-500">{rule.description}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{rule.clients.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{rule.membership_programs.name}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {rule.trigger_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {rule.current_enrollments}
                          {rule.max_enrollments && ` / ${rule.max_enrollments}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{rule.priority}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleStatus(rule.id, rule.is_active)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              rule.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {rule.is_active ? 'Active' : 'Paused'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(rule)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(rule.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingRule ? 'Edit Campaign Rule' : 'New Campaign Rule'}
                </h3>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select Client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Program <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.program_id}
                      onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select Program</option>
                      {programs.filter(p => p.client_id === formData.client_id).map((program) => (
                        <option key={program.id} value={program.id}>{program.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.trigger_type}
                    onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="order_value">Order Value Threshold</option>
                    <option value="order_count">Order Count Threshold</option>
                    <option value="signup">New Signup</option>
                    <option value="birthday">Birthday</option>
                    <option value="referral">Referral</option>
                    <option value="custom_event">Custom Event</option>
                  </select>
                </div>

                {formData.trigger_type === 'order_value' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Order Value
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.trigger_conditions.min_order_value}
                      onChange={(e) => setFormData({
                        ...formData,
                        trigger_conditions: { ...formData.trigger_conditions, min_order_value: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}

                {formData.trigger_type === 'order_count' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Order Count
                    </label>
                    <input
                      type="number"
                      value={formData.trigger_conditions.min_order_count}
                      onChange={(e) => setFormData({
                        ...formData,
                        trigger_conditions: { ...formData.trigger_conditions, min_order_count: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}

                {formData.trigger_type === 'custom_event' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Event Field
                      </label>
                      <input
                        type="text"
                        value={formData.trigger_conditions.custom_field}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_conditions: { ...formData.trigger_conditions, custom_field: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Event Value
                      </label>
                      <input
                        type="text"
                        value={formData.trigger_conditions.custom_value}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_conditions: { ...formData.trigger_conditions, custom_value: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Enrollments
                  </label>
                  <input
                    type="number"
                    value={formData.max_enrollments}
                    onChange={(e) => setFormData({ ...formData, max_enrollments: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Active Campaign</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingRule ? 'Update Rule' : 'Create Rule'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
