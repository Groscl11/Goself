import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import {
  Users, Coins, Megaphone, GitBranch, Tag, ArrowRight,
  Link as LinkIcon, Copy, CheckCircle, Cog, BarChart3,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';

interface DashboardStats {
  totalMembers: number;
  activeCampaigns: number;
  activeOffers: number;
  totalReferrals: number;
}

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  registration_enabled: boolean;
  onboarding_completed: boolean;
}

export function ClientDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeCampaigns: 0,
    activeOffers: 0,
    totalReferrals: 0,
  });
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (profile?.client_id) {
      loadClientInfo();
      loadStats();
    }
  }, [profile]);

  const loadClientInfo = async () => {
    if (!profile?.client_id) return;
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, slug, registration_enabled, onboarding_completed')
        .eq('id', profile.client_id)
        .maybeSingle();
      if (data) {
        setClientInfo(data);
        if (!data.onboarding_completed) {
          navigate('/client/onboarding', { replace: true });
        }
      }
    } catch (error) {
      console.error('Error loading client info:', error);
    }
  };

  const loadStats = async () => {
    if (!profile?.client_id) return;
    try {
      const [members, campaigns, offers] = await Promise.all([
        supabase
          .from('member_users')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.client_id),
        supabase
          .from('campaign_rules')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.client_id)
          .eq('is_active', true),
        supabase
          .from('rewards')
          .select('id', { count: 'exact', head: true })
          .eq('owner_client_id', profile.client_id),
      ]);

      // Referrals require the loyalty program id first
      let totalReferrals = 0;
      try {
        const { data: program } = await supabase
          .from('loyalty_programs')
          .select('id')
          .eq('client_id', profile.client_id)
          .eq('is_active', true)
          .maybeSingle();
        if (program) {
          const { count } = await supabase
            .from('member_referrals')
            .select('id', { count: 'exact', head: true })
            .eq('loyalty_program_id', program.id);
          totalReferrals = count || 0;
        }
      } catch {
        // referral table may not be populated yet
      }

      setStats({
        totalMembers: members.count || 0,
        activeCampaigns: campaigns.count || 0,
        activeOffers: offers.count || 0,
        totalReferrals,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
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

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const statCards = [
    { label: 'Total Members', value: stats.totalMembers, icon: <Users className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Active Campaigns', value: stats.activeCampaigns, icon: <Megaphone className="w-5 h-5 text-violet-600" />, bg: 'bg-violet-50', color: 'text-violet-600' },
    { label: 'Total Offers', value: stats.activeOffers, icon: <Tag className="w-5 h-5 text-orange-600" />, bg: 'bg-orange-50', color: 'text-orange-600' },
    { label: 'Total Referrals', value: stats.totalReferrals, icon: <GitBranch className="w-5 h-5 text-green-600" />, bg: 'bg-green-50', color: 'text-green-600' },
  ];

  const moduleCards = [
    {
      title: 'Loyalty',
      description: 'Manage points, tiers, and member earning rules. Build a lasting relationship with every purchase.',
      icon: <Coins className="w-6 h-6 text-blue-600" />,
      iconBg: 'bg-blue-50',
      metrics: [
        { label: 'Members', value: loading ? '…' : stats.totalMembers },
      ],
      primaryAction: { label: 'View Members', path: '/client/members' },
      secondaryAction: { label: 'Earn Rules', path: '/client/loyalty-config' },
      accent: 'border-l-blue-500',
    },
    {
      title: 'Referral',
      description: 'Track referral codes, reward successful conversions, and grow your member base organically.',
      icon: <GitBranch className="w-6 h-6 text-green-600" />,
      iconBg: 'bg-green-50',
      metrics: [
        { label: 'Referrals', value: loading ? '…' : stats.totalReferrals },
      ],
      primaryAction: { label: 'Track Referrals', path: '/client/referral-tracking' },
      secondaryAction: { label: 'Reward Links', path: '/client/tokenized-links' },
      accent: 'border-l-green-500',
    },
    {
      title: 'Rewards & Offers',
      description: 'Create campaigns, publish offers, connect brand partners, and distribute rewards at scale.',
      icon: <Tag className="w-6 h-6 text-orange-600" />,
      iconBg: 'bg-orange-50',
      metrics: [
        { label: 'Active Campaigns', value: loading ? '…' : stats.activeCampaigns },
        { label: 'Offers', value: loading ? '…' : stats.activeOffers },
      ],
      primaryAction: { label: 'View Campaigns', path: '/client/campaigns' },
      secondaryAction: { label: 'Browse Offers', path: '/client/offers' },
      accent: 'border-l-orange-500',
    },
  ];

  const quickActions = [
    { label: 'Configure Earn Rules', desc: 'Set up how members earn points', icon: <Cog className="w-5 h-5" />, path: '/client/loyalty-config', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
    { label: 'Create Campaign', desc: 'Launch a new reward campaign', icon: <Megaphone className="w-5 h-5" />, path: '/client/campaigns', color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
    { label: 'Create Offer', desc: 'Add a discount or partner voucher', icon: <Tag className="w-5 h-5" />, path: '/client/offers', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
    { label: 'View Reports', desc: 'Analyse member and campaign data', icon: <BarChart3 className="w-5 h-5" />, path: '/client/reports', color: 'text-gray-700 bg-gray-100 hover:bg-gray-200' },
  ];

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Dashboard">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {clientInfo?.name ? `${clientInfo.name}` : 'Dashboard'}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{today}</p>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? <span className="inline-block w-8 h-5 bg-gray-100 rounded animate-pulse" /> : stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── 3 Module cards ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {moduleCards.map((mod) => (
              <div
                key={mod.title}
                className={`bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col border-l-4 ${mod.accent}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${mod.iconBg}`}>{mod.icon}</div>
                  <h3 className="font-semibold text-gray-900">{mod.title}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{mod.description}</p>

                {/* Metrics */}
                <div className="flex gap-4 mb-4">
                  {mod.metrics.map((m) => (
                    <div key={m.label}>
                      <p className="text-xs text-gray-400">{m.label}</p>
                      <p className="text-lg font-bold text-gray-900">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => navigate(mod.primaryAction.path)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {mod.primaryAction.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => navigate(mod.secondaryAction.path)}
                    className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {mod.secondaryAction.label}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick Actions + Registration Link ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-700">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="p-3 rounded-xl text-left transition-colors border border-transparent hover:border-gray-100 hover:shadow-sm"
                >
                  <div className={`inline-flex p-2 rounded-lg mb-2 ${action.color}`}>
                    {action.icon}
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-tight">{action.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {clientInfo?.registration_enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <LinkIcon className="w-4 h-4" />
                  Member Registration Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-500">
                  Share this link so customers can register and join your loyalty program.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs text-gray-700 truncate">
                    {window.location.origin}/join/{clientInfo.slug}
                  </div>
                  <button
                    onClick={copyRegistrationLink}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
                  >
                    {copiedLink ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Members who join through this link are automatically linked to your account.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}


  const loadClientInfo = async () => {
    if (!profile?.client_id) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, slug, registration_enabled, onboarding_completed')
        .eq('id', profile.client_id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setClientInfo(data);
        if (!data.onboarding_completed) {
          navigate('/client/onboarding', { replace: true });
        }
      }
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
