import { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, Gift, Users } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { brandMenuItems } from './brandMenuItems';

interface Voucher {
  id: string;
  code: string;
  status: string;
  expires_at: string | null;
  redeemed_at: string | null;
  issued_at: string | null;
  created_at: string;
  rewards: {
    title: string;
  };
  member_users: {
    full_name: string;
    email: string;
    clients: {
      name: string;
    };
  };
}

export function BrandVouchers() {
  const { profile } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'redeemed' | 'expired'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [stats, setStats] = useState({
    available: 0,
    redeemed: 0,
    expired: 0,
    total: 0,
  });

  useEffect(() => {
    if (profile?.brand_id) {
      loadVouchers();
    }
  }, [profile]);

  const loadVouchers = async () => {
    if (!profile?.brand_id) return;

    setLoading(true);
    try {
      const rewardsData = await supabase
        .from('rewards')
        .select('id')
        .eq('brand_id', profile.brand_id);

      const rewardIds = (rewardsData.data || []).map(r => r.id);

      if (rewardIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('vouchers')
        .select(`
          *,
          rewards!inner(title),
          member_users!inner(full_name, email, clients!inner(name))
        `)
        .in('reward_id', rewardIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVouchers(data || []);

      const available = data?.filter(v => v.status === 'available').length || 0;
      const redeemed = data?.filter(v => v.status === 'redeemed').length || 0;
      const expired = data?.filter(v => v.status === 'expired').length || 0;

      setStats({
        available,
        redeemed,
        expired,
        total: data?.length || 0,
      });
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVouchers = vouchers.filter((v) => {
    if (filter !== 'all' && v.status !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        v.code.toLowerCase().includes(term) ||
        v.rewards.title.toLowerCase().includes(term) ||
        v.member_users.full_name.toLowerCase().includes(term) ||
        v.member_users.email.toLowerCase().includes(term) ||
        v.member_users.clients.name.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const styles: any = {
      available: 'bg-green-100 text-green-800',
      redeemed: 'bg-blue-100 text-blue-800',
      expired: 'bg-red-100 text-red-800',
      revoked: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getStatusIcon = (status: string) => {
    const icons: any = {
      available: <Clock className="w-5 h-5 text-green-600" />,
      redeemed: <CheckCircle className="w-5 h-5 text-blue-600" />,
      expired: <XCircle className="w-5 h-5 text-red-600" />,
    };
    return icons[status] || <Clock className="w-5 h-5 text-gray-600" />;
  };

  return (
    <DashboardLayout menuItems={brandMenuItems} title="Voucher Tracking">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Voucher Tracking</h1>
          <p className="text-gray-600 mt-2">Monitor all vouchers issued for your rewards</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Vouchers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Gift className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.available}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Redeemed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.redeemed}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expired</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-6">
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2">
                {(['all', 'available', 'redeemed', 'expired'] as const).map((f) => (
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
              <input
                type="text"
                placeholder="Search vouchers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg w-full sm:w-64"
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading vouchers...</div>
            ) : filteredVouchers.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">No Vouchers Found</p>
                <p className="text-sm text-gray-500">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : `No ${filter === 'all' ? '' : filter} vouchers available`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredVouchers.map((voucher) => (
                      <tr key={voucher.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <code className="text-sm font-mono font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                            {voucher.code}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{voucher.rewards.title}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{voucher.member_users.full_name}</div>
                          <div className="text-xs text-gray-500">{voucher.member_users.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{voucher.member_users.clients.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {voucher.issued_at ? new Date(voucher.issued_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {voucher.expires_at ? new Date(voucher.expires_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(voucher.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
