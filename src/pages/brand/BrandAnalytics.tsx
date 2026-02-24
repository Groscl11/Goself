import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { LayoutDashboard, Gift, CheckCircle, BarChart3, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { brandMenuItems } from './brandMenuItems';

interface DailyMetric {
  date: string;
  issued: number;
  redeemed: number;
  revenue: number;
}

interface ClientDistribution {
  client_name: string;
  total_vouchers: number;
  total_redemptions: number;
  revenue_generated: number;
  unique_members: number;
}

interface RewardPerformance {
  reward_title: string;
  total_issued: number;
  total_redeemed: number;
  redemption_rate: number;
  revenue: number;
}

export function BrandAnalytics() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [clientDistribution, setClientDistribution] = useState<ClientDistribution[]>([]);
  const [rewardPerformance, setRewardPerformance] = useState<RewardPerformance[]>([]);
  const [dateRange, setDateRange] = useState(30);

  const [summary, setSummary] = useState({
    totalIssued: 0,
    totalRedeemed: 0,
    totalRevenue: 0,
    redemptionRate: 0,
    avgDailyIssued: 0,
    avgDailyRedeemed: 0,
  });

  useEffect(() => {
    if (profile?.brand_id) {
      loadAnalytics();
    }
  }, [profile, dateRange]);

  const loadAnalytics = async () => {
    if (!profile?.brand_id) return;

    setLoading(true);
    try {
      const rewardsData = await supabase
        .from('rewards')
        .select('id, title')
        .eq('brand_id', profile.brand_id);

      const rewardIds = (rewardsData.data || []).map(r => r.id);

      if (rewardIds.length === 0) {
        setLoading(false);
        return;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const [vouchersData, redemptionsData] = await Promise.all([
        supabase
          .from('vouchers')
          .select('id, issued_at, member_users!inner(client_id, clients!inner(name)), member_id')
          .in('reward_id', rewardIds)
          .gte('issued_at', startDate.toISOString()),
        supabase
          .from('redemptions')
          .select('id, redeemed_at, member_users!inner(client_id, clients!inner(name)), reward_id')
          .in('reward_id', rewardIds)
          .gte('redeemed_at', startDate.toISOString())
      ]);

      await loadDailyMetrics(vouchersData.data || [], redemptionsData.data || []);
      await loadClientDistribution(rewardIds);
      await loadRewardPerformance(rewardIds, rewardsData.data || []);

      const totalIssued = vouchersData.data?.length || 0;
      const totalRedeemed = redemptionsData.data?.length || 0;
      const totalRevenue = totalRedeemed * 15;
      const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0;

      setSummary({
        totalIssued,
        totalRedeemed,
        totalRevenue,
        redemptionRate,
        avgDailyIssued: totalIssued / dateRange,
        avgDailyRedeemed: totalRedeemed / dateRange,
      });

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyMetrics = async (vouchers: any[], redemptions: any[]) => {
    const dailyMap = new Map<string, { issued: number; redeemed: number }>();

    for (let i = 0; i < dateRange; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { issued: 0, redeemed: 0 });
    }

    vouchers.forEach(v => {
      const dateStr = new Date(v.issued_at).toISOString().split('T')[0];
      if (dailyMap.has(dateStr)) {
        dailyMap.get(dateStr)!.issued++;
      }
    });

    redemptions.forEach(r => {
      const dateStr = new Date(r.redeemed_at).toISOString().split('T')[0];
      if (dailyMap.has(dateStr)) {
        dailyMap.get(dateStr)!.redeemed++;
      }
    });

    const metrics: DailyMetric[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        issued: data.issued,
        redeemed: data.redeemed,
        revenue: data.redeemed * 15,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setDailyMetrics(metrics);
  };

  const loadClientDistribution = async (rewardIds: string[]) => {
    const vouchersData = await supabase
      .from('vouchers')
      .select('id, member_users!inner(client_id, clients!inner(name)), member_id')
      .in('reward_id', rewardIds);

    const redemptionsData = await supabase
      .from('redemptions')
      .select('id, member_users!inner(client_id, clients!inner(name))')
      .in('reward_id', rewardIds);

    const clientMap = new Map<string, { name: string; vouchers: number; redemptions: number; members: Set<string> }>();

    (vouchersData.data || []).forEach((v: any) => {
      const clientId = v.member_users.client_id;
      const clientName = v.member_users.clients.name;

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, { name: clientName, vouchers: 0, redemptions: 0, members: new Set() });
      }

      clientMap.get(clientId)!.vouchers++;
      clientMap.get(clientId)!.members.add(v.member_id);
    });

    (redemptionsData.data || []).forEach((r: any) => {
      const clientId = r.member_users.client_id;
      if (clientMap.has(clientId)) {
        clientMap.get(clientId)!.redemptions++;
      }
    });

    const distribution: ClientDistribution[] = Array.from(clientMap.entries())
      .map(([clientId, data]) => ({
        client_name: data.name,
        total_vouchers: data.vouchers,
        total_redemptions: data.redemptions,
        revenue_generated: data.redemptions * 15,
        unique_members: data.members.size,
      }))
      .sort((a, b) => b.total_vouchers - a.total_vouchers);

    setClientDistribution(distribution);
  };

  const loadRewardPerformance = async (rewardIds: string[], rewards: any[]) => {
    const rewardMap = new Map(rewards.map(r => [r.id, r.title]));

    const vouchersData = await supabase
      .from('vouchers')
      .select('reward_id')
      .in('reward_id', rewardIds);

    const redemptionsData = await supabase
      .from('redemptions')
      .select('reward_id')
      .in('reward_id', rewardIds);

    const perfMap = new Map<string, { issued: number; redeemed: number }>();

    rewardIds.forEach(id => {
      perfMap.set(id, { issued: 0, redeemed: 0 });
    });

    (vouchersData.data || []).forEach(v => {
      perfMap.get(v.reward_id)!.issued++;
    });

    (redemptionsData.data || []).forEach(r => {
      perfMap.get(r.reward_id)!.redeemed++;
    });

    const performance: RewardPerformance[] = Array.from(perfMap.entries())
      .map(([rewardId, data]) => ({
        reward_title: rewardMap.get(rewardId) || 'Unknown',
        total_issued: data.issued,
        total_redeemed: data.redeemed,
        redemption_rate: data.issued > 0 ? (data.redeemed / data.issued) * 100 : 0,
        revenue: data.redeemed * 15,
      }))
      .sort((a, b) => b.total_issued - a.total_issued);

    setRewardPerformance(performance);
  };

  return (
    <DashboardLayout menuItems={brandMenuItems} title="Brand Analytics">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Brand Analytics</h1>
            <p className="text-gray-600 mt-2">Detailed performance metrics and insights</p>
          </div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Issued</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.totalIssued}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Avg: {summary.avgDailyIssued.toFixed(1)}/day</p>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Redeemed</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.totalRedeemed}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Avg: {summary.avgDailyRedeemed.toFixed(1)}/day</p>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">${summary.totalRevenue.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Redemption Rate: {summary.redemptionRate.toFixed(1)}%</p>
                </div>
              </Card>
            </div>

            <Card className="mb-8">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Daily Metrics
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Issued</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Redeemed</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dailyMetrics.slice(-14).reverse().map((metric) => {
                        const rate = metric.issued > 0 ? (metric.redeemed / metric.issued) * 100 : 0;
                        return (
                          <tr key={metric.date} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(metric.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{metric.issued}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{metric.redeemed}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">${metric.revenue}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                rate >= 50 ? 'bg-green-100 text-green-800' :
                                rate >= 25 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {rate.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Client Distribution
                  </h2>
                  {clientDistribution.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No client data available</p>
                  ) : (
                    <div className="space-y-4">
                      {clientDistribution.map((client) => (
                        <div key={client.client_name} className="border-l-4 border-blue-500 pl-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-gray-900">{client.client_name}</p>
                            <p className="text-sm font-medium text-blue-600">${client.revenue_generated}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Vouchers</p>
                              <p className="font-medium text-gray-900">{client.total_vouchers}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Redeemed</p>
                              <p className="font-medium text-gray-900">{client.total_redemptions}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Members</p>
                              <p className="font-medium text-gray-900">{client.unique_members}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    Reward Performance
                  </h2>
                  {rewardPerformance.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No reward data available</p>
                  ) : (
                    <div className="space-y-4">
                      {rewardPerformance.slice(0, 5).map((reward) => (
                        <div key={reward.reward_title} className="border border-gray-200 rounded-lg p-4">
                          <p className="font-semibold text-gray-900 mb-3 truncate">{reward.reward_title}</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Issued</p>
                              <p className="font-medium text-gray-900">{reward.total_issued}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Redeemed</p>
                              <p className="font-medium text-gray-900">{reward.total_redeemed}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Rate</p>
                              <p className="font-medium text-gray-900">{reward.redemption_rate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Revenue</p>
                              <p className="font-medium text-emerald-600">${reward.revenue}</p>
                            </div>
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
