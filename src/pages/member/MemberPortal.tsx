import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Gift, Award, Clock, CheckCircle, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { memberMenuItems } from './memberMenuItems';

interface MemberStats {
  activeMemberships: number;
  availableRewards: number;
  availableVouchers: number;
  totalRedemptions: number;
  connectedClients: number;
}

interface ClientInfo {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
}

interface Voucher {
  id: string;
  code: string;
  status: string;
  expires_at: string | null;
  client: ClientInfo;
  reward: {
    title: string;
    description: string;
    image_url: string | null;
  };
}

export function MemberPortal() {
  const { user } = useAuth();
  const [stats, setStats] = useState<MemberStats>({
    activeMemberships: 0,
    availableRewards: 0,
    availableVouchers: 0,
    totalRedemptions: 0,
    connectedClients: 0,
  });
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMemberData();
    }
  }, [user]);

  const loadMemberData = async () => {
    if (!user) return;

    try {
      const { data: memberDataList, error: memberError } = await supabase
        .from('member_users')
        .select('id, client:clients(id, name, logo_url, primary_color)')
        .eq('auth_user_id', user.id)
        .eq('is_active', true);

      if (memberError) throw memberError;

      if (!memberDataList || memberDataList.length === 0) {
        setLoading(false);
        return;
      }

      const memberIds = memberDataList.map(m => m.id);
      const clientsList = memberDataList.map(m => m.client).filter(Boolean) as ClientInfo[];
      setClients(clientsList);

      const [memberships, rewards, vouchersData, redemptions] = await Promise.all([
        supabase
          .from('member_memberships')
          .select('id', { count: 'exact', head: true })
          .in('member_id', memberIds)
          .eq('status', 'active'),
        supabase
          .from('member_rewards_allocation')
          .select('id', { count: 'exact', head: true })
          .in('member_id', memberIds),
        supabase
          .from('vouchers')
          .select(`
            *,
            reward:rewards(title, description, image_url),
            member:member_users!inner(client:clients(id, name, logo_url, primary_color))
          `)
          .in('member_id', memberIds)
          .eq('status', 'available')
          .order('expires_at', { ascending: true })
          .limit(5),
        supabase
          .from('redemptions')
          .select('id', { count: 'exact', head: true })
          .in('member_id', memberIds),
      ]);

      const vouchersWithClients = (vouchersData.data || []).map((v: any) => ({
        id: v.id,
        code: v.code,
        status: v.status,
        expires_at: v.expires_at,
        client: v.member?.client || { id: '', name: 'Unknown', logo_url: null, primary_color: '#3B82F6' },
        reward: v.reward || { title: '', description: '', image_url: null }
      }));

      setStats({
        activeMemberships: memberships.count || 0,
        availableRewards: rewards.count || 0,
        availableVouchers: vouchersData.data?.length || 0,
        totalRedemptions: redemptions.count || 0,
        connectedClients: clientsList.length,
      });
      setVouchers(vouchersWithClients);
    } catch (error) {
      console.error('Error loading member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Connected Clients',
      value: stats.connectedClients,
      icon: <Building2 className="w-8 h-8 text-blue-600" />,
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Memberships',
      value: stats.activeMemberships,
      icon: <Award className="w-8 h-8 text-green-600" />,
      bgColor: 'bg-green-50',
    },
    {
      title: 'Available Rewards',
      value: stats.availableRewards,
      icon: <Gift className="w-8 h-8 text-orange-600" />,
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Total Redemptions',
      value: stats.totalRedemptions,
      icon: <CheckCircle className="w-8 h-8 text-purple-600" />,
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <DashboardLayout menuItems={memberMenuItems} title="Member Portal">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Your Portal</h1>
          <p className="text-gray-600 mt-2">Access your memberships and rewards</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${stat.bgColor}`}>
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {clients.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Your Connected Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="p-4 border border-gray-200 rounded-lg text-center hover:shadow-md transition-shadow"
                  >
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} className="h-12 mx-auto mb-2" />
                    ) : (
                      <Building2 className="h-12 w-12 mx-auto mb-2" style={{ color: client.primary_color }} />
                    )}
                    <p className="text-sm font-medium text-gray-900">{client.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Your Available Vouchers</CardTitle>
          </CardHeader>
          <CardContent>
            {vouchers.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No vouchers available</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vouchers.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{voucher.reward.title}</h4>
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: `${voucher.client.primary_color}20`, color: voucher.client.primary_color }}>
                        {voucher.client.name}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{voucher.reward.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <code className="px-3 py-1 bg-blue-50 text-blue-700 rounded font-mono text-sm">
                        {voucher.code}
                      </code>
                      {voucher.expires_at && (
                        <span className="text-sm text-gray-500">
                          Expires: {new Date(voucher.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
