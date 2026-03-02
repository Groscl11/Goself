import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';
import { Search, Building2, Gift, Users, Coins, Download, Tag } from 'lucide-react';

interface Redemption {
  id: string;
  created_at: string;
  points_amount: number;
  balance_after: number;
  description: string;
  metadata: {
    reward_type: string;
    coupon_type: string;
    voucher_code: string;
  } | null;
  member_user_id: string;
  reference_id: string;
  // enriched
  member_email: string;
  member_name: string;
  reward_title: string;
  reward_external_id: string;
  brand_name: string;
  coupon_type: string;
  voucher_code: string;
}

export function BrandRedemptions() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [search, setSearch] = useState('');
  const [filterReward, setFilterReward] = useState('all');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();
      if (profile?.client_id) setClientId(profile.client_id);
    })();
  }, []);

  useEffect(() => {
    if (clientId) loadRedemptions();
  }, [clientId]);

  async function loadRedemptions() {
    setLoading(true);
    try {
      // Step 1: get reward IDs configured for this client
      const { data: configs } = await supabase
        .from('client_brand_reward_configs')
        .select('reward_id')
        .eq('client_id', clientId);

      const rewardIds = (configs ?? []).map((c: any) => c.reward_id).filter(Boolean);

      if (rewardIds.length === 0) {
        setRedemptions([]);
        setLoading(false);
        return;
      }

      // Step 2: get rewards info (title, brand)
      const { data: rewardsData } = await supabase
        .from('rewards')
        .select('id, title, reward_id, coupon_type, brands(name)')
        .in('id', rewardIds);

      const rewardMap: Record<string, any> = {};
      (rewardsData ?? []).forEach((r: any) => { rewardMap[r.id] = r; });

      // Step 3: get all brand-reward redemption transactions for these rewards
      const { data: txns } = await supabase
        .from('loyalty_points_transactions')
        .select('id, created_at, points_amount, balance_after, description, metadata, member_user_id, reference_id')
        .eq('transaction_type', 'redeemed')
        .in('reference_id', rewardIds)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!txns || txns.length === 0) {
        setRedemptions([]);
        setLoading(false);
        return;
      }

      // Step 4: get member info
      const memberIds = [...new Set((txns as any[]).map((t: any) => t.member_user_id).filter(Boolean))];
      const { data: membersData } = await supabase
        .from('member_users')
        .select('id, email, full_name')
        .in('id', memberIds);

      const memberMap: Record<string, any> = {};
      (membersData ?? []).forEach((m: any) => { memberMap[m.id] = m; });

      // Step 5: enrich transactions
      const enriched: Redemption[] = (txns as any[]).map((t: any) => {
        const reward = rewardMap[t.reference_id];
        const member = memberMap[t.member_user_id];
        const meta = t.metadata ?? {};
        return {
          ...t,
          member_email: member?.email ?? '—',
          member_name: member?.full_name ?? '—',
          reward_title: reward?.title ?? '—',
          reward_external_id: reward?.reward_id ?? '—',
          brand_name: reward?.brands?.name ?? '—',
          coupon_type: meta.coupon_type ?? reward?.coupon_type ?? '—',
          voucher_code: meta.voucher_code ?? '—',
        };
      });

      setRedemptions(enriched);
    } catch (err) {
      console.error('Error loading brand redemptions:', err);
    } finally {
      setLoading(false);
    }
  }

  const uniqueRewards = useMemo(() => {
    const seen = new Map<string, string>();
    redemptions.forEach(r => { if (r.reference_id && r.reward_title) seen.set(r.reference_id, r.reward_title); });
    return [...seen.entries()].map(([id, title]) => ({ id, title }));
  }, [redemptions]);

  const filtered = useMemo(() => {
    return redemptions.filter(r => {
      const matchSearch = !search ||
        r.member_email.toLowerCase().includes(search.toLowerCase()) ||
        r.member_name.toLowerCase().includes(search.toLowerCase()) ||
        r.reward_title.toLowerCase().includes(search.toLowerCase()) ||
        r.brand_name.toLowerCase().includes(search.toLowerCase()) ||
        r.voucher_code.toLowerCase().includes(search.toLowerCase());
      const matchReward = filterReward === 'all' || r.reference_id === filterReward;
      return matchSearch && matchReward;
    });
  }, [redemptions, search, filterReward]);

  const stats = useMemo(() => ({
    total: redemptions.length,
    uniqueMembers: new Set(redemptions.map(r => r.member_user_id)).size,
    totalPoints: Math.abs(redemptions.reduce((sum, r) => sum + (r.points_amount ?? 0), 0)),
    uniqueRewards: new Set(redemptions.map(r => r.reference_id)).size,
  }), [redemptions]);

  function exportCSV() {
    const headers = ['Date', 'Member Email', 'Member Name', 'Reward', 'Brand', 'Coupon Type', 'Voucher Code', 'Points Spent'];
    const rows = filtered.map(r => [
      new Date(r.created_at).toLocaleDateString('en-IN'),
      r.member_email,
      r.member_name,
      r.reward_title,
      r.brand_name,
      r.coupon_type,
      r.voucher_code,
      Math.abs(r.points_amount),
    ]);
    const csv = [headers, ...rows].map(row => row.map(String).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'brand_redemptions.csv'; a.click();
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Brand Redemptions">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Brand Reward Redemptions</h1>
            <p className="text-gray-500 text-sm mt-1">Track all brand/marketplace reward redemptions by your members</p>
          </div>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Redemptions', value: stats.total, icon: <Gift className="w-5 h-5 text-indigo-500" />, color: 'bg-indigo-50' },
            { label: 'Unique Members', value: stats.uniqueMembers, icon: <Users className="w-5 h-5 text-blue-500" />, color: 'bg-blue-50' },
            { label: 'Points Spent', value: stats.totalPoints.toLocaleString(), icon: <Coins className="w-5 h-5 text-amber-500" />, color: 'bg-amber-50' },
            { label: 'Rewards Redeemed', value: stats.uniqueRewards, icon: <Building2 className="w-5 h-5 text-green-500" />, color: 'bg-green-50' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`${s.color} p-2 rounded-lg`}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <CardTitle>Redemptions ({filtered.length})</CardTitle>
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search member, reward, code..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterReward}
                  onChange={e => setFilterReward(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Rewards</option>
                  {uniqueRewards.map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No brand reward redemptions yet</p>
                <p className="text-gray-400 text-sm mt-1">Redemptions will appear here once members redeem brand rewards</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-600">Member</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-600">Reward</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-600">Brand</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-600">Type</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-600">Voucher Code</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-600">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-3 whitespace-nowrap text-gray-500">
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-medium text-gray-900">{r.member_name !== '—' ? r.member_name : r.member_email}</p>
                          {r.member_name !== '—' && <p className="text-xs text-gray-400">{r.member_email}</p>}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-gray-900">{r.reward_title}</p>
                              <p className="text-xs text-gray-400 font-mono">{r.reward_external_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                            <Building2 className="w-3 h-3" /> {r.brand_name}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${r.coupon_type === 'generic' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                            {r.coupon_type === 'generic' ? 'Generic Code' : 'Unique Code'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-gray-700">{r.voucher_code}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-semibold text-red-600">−{Math.abs(r.points_amount).toLocaleString()}</span>
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
