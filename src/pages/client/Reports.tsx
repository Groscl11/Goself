import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Download,
  TrendingUp,
  Users,
  Gift,
  DollarSign,
  Calendar,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface ReportMetrics {
  totalMembers: number;
  activeMembers: number;
  totalMemberships: number;
  activeMemberships: number;
  totalVouchers: number;
  redeemedVouchers: number;
  totalRedemptions: number;
  redemptionRate: number;
  revenueGenerated: number;
}

interface TopReward {
  reward_title: string;
  brand_name: string;
  issued: number;
  redeemed: number;
  redemption_rate: number;
}

interface MemberActivity {
  member_name: string;
  email: string;
  memberships: number;
  vouchers: number;
  redemptions: number;
  last_active: string;
}

interface MonthlyData {
  month: string;
  members: number;
  vouchers: number;
  redemptions: number;
}

export function Reports() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string>('');
  const [metrics, setMetrics] = useState<ReportMetrics>({
    totalMembers: 0,
    activeMembers: 0,
    totalMemberships: 0,
    activeMemberships: 0,
    totalVouchers: 0,
    redeemedVouchers: 0,
    totalRedemptions: 0,
    redemptionRate: 0,
    revenueGenerated: 0,
  });
  const [topRewards, setTopRewards] = useState<TopReward[]>([]);
  const [memberActivity, setMemberActivity] = useState<MemberActivity[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [dateRange, setDateRange] = useState<string>('30');

  useEffect(() => {
    loadClientId();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadMetrics();
      loadTopRewards();
      loadMemberActivity();
      loadMonthlyData();
    }
  }, [clientId, dateRange]);

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

  const loadMetrics = async () => {
    try {
      setLoading(true);

      const { data: members, error: membersError } = await supabase
        .from('member_users')
        .select('id, is_active')
        .eq('client_id', clientId);

      if (membersError) throw membersError;

      const { data: memberships, error: membershipsError } = await supabase
        .from('member_memberships')
        .select('id, status, member_id')
        .in(
          'member_id',
          members?.map((m) => m.id) || []
        );

      if (membershipsError) throw membershipsError;

      const { data: allocations, error: allocationsError } = await supabase
        .from('member_rewards_allocation')
        .select('id, member_id')
        .in(
          'member_id',
          members?.map((m) => m.id) || []
        );

      if (allocationsError) throw allocationsError;

      const { data: vouchers, error: vouchersError } = await supabase
        .from('vouchers')
        .select('id, status')
        .in(
          'allocation_id',
          allocations?.map((a) => a.id) || []
        );

      if (vouchersError) throw vouchersError;

      const { data: redemptions, error: redemptionsError } = await supabase
        .from('redemptions')
        .select('id')
        .in(
          'member_id',
          members?.map((m) => m.id) || []
        );

      if (redemptionsError) throw redemptionsError;

      const totalMembers = members?.length || 0;
      const activeMembers = members?.filter((m) => m.is_active).length || 0;
      const totalMemberships = memberships?.length || 0;
      const activeMemberships =
        memberships?.filter((m) => m.status === 'active').length || 0;
      const totalVouchers = vouchers?.length || 0;
      const redeemedVouchers = vouchers?.filter((v) => v.status === 'redeemed').length || 0;
      const totalRedemptions = redemptions?.length || 0;
      const redemptionRate =
        totalVouchers > 0 ? (redeemedVouchers / totalVouchers) * 100 : 0;

      setMetrics({
        totalMembers,
        activeMembers,
        totalMemberships,
        activeMemberships,
        totalVouchers,
        redeemedVouchers,
        totalRedemptions,
        redemptionRate,
        revenueGenerated: totalRedemptions * 15,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTopRewards = async () => {
    try {
      const { data: members } = await supabase
        .from('member_users')
        .select('id')
        .eq('client_id', clientId);

      const memberIds = members?.map((m) => m.id) || [];

      const { data, error } = await supabase
        .from('voucher_issuances')
        .select(
          `
          id,
          reward_id,
          voucher_id,
          rewards (
            id,
            title,
            brands (
              name
            )
          ),
          vouchers (
            status
          )
        `
        )
        .in('member_id', memberIds)
        .limit(100);

      if (error) throw error;

      const rewardStats = new Map<string, any>();

      data?.forEach((issuance: any) => {
        const rewardId = issuance.reward_id;
        const rewardTitle = issuance.rewards?.title || 'Unknown';
        const brandName = issuance.rewards?.brands?.name || 'Unknown';
        const isRedeemed = issuance.vouchers?.status === 'redeemed';

        if (!rewardStats.has(rewardId)) {
          rewardStats.set(rewardId, {
            reward_title: rewardTitle,
            brand_name: brandName,
            issued: 0,
            redeemed: 0,
          });
        }

        const stats = rewardStats.get(rewardId);
        stats.issued += 1;
        if (isRedeemed) {
          stats.redeemed += 1;
        }
      });

      const topRewardsList = Array.from(rewardStats.values())
        .map((stats) => ({
          ...stats,
          redemption_rate: stats.issued > 0 ? (stats.redeemed / stats.issued) * 100 : 0,
        }))
        .sort((a, b) => b.issued - a.issued)
        .slice(0, 5);

      setTopRewards(topRewardsList);
    } catch (error) {
      console.error('Error loading top rewards:', error);
    }
  };

  const loadMemberActivity = async () => {
    try {
      const { data: members, error } = await supabase
        .from('member_users')
        .select(
          `
          id,
          full_name,
          email,
          updated_at
        `
        )
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const activityPromises =
        members?.map(async (member) => {
          const { data: memberships } = await supabase
            .from('member_memberships')
            .select('id')
            .eq('member_id', member.id);

          const { data: vouchers } = await supabase
            .from('vouchers')
            .select('id')
            .eq('member_id', member.id);

          const { data: redemptions } = await supabase
            .from('redemptions')
            .select('id')
            .eq('member_id', member.id);

          return {
            member_name: member.full_name,
            email: member.email,
            memberships: memberships?.length || 0,
            vouchers: vouchers?.length || 0,
            redemptions: redemptions?.length || 0,
            last_active: member.updated_at,
          };
        }) || [];

      const activity = await Promise.all(activityPromises);
      setMemberActivity(activity);
    } catch (error) {
      console.error('Error loading member activity:', error);
    }
  };

  const loadMonthlyData = async () => {
    try {
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data: members } = await supabase
        .from('member_users')
        .select('id, created_at')
        .eq('client_id', clientId)
        .gte('created_at', startDate.toISOString());

      const { data: memberships } = await supabase
        .from('member_memberships')
        .select('id, created_at, member_id')
        .in(
          'member_id',
          members?.map((m) => m.id) || []
        )
        .gte('created_at', startDate.toISOString());

      const { data: allocations } = await supabase
        .from('member_rewards_allocation')
        .select('id, member_id')
        .in(
          'member_id',
          members?.map((m) => m.id) || []
        );

      const { data: vouchers } = await supabase
        .from('vouchers')
        .select('id, created_at, allocation_id')
        .in(
          'allocation_id',
          allocations?.map((a) => a.id) || []
        )
        .gte('created_at', startDate.toISOString());

      const { data: redemptions } = await supabase
        .from('redemptions')
        .select('id, redeemed_at, member_id')
        .in(
          'member_id',
          members?.map((m) => m.id) || []
        )
        .gte('redeemed_at', startDate.toISOString());

      const monthlyMap = new Map<string, MonthlyData>();

      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const key = date.toISOString().slice(0, 7);
        monthlyMap.set(key, {
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          members: 0,
          vouchers: 0,
          redemptions: 0,
        });
      }

      members?.forEach((member) => {
        const key = member.created_at.slice(0, 7);
        const data = monthlyMap.get(key);
        if (data) data.members += 1;
      });

      vouchers?.forEach((voucher) => {
        const key = voucher.created_at.slice(0, 7);
        const data = monthlyMap.get(key);
        if (data) data.vouchers += 1;
      });

      redemptions?.forEach((redemption) => {
        const key = redemption.redeemed_at.slice(0, 7);
        const data = monthlyMap.get(key);
        if (data) data.redemptions += 1;
      });

      setMonthlyData(Array.from(monthlyMap.values()).reverse());
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };

  const exportToCSV = () => {
    const csvData = [
      ['Metric', 'Value'],
      ['Total Members', metrics.totalMembers],
      ['Active Members', metrics.activeMembers],
      ['Total Memberships', metrics.totalMemberships],
      ['Active Memberships', metrics.activeMemberships],
      ['Total Vouchers', metrics.totalVouchers],
      ['Redeemed Vouchers', metrics.redeemedVouchers],
      ['Total Redemptions', metrics.totalRedemptions],
      ['Redemption Rate', `${metrics.redemptionRate.toFixed(2)}%`],
      ['Revenue Generated', `$${metrics.revenueGenerated.toFixed(2)}`],
    ];

    const csv = csvData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Reports & Analytics">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-2">
              Comprehensive insights into your membership program performance
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
            <Button onClick={exportToCSV} variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Members</p>
                  <p className="text-3xl font-bold text-gray-900">{metrics.totalMembers}</p>
                  <p className="text-sm text-green-600 mt-1">
                    {metrics.activeMembers} active
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Memberships</p>
                  <p className="text-3xl font-bold text-gray-900">{metrics.activeMemberships}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    of {metrics.totalMemberships} total
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Vouchers Issued</p>
                  <p className="text-3xl font-bold text-gray-900">{metrics.totalVouchers}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {metrics.redeemedVouchers} redeemed
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Redemption Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {metrics.redemptionRate.toFixed(1)}%
                  </p>
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {metrics.totalRedemptions} total
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              {topRewards.length === 0 ? (
                <p className="text-center text-gray-600 py-8">No reward data available</p>
              ) : (
                <div className="space-y-4">
                  {topRewards.map((reward, index) => (
                    <div key={index} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{reward.reward_title}</p>
                          <p className="text-sm text-gray-500">{reward.brand_name}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            reward.redemption_rate >= 70
                              ? 'bg-green-50 text-green-700'
                              : reward.redemption_rate >= 40
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {reward.redemption_rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Issued:</span>
                          <span className="font-semibold text-gray-900 ml-2">
                            {reward.issued}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Redeemed:</span>
                          <span className="font-semibold text-gray-900 ml-2">
                            {reward.redeemed}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="text-center text-gray-600 py-8">No trend data available</p>
              ) : (
                <div className="space-y-4">
                  {monthlyData.map((month, index) => (
                    <div key={index} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                      <p className="font-medium text-gray-900 mb-2">{month.month}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 block">Members</span>
                          <span className="font-semibold text-blue-600">{month.members}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Vouchers</span>
                          <span className="font-semibold text-purple-600">{month.vouchers}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Redemptions</span>
                          <span className="font-semibold text-green-600">
                            {month.redemptions}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Member Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {memberActivity.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No member activity data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Member</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">
                        Memberships
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">
                        Vouchers
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">
                        Redemptions
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Last Active
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberActivity.map((member, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{member.member_name}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{member.email}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {member.memberships}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                            {member.vouchers}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            {member.redemptions}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {new Date(member.last_active).toLocaleDateString()}
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
    </DashboardLayout>
  );
}
