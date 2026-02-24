import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Eye, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { brandMenuItems } from './brandMenuItems';

interface Reward {
  id: string;
  title: string;
  description: string;
  reward_type: string;
  discount_value: number | null;
  currency: string;
  status: string;
  is_marketplace: boolean;
  created_at: string;
  voucher_count: number;
  redemption_count: number;
}

export function BrandRewards() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (profile?.brand_id) {
      loadRewards();
    }
  }, [profile]);

  const loadRewards = async () => {
    if (!profile?.brand_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('brand_id', profile.brand_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rewardsWithCounts = await Promise.all(
        (data || []).map(async (reward) => {
          const [voucherCount, redemptionCount] = await Promise.all([
            supabase
              .from('vouchers')
              .select('id', { count: 'exact', head: true })
              .eq('reward_id', reward.id),
            supabase
              .from('redemptions')
              .select('id', { count: 'exact', head: true })
              .eq('reward_id', reward.id)
          ]);

          return {
            ...reward,
            voucher_count: voucherCount.count || 0,
            redemption_count: redemptionCount.count || 0,
          };
        })
      );

      setRewards(rewardsWithCounts);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRewards = rewards.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const getStatusBadge = (status: string) => {
    const styles: any = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getRewardTypeDisplay = (type: string | null, value: number | null, currency: string) => {
    if (!type || !value) return null;

    const displays: any = {
      flat_discount: `${currency} ${value} OFF`,
      percentage_discount: `${value}% OFF`,
      upto_discount: `Up to ${currency} ${value}`,
      fixed_value: `${currency} ${value}`,
      free_item: 'Free Item',
    };

    return displays[type] || type;
  };

  return (
    <DashboardLayout menuItems={brandMenuItems} title="My Rewards">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Rewards</h1>
            <p className="text-gray-600 mt-2">Manage your reward offerings</p>
          </div>
          <Button onClick={() => navigate('/brand/rewards/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Submit New Reward
          </Button>
        </div>

        <div className="mb-6 flex gap-2">
          {['all', 'active', 'pending', 'inactive'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : filteredRewards.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No Rewards Found</p>
              <p className="text-sm text-gray-500 mb-6">
                {filter === 'all' ? 'You haven\'t created any rewards yet' : `No ${filter} rewards`}
              </p>
              {filter === 'all' && (
                <Button onClick={() => navigate('/brand/rewards/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Reward
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRewards.map((reward) => (
              <Card key={reward.id} className="hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-2">{reward.title}</h3>
                      {getStatusBadge(reward.status)}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{reward.description}</p>

                  {getRewardTypeDisplay(reward.reward_type, reward.discount_value, reward.currency) && (
                    <div className="mb-4 px-3 py-2 bg-blue-50 rounded-lg">
                      <p className="text-sm font-semibold text-blue-600">
                        {getRewardTypeDisplay(reward.reward_type, reward.discount_value, reward.currency)}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-600">Vouchers Issued</p>
                      <p className="text-2xl font-bold text-gray-900">{reward.voucher_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Redemptions</p>
                      <p className="text-2xl font-bold text-green-600">{reward.redemption_count}</p>
                    </div>
                  </div>

                  {reward.voucher_count > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Redemption Rate</span>
                        <span>{((reward.redemption_count / reward.voucher_count) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((reward.redemption_count / reward.voucher_count) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/brand/rewards/${reward.id}`)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/brand/rewards/${reward.id}/edit`)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
