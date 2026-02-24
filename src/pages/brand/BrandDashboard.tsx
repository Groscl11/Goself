import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Gift, TrendingUp, Users, CheckCircle, Award, DollarSign, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { brandMenuItems } from './brandMenuItems';

interface BrandStats {
  totalRewards: number;
  activeRewards: number;
  totalVouchersIssued: number;
  totalRedemptions: number;
  revenueGenerated: number;
  uniqueClients: number;
  uniqueMembers: number;
  pendingApprovals: number;
}

interface RecentRedemption {
  id: string;
  redeemed_at: string;
  rewards: {
    title: string;
  };
  member_users: {
    full_name: string;
    clients: {
      name: string;
    };
  };
}

export function BrandDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<BrandStats>({
    totalRewards: 0,
    activeRewards: 0,
    totalVouchersIssued: 0,
    totalRedemptions: 0,
    revenueGenerated: 0,
    uniqueClients: 0,
    uniqueMembers: 0,
    pendingApprovals: 0,
  });
  const [recentRedemptions, setRecentRedemptions] = useState<RecentRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.brand_id) {
      loadDashboardData();
    }
  }, [profile]);

  const loadDashboardData = async () => {
    if (!profile?.brand_id) return;

    try {
      const [rewardsData, vouchersData, redemptionsData, clientsData, membersData, pendingData, recentData] = await Promise.all([
        supabase.from('rewards').select('id, status').eq('brand_id', profile.brand_id),
        supabase.from('vouchers').select('id').eq('reward_id', profile.brand_id).in('rewards.brand_id', [profile.brand_id]),
        supabase.from('redemptions').select('id').eq('reward_id', profile.brand_id).in('rewards.brand_id', [profile.brand_id]),
        supabase.from('vouchers').select('member_users(client_id)').eq('reward_id', profile.brand_id).in('rewards.brand_id', [profile.brand_id]),
        supabase.from('vouchers').select('member_id').eq('reward_id', profile.brand_id).in('rewards.brand_id', [profile.brand_id]),
        supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('brand_id', profile.brand_id).eq('status', 'pending'),
        supabase
          .from('redemptions')
          .select('id, redeemed_at, rewards!inner(title, brand_id), member_users!inner(full_name, clients!inner(name))')
          .eq('rewards.brand_id', profile.brand_id)
          .order('redeemed_at', { ascending: false })
          .limit(5)
      ]);

      const totalRewards = rewardsData.data?.length || 0;
      const activeRewards = rewardsData.data?.filter(r => r.status === 'active').length || 0;

      const vouchersIssued = await supabase
        .from('vouchers')
        .select('id', { count: 'exact', head: true })
        .in('reward_id', (rewardsData.data || []).map(r => r.id));

      const redemptions = await supabase
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .in('reward_id', (rewardsData.data || []).map(r => r.id));

      const clientsQuery = await supabase
        .from('vouchers')
        .select('member_users!inner(client_id)')
        .in('reward_id', (rewardsData.data || []).map(r => r.id));

      const uniqueClients = new Set(clientsQuery.data?.map((v: any) => v.member_users.client_id)).size;

      const membersQuery = await supabase
        .from('vouchers')
        .select('member_id')
        .in('reward_id', (rewardsData.data || []).map(r => r.id));

      const uniqueMembers = new Set(membersQuery.data?.map(v => v.member_id)).size;

      setStats({
        totalRewards,
        activeRewards,
        totalVouchersIssued: vouchersIssued.count || 0,
        totalRedemptions: redemptions.count || 0,
        revenueGenerated: (redemptions.count || 0) * 15,
        uniqueClients,
        uniqueMembers,
        pendingApprovals: pendingData.count || 0,
      });

      setRecentRedemptions(recentData.data || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Rewards',
      value: stats.totalRewards,
      icon: <Gift className="w-6 h-6 text-blue-600" />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Active Rewards',
      value: stats.activeRewards,
      icon: <CheckCircle className="w-6 h-6 text-green-600" />,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'Vouchers Issued',
      value: stats.totalVouchersIssued,
      icon: <TrendingUp className="w-6 h-6 text-purple-600" />,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: 'Total Redemptions',
      value: stats.totalRedemptions,
      icon: <Users className="w-6 h-6 text-orange-600" />,
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
    {
      title: 'Revenue Generated',
      value: `$${stats.revenueGenerated.toLocaleString()}`,
      icon: <DollarSign className="w-6 h-6 text-emerald-600" />,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      subtitle: 'Estimated value',
    },
    {
      title: 'Unique Clients',
      value: stats.uniqueClients,
      icon: <Award className="w-6 h-6 text-pink-600" />,
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600',
    },
    {
      title: 'Unique Members',
      value: stats.uniqueMembers,
      icon: <Users className="w-6 h-6 text-cyan-600" />,
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-600',
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: <BarChart3 className="w-6 h-6 text-yellow-600" />,
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
  ];

  return (
    <DashboardLayout menuItems={brandMenuItems} title="Brand Dashboard">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Brand Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your rewards and track performance</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {statCards.map((stat) => (
                <Card key={stat.title}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                        {stat.icon}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    {stat.subtitle && (
                      <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => navigate('/brand/rewards/new')}
                      className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <p className="font-medium text-gray-900">Submit New Reward</p>
                      <p className="text-sm text-gray-600 mt-1">Add a new reward to the marketplace</p>
                    </button>
                    <button
                      onClick={() => navigate('/brand/analytics')}
                      className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <p className="font-medium text-gray-900">View Analytics</p>
                      <p className="text-sm text-gray-600 mt-1">Detailed performance metrics and insights</p>
                    </button>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Redemptions</h2>
                  {recentRedemptions.length === 0 ? (
                    <p className="text-gray-500 text-sm py-8 text-center">No recent redemptions</p>
                  ) : (
                    <div className="space-y-3">
                      {recentRedemptions.map((redemption) => (
                        <div key={redemption.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {redemption.rewards.title}
                            </p>
                            <p className="text-xs text-gray-600">
                              {redemption.member_users.full_name} • {redemption.member_users.clients.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(redemption.redeemed_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
