import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Plus, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

export function CreateMembershipProgram() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [clientId, setClientId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditMode = id && id !== 'new';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tier_level: '',
    validity_days: 365,
    priority: 0,
    benefits: [''],
    enrollment_fee: 0,
    renewal_fee: 0,
    auto_renew: false,
    allow_self_enrollment: false,
    enrollment_url: '',
    max_enrollments: null as number | null,
    enrollment_start_date: '',
    enrollment_end_date: '',
  });

  const [availableRewards, setAvailableRewards] = useState<any[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<Array<{ reward_id: string; quantity_limit: number | null; reward?: any }>>([]);

  useEffect(() => {
    loadClientId();
    loadRewards();
    if (isEditMode) {
      loadProgram();
    }
  }, [isEditMode]);

  const loadClientId = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (profile?.client_id) {
        setClientId(profile.client_id);
      }
    } catch (error) {
      console.error('Error loading client ID:', error);
    }
  };

  const loadRewards = async () => {
    try {
      const { data, error } = await supabase
        .from('rewards')
        .select('*, brands(name)')
        .eq('status', 'active')
        .order('title');

      if (error) throw error;
      setAvailableRewards(data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
    }
  };

  const loadProgram = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('membership_programs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name || '',
          description: data.description || '',
          tier_level: data.tier_level || '',
          validity_days: data.validity_days || 365,
          priority: data.priority || 0,
          benefits: (data.benefits as string[]) || [''],
          enrollment_fee: data.enrollment_fee || 0,
          renewal_fee: data.renewal_fee || 0,
          auto_renew: data.auto_renew || false,
          allow_self_enrollment: data.allow_self_enrollment || false,
          enrollment_url: data.enrollment_url || '',
          max_enrollments: data.max_enrollments || null,
          enrollment_start_date: data.enrollment_start_date || '',
          enrollment_end_date: data.enrollment_end_date || '',
        });
        setClientId(data.client_id);

        const { data: programRewards, error: rewardsError } = await supabase
          .from('membership_program_rewards')
          .select('*, rewards(*, brands(name))')
          .eq('program_id', id);

        if (!rewardsError && programRewards) {
          setSelectedRewards(programRewards.map((pr: any) => ({
            reward_id: pr.reward_id,
            quantity_limit: pr.quantity_limit,
            reward: pr.rewards
          })));
        }
      }
    } catch (error) {
      console.error('Error loading program:', error);
      alert('Failed to load program');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      alert('Client ID not found');
      return;
    }

    if (!formData.name || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const filteredBenefits = formData.benefits.filter((b) => b.trim() !== '');

      const programData = {
        client_id: clientId,
        name: formData.name,
        description: formData.description,
        tier_level: formData.tier_level || null,
        validity_days: formData.validity_days,
        priority: formData.priority,
        benefits: filteredBenefits,
        enrollment_fee: formData.enrollment_fee,
        renewal_fee: formData.renewal_fee,
        auto_renew: formData.auto_renew,
        allow_self_enrollment: formData.allow_self_enrollment,
        enrollment_url: formData.enrollment_url || null,
        max_enrollments: formData.max_enrollments || null,
        enrollment_start_date: formData.enrollment_start_date || null,
        enrollment_end_date: formData.enrollment_end_date || null,
        is_active: true,
      };

      let programId = id;

      if (isEditMode) {
        const { error } = await supabase
          .from('membership_programs')
          .update(programData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('membership_programs')
          .insert([programData])
          .select()
          .single();

        if (error) throw error;
        programId = data.id;
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

      alert(`Membership program ${isEditMode ? 'updated' : 'created'} successfully!`);
      navigate('/client/programs');
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} program:`, error);
      alert(error.message || `Failed to ${isEditMode ? 'update' : 'create'} program`);
    } finally {
      setSaving(false);
    }
  };

  const addBenefit = () => {
    setFormData({
      ...formData,
      benefits: [...formData.benefits, ''],
    });
  };

  const updateBenefit = (index: number, value: string) => {
    const newBenefits = [...formData.benefits];
    newBenefits[index] = value;
    setFormData({ ...formData, benefits: newBenefits });
  };

  const removeBenefit = (index: number) => {
    const newBenefits = formData.benefits.filter((_, i) => i !== index);
    setFormData({ ...formData, benefits: newBenefits });
  };

  const addReward = (rewardId: string) => {
    if (selectedRewards.find(sr => sr.reward_id === rewardId)) {
      alert('Reward already added');
      return;
    }
    const reward = availableRewards.find(r => r.id === rewardId);
    setSelectedRewards([...selectedRewards, { reward_id: rewardId, quantity_limit: 1, reward }]);
  };

  const updateRewardQuantity = (rewardId: string, quantity: number | null) => {
    setSelectedRewards(selectedRewards.map(sr =>
      sr.reward_id === rewardId ? { ...sr, quantity_limit: quantity } : sr
    ));
  };

  const removeReward = (rewardId: string) => {
    setSelectedRewards(selectedRewards.filter(sr => sr.reward_id !== rewardId));
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title={isEditMode ? "Edit Membership Program" : "Create Membership Program"}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Loading program...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title={isEditMode ? "Edit Membership Program" : "Create Membership Program"}>
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/client/programs')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Programs
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create New Membership Program</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Program Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Gold Membership"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe the membership program..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tier Level
                  </label>
                  <select
                    value={formData.tier_level}
                    onChange={(e) =>
                      setFormData({ ...formData, tier_level: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select tier</option>
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                    <option value="diamond">Diamond</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Validity (Days) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.validity_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        validity_days: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of days the membership is valid
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Priority Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Higher priority shows first (0 = lowest)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Enrollment Fee
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.enrollment_fee}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        enrollment_fee: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">One-time enrollment fee</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Renewal Fee
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.renewal_fee}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        renewal_fee: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Annual renewal fee</p>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.auto_renew}
                      onChange={(e) =>
                        setFormData({ ...formData, auto_renew: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Enable Auto-Renewal
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Automatically renew memberships when they expire
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Self-Enrollment Settings
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allow_self_enrollment}
                        onChange={(e) =>
                          setFormData({ ...formData, allow_self_enrollment: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-gray-700">
                        Allow Member Self-Enrollment
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Enable members to enroll themselves in this program
                    </p>
                  </div>

                  {formData.allow_self_enrollment && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-6 p-4 bg-gray-50 rounded-lg">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Enrollment URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://your-custom-enrollment-page.com"
                          value={formData.enrollment_url}
                          onChange={(e) =>
                            setFormData({ ...formData, enrollment_url: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Optional custom URL for enrollment landing page
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Max Enrollments
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Unlimited"
                          value={formData.max_enrollments || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              max_enrollments: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty for unlimited
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Enrollment Start Date
                        </label>
                        <input
                          type="date"
                          value={formData.enrollment_start_date}
                          onChange={(e) =>
                            setFormData({ ...formData, enrollment_start_date: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Optional start date for enrollment
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Enrollment End Date
                        </label>
                        <input
                          type="date"
                          value={formData.enrollment_end_date}
                          onChange={(e) =>
                            setFormData({ ...formData, enrollment_end_date: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Optional end date for enrollment
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Member Benefits
                  </label>
                  <Button type="button" size="sm" onClick={addBenefit}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Benefit
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., 10% discount on all purchases"
                        value={benefit}
                        onChange={(e) => updateBenefit(index, e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      {formData.benefits.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBenefit(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Rewards Available to Members
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-4">
                  <select
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => {
                      if (e.target.value) {
                        addReward(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Select a reward to add...</option>
                    {availableRewards.filter(r => !selectedRewards.find(sr => sr.reward_id === r.id)).map((reward) => (
                      <option key={reward.id} value={reward.id}>
                        {reward.title} - {reward.brands?.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRewards.length > 0 && (
                  <div className="space-y-3">
                    {selectedRewards.map((sr) => {
                      const reward = sr.reward || availableRewards.find(r => r.id === sr.reward_id);
                      if (!reward) return null;
                      return (
                        <div key={sr.reward_id} className="flex gap-2 items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{reward.title}</p>
                            <p className="text-sm text-gray-600">{reward.brands?.name}</p>
                          </div>
                          <input
                            type="number"
                            min="1"
                            placeholder="Quantity"
                            value={sr.quantity_limit || ''}
                            onChange={(e) => updateRewardQuantity(sr.reward_id, e.target.value ? parseInt(e.target.value) : null)}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeReward(sr.reward_id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/client/programs')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Creating...' : 'Create Program'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
