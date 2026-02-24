import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { clientMenuItems } from './clientMenuItems';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UserPlus, Users, CheckCircle, Clock, Gift, TrendingUp, Copy, Check, XCircle } from 'lucide-react';

interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalPointsAwarded: number;
  membersWithCode: number;
}

interface Referral {
  id: string;
  status: string;
  referral_code: string;
  referred_email: string | null;
  referred_phone: string | null;
  points_awarded: number;
  completed_at: string | null;
  created_at: string;
  expires_at: string | null;
  referrer_name: string;
  referrer_email: string;
  referred_name: string | null;
}

interface EarningRule {
  rule_type: string;
  points_awarded: number;
}

interface MemberCode {
  id: string;
  full_name: string;
  email: string;
  referral_code: string;
  referral_points_earned: number;
  total_referrals: number;
}

export function ReferralTracking() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalPointsAwarded: 0,
    membersWithCode: 0,
  });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [memberCodes, setMemberCodes] = useState<MemberCode[]>([]);
  const [earningRules, setEarningRules] = useState<EarningRule[]>([]);
  const [activeTab, setActiveTab] = useState<'referrals' | 'members'>('referrals');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [pointsName, setPointsName] = useState('Points');

  useEffect(() => {
    if (profile?.client_id) {
      loadAll();
    }
  }, [profile]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadStats(),
      loadReferrals(),
      loadMemberCodes(),
      loadEarningRules(),
      loadPointsName(),
    ]);
    setLoading(false);
  };

  const loadPointsName = async () => {
    if (!profile?.client_id) return;
    const { data } = await supabase
      .from('loyalty_programs')
      .select('points_name')
      .eq('client_id', profile.client_id)
      .eq('is_active', true)
      .maybeSingle();
    if (data?.points_name) setPointsName(data.points_name);
  };

  const loadStats = async () => {
    if (!profile?.client_id) return;
    try {
      const { data: program } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('client_id', profile.client_id)
        .eq('is_active', true)
        .maybeSingle();
      if (!program) return;

      const { data: referralData } = await supabase
        .from('member_referrals')
        .select('status, points_awarded')
        .eq('loyalty_program_id', program.id);

      const { count: membersWithCode } = await supabase
        .from('member_loyalty_status')
        .select('*', { count: 'exact', head: true })
        .eq('loyalty_program_id', program.id)
        .not('referral_code', 'is', null);

      setStats({
        totalReferrals: referralData?.length || 0,
        completedReferrals: referralData?.filter(r => r.status === 'completed').length || 0,
        pendingReferrals: referralData?.filter(r => r.status === 'pending').length || 0,
        totalPointsAwarded: referralData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0,
        membersWithCode: membersWithCode || 0,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadReferrals = async () => {
    if (!profile?.client_id) return;
    try {
      const { data: program } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('client_id', profile.client_id)
        .eq('is_active', true)
        .maybeSingle();
      if (!program) return;

      const { data } = await supabase
        .from('member_referrals')
        .select(`
          id, status, referral_code, referred_email, referred_phone,
          points_awarded, completed_at, created_at, expires_at,
          referrer:referrer_member_id ( full_name, email ),
          referred:referred_member_id ( full_name )
        `)
        .eq('loyalty_program_id', program.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        setReferrals(data.map((r: any) => ({
          ...r,
          referrer_name: r.referrer?.full_name || 'Unknown',
          referrer_email: r.referrer?.email || '',
          referred_name: r.referred?.full_name || null,
        })));
      }
    } catch (err) {
      console.error('Error loading referrals:', err);
    }
  };

  const loadMemberCodes = async () => {
    if (!profile?.client_id) return;
    try {
      const { data: program } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('client_id', profile.client_id)
        .eq('is_active', true)
        .maybeSingle();
      if (!program) return;

      const { data } = await supabase
        .from('member_loyalty_status')
        .select(`
          id, referral_code, referral_points_earned,
          member:member_user_id ( full_name, email )
        `)
        .eq('loyalty_program_id', program.id)
        .not('referral_code', 'is', null)
        .order('referral_points_earned', { ascending: false })
        .limit(50);

      if (data) {
        const { data: referralCounts } = await supabase
          .from('member_referrals')
          .select('referrer_member_id')
          .eq('loyalty_program_id', program.id)
          .eq('status', 'completed');

        const countMap: Record<string, number> = {};
        referralCounts?.forEach((r: any) => {
          countMap[r.referrer_member_id] = (countMap[r.referrer_member_id] || 0) + 1;
        });

        setMemberCodes(data.map((m: any) => ({
          id: m.id,
          full_name: m.member?.full_name || 'Unknown',
          email: m.member?.email || '',
          referral_code: m.referral_code,
          referral_points_earned: m.referral_points_earned || 0,
          total_referrals: countMap[m.id] || 0,
        })));
      }
    } catch (err) {
      console.error('Error loading member codes:', err);
    }
  };

  const loadEarningRules = async () => {
    if (!profile?.client_id) return;
    try {
      const { data: program } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('client_id', profile.client_id)
        .eq('is_active', true)
        .maybeSingle();
      if (!program) return;

      const { data } = await supabase
        .from('loyalty_program_earning_rules')
        .select('rule_type, points_awarded')
        .eq('loyalty_program_id', program.id)
        .eq('is_active', true)
        .in('rule_type', ['referral', 'referral_complete']);

      if (data) setEarningRules(data);
    } catch (err) {
      console.error('Error loading earning rules:', err);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredReferrals = statusFilter === 'all'
    ? referrals
    : referrals.filter(r => r.status === statusFilter);

  const referrerRule = earningRules.find(r => r.rule_type === 'referral');
  const refereeRule = earningRules.find(r => r.rule_type === 'referral_complete');

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Completed</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> Pending</span>;
      case 'expired':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Expired</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Referral Tracking">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Referral Tracking">
      <div className="space-y-6">

        {/* Earning Rules Banner */}
        {(referrerRule || refereeRule) && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Two-Way Referral Program</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {referrerRule && (
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold">+{referrerRule.points_awarded} {pointsName}</div>
                  <div className="text-sm opacity-80 mt-1">Referrer earns when friend places first order</div>
                </div>
              )}
              {refereeRule && (
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold">+{refereeRule.points_awarded} {pointsName}</div>
                  <div className="text-sm opacity-80 mt-1">New member earns on their first order</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Total Referrals</span>
                <UserPlus className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Completed</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.completedReferrals}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Pending</span>
                <Clock className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingReferrals}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{pointsName} Awarded</span>
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-600">{stats.totalPointsAwarded.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Active Codes</span>
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-600">{stats.membersWithCode}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-6">
            {(['referrals', 'members'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {tab === 'referrals' ? 'Referral Activity' : 'Member Referral Codes'}
              </button>
            ))}
          </div>
        </div>

        {/* Referral Activity Tab */}
        {activeTab === 'referrals' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>Referral Activity</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {['all', 'pending', 'completed', 'expired'].map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {s === 'all' ? `All (${referrals.length})` : s}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredReferrals.length === 0 ? (
                <div className="text-center py-16">
                  <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-gray-500 font-medium">No referrals yet</h3>
                  <p className="text-gray-400 text-sm mt-1">Referrals will appear here once members start sharing their codes</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Referrer</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Referred</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applied</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredReferrals.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-900">{r.referrer_name}</div>
                            <div className="text-xs text-gray-400">{r.referrer_email}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-1 rounded">{r.referral_code}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-gray-900">{r.referred_name || '—'}</div>
                            <div className="text-xs text-gray-400">{r.referred_email || r.referred_phone || '—'}</div>
                          </td>
                          <td className="py-3 px-3">{statusBadge(r.status)}</td>
                          <td className="py-3 px-3">
                            {r.points_awarded > 0
                              ? <span className="font-semibold text-purple-600">+{r.points_awarded}</span>
                              : <span className="text-gray-400">—</span>
                            }
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">{formatDate(r.created_at)}</td>
                          <td className="py-3 px-3 text-gray-500 text-xs">{formatDate(r.completed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Member Codes Tab */}
        {activeTab === 'members' && (
          <Card>
            <CardHeader>
              <CardTitle>Member Referral Codes</CardTitle>
            </CardHeader>
            <CardContent>
              {memberCodes.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-gray-500 font-medium">No referral codes yet</h3>
                  <p className="text-gray-400 text-sm mt-1">Members get referral codes when they join the loyalty program</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Referral Code</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Successful Referrals</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{pointsName} Earned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {memberCodes.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-900">{m.full_name}</div>
                            <div className="text-xs text-gray-400">{m.email}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded border border-blue-100">
                                {m.referral_code}
                              </span>
                              <button
                                onClick={() => copyCode(m.referral_code)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Copy code"
                              >
                                {copiedCode === m.referral_code
                                  ? <Check className="w-4 h-4 text-green-500" />
                                  : <Copy className="w-4 h-4" />
                                }
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`font-semibold ${m.total_referrals > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {m.total_referrals}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`font-semibold ${m.referral_points_earned > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                              {m.referral_points_earned > 0 ? `+${m.referral_points_earned.toLocaleString()}` : '0'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
