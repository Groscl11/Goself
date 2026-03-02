import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { adminMenuItems } from './adminMenuItems';
import { Search, Building2, Gift, Users, Coins, Download, Tag, ArrowLeft, Store } from 'lucide-react';

interface Redemption {
  id: string;
  created_at: string;
  points_amount: number;
  balance_after: number;
  metadata: Record<string, any> | null;
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
  client_name: string;
  client_id: string;
}

export function AdminBrandRedemptions() {
  const navigate = useNavigate();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterReward, setFilterReward] = useState('all');

  useEffect(() => { loadRedemptions(); }, []);

  async function loadRedemptions() {
    setLoading(true);
    try {
      // Step 1: get ALL brand_voucher redemption transactions
      const { data: txns } = await supabase
        .from('loyalty_points_transactions')
        .select('id, created_at, points_amount, balance_after, metadata, member_user_id, reference_id')
        .eq('transaction_type', 'redeemed')
        .order('created_at', { ascending: false })
        .limit(1000);

      // Filter to only brand voucher transactions
      const brandTxns = (txns ?? []).filter((t: any) => t.metadata?.reward_type === 'brand_voucher');

      if (brandTxns.length === 0) {
        setRedemptions([]);
        setLoading(false);
        return;
      }

      const rewardIds = [...new Set(brandTxns.map((t: any) => t.reference_id).filter(Boolean))];
      const memberIds = [...new Set(brandTxns.map((t: any) => t.member_user_id).filter(Boolean))];

      // Step 2: fetch rewards + brands
      const { data: rewardsData } = await supabase
        .from('rewards')
        .select('id, title, reward_id, coupon_type, brand_id, brands(name)')
        .in('id', rewardIds);

      const rewardMap: Record<string, any> = {};
      (rewardsData ?? []).forEach((r: any) => { rewardMap[r.id] = r; });

      // Step 3: fetch client_brand_reward_configs to map reward → client
      const { data: configs } = await supabase
        .from('client_brand_reward_configs')
        .select('reward_id, client_id')
        .in('reward_id', rewardIds);

      // reward_id → client_id (first match per reward)
      const rewardToClient: Record<string, string> = {};
      (configs ?? []).forEach((c: any) => {
        if (!rewardToClient[c.reward_id]) rewardToClient[c.reward_id] = c.client_id;
      });

      // Step 4: fetch clients
      const clientIds = [...new Set(Object.values(rewardToClient))].filter(Boolean);
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, business_name, name')
        .in('id', clientIds);

      const clientMap: Record<string, any> = {};
      (clientsData ?? []).forEach((c: any) => { clientMap[c.id] = c; });

      // Step 5: fetch members
      const { data: membersData } = await supabase
        .from('member_users')
        .select('id, email, full_name')
        .in('id', memberIds);

      const memberMap: Record<string, any> = {};
      (membersData ?? []).forEach((m: any) => { memberMap[m.id] = m; });

      // Step 6: enrich
      const enriched: Redemption[] = (brandTxns as any[]).map((t: any) => {
        const reward = rewardMap[t.reference_id];
        const member = memberMap[t.member_user_id];
        const clientId = rewardToClient[t.reference_id] ?? '';
        const client = clientMap[clientId];
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
          client_id: clientId,
          client_name: client?.business_name ?? client?.name ?? clientId ?? '—',
        };
      });

      setRedemptions(enriched);
    } catch (err) {
      console.error('Error loading brand redemptions:', err);
    } finally {
      setLoading(false);
    }
  }

  const uniqueClients = useMemo(() => {
    const seen = new Map<string, string>();
    redemptions.forEach(r => { if (r.client_id && r.client_name !== '—') seen.set(r.client_id, r.client_name); });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [redemptions]);

  const uniqueRewards = useMemo(() => {
    const seen = new Map<string, string>();
    redemptions.forEach(r => { if (r.reference_id && r.reward_title) seen.set(r.reference_id, r.reward_title); });
    return [...seen.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [redemptions]);

  const filtered = useMemo(() => {
    return redemptions.filter(r => {
      const matchSearch = !search ||
        r.member_email.toLowerCase().includes(search.toLowerCase()) ||
        r.member_name.toLowerCase().includes(search.toLowerCase()) ||
        r.reward_title.toLowerCase().includes(search.toLowerCase()) ||
        r.brand_name.toLowerCase().includes(search.toLowerCase()) ||
        r.client_name.toLowerCase().includes(search.toLowerCase()) ||
        r.voucher_code.toLowerCase().includes(search.toLowerCase());
      const matchClient = filterClient === 'all' || r.client_id === filterClient;
      const matchReward = filterReward === 'all' || r.reference_id === filterReward;
      return matchSearch && matchClient && matchReward;
    });
  }, [redemptions, search, filterClient, filterReward]);

  const stats = useMemo(() => {
    const totalPoints = Math.abs(filtered.reduce((sum, r) => sum + (r.points_amount ?? 0), 0));
    return {
      total: filtered.length,
      uniqueMembers: new Set(filtered.map(r => r.member_user_id)).size,
      totalPoints,
      uniqueClients: new Set(filtered.map(r => r.client_id)).size,
    };
  }, [filtered]);

  // Per-client summary
  const clientSummary = useMemo(() => {
    const map = new Map<string, { name: string; count: number; points: number; members: Set<string> }>();
    filtered.forEach(r => {
      const entry = map.get(r.client_id) ?? { name: r.client_name, count: 0, points: 0, members: new Set() };
      entry.count += 1;
      entry.points += Math.abs(r.points_amount ?? 0);
      entry.members.add(r.member_user_id);
      map.set(r.client_id, entry);
    });
    return [...map.entries()]
      .map(([id, v]) => ({ id, name: v.name, count: v.count, points: v.points, members: v.members.size }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  function exportCSV() {
    const headers = ['Date', 'Merchant', 'Member Email', 'Member Name', 'Reward', 'Brand', 'Coupon Type', 'Voucher Code', 'Points Spent'];
    const rows = filtered.map(r => [
      new Date(r.created_at).toLocaleDateString('en-IN'),
      r.client_name,
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
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'all_brand_redemptions.csv'; a.click();
  }

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Brand Redemptions">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Brand Reward Redemptions</h1>
            <p className="text-gray-500 text-sm mt-1">All brand/marketplace reward redemptions across all merchants</p>
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
            { label: 'Total Points Spent', value: stats.totalPoints.toLocaleString(), icon: <Coins className="w-5 h-5 text-amber-500" />, color: 'bg-amber-50' },
            { label: 'Active Merchants', value: stats.uniqueClients, icon: <Store className="w-5 h-5 text-green-500" />, color: 'bg-green-50' },
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

        {/* Per-merchant summary */}
        {clientSummary.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Per-Merchant Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Merchant</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Redemptions</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Unique Members</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Points Spent</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Filter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientSummary.map(c => (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-gray-400" />{c.name}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">{c.count}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{c.members}</td>
                        <td className="py-2 px-3 text-right text-red-600 font-medium">{c.points.toLocaleString()}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setFilterClient(filterClient === c.id ? 'all' : c.id)}
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${filterClient === c.id ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 border-blue-300 hover:bg-blue-50'}`}
                          >
                            {filterClient === c.id ? '✕ Clear' : 'View only'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transactions table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <CardTitle>All Transactions ({filtered.length})</CardTitle>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="all">All Merchants</option>
                  {uniqueClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={filterReward} onChange={e => setFilterReward(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="all">All Rewards</option>
                  {uniqueRewards.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-lg" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No brand reward redemptions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-600">Merchant</th>
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                            <Store className="w-3 h-3" />{r.client_name}
                          </span>
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
                            <Building2 className="w-3 h-3" />{r.brand_name}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${r.coupon_type === 'generic' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                            {r.coupon_type === 'generic' ? 'Generic' : 'Unique'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-gray-700">{r.voucher_code}</td>
                        <td className="py-3 px-3 text-right font-semibold text-red-600">
                          −{Math.abs(r.points_amount).toLocaleString()}
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
