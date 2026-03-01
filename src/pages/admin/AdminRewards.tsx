import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Plus, Edit, Eye, Filter, Trash2, X, Copy, Tag, FileSpreadsheet, ArrowLeft, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminMenuItems } from './adminMenuItems';
import { RewardForm } from '../../components/RewardForm';
import { ExcelUploadModal } from '../../components/ExcelUploadModal';

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

type TabType = 'available' | 'expired' | 'inactive';

interface Reward {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  terms_conditions: string;
  value_description: string;
  image_url: string | null;
  category: string;
  status: string;
  is_marketplace: boolean;
  voucher_count: number;
  expiry_date: string | null;
  brands: Brand;
  // computed
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
  isAvailable: boolean;
  unredeemedVouchers: number;
}

interface RewardFormData {
  brand_id: string;
  title: string;
  description: string;
  terms_conditions: string;
  value_description: string;
  image_url: string;
  category: string;
  status: string;
  is_marketplace: boolean;
  voucher_count: number;
  expiry_date: string;
}

export function AdminRewards() {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('available');
  const [extendingReward, setExtendingReward] = useState<string | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formData, setFormData] = useState<RewardFormData>({
    brand_id: '',
    title: '',
    description: '',
    terms_conditions: '',
    value_description: '',
    image_url: '',
    category: 'general',
    status: 'active',
    is_marketplace: true,
    voucher_count: 0,
    expiry_date: '',
  });

  useEffect(() => {
    loadRewards();
    loadBrands();
  }, []);

  const loadRewards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rewards')
        .select(`
          *,
          brands (
            id,
            name,
            logo_url
          ),
          vouchers (id, status)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const processed = (data || []).map((reward: any) => {
        const expiresAt = reward.expiry_date ? new Date(reward.expiry_date) : null;
        const isExpired = !!(expiresAt && expiresAt < now);
        const daysUntilExpiry = expiresAt
          ? Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 7;
        return {
          ...reward,
          isExpired,
          isExpiringSoon,
          daysUntilExpiry,
          isAvailable: reward.status === 'active' && !isExpired,
          unredeemedVouchers: (reward.vouchers ?? []).filter((v: any) => v.status === 'available').length,
        };
      });

      setRewards(processed);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, logo_url')
        .eq('status', 'approved')
        .order('name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  };

  const handleSubmit = async (formSubmitData: any) => {
    try {
      const { unique_coupon_codes, ...rewardData } = formSubmitData;

      if (editingReward) {
        const { error } = await supabase
          .from('rewards')
          .update({
            ...rewardData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingReward.id);

        if (error) throw error;

        if (rewardData.coupon_type === 'unique' && unique_coupon_codes && unique_coupon_codes.length > 0) {
          const vouchersToInsert = unique_coupon_codes.map((code: string) => ({
            reward_id: editingReward.id,
            code: code,
            status: 'available',
            redemption_link: rewardData.redemption_link,
          }));

          const { error: voucherError } = await supabase
            .from('vouchers')
            .insert(vouchersToInsert);

          if (voucherError) throw voucherError;
        }
      } else {
        const { data: newReward, error } = await supabase
          .from('rewards')
          .insert([rewardData])
          .select()
          .single();

        if (error) throw error;

        if (rewardData.coupon_type === 'unique' && unique_coupon_codes && unique_coupon_codes.length > 0) {
          const vouchersToInsert = unique_coupon_codes.map((code: string) => ({
            reward_id: newReward.id,
            code: code,
            status: 'available',
            redemption_link: rewardData.redemption_link,
          }));

          const { error: voucherError } = await supabase
            .from('vouchers')
            .insert(vouchersToInsert);

          if (voucherError) throw voucherError;
        }
      }

      setShowForm(false);
      setEditingReward(null);
      resetForm();
      loadRewards();
    } catch (error) {
      console.error('Error saving reward:', error);
      alert('Failed to save reward. Please try again.');
    }
  };

  const handleEdit = (reward: Reward) => {
    setEditingReward(reward);
    setFormData({
      brand_id: reward.brand_id,
      title: reward.title,
      description: reward.description,
      terms_conditions: reward.terms_conditions,
      value_description: reward.value_description,
      image_url: reward.image_url || '',
      category: reward.category,
      status: reward.status,
      is_marketplace: reward.is_marketplace,
      voucher_count: reward.voucher_count,
      expiry_date: reward.expiry_date
        ? new Date(reward.expiry_date).toISOString().split('T')[0]
        : '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;

    try {
      const { error } = await supabase.from('rewards').delete().eq('id', id);

      if (error) throw error;
      loadRewards();
    } catch (error) {
      console.error('Error deleting reward:', error);
      alert('Failed to delete reward. Please try again.');
    }
  };

  const handleExtendExpiry = async (rewardId: string) => {
    if (!newExpiryDate) return;
    try {
      const { error } = await supabase
        .from('rewards')
        .update({ expiry_date: newExpiryDate })
        .eq('id', rewardId);
      if (error) throw error;
      setExtendingReward(null);
      setNewExpiryDate('');
      loadRewards();
    } catch (error) {
      console.error('Error extending expiry:', error);
      alert('Failed to extend expiry date');
    }
  };

  const handleExcelUpload = async (data: any[]) => {
    try {
      for (const row of data) {
        const { data: brandData } = await supabase
          .from('brands')
          .select('id')
          .eq('name', row.brand_name)
          .maybeSingle();

        if (!brandData) {
          throw new Error(`Brand "${row.brand_name}" not found`);
        }

        const rewardData = {
          brand_id: brandData.id,
          title: row.title,
          description: row.description,
          category: row.category,
          reward_type: row.reward_type,
          discount_value: row.discount_value,
          max_discount_value: row.max_discount_value,
          min_purchase_amount: row.min_purchase_amount,
          currency: row.currency,
          coupon_type: row.coupon_type,
          generic_coupon_code: row.generic_coupon_code,
          redemption_link: row.redemption_link,
          value_description: row.value_description,
          terms_conditions: row.terms_conditions,
          expiry_date: row.expiry_date,
          is_marketplace: row.is_marketplace,
          status: row.status,
        };

        const { error } = await supabase.from('rewards').insert([rewardData]);

        if (error) throw error;
      }

      alert(`Successfully uploaded ${data.length} rewards`);
      loadRewards();
    } catch (error: any) {
      console.error('Error uploading rewards:', error);
      throw error;
    }
  };

  const resetForm = () => {
    setFormData({
      brand_id: '',
      title: '',
      description: '',
      terms_conditions: '',
      value_description: '',
      image_url: '',
      category: 'general',
      status: 'active',
      is_marketplace: true,
      voucher_count: 0,
      expiry_date: '',
    });
  };

  const counts = useMemo(() => ({
    available: rewards.filter(r => r.isAvailable).length,
    expired: rewards.filter(r => r.status === 'active' && r.isExpired).length,
    inactive: rewards.filter(r => r.status !== 'active').length,
    expiringSoon: rewards.filter(r => r.isExpiringSoon).length,
  }), [rewards]);

  const filteredRewards = useMemo(() => {
    return rewards.filter((reward) => {
      const brandName = reward.brands?.name ?? '';
      const matchesSearch =
        reward.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (reward.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        brandName.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesTab: boolean;
      if (activeTab === 'available') matchesTab = reward.isAvailable;
      else if (activeTab === 'expired') matchesTab = reward.status === 'active' && reward.isExpired;
      else matchesTab = reward.status !== 'active';

      return matchesSearch && matchesTab;
    });
  }, [rewards, searchQuery, activeTab]);

  const categories = [
    'general',
    'dining',
    'travel',
    'fitness',
    'wellness',
    'electronics',
    'entertainment',
  ];

  const statuses = ['draft', 'pending', 'active', 'inactive', 'expired'];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Rewards Management">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rewards Management</h1>
            <p className="text-gray-600 mt-2">Create and manage marketplace rewards</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowExcelUpload(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Upload Excel
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Reward
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>All Rewards ({filteredRewards.length})</CardTitle>
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search rewards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Warning banner */}
            {counts.expiringSoon > 0 && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">
                    Warning: {counts.expiringSoon} reward{counts.expiringSoon > 1 ? 's' : ''} expiring in the next 7 days
                  </p>
                  <button
                    onClick={() => setActiveTab('available')}
                    className="mt-1 text-sm text-yellow-700 hover:text-yellow-800 underline"
                  >
                    View expiring rewards
                  </button>
                </div>
              </div>
            )}

            {/* Tab navigation */}
            <div className="flex gap-4 border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab('available')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'available'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Available ({counts.available})
              </button>
              <button
                onClick={() => setActiveTab('expired')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'expired'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Expired ({counts.expired})
              </button>
              <button
                onClick={() => setActiveTab('inactive')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'inactive'
                    ? 'border-gray-600 text-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Inactive ({counts.inactive})
              </button>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="w-20 h-20 bg-gray-200 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRewards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No rewards found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Reward ID
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Reward
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Brand
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Expiry
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Status
                      </th>
                      {activeTab === 'expired' && (
                        <>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Unredeemed Vouchers</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">In Campaigns</th>
                        </>
                      )}
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRewards.map((reward) => (
                      <tr key={reward.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-sm text-gray-900">
                              {(reward as any).reward_id || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {reward.image_url && (
                              <img
                                src={reward.image_url}
                                alt={reward.title}
                                className="w-16 h-16 rounded object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{reward.title}</p>
                              <p className="text-sm text-gray-500">{reward.value_description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-gray-900">{reward.brands?.name || '—'}</p>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                              {(reward as any).reward_type?.replace('_', ' ') || 'other'}
                            </span>
                            <div className="text-xs text-gray-500">
                              {(reward as any).coupon_type === 'generic' ? 'Generic Code' : 'Unique Codes'}
                            </div>
                          </div>
                        </td>
                        {/* Expiry cell */}
                        <td className="py-4 px-4 whitespace-nowrap text-sm">
                          {reward.expiry_date ? (
                            reward.isExpired ? (
                              <span className="text-red-600 font-medium">
                                ⏰ Expired {Math.abs(reward.daysUntilExpiry!)} days ago
                              </span>
                            ) : reward.isExpiringSoon ? (
                              <span className="text-orange-600 font-medium">
                                ⚠️ Expires in {reward.daysUntilExpiry} days
                              </span>
                            ) : (
                              <span className="text-gray-700">
                                {new Date(reward.expiry_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 italic">Never expires</span>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className="py-4 px-4">
                          {reward.isExpired ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              ❌ Expired
                            </span>
                          ) : reward.isExpiringSoon ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                              ⏰ Expiring Soon
                            </span>
                          ) : reward.status === 'active' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              ✅ Active
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
                              🚫 {reward.status}
                            </span>
                          )}
                        </td>

                        {/* Expired tab extra columns */}
                        {activeTab === 'expired' && (
                          <>
                            <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-700">
                              {reward.unredeemedVouchers > 0 ? (
                                <span className="text-orange-600 font-medium">
                                  ⚠️ {reward.unredeemedVouchers} unredeemed
                                </span>
                              ) : (
                                <span className="text-gray-500">None</span>
                              )}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">—</td>
                          </>
                        )}

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {reward.isExpired && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExtendingReward(reward.id)}
                                title="Extend Expiry"
                              >
                                <Calendar className="w-4 h-4 text-blue-600" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(reward)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(reward.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {extendingReward && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Extend Expiry Date</h3>
            <input
              type="date"
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleExtendExpiry(extendingReward)}
                disabled={!newExpiryDate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Extend
              </button>
              <button
                onClick={() => { setExtendingReward(null); setNewExpiryDate(''); }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <RewardForm
          reward={editingReward}
          brands={brands}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingReward(null);
            resetForm();
          }}
        />
      )}

      {showExcelUpload && (
        <ExcelUploadModal
          onClose={() => setShowExcelUpload(false)}
          onUpload={handleExcelUpload}
        />
      )}
    </DashboardLayout>
  );
}
