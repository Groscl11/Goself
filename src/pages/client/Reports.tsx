import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Download,
  TrendingUp,
  Users,
  Gift,
  BarChart3,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface Metrics {
  totalMembers: number;
  totalClaimed: number;
  totalRedeemed: number;
  redemptionRate: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
}

interface OfferStat {
  reward_id: string;
  title: string;
  offer_type: string;
  claimed: number;
  redeemed: number;
  redemption_rate: number;
}

interface CampaignStat {
  campaign_id: string;
  name: string;
  trigger_type: string;
  total_triggers: number;
  successful: number;
  failed: number;
  success_rate: number;
}

interface MonthlyData {
  month: string;
  members: number;
  claimed: number;
  redeemed: number;
}

interface MemberStat {
  id: string;
  full_name: string;
  email: string;
  claimed: number;
  redeemed: number;
  points_balance: number;
  joined: string;
}

interface PartnerBrandStat {
  owner_client_id: string;
  brand_name: string;
  offers: Array<{ reward_id: string; title: string; claimed: number; redeemed: number }>;
  total_claimed: number;
  total_redeemed: number;
  redemption_rate: number;
}

export function Reports() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [metrics, setMetrics] = useState<Metrics>({
    totalMembers: 0,
    totalClaimed: 0,
    totalRedeemed: 0,
    redemptionRate: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
  });
  const [offerStats, setOfferStats] = useState<OfferStat[]>([]);
  const [campaignStats, setCampaignStats] = useState<CampaignStat[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStat[]>([]);
  const [partnerBrandStats, setPartnerBrandStats] = useState<PartnerBrandStat[]>([]);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => { loadClientId(); }, []);

  useEffect(() => { if (clientId) loadAllData(); }, [clientId, dateRange]);

  const loadClientId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single();
    if (profile?.client_id) setClientId(profile.client_id);
  };

  const getStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(dateRange));
    return d.toISOString();
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const { data: members } = await supabase
        .from('member_users')
        .select('id, full_name, email, created_at')
        .eq('client_id', clientId);
      const allMembers = members ?? [];
      const memberIds = allMembers.map((m: any) => m.id);

      await Promise.all([
        loadMetrics(memberIds, allMembers),
        loadOfferStats(),
        loadCampaignStats(),
        loadMonthlyData(),
        loadMemberStats(allMembers, memberIds),
        loadPartnerBrandStats(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (memberIds: string[], allMembers: any[]) => {
    const startDate = getStartDate();

    const [{ data: codes }, txnResult] = await Promise.all([
      supabase.from('offer_codes').select('status').eq('distributed_by_client_id', clientId).gte('assigned_at', startDate),
      memberIds.length > 0
        ? supabase.from('loyalty_points_transactions').select('transaction_type, points_amount').in('member_user_id', memberIds).gte('created_at', startDate)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const totalClaimed = codes?.length ?? 0;
    const totalRedeemed = codes?.filter((c: any) => c.status === 'redeemed').length ?? 0;

    let totalPointsIssued = 0, totalPointsRedeemed = 0;
    for (const t of (txnResult as any).data ?? []) {
      if (t.transaction_type === 'earned') totalPointsIssued += t.points_amount;
      if (t.transaction_type === 'redeemed') totalPointsRedeemed += Math.abs(t.points_amount);
    }

    setMetrics({
      totalMembers: allMembers.length,
      totalClaimed,
      totalRedeemed,
      redemptionRate: totalClaimed > 0 ? (totalRedeemed / totalClaimed) * 100 : 0,
      totalPointsIssued,
      totalPointsRedeemed,
    });
  };

  const loadOfferStats = async () => {
    const startDate = getStartDate();
    const { data: codes } = await supabase
      .from('offer_codes')
      .select('offer_id, status')
      .eq('distributed_by_client_id', clientId)
      .gte('assigned_at', startDate);

    if (!codes?.length) { setOfferStats([]); return; }

    const offerMap = new Map<string, { claimed: number; redeemed: number }>();
    for (const c of codes) {
      const entry = offerMap.get(c.offer_id) ?? { claimed: 0, redeemed: 0 };
      entry.claimed += 1;
      if (c.status === 'redeemed') entry.redeemed += 1;
      offerMap.set(c.offer_id, entry);
    }

    const { data: rewards } = await supabase.from('rewards').select('id, title, offer_type').in('id', Array.from(offerMap.keys()));

    setOfferStats(
      Array.from(offerMap.entries())
        .map(([id, counts]) => {
          const r = rewards?.find((r: any) => r.id === id);
          return {
            reward_id: id,
            title: r?.title ?? 'Unknown Offer',
            offer_type: r?.offer_type ?? '-',
            claimed: counts.claimed,
            redeemed: counts.redeemed,
            redemption_rate: counts.claimed > 0 ? (counts.redeemed / counts.claimed) * 100 : 0,
          };
        })
        .sort((a, b) => b.claimed - a.claimed)
    );
  };

  const loadCampaignStats = async () => {
    const startDate = getStartDate();
    const { data: logs } = await supabase
      .from('campaign_trigger_logs')
      .select('campaign_rule_id, trigger_result')
      .eq('client_id', clientId)
      .gte('created_at', startDate);

    if (!logs?.length) { setCampaignStats([]); return; }

    const ruleIds = [...new Set(logs.map((l: any) => l.campaign_rule_id).filter(Boolean))];
    const { data: rules } = await supabase.from('campaign_rules').select('id, name, trigger_type').in('id', ruleIds);
    const ruleMap = new Map((rules ?? []).map((r: any) => [r.id, r]));

    const statsMap = new Map<string, CampaignStat>();
    for (const log of logs) {
      if (!log.campaign_rule_id) continue;
      if (!statsMap.has(log.campaign_rule_id)) {
        const rule = ruleMap.get(log.campaign_rule_id) as any;
        statsMap.set(log.campaign_rule_id, {
          campaign_id: log.campaign_rule_id,
          name: rule?.name ?? 'Unknown Campaign',
          trigger_type: rule?.trigger_type ?? '-',
          total_triggers: 0, successful: 0, failed: 0, success_rate: 0,
        });
      }
      const s = statsMap.get(log.campaign_rule_id)!;
      s.total_triggers += 1;
      if (log.trigger_result === 'success') s.successful += 1;
      else if (log.trigger_result === 'failed') s.failed += 1;
    }

    setCampaignStats(
      Array.from(statsMap.values())
        .map(s => ({ ...s, success_rate: s.total_triggers > 0 ? (s.successful / s.total_triggers) * 100 : 0 }))
        .sort((a, b) => b.total_triggers - a.total_triggers)
    );
  };

  const loadMonthlyData = async () => {
    const monthMap = new Map<string, MonthlyData>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      monthMap.set(key, { month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), members: 0, claimed: 0, redeemed: 0 });
    }
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [{ data: members }, { data: codes }] = await Promise.all([
      supabase.from('member_users').select('created_at').eq('client_id', clientId).gte('created_at', sixMonthsAgo.toISOString()),
      supabase.from('offer_codes').select('assigned_at, status').eq('distributed_by_client_id', clientId).gte('assigned_at', sixMonthsAgo.toISOString()),
    ]);

    for (const m of members ?? []) {
      const key = m.created_at?.slice(0, 7);
      if (key && monthMap.has(key)) monthMap.get(key)!.members += 1;
    }
    for (const c of codes ?? []) {
      const key = c.assigned_at?.slice(0, 7);
      if (key && monthMap.has(key)) {
        monthMap.get(key)!.claimed += 1;
        if (c.status === 'redeemed') monthMap.get(key)!.redeemed += 1;
      }
    }

    setMonthlyData(Array.from(monthMap.values()));
  };

  const loadMemberStats = async (allMembers: any[], memberIds: string[]) => {
    if (!allMembers.length) { setMemberStats([]); return; }
    const top10 = [...allMembers]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
    const top10Ids = top10.map((m: any) => m.id);

    const [{ data: codes }, { data: statuses }] = await Promise.all([
      supabase.from('offer_codes').select('assigned_to_member_id, status').in('assigned_to_member_id', top10Ids),
      supabase.from('member_loyalty_status').select('member_user_id, points_balance').in('member_user_id', top10Ids),
    ]);

    const codesByMember = new Map<string, { claimed: number; redeemed: number }>();
    for (const c of codes ?? []) {
      const e = codesByMember.get(c.assigned_to_member_id) ?? { claimed: 0, redeemed: 0 };
      e.claimed += 1;
      if (c.status === 'redeemed') e.redeemed += 1;
      codesByMember.set(c.assigned_to_member_id, e);
    }
    const balanceMap = new Map((statuses ?? []).map((s: any) => [s.member_user_id, s.points_balance]));

    setMemberStats(top10.map((m: any) => ({
      id: m.id,
      full_name: m.full_name || m.email || 'Unknown',
      email: m.email || '',
      claimed: codesByMember.get(m.id)?.claimed ?? 0,
      redeemed: codesByMember.get(m.id)?.redeemed ?? 0,
      points_balance: balanceMap.get(m.id) ?? 0,
      joined: m.created_at,
    })));
  };

  const loadPartnerBrandStats = async () => {
    const startDate = getStartDate();
    // Get all codes distributed BY this client
    const { data: codes } = await supabase
      .from('offer_codes')
      .select('offer_id, status')
      .eq('distributed_by_client_id', clientId)
      .gte('assigned_at', startDate);

    if (!codes?.length) { setPartnerBrandStats([]); return; }

    const offerIds = [...new Set(codes.map((c: any) => c.offer_id))];
    // Get rewards and their owner_client_id (the partner brand)
    const { data: rewards } = await supabase
      .from('rewards')
      .select('id, title, owner_client_id')
      .in('id', offerIds)
      .neq('owner_client_id', clientId);  // only cross-brand

    if (!rewards?.length) { setPartnerBrandStats([]); return; }

    // Get client names for all partner brands
    const partnerClientIds = [...new Set(rewards.map((r: any) => r.owner_client_id).filter(Boolean))];
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', partnerClientIds);
    const clientNameMap = new Map((clients ?? []).map((c: any) => [c.id, c.name]));

    // Build per-offer tallies
    const codesByOffer = new Map<string, { claimed: number; redeemed: number }>();
    for (const c of codes) {
      const e = codesByOffer.get(c.offer_id) ?? { claimed: 0, redeemed: 0 };
      e.claimed += 1;
      if (c.status === 'redeemed') e.redeemed += 1;
      codesByOffer.set(c.offer_id, e);
    }

    // Group offers by partner brand
    const brandMap = new Map<string, PartnerBrandStat>();
    for (const r of rewards) {
      const ownerId = r.owner_client_id;
      if (!ownerId) continue;
      if (!brandMap.has(ownerId)) {
        brandMap.set(ownerId, {
          owner_client_id: ownerId,
          brand_name: clientNameMap.get(ownerId) ?? 'Unknown Brand',
          offers: [],
          total_claimed: 0,
          total_redeemed: 0,
          redemption_rate: 0,
        });
      }
      const stat = brandMap.get(ownerId)!;
      const counts = codesByOffer.get(r.id) ?? { claimed: 0, redeemed: 0 };
      stat.offers.push({ reward_id: r.id, title: r.title, claimed: counts.claimed, redeemed: counts.redeemed });
      stat.total_claimed += counts.claimed;
      stat.total_redeemed += counts.redeemed;
    }

    setPartnerBrandStats(
      Array.from(brandMap.values())
        .map(s => ({ ...s, redemption_rate: s.total_claimed > 0 ? (s.total_redeemed / s.total_claimed) * 100 : 0 }))
        .sort((a, b) => b.total_claimed - a.total_claimed)
    );
  };

  const exportToCSV = () => {
    const rows: string[][] = [
      ['=== SUMMARY METRICS ==='],
      ['Total Members', String(metrics.totalMembers)],
      ['Vouchers Claimed', String(metrics.totalClaimed)],
      ['Vouchers Redeemed', String(metrics.totalRedeemed)],
      ['Redemption Rate', `${metrics.redemptionRate.toFixed(1)}%`],
      ['Points Issued', String(metrics.totalPointsIssued)],
      ['Points Spent on Vouchers', String(metrics.totalPointsRedeemed)],
      [],
      ['=== OFFER PERFORMANCE ==='],
      ['Offer', 'Type', 'Claimed', 'Redeemed', 'Rate'],
      ...offerStats.map(o => [o.title, o.offer_type, String(o.claimed), String(o.redeemed), `${o.redemption_rate.toFixed(1)}%`]),
      [],
      ['=== CAMPAIGN PERFORMANCE ==='],
      ['Campaign', 'Trigger Type', 'Total Triggers', 'Successful', 'Failed', 'Success Rate'],
      ...campaignStats.map(c => [c.name, c.trigger_type, String(c.total_triggers), String(c.successful), String(c.failed), `${c.success_rate.toFixed(1)}%`]),
      [],
      ['=== PARTNER BRAND DISTRIBUTION ==='],
      ['Partner Brand', 'Offer', 'Distributed to Your Members', 'Redeemed at Partner', 'Rate'],
      ...partnerBrandStats.flatMap(b => b.offers.map(o => [b.brand_name, o.title, String(o.claimed), String(o.redeemed), `${b.redemption_rate.toFixed(1)}%`])),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Reports & Analytics">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-2">Voucher distribution and redemption insights</p>
          </div>
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Members</p>
                  <p className="text-3xl font-bold text-gray-900">{loading ? '—' : metrics.totalMembers}</p>
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
                  <p className="text-sm text-gray-600 mb-1">Vouchers Claimed</p>
                  <p className="text-3xl font-bold text-gray-900">{loading ? '—' : metrics.totalClaimed}</p>
                  <p className="text-xs text-gray-400 mt-1">Codes distributed to members</p>
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
                  <p className="text-sm text-gray-600 mb-1">Vouchers Redeemed</p>
                  <p className="text-3xl font-bold text-gray-900">{loading ? '—' : metrics.totalRedeemed}</p>
                  <p className="text-xs text-gray-400 mt-1">Used at store</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
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
                    {loading ? '—' : `${metrics.redemptionRate.toFixed(1)}%`}
                  </p>
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    of claimed codes
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Points Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Points Issued</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {loading ? '—' : metrics.totalPointsIssued.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Earned by members in period</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Points Spent on Vouchers</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {loading ? '—' : metrics.totalPointsRedeemed.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Redeemed via widget</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Offer Performance & Campaign Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Offer Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
              ) : offerStats.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No vouchers distributed in this period</p>
              ) : (
                <div className="space-y-4">
                  {offerStats.slice(0, 6).map((offer) => (
                    <div key={offer.reward_id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{offer.title}</p>
                          <p className="text-xs text-gray-400 capitalize mt-0.5">{offer.offer_type?.replace(/_/g, ' ')}</p>
                        </div>
                        <span className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          offer.redemption_rate >= 50
                            ? 'bg-green-50 text-green-700'
                            : offer.redemption_rate >= 20
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-gray-50 text-gray-600'
                        }`}>
                          {offer.redemption_rate.toFixed(0)}% redeemed
                        </span>
                      </div>
                      <div className="flex gap-6 text-sm mb-2">
                        <span className="text-gray-500">Claimed: <strong className="text-gray-900">{offer.claimed}</strong></span>
                        <span className="text-gray-500">Redeemed: <strong className="text-green-700">{offer.redeemed}</strong></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.min(offer.redemption_rate, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
              ) : campaignStats.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No campaign events in this period</p>
              ) : (
                <div className="space-y-4">
                  {campaignStats.slice(0, 6).map((c) => (
                    <div key={c.campaign_id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-400 capitalize mt-0.5">{c.trigger_type?.replace(/_/g, ' ')}</p>
                        </div>
                        <span className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.success_rate >= 70
                            ? 'bg-green-50 text-green-700'
                            : c.success_rate >= 40
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {c.success_rate.toFixed(0)}% success
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Triggered</p>
                          <p className="font-semibold text-gray-900">{c.total_triggers}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Succeeded</p>
                          <p className="font-semibold text-green-700">{c.successful}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Failed/Skipped</p>
                          <p className="font-semibold text-red-500">{c.failed}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trends & Recent Members */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends (6 months)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
              ) : (
                <div className="space-y-3">
                  {monthlyData.map((m, i) => (
                    <div key={i} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                      <p className="font-medium text-gray-700 mb-2">{m.month}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">New Members</p>
                          <p className="font-semibold text-blue-600">{m.members}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Claimed</p>
                          <p className="font-semibold text-purple-600">{m.claimed}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Redeemed</p>
                          <p className="font-semibold text-green-600">{m.redeemed}</p>
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
              <CardTitle>Recent Members</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
              ) : memberStats.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No members yet</p>
              ) : (
                <div className="space-y-3">
                  {memberStats.map((m) => (
                    <div key={m.id} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">{m.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>
                        <div className="ml-4 text-right text-sm shrink-0">
                          <p className="text-gray-600">{m.points_balance.toLocaleString()} pts</p>
                          <p className="text-xs text-gray-400">{m.claimed} claimed · {m.redeemed} redeemed</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Partner Brand Cross-Distribution */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Partner Brand Distribution</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Rewards from other brands that you distributed to your members — and how many your members redeemed at their store.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
              ) : partnerBrandStats.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No cross-brand rewards distributed in this period
                </p>
              ) : (
                <div className="space-y-6">
                  {partnerBrandStats.map((brand) => (
                    <div key={brand.owner_client_id} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Brand header */}
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                            {brand.brand_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{brand.brand_name}</p>
                            <p className="text-xs text-gray-500">{brand.offers.length} offer{brand.offers.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Distributed</p>
                            <p className="font-bold text-gray-900">{brand.total_claimed}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Redeemed</p>
                            <p className="font-bold text-green-700">{brand.total_redeemed}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            brand.redemption_rate >= 50
                              ? 'bg-green-100 text-green-800'
                              : brand.redemption_rate >= 20
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {brand.redemption_rate.toFixed(0)}% redeemed
                          </span>
                        </div>
                      </div>
                      {/* Per-offer breakdown */}
                      <div className="divide-y divide-gray-100">
                        {brand.offers.map((offer) => (
                          <div key={offer.reward_id} className="px-4 py-3 flex items-center justify-between">
                            <p className="text-sm text-gray-700 flex-1 min-w-0 truncate pr-4">{offer.title}</p>
                            <div className="flex items-center gap-4 text-sm shrink-0">
                              <span className="text-gray-500">
                                Dist: <strong className="text-gray-900">{offer.claimed}</strong>
                              </span>
                              <span className="text-gray-500">
                                Redeem: <strong className="text-green-700">{offer.redeemed}</strong>
                              </span>
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full"
                                  style={{ width: `${offer.claimed > 0 ? Math.min((offer.redeemed / offer.claimed) * 100, 100) : 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
