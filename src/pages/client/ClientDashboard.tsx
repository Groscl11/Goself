import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Users, Gift, Award, TrendingUp, Sparkles, UserPlus, Send, ShoppingBag, Link as LinkIcon, Copy, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';

interface ClientStats {
  totalMembers: number;
  activePrograms: number;
  totalRewards: number;
  redemptionsThisMonth: number;
}

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  registration_enabled: boolean;
}

export function ClientDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [stats, setStats] = useState<ClientStats>({
    totalMembers: 0,
    activePrograms: 0,
    totalRewards: 0,
    redemptionsThisMonth: 0,
  });
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (profile?.client_id) {
      loadStats();
      loadClientInfo();
    }
  }, [profile]);

  const loadClientInfo = async () => {
    if (!profile?.client_id) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, slug, registration_enabled')
        .eq('id', profile.client_id)
        .maybeSingle();

      if (error) throw error;
      if (data) setClientInfo(data);
    } catch (error) {
      console.error('Error loading client info:', error);
    }
  };

  const copyRegistrationLink = async () => {
    if (!clientInfo) return;

    const registrationUrl = `${window.location.origin}/join/${clientInfo.slug}`;
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const loadStats = async () => {
    if (!profile?.client_id) return;

    try {
      const [members, programs, rewards, redemptions] = await Promise.all([
        supabase
          .from('member_users')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.client_id),
        supabase
          .from('membership_programs')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.client_id)
          .eq('is_active', true),
        supabase
          .from('rewards')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.client_id),
        supabase
          .from('redemptions')
          .select('id', { count: 'exact', head: true })
          .gte('redeemed_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      setStats({
        totalMembers: members.count || 0,
        activePrograms: programs.count || 0,
        totalRewards: rewards.count || 0,
        redemptionsThisMonth: redemptions.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Members',
      value: stats.totalMembers,
      icon: <Users className="w-8 h-8 text-blue-600" />,
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Programs',
      value: stats.activePrograms,
      icon: <Award className="w-8 h-8 text-green-600" />,
      bgColor: 'bg-green-50',
    },
    {
      title: 'Custom Rewards',
      value: stats.totalRewards,
      icon: <Gift className="w-8 h-8 text-orange-600" />,
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Redemptions (This Month)',
      value: stats.redemptionsThisMonth,
      icon: <TrendingUp className="w-8 h-8 text-purple-600" />,
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Client Dashboard">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Manage your membership programs and rewards</p>
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

        {clientInfo && clientInfo.registration_enabled && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Member Registration Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Share this link with your audience to allow them to register and join your membership programs.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-900 overflow-x-auto">
                  {window.location.origin}/join/{clientInfo.slug}
                </div>
                <button
                  onClick={copyRegistrationLink}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {copiedLink ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Pro Tip:</strong> Members who register through this link will be automatically associated with your organization, allowing them to access your exclusive programs and rewards.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => navigate('/client/programs/new')}
                className="w-full p-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-left flex items-center gap-3"
              >
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Create Membership Program</p>
                  <p className="text-sm text-gray-600">Build a new membership tier</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/client/campaigns/new')}
                className="w-full p-4 border-2 border-dashed border-purple-300 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-left flex items-center gap-3"
              >
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Launch Campaign</p>
                  <p className="text-sm text-gray-600">Enroll members or distribute rewards</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/client/members')}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
              >
                <div className="p-2 bg-gray-100 rounded-lg">
                  <UserPlus className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Manage Members</p>
                  <p className="text-sm text-gray-600">View activity and history</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/client/rewards')}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
              >
                <div className="p-2 bg-gray-100 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Browse Rewards</p>
                  <p className="text-sm text-gray-600">Explore marketplace rewards</p>
                </div>
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Recent member activity will appear here...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
