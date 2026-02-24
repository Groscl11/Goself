import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Edit2, Trash2, Save, X, Award, TrendingUp, Users } from 'lucide-react';
import { clientMenuItems } from './clientMenuItems';

interface LoyaltyProgram {
  id: string;
  client_id: string;
  program_name: string;
  points_name: string;
  points_name_singular: string;
  is_active: boolean;
  currency: string;
  allow_redemption: boolean;
  points_expiry_days: number | null;
  welcome_bonus_points: number;
  created_at: string;
  updated_at: string;
}

interface LoyaltyTier {
  id: string;
  loyalty_program_id: string;
  tier_name: string;
  tier_level: number;
  min_orders: number;
  min_spend: number;
  points_earn_rate: number;
  points_earn_divisor: number;
  max_redemption_percent: number;
  max_redemption_points: number | null;
  points_value: number;
  benefits_description: string | null;
  color_code: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export default function LoyaltyProgram() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showTierForm, setShowTierForm] = useState(false);
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
  const [stats, setStats] = useState({ totalMembers: 0, totalPointsIssued: 0, totalRedeemed: 0 });
  const [error, setError] = useState<string | null>(null);

  const [programForm, setProgramForm] = useState({
    program_name: '',
    points_name: 'Points',
    points_name_singular: 'Point',
    currency: 'INR',
    allow_redemption: true,
    points_expiry_days: null as number | null,
    welcome_bonus_points: 0,
  });

  const [tierForm, setTierForm] = useState({
    tier_name: '',
    tier_level: 1,
    min_orders: 0,
    min_spend: 0,
    points_earn_rate: 1,
    points_earn_divisor: 1,
    max_redemption_percent: 100,
    max_redemption_points: null as number | null,
    points_value: 1,
    benefits_description: '',
    color_code: '#3B82F6',
    is_default: false,
  });

  useEffect(() => {
    loadProgram();
  }, [user]);

  const loadProgram = async () => {
    if (!user) {
      setLoading(false);
      setError('User not authenticated. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setError('Failed to load profile. Please try refreshing the page.');
        setLoading(false);
        return;
      }

      if (!profile?.client_id) {
        setError('No client account found. Please contact support to set up your client account.');
        setLoading(false);
        return;
      }

      const { data: programData, error: programError } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('client_id', profile.client_id)
        .maybeSingle();

      if (programError) {
        setError('Failed to load loyalty program. Please try again.');
        setLoading(false);
        return;
      }

      if (programData) {
        setProgram(programData);
        loadTiers(programData.id);
        loadStats(programData.id);
      } else {
        setShowProgramForm(true);
      }
    } catch (error) {
      console.error('Error loading program:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTiers = async (programId: string) => {
    const { data, error } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('loyalty_program_id', programId)
      .order('tier_level');

    if (data) setTiers(data);
    if (error) console.error('Error loading tiers:', error);
  };

  const loadStats = async (programId: string) => {
    try {
      const { data: statusData } = await supabase
        .from('member_loyalty_status')
        .select('points_balance, lifetime_points_earned, lifetime_points_redeemed')
        .eq('loyalty_program_id', programId);

      if (statusData) {
        const totalMembers = statusData.length;
        const totalPointsIssued = statusData.reduce((sum, m) => sum + (m.lifetime_points_earned || 0), 0);
        const totalRedeemed = statusData.reduce((sum, m) => sum + (m.lifetime_points_redeemed || 0), 0);
        setStats({ totalMembers, totalPointsIssued, totalRedeemed });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSaveProgram = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (!profile?.client_id) return;

      if (program) {
        const { error } = await supabase
          .from('loyalty_programs')
          .update(programForm)
          .eq('id', program.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('loyalty_programs')
          .insert([{ ...programForm, client_id: profile.client_id }])
          .select()
          .single();

        if (error) throw error;
        if (data) setProgram(data);
      }

      setShowProgramForm(false);
      loadProgram();
    } catch (error) {
      console.error('Error saving program:', error);
      alert('Failed to save program');
    }
  };

  const handleSaveTier = async () => {
    if (!program) return;

    try {
      if (editingTier) {
        const { error } = await supabase
          .from('loyalty_tiers')
          .update(tierForm)
          .eq('id', editingTier.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('loyalty_tiers')
          .insert([{ ...tierForm, loyalty_program_id: program.id }]);

        if (error) throw error;
      }

      setShowTierForm(false);
      setEditingTier(null);
      loadTiers(program.id);
      resetTierForm();
    } catch (error) {
      console.error('Error saving tier:', error);
      alert('Failed to save tier');
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier?')) return;

    try {
      const { error } = await supabase
        .from('loyalty_tiers')
        .delete()
        .eq('id', tierId);

      if (error) throw error;
      if (program) loadTiers(program.id);
    } catch (error) {
      console.error('Error deleting tier:', error);
      alert('Failed to delete tier');
    }
  };

  const handleEditTier = (tier: LoyaltyTier) => {
    setTierForm({
      tier_name: tier.tier_name,
      tier_level: tier.tier_level,
      min_orders: tier.min_orders,
      min_spend: tier.min_spend,
      points_earn_rate: tier.points_earn_rate,
      points_earn_divisor: tier.points_earn_divisor,
      max_redemption_percent: tier.max_redemption_percent,
      max_redemption_points: tier.max_redemption_points,
      points_value: tier.points_value,
      benefits_description: tier.benefits_description || '',
      color_code: tier.color_code || '#3B82F6',
      is_default: tier.is_default,
    });
    setEditingTier(tier);
    setShowTierForm(true);
  };

  const resetTierForm = () => {
    setTierForm({
      tier_name: '',
      tier_level: tiers.length + 1,
      min_orders: 0,
      min_spend: 0,
      points_earn_rate: 1,
      points_earn_divisor: 1,
      max_redemption_percent: 100,
      max_redemption_points: null,
      points_value: 1,
      benefits_description: '',
      color_code: '#3B82F6',
      is_default: false,
    });
  };

  const handleEditProgram = () => {
    if (program) {
      setProgramForm({
        program_name: program.program_name,
        points_name: program.points_name,
        points_name_singular: program.points_name_singular,
        currency: program.currency,
        allow_redemption: program.allow_redemption,
        points_expiry_days: program.points_expiry_days,
        welcome_bonus_points: program.welcome_bonus_points,
      });
    }
    setShowProgramForm(true);
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Loyalty Points">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Loyalty Points">
        <div className="max-w-2xl mx-auto mt-8">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Loyalty Program</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={loadProgram}>
              Try Again
            </Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Loyalty Points">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Loyalty Points Program</h1>
            <p className="text-gray-600 mt-1">Configure your points-based loyalty program</p>
          </div>
          {program && !showProgramForm && (
            <Button onClick={handleEditProgram} variant="outline">
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Program
            </Button>
          )}
        </div>

        {program && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Members</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalMembers}</p>
                </div>
                <Users className="w-12 h-12 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{program.points_name} Issued</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalPointsIssued.toLocaleString()}</p>
                </div>
                <Award className="w-12 h-12 text-green-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{program.points_name} Redeemed</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalRedeemed.toLocaleString()}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-purple-500" />
              </div>
            </Card>
          </div>
        )}

        {showProgramForm ? (
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {program ? 'Edit Program' : 'Create Loyalty Program'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Program Name
                </label>
                <input
                  type="text"
                  value={programForm.program_name}
                  onChange={(e) => setProgramForm({ ...programForm, program_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="VIP Rewards"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Points Name (Plural)
                </label>
                <input
                  type="text"
                  value={programForm.points_name}
                  onChange={(e) => setProgramForm({ ...programForm, points_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Points"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Points Name (Singular)
                </label>
                <input
                  type="text"
                  value={programForm.points_name_singular}
                  onChange={(e) => setProgramForm({ ...programForm, points_name_singular: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Point"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={programForm.currency}
                  onChange={(e) => setProgramForm({ ...programForm, currency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Welcome Bonus Points
                </label>
                <input
                  type="number"
                  value={programForm.welcome_bonus_points}
                  onChange={(e) => setProgramForm({ ...programForm, welcome_bonus_points: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Points Expiry (Days)
                </label>
                <input
                  type="number"
                  value={programForm.points_expiry_days || ''}
                  onChange={(e) => setProgramForm({ ...programForm, points_expiry_days: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave blank for no expiry"
                  min="1"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={programForm.allow_redemption}
                    onChange={(e) => setProgramForm({ ...programForm, allow_redemption: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Allow Points Redemption</span>
                </label>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <Button onClick={handleSaveProgram}>
                <Save className="w-4 h-4 mr-2" />
                Save Program
              </Button>
              {program && (
                <Button variant="outline" onClick={() => setShowProgramForm(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </Card>
        ) : program && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Loyalty Tiers</h2>
              <Button onClick={() => { resetTierForm(); setShowTierForm(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Tier
              </Button>
            </div>

            {tiers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No tiers created yet</p>
                <p className="text-sm">Create your first loyalty tier to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    style={{ borderLeftColor: tier.color_code || '#3B82F6', borderLeftWidth: '4px' }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{tier.tier_name}</h3>
                          {tier.is_default && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                              Default
                            </span>
                          )}
                          <span className="text-sm text-gray-500">Level {tier.tier_level}</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Min Orders</p>
                            <p className="font-semibold">{tier.min_orders}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Min Spend</p>
                            <p className="font-semibold">{program.currency} {tier.min_spend}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Earn Rate</p>
                            <p className="font-semibold">
                              {tier.points_earn_rate} {program.points_name_singular} / {program.currency} {tier.points_earn_divisor}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Max Redemption</p>
                            <p className="font-semibold">{tier.max_redemption_percent}%</p>
                          </div>
                        </div>

                        {tier.benefits_description && (
                          <p className="text-sm text-gray-600 mt-2">{tier.benefits_description}</p>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEditTier(tier)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTier(tier.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {showTierForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <Card className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  {editingTier ? 'Edit Tier' : 'Create New Tier'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tier Name
                    </label>
                    <input
                      type="text"
                      value={tierForm.tier_name}
                      onChange={(e) => setTierForm({ ...tierForm, tier_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Bronze, Silver, Gold..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tier Level
                    </label>
                    <input
                      type="number"
                      value={tierForm.tier_level}
                      onChange={(e) => setTierForm({ ...tierForm, tier_level: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Orders
                    </label>
                    <input
                      type="number"
                      value={tierForm.min_orders}
                      onChange={(e) => setTierForm({ ...tierForm, min_orders: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Spend ({program?.currency})
                    </label>
                    <input
                      type="number"
                      value={tierForm.min_spend}
                      onChange={(e) => setTierForm({ ...tierForm, min_spend: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Points Earn Rate
                    </label>
                    <input
                      type="number"
                      value={tierForm.points_earn_rate}
                      onChange={(e) => setTierForm({ ...tierForm, points_earn_rate: parseFloat(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1">Points earned per currency unit</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Points Earn Divisor
                    </label>
                    <input
                      type="number"
                      value={tierForm.points_earn_divisor}
                      onChange={(e) => setTierForm({ ...tierForm, points_earn_divisor: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">1 point per {tierForm.points_earn_divisor} {program?.currency}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Point Value ({program?.currency})
                    </label>
                    <input
                      type="number"
                      value={tierForm.points_value}
                      onChange={(e) => setTierForm({ ...tierForm, points_value: parseFloat(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1">Currency value when redeeming</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Redemption %
                    </label>
                    <input
                      type="number"
                      value={tierForm.max_redemption_percent}
                      onChange={(e) => setTierForm({ ...tierForm, max_redemption_percent: parseInt(e.target.value) || 100 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Redemption Points
                    </label>
                    <input
                      type="number"
                      value={tierForm.max_redemption_points || ''}
                      onChange={(e) => setTierForm({ ...tierForm, max_redemption_points: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="No limit"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tier Color
                    </label>
                    <input
                      type="color"
                      value={tierForm.color_code}
                      onChange={(e) => setTierForm({ ...tierForm, color_code: e.target.value })}
                      className="w-full h-10 px-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Benefits Description
                    </label>
                    <textarea
                      value={tierForm.benefits_description}
                      onChange={(e) => setTierForm({ ...tierForm, benefits_description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Describe the benefits of this tier..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={tierForm.is_default}
                        onChange={(e) => setTierForm({ ...tierForm, is_default: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Set as Default Tier</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <Button onClick={handleSaveTier}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Tier
                  </Button>
                  <Button variant="outline" onClick={() => { setShowTierForm(false); setEditingTier(null); }}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
