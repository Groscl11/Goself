import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Plus, Edit, Trash2, Tag, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';
import { RewardForm } from '../../components/RewardForm';
import { ExcelUploadModal } from '../../components/ExcelUploadModal';

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Reward {
  id: string;
  brand_id: string;
  client_id: string | null;
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
  reward_type: string;
  coupon_type: string;
}

export function ClientRewards() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [clientId, setClientId] = useState<string>('');

  useEffect(() => {
    loadClientId();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadRewards();
      loadBrands();
    }
  }, [clientId]);

  const loadClientId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (profile?.client_id) {
        setClientId(profile.client_id);
      }
    } catch (error) {
      console.error('Error loading client ID:', error);
    }
  };

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
          )
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRewards(data || []);
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

      const rewardPayload = {
        ...rewardData,
        client_id: clientId,
        is_marketplace: false,
      };

      if (editingReward) {
        const { error } = await supabase
          .from('rewards')
          .update({
            ...rewardPayload,
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
          .insert([rewardPayload])
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
      loadRewards();
    } catch (error) {
      console.error('Error saving reward:', error);
      alert('Failed to save reward. Please try again.');
    }
  };

  const handleEdit = (reward: Reward) => {
    setEditingReward(reward);
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
          client_id: clientId,
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
          is_marketplace: false,
          status: row.status || 'active',
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

  const filteredRewards = rewards.filter((reward) => {
    const brandName = reward.brands?.name ?? '';
    const matchesSearch =
      reward.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (reward.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      brandName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterStatus === 'all' || reward.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const statuses = ['draft', 'pending', 'active', 'inactive', 'expired'];

  return (
    <DashboardLayout menuItems={clientMenuItems} title="My Rewards">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Rewards</h1>
            <p className="text-gray-600 mt-2">Create and manage your custom rewards</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowExcelUpload(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Upload Excel
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Reward
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Your Rewards ({filteredRewards.length})</CardTitle>
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
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                <p className="text-gray-500 text-sm mt-2">
                  Create your first custom reward to get started
                </p>
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
                        Status
                      </th>
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
                              {reward.reward_type?.replace('_', ' ') || 'other'}
                            </span>
                            <div className="text-xs text-gray-500">
                              {reward.coupon_type === 'generic' ? 'Generic Code' : 'Unique Codes'}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${
                              reward.status === 'active'
                                ? 'bg-green-50 text-green-700'
                                : reward.status === 'draft'
                                ? 'bg-gray-100 text-gray-700'
                                : reward.status === 'pending'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {reward.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
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

      {showForm && (
        <RewardForm
          reward={editingReward}
          brands={brands}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingReward(null);
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
