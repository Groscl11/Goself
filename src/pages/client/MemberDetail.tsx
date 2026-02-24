import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Mail, Phone, Calendar, Award, Gift, CheckCircle, XCircle, AlertCircle, Clock, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface MemberDetail {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  metadata: Record<string, any>;
}

interface MemberSource {
  source_type: string;
  created_at: string;
  source_metadata: Record<string, any>;
}

interface Membership {
  id: string;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  program: {
    name: string;
  };
}

interface RewardAllocation {
  id: string;
  quantity_allocated: number;
  quantity_redeemed: number;
  allocated_at: string;
  expires_at: string | null;
  reward: {
    title: string;
    brand_id: string;
  };
}

interface Voucher {
  id: string;
  code: string;
  status: string;
  expires_at: string | null;
  redeemed_at: string | null;
  reward: {
    title: string;
  };
}

interface Redemption {
  id: string;
  redeemed_at: string;
  redemption_channel: string;
  redemption_location: string | null;
  reward: {
    title: string;
  };
  voucher: {
    code: string;
  };
}

export function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [allocations, setAllocations] = useState<RewardAllocation[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'memberships' | 'rewards' | 'vouchers' | 'history' | 'transactions'>('memberships');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [memberSource, setMemberSource] = useState<MemberSource | null>(null);

  useEffect(() => {
    if (id) {
      loadMemberData();
    }
  }, [id]);

  const loadMemberData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      const [memberResult, membershipsResult, allocationsResult, vouchersResult, redemptionsResult, transactionsResult, sourceResult] = await Promise.all([
        supabase.from('member_users').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('member_memberships')
          .select('*, program:membership_programs(name)')
          .eq('member_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('member_rewards_allocation')
          .select('*, reward:rewards(title, brand_id)')
          .eq('member_id', id)
          .order('allocated_at', { ascending: false }),
        supabase
          .from('vouchers')
          .select('*, reward:rewards(title)')
          .eq('member_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('redemptions')
          .select('*, reward:rewards(title), voucher:vouchers(code)')
          .eq('member_id', id)
          .order('redeemed_at', { ascending: false }),
        supabase
          .from('transaction_summary_view')
          .select('*')
          .eq('member_id', id)
          .order('transaction_date', { ascending: false }),
        supabase
          .from('member_sources')
          .select('*')
          .eq('member_id', id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (memberResult.error) throw memberResult.error;
      if (!memberResult.data) {
        navigate('/client/members');
        return;
      }

      setMember(memberResult.data);
      setMemberships(membershipsResult.data || []);
      setAllocations(allocationsResult.data || []);
      setVouchers(vouchersResult.data || []);
      setRedemptions(redemptionsResult.data || []);
      setTransactions(transactionsResult.data || []);
      setMemberSource(sourceResult.data || null);
    } catch (error) {
      console.error('Error loading member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      revoked: 'bg-gray-100 text-gray-800',
      available: 'bg-blue-100 text-blue-800',
      redeemed: 'bg-green-100 text-green-800',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const daysUntilExpiry = Math.floor((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Member Details">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!member) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Member Details">
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-gray-600">Member not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Member Details">
      <div className="max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/client/members')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Members
        </Button>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {member.full_name?.[0]?.toUpperCase() || 'M'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{member.full_name || 'N/A'}</h1>
                  <div className="flex items-center gap-4 mt-2 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">{member.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">
                        Joined {new Date(member.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {memberSource && (
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          memberSource.source_type === 'campaign' ? 'bg-purple-100 text-purple-700' :
                          memberSource.source_type === 'import' ? 'bg-blue-100 text-blue-700' :
                          memberSource.source_type === 'organic' ? 'bg-green-100 text-green-700' :
                          memberSource.source_type === 'referral' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Source: {memberSource.source_type.charAt(0).toUpperCase() + memberSource.source_type.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                {getStatusBadge(member.is_active ? 'active' : 'inactive')}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Award className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Memberships</p>
                  <p className="text-2xl font-bold text-gray-900">{memberships.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-lg">
                  <Gift className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Allocated Rewards</p>
                  <p className="text-2xl font-bold text-gray-900">{allocations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Available Vouchers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {vouchers.filter((v) => v.status === 'available').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Redemptions</p>
                  <p className="text-2xl font-bold text-gray-900">{redemptions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex gap-2 border-b border-gray-200 -mb-4">
              {['memberships', 'rewards', 'vouchers', 'transactions', 'history'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-3 font-medium capitalize border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {activeTab === 'memberships' && (
              <div className="space-y-4">
                {memberships.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No memberships assigned</p>
                ) : (
                  memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{membership.program.name}</h4>
                          <div className="flex gap-4 mt-2 text-sm text-gray-600">
                            {membership.activated_at && (
                              <span>Activated: {new Date(membership.activated_at).toLocaleDateString()}</span>
                            )}
                            {membership.expires_at && (
                              <span
                                className={
                                  isExpired(membership.expires_at)
                                    ? 'text-red-600 font-medium'
                                    : isExpiringSoon(membership.expires_at)
                                    ? 'text-orange-600 font-medium'
                                    : ''
                                }
                              >
                                Expires: {new Date(membership.expires_at).toLocaleDateString()}
                                {isExpired(membership.expires_at) && ' (Expired)'}
                                {isExpiringSoon(membership.expires_at) && ' (Expiring Soon)'}
                              </span>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(membership.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'rewards' && (
              <div className="space-y-4">
                {allocations.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No rewards allocated</p>
                ) : (
                  allocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{allocation.reward.title}</h4>
                          <div className="flex gap-4 mt-2 text-sm text-gray-600">
                            <span>Allocated: {allocation.quantity_allocated}</span>
                            <span>Redeemed: {allocation.quantity_redeemed}</span>
                            <span>Available: {allocation.quantity_allocated - allocation.quantity_redeemed}</span>
                            {allocation.expires_at && (
                              <span
                                className={
                                  isExpired(allocation.expires_at)
                                    ? 'text-red-600 font-medium'
                                    : isExpiringSoon(allocation.expires_at)
                                    ? 'text-orange-600 font-medium'
                                    : ''
                                }
                              >
                                Expires: {new Date(allocation.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'vouchers' && (
              <div className="space-y-4">
                {vouchers.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No vouchers available</p>
                ) : (
                  vouchers.map((voucher) => (
                    <div
                      key={voucher.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{voucher.reward.title}</h4>
                          <div className="flex gap-4 mt-2 text-sm text-gray-600">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                              {voucher.code}
                            </span>
                            {voucher.expires_at && (
                              <span
                                className={
                                  isExpired(voucher.expires_at)
                                    ? 'text-red-600 font-medium'
                                    : isExpiringSoon(voucher.expires_at)
                                    ? 'text-orange-600 font-medium'
                                    : ''
                                }
                              >
                                {isExpired(voucher.expires_at)
                                  ? `Expired: ${new Date(voucher.expires_at).toLocaleDateString()}`
                                  : `Expires: ${new Date(voucher.expires_at).toLocaleDateString()}`}
                              </span>
                            )}
                            {voucher.redeemed_at && (
                              <span>Redeemed: {new Date(voucher.redeemed_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(voucher.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No transaction history</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transactions.map((txn) => (
                          <tr key={txn.transaction_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(txn.transaction_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                txn.transaction_type === 'issued'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {txn.transaction_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{txn.reward_title}</div>
                              <div className="text-xs text-gray-500">{txn.reward_code}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{txn.brand_name}</td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-900">{txn.voucher_code}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                txn.voucher_status === 'available'
                                  ? 'bg-green-100 text-green-800'
                                  : txn.voucher_status === 'redeemed'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {txn.voucher_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {txn.discount_value ? `${txn.discount_value} ${txn.currency}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                {redemptions.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No redemption history</p>
                ) : (
                  redemptions.map((redemption) => (
                    <div
                      key={redemption.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{redemption.reward.title}</h4>
                          <div className="flex gap-4 mt-2 text-sm text-gray-600">
                            <span>Code: {redemption.voucher.code}</span>
                            <span>Channel: {redemption.redemption_channel}</span>
                            {redemption.redemption_location && (
                              <span>Location: {redemption.redemption_location}</span>
                            )}
                            <span>Date: {new Date(redemption.redeemed_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
