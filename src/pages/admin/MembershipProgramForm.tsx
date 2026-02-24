import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, X, Gift } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { adminMenuItems } from './adminMenuItems';

interface Reward {
  id: string;
  title: string;
  brand_id: string;
  status: string;
  brands: {
    name: string;
  };
}

interface SelectedReward {
  reward_id: string;
  quantity_limit: number | null;
  reward?: Reward;
}

export function MembershipProgramForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<SelectedReward[]>([]);
  const [showRewardModal, setShowRewardModal] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    description: '',
    tier_level: '',
    enrollment_type: 'manual' as 'manual' | 'automatic' | 'hybrid' | 'invitation_only',
    validity_days: 365,
    max_rewards_total: '',
    max_rewards_per_brand: '',
    enrollment_fee: 0,
    renewal_fee: 0,
    auto_renew: false,
    priority: 0,
    benefits: [] as string[],
    terms_conditions: '',
    is_active: true
  });

  const [benefitInput, setBenefitInput] = useState('');

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    try {
      const [clientsRes, rewardsRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('rewards').select('*, brands(name)').eq('status', 'active').order('title')
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (rewardsRes.data) setAvailableRewards(rewardsRes.data);

      if (id && id !== 'new') {
        await loadProgram(id);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadProgram = async (programId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('membership_programs')
        .select('*')
        .eq('id', programId)
        .single();

      if (error) throw error;

      setFormData({
        client_id: data.client_id,
        name: data.name,
        description: data.description || '',
        tier_level: data.tier_level || '',
        enrollment_type: data.enrollment_type || 'manual',
        validity_days: data.validity_days,
        max_rewards_total: data.max_rewards_total?.toString() || '',
        max_rewards_per_brand: data.max_rewards_per_brand?.toString() || '',
        enrollment_fee: data.enrollment_fee || 0,
        renewal_fee: data.renewal_fee || 0,
        auto_renew: data.auto_renew || false,
        priority: data.priority || 0,
        benefits: data.benefits || [],
        terms_conditions: data.terms_conditions || '',
        is_active: data.is_active
      });

      const { data: programRewards } = await supabase
        .from('membership_program_rewards')
        .select('*, rewards(*, brands(name))')
        .eq('program_id', programId);

      if (programRewards) {
        setSelectedRewards(programRewards.map((pr: any) => ({
          reward_id: pr.reward_id,
          quantity_limit: pr.quantity_limit,
          reward: pr.rewards
        })));
      }
    } catch (error) {
      console.error('Error loading program:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.client_id) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const programData = {
        client_id: formData.client_id,
        name: formData.name,
        description: formData.description,
        tier_level: formData.tier_level || null,
        enrollment_type: formData.enrollment_type,
        validity_days: formData.validity_days,
        max_rewards_total: formData.max_rewards_total ? parseInt(formData.max_rewards_total) : null,
        max_rewards_per_brand: formData.max_rewards_per_brand ? parseInt(formData.max_rewards_per_brand) : null,
        enrollment_fee: formData.enrollment_fee,
        renewal_fee: formData.renewal_fee,
        auto_renew: formData.auto_renew,
        priority: formData.priority,
        benefits: formData.benefits,
        terms_conditions: formData.terms_conditions,
        is_active: formData.is_active
      };

      let programId = id;

      if (id === 'new') {
        const { data, error } = await supabase
          .from('membership_programs')
          .insert([programData])
          .select()
          .single();

        if (error) throw error;
        programId = data.id;
      } else {
        const { error } = await supabase
          .from('membership_programs')
          .update(programData)
          .eq('id', id);

        if (error) throw error;
      }

      await supabase
        .from('membership_program_rewards')
        .delete()
        .eq('program_id', programId);

      if (selectedRewards.length > 0) {
        const rewardInserts = selectedRewards.map(sr => ({
          program_id: programId,
          reward_id: sr.reward_id,
          quantity_limit: sr.quantity_limit
        }));

        const { error: rewardsError } = await supabase
          .from('membership_program_rewards')
          .insert(rewardInserts);

        if (rewardsError) throw rewardsError;
      }

      navigate('/admin/membership-programs');
    } catch (error) {
      console.error('Error saving program:', error);
      alert('Failed to save program');
    } finally {
      setLoading(false);
    }
  };

  const addReward = (rewardId: string) => {
    if (selectedRewards.find(sr => sr.reward_id === rewardId)) {
      alert('Reward already added');
      return;
    }

    const reward = availableRewards.find(r => r.id === rewardId);
    if (reward) {
      setSelectedRewards([...selectedRewards, {
        reward_id: rewardId,
        quantity_limit: null,
        reward
      }]);
    }
    setShowRewardModal(false);
  };

  const removeReward = (rewardId: string) => {
    setSelectedRewards(selectedRewards.filter(sr => sr.reward_id !== rewardId));
  };

  const updateRewardQuantity = (rewardId: string, quantity: number | null) => {
    setSelectedRewards(selectedRewards.map(sr =>
      sr.reward_id === rewardId ? { ...sr, quantity_limit: quantity } : sr
    ));
  };

  const addBenefit = () => {
    if (benefitInput.trim()) {
      setFormData({
        ...formData,
        benefits: [...formData.benefits, benefitInput.trim()]
      });
      setBenefitInput('');
    }
  };

  const removeBenefit = (index: number) => {
    setFormData({
      ...formData,
      benefits: formData.benefits.filter((_, i) => i !== index)
    });
  };

  return (
    <DashboardLayout menuItems={adminMenuItems} title={id === 'new' ? 'New Program' : 'Edit Program'}>
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/admin/membership-programs')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Programs
        </Button>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Program Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tier Level
                  </label>
                  <select
                    value={formData.tier_level}
                    onChange={(e) => setFormData({ ...formData, tier_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">None</option>
                    <option value="basic">Basic</option>
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                    <option value="diamond">Diamond</option>
                    <option value="premium">Premium</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enrollment Type
                  </label>
                  <select
                    value={formData.enrollment_type}
                    onChange={(e) => setFormData({ ...formData, enrollment_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="manual">Manual</option>
                    <option value="automatic">Automatic</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="invitation_only">Invitation Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validity (Days)
                  </label>
                  <input
                    type="number"
                    value={formData.validity_days}
                    onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

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
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Reward Limits</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Rewards (Total)
                  </label>
                  <input
                    type="number"
                    value={formData.max_rewards_total}
                    onChange={(e) => setFormData({ ...formData, max_rewards_total: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Rewards (Per Brand)
                  </label>
                  <input
                    type="number"
                    value={formData.max_rewards_per_brand}
                    onChange={(e) => setFormData({ ...formData, max_rewards_per_brand: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Fees</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enrollment Fee
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.enrollment_fee}
                    onChange={(e) => setFormData({ ...formData, enrollment_fee: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Renewal Fee
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.renewal_fee}
                    onChange={(e) => setFormData({ ...formData, renewal_fee: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.auto_renew}
                      onChange={(e) => setFormData({ ...formData, auto_renew: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Enable Auto-Renewal</span>
                  </label>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Rewards</h2>
                <Button type="button" variant="outline" onClick={() => setShowRewardModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reward
                </Button>
              </div>

              {selectedRewards.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No rewards added yet</p>
              ) : (
                <div className="space-y-3">
                  {selectedRewards.map((sr) => (
                    <div key={sr.reward_id} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg">
                      <Gift className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{sr.reward?.title}</div>
                        <div className="text-sm text-gray-500">{sr.reward?.brands.name}</div>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          placeholder="Unlimited"
                          value={sr.quantity_limit || ''}
                          onChange={(e) => updateRewardQuantity(sr.reward_id, e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                        <div className="text-xs text-gray-500 mt-1">Quantity limit</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReward(sr.reward_id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Benefits</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={benefitInput}
                  onChange={(e) => setBenefitInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                  placeholder="Add a benefit..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <Button type="button" onClick={addBenefit}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {formData.benefits.length > 0 && (
                <ul className="space-y-2">
                  {formData.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <span className="flex-1">{benefit}</span>
                      <button
                        type="button"
                        onClick={() => removeBenefit(index)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h2>
              <textarea
                value={formData.terms_conditions}
                onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Enter terms and conditions..."
              />
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Active Program</span>
              </label>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/admin/membership-programs')}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Program'}
            </Button>
          </div>
        </form>

        {showRewardModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Select Rewards</h3>
                  <button onClick={() => setShowRewardModal(false)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-2">
                  {availableRewards.map((reward) => (
                    <button
                      key={reward.id}
                      type="button"
                      onClick={() => addReward(reward.id)}
                      disabled={selectedRewards.some(sr => sr.reward_id === reward.id)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium text-gray-900">{reward.title}</div>
                      <div className="text-sm text-gray-500">{reward.brands.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
