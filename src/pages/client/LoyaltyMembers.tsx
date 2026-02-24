import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Users, TrendingUp, Award, Search, Download, Eye, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface LoyaltyMember {
  id: string;
  member_user_id: string;
  email: string;
  full_name: string;
  phone: string;
  tier_name: string;
  tier_level: number;
  points_balance: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  total_orders: number;
  total_spend: number;
  tier_achieved_at: string;
  created_at: string;
  expiring_soon: number;
}

interface TierSummary {
  tier_name: string;
  tier_level: number;
  member_count: number;
  total_points: number;
  avg_points: number;
}

export function LoyaltyMembers() {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [tierSummary, setTierSummary] = useState<TierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string>('');
  const [loyaltyProgramId, setLoyaltyProgramId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
  const [expirySchedule, setExpirySchedule] = useState<any[]>([]);

  useEffect(() => {
    loadClientId();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadLoyaltyProgram();
    }
  }, [clientId]);

  useEffect(() => {
    if (loyaltyProgramId) {
      loadMembers();
      loadTierSummary();
    }
  }, [loyaltyProgramId]);

  const loadClientId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (profile?.client_id) {
        setClientId(profile.client_id);
      }
    } catch (error) {
      console.error('Error loading client ID:', error);
    }
  };

  const loadLoyaltyProgram = async () => {
    try {
      const { data } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setLoyaltyProgramId(data.id);
      }
    } catch (error) {
      console.error('Error loading loyalty program:', error);
    }
  };

  const loadMembers = async () => {
    try {
      setLoading(true);

      const { data: statusData, error: statusError } = await supabase
        .from('member_loyalty_status')
        .select(`
          id,
          member_user_id,
          points_balance,
          lifetime_points_earned,
          lifetime_points_redeemed,
          total_orders,
          total_spend,
          tier_achieved_at,
          created_at,
          loyalty_tiers(
            tier_name,
            tier_level
          )
        `)
        .eq('loyalty_program_id', loyaltyProgramId)
        .order('points_balance', { ascending: false });

      if (statusError) throw statusError;
      if (!statusData || statusData.length === 0) {
        setMembers([]);
        return;
      }

      const memberUserIds = statusData.map((m: any) => m.member_user_id).filter(Boolean);
      const { data: memberUsersData } = await supabase
        .from('member_users')
        .select('id, email, full_name, phone')
        .in('id', memberUserIds);

      const memberUsersMap = new Map((memberUsersData || []).map((mu: any) => [mu.id, mu]));

      const membersWithExpiry = await Promise.all(
        statusData.map(async (member: any) => {
          const mu = memberUsersMap.get(member.member_user_id);
          const { data: expiryData } = await supabase
            .from('points_expiry_schedule')
            .select('points_amount')
            .eq('member_loyalty_status_id', member.id)
            .eq('expired', false)
            .lte('expires_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

          const expiringSoon = expiryData?.reduce((sum: number, item: any) => sum + item.points_amount, 0) || 0;

          return {
            id: member.id,
            member_user_id: member.member_user_id,
            email: mu?.email || '',
            full_name: mu?.full_name || '',
            phone: mu?.phone || '',
            tier_name: (member.loyalty_tiers as any)?.tier_name || 'No Tier',
            tier_level: (member.loyalty_tiers as any)?.tier_level || 0,
            points_balance: member.points_balance,
            lifetime_points_earned: member.lifetime_points_earned,
            lifetime_points_redeemed: member.lifetime_points_redeemed,
            total_orders: member.total_orders,
            total_spend: member.total_spend,
            tier_achieved_at: member.tier_achieved_at,
            created_at: member.created_at,
            expiring_soon: expiringSoon,
          };
        })
      );

      setMembers(membersWithExpiry);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTierSummary = async () => {
    try {
      const { data, error } = await supabase
        .from('member_loyalty_status')
        .select(`
          points_balance,
          loyalty_tiers(
            tier_name,
            tier_level
          )
        `)
        .eq('loyalty_program_id', loyaltyProgramId);

      if (error) throw error;

      const summary = (data || []).reduce((acc: any, member: any) => {
        const tierName = member.loyalty_tiers?.tier_name || 'No Tier';
        const tierLevel = member.loyalty_tiers?.tier_level || 0;
        if (!acc[tierName]) {
          acc[tierName] = {
            tier_name: tierName,
            tier_level: tierLevel,
            member_count: 0,
            total_points: 0,
          };
        }
        acc[tierName].member_count++;
        acc[tierName].total_points += member.points_balance;
        return acc;
      }, {});

      const summaryArray = Object.values(summary).map((tier: any) => ({
        ...tier,
        avg_points: Math.round(tier.total_points / tier.member_count),
      })).sort((a: any, b: any) => b.tier_level - a.tier_level);

      setTierSummary(summaryArray as TierSummary[]);
    } catch (error) {
      console.error('Error loading tier summary:', error);
    }
  };

  const loadMemberLedger = async (memberId: string) => {
    try {
      const { data, error } = await supabase
        .from('loyalty_points_transactions')
        .select('*')
        .eq('member_loyalty_status_id', memberId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLedgerTransactions(data || []);
    } catch (error) {
      console.error('Error loading ledger:', error);
    }
  };

  const loadExpirySchedule = async (memberId: string) => {
    try {
      const { data, error } = await supabase
        .from('points_expiry_schedule')
        .select('*')
        .eq('member_loyalty_status_id', memberId)
        .eq('expired', false)
        .order('expires_at', { ascending: true });

      if (error) throw error;
      setExpirySchedule(data || []);
    } catch (error) {
      console.error('Error loading expiry schedule:', error);
    }
  };

  const viewMemberDetails = async (member: LoyaltyMember) => {
    setSelectedMember(member);
    setShowLedger(true);
    await loadMemberLedger(member.id);
    await loadExpirySchedule(member.id);
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Tier', 'Points Balance', 'Lifetime Earned', 'Lifetime Redeemed', 'Total Orders', 'Total Spend', 'Expiring Soon'];
    const rows = filteredMembers.map(m => [
      m.full_name,
      m.email,
      m.phone || '',
      m.tier_name,
      m.points_balance,
      m.lifetime_points_earned,
      m.lifetime_points_redeemed,
      m.total_orders,
      m.total_spend,
      m.expiring_soon,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loyalty-members-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = !searchTerm ||
      m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone?.includes(searchTerm);

    const matchesTier = selectedTier === 'all' || m.tier_name === selectedTier;

    return matchesSearch && matchesTier;
  });

  const totalMembers = members.length;
  const totalPointsIssued = members.reduce((sum, m) => sum + m.lifetime_points_earned, 0);
  const totalPointsRedeemed = members.reduce((sum, m) => sum + m.lifetime_points_redeemed, 0);
  const avgPointsBalance = totalMembers > 0 ? Math.round(members.reduce((sum, m) => sum + m.points_balance, 0) / totalMembers) : 0;

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Loyalty Members">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Loading members...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!loyaltyProgramId) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Loyalty Members">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Loyalty Program Found</h3>
              <p className="text-gray-600 mb-6">Set up a loyalty program first to manage members.</p>
              <Button onClick={() => window.location.href = '/client/loyalty-program'}>
                Set Up Loyalty Program
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Loyalty Members">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Loyalty Members</h1>
            <p className="text-gray-600 mt-1">Track member points, tiers, and activity</p>
          </div>
          <Button onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Members</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalMembers}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Points Issued</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalPointsIssued.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Points Redeemed</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalPointsRedeemed.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg. Balance</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{avgPointsBalance}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Members by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tierSummary.map((tier) => (
                <div key={tier.tier_name} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{tier.tier_name}</h3>
                    <Award className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">{tier.member_count} members</p>
                    <p className="text-gray-600">{tier.total_points.toLocaleString()} total points</p>
                    <p className="text-gray-600">{tier.avg_points} avg. points</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Members</CardTitle>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Tiers</option>
                  {tierSummary.map((tier) => (
                    <option key={tier.tier_name} value={tier.tier_name}>
                      {tier.tier_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Points</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Earned</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Redeemed</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orders</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spend</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expiring</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{member.full_name || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                          {member.phone && <p className="text-xs text-gray-400">{member.phone}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {member.tier_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-gray-900">{member.points_balance.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {member.lifetime_points_earned.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {member.lifetime_points_redeemed.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {member.total_orders}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        ${member.total_spend.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {member.expiring_soon > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {member.expiring_soon}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => viewMemberDetails(member)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredMembers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No members found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {showLedger && selectedMember && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLedger(false)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h2 className="text-2xl font-bold">Member Details</h2>
              <p className="text-blue-100 mt-1">{selectedMember.full_name} - {selectedMember.email}</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Tier</p>
                  <p className="font-semibold text-gray-900">{selectedMember.tier_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Points Balance</p>
                  <p className="font-semibold text-gray-900">{selectedMember.points_balance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lifetime Earned</p>
                  <p className="font-semibold text-gray-900">{selectedMember.lifetime_points_earned.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lifetime Redeemed</p>
                  <p className="font-semibold text-gray-900">{selectedMember.lifetime_points_redeemed.toLocaleString()}</p>
                </div>
              </div>

              {expirySchedule.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Points Expiring Soon</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="space-y-2">
                      {expirySchedule.map((expiry) => (
                        <div key={expiry.id} className="flex justify-between items-center text-sm">
                          <span className="text-gray-700">
                            {expiry.points_amount} points expire on {new Date(expiry.expires_at).toLocaleDateString()}
                          </span>
                          <span className="text-red-600 font-medium">
                            {Math.ceil((new Date(expiry.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Points Ledger</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Points</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {ledgerTransactions.map((txn) => (
                          <tr key={txn.id}>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(txn.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                txn.transaction_type === 'earn' ? 'bg-green-100 text-green-800' :
                                txn.transaction_type === 'earned' ? 'bg-green-100 text-green-800' :
                                txn.transaction_type === 'redeem' ? 'bg-blue-100 text-blue-800' :
                                txn.transaction_type === 'redeemed' ? 'bg-blue-100 text-blue-800' :
                                txn.transaction_type === 'expired' ? 'bg-red-100 text-red-800' :
                                txn.transaction_type === 'expire' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {txn.transaction_type}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right font-medium ${
                              txn.points_amount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {txn.points_amount >= 0 ? '+' : ''}{txn.points_amount}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                              {txn.balance_after}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {txn.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setShowLedger(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
