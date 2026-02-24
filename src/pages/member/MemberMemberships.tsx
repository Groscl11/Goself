import { useEffect, useState } from 'react';
import { Award, Calendar, Gift, CheckCircle, Building2, Settings, ChevronDown, ChevronUp, Ticket } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const memberMenuItems = [
  { label: 'Dashboard', path: '/member', icon: <Award className="w-5 h-5" /> },
  { label: 'My Memberships', path: '/member/memberships', icon: <Award className="w-5 h-5" /> },
  { label: 'Available Rewards', path: '/member/rewards', icon: <Gift className="w-5 h-5" /> },
  { label: 'My Vouchers', path: '/member/vouchers', icon: <CheckCircle className="w-5 h-5" /> },
  { label: 'Settings', path: '/member/settings', icon: <Settings className="w-5 h-5" /> },
];

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
}

interface MembershipReward {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  brands: {
    name: string;
    logo_url: string | null;
  };
}

interface RewardStats {
  total_allocated: number;
  total_redeemed: number;
  total_available: number;
}

interface Membership {
  id: string;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  client: Client;
  membership_programs: {
    id: string;
    name: string;
    description: string;
    tier_level: string | null;
    benefits: string[];
    validity_days: number;
    max_rewards_total: number | null;
    max_rewards_per_brand: number | null;
  };
  reward_stats?: RewardStats;
  rewards?: MembershipReward[];
}

export function MemberMemberships() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMembership, setExpandedMembership] = useState<string | null>(null);
  const [loadingRewards, setLoadingRewards] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadMemberships();
    }
  }, [user]);

  const loadMemberships = async () => {
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

      const { data, error } = await supabase
        .from('member_memberships')
        .select(`
          *,
          membership_programs (
            id,
            name,
            description,
            tier_level,
            benefits,
            validity_days,
            max_rewards_total,
            max_rewards_per_brand
          )
        `)
        .in('member_id', memberIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const membershipsWithClients = await Promise.all((data || []).map(async (membership: any) => {
        const memberUser = memberDataList.find(m => m.id === membership.member_id);

        const { data: statsData } = await supabase
          .from('member_rewards_allocation')
          .select('quantity_allocated, quantity_redeemed')
          .eq('membership_id', membership.id);

        const stats: RewardStats = {
          total_allocated: statsData?.reduce((sum, item) => sum + item.quantity_allocated, 0) || 0,
          total_redeemed: statsData?.reduce((sum, item) => sum + item.quantity_redeemed, 0) || 0,
          total_available: 0
        };
        stats.total_available = stats.total_allocated - stats.total_redeemed;

        return {
          ...membership,
          client: memberUser?.client || { id: '', name: 'Unknown', logo_url: null, primary_color: '#3B82F6' },
          reward_stats: stats
        };
      }));

      setMemberships(membershipsWithClients);
    } catch (error) {
      console.error('Error loading memberships:', error);
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
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const toggleMembershipRewards = async (membershipId: string) => {
    if (expandedMembership === membershipId) {
      setExpandedMembership(null);
      return;
    }

    setExpandedMembership(membershipId);

    const membership = memberships.find(m => m.id === membershipId);
    if (!membership || membership.rewards) return;

    setLoadingRewards(membershipId);
    try {
      const { data: programRewards, error } = await supabase
        .from('membership_program_rewards')
        .select(`
          rewards (
            id,
            title,
            description,
            image_url,
            brands (
              name,
              logo_url
            )
          )
        `)
        .eq('program_id', membership.membership_programs.id);

      if (error) throw error;

      const rewards = (programRewards || [])
        .map((pr: any) => pr.rewards)
        .filter((r: any) => r !== null);

      setMemberships(prev => prev.map(m =>
        m.id === membershipId ? { ...m, rewards } : m
      ));
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoadingRewards(null);
    }
  };

  return (
    <DashboardLayout menuItems={memberMenuItems} title="My Memberships">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Memberships</h1>
          <p className="text-gray-600 mt-2">View and manage your membership programs</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : memberships.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No Active Memberships</p>
              <p className="text-sm text-gray-500">You don't have any memberships yet</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {memberships.map((membership) => {
              const daysRemaining = getDaysRemaining(membership.expires_at);
              const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;

              return (
                <Card key={membership.id}>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                      {membership.client.logo_url ? (
                        <img src={membership.client.logo_url} alt={membership.client.name} className="h-10" />
                      ) : (
                        <Building2 className="h-10 w-10" style={{ color: membership.client.primary_color }} />
                      )}
                      <div>
                        <p className="text-sm text-gray-500">Member of</p>
                        <p className="font-semibold text-gray-900">{membership.client.name}</p>
                      </div>
                    </div>

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-2xl font-bold text-gray-900">
                            {membership.membership_programs.name}
                          </h2>
                          {membership.membership_programs.tier_level && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 uppercase">
                              {membership.membership_programs.tier_level}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600">{membership.membership_programs.description}</p>
                      </div>
                      {getStatusBadge(membership.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Activated</span>
                        </div>
                        <p className="text-gray-900">
                          {membership.activated_at
                            ? new Date(membership.activated_at).toLocaleDateString()
                            : 'Pending'}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Expires</span>
                        </div>
                        <p className={`${isExpiringSoon ? 'text-orange-600 font-medium' : 'text-gray-900'}`}>
                          {membership.expires_at
                            ? new Date(membership.expires_at).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>

                      {daysRemaining !== null && daysRemaining > 0 && (
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="font-medium">Days Remaining</span>
                          </div>
                          <p className={`text-2xl font-bold ${isExpiringSoon ? 'text-orange-600' : 'text-gray-900'}`}>
                            {daysRemaining}
                          </p>
                        </div>
                      )}
                    </div>

                    {membership.reward_stats && (
                      <div className="border-t border-gray-200 pt-4 mb-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Ticket className="w-5 h-5 text-blue-600" />
                          Rewards Summary
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-600 mb-1">Total Allocated</p>
                            <p className="text-2xl font-bold text-blue-900">{membership.reward_stats.total_allocated}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-green-600 mb-1">Available</p>
                            <p className="text-2xl font-bold text-green-900">{membership.reward_stats.total_available}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">Redeemed</p>
                            <p className="text-2xl font-bold text-gray-900">{membership.reward_stats.total_redeemed}</p>
                          </div>
                        </div>
                        {membership.membership_programs.max_rewards_total && (
                          <p className="text-xs text-gray-500 mt-2">
                            Maximum {membership.membership_programs.max_rewards_total} rewards per membership
                            {membership.membership_programs.max_rewards_per_brand &&
                              ` (up to ${membership.membership_programs.max_rewards_per_brand} per brand)`}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="border-t border-gray-200 pt-4">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => toggleMembershipRewards(membership.id)}
                      >
                        {expandedMembership === membership.id ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-2" />
                            Hide Rewards
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-2" />
                            View All Rewards in Membership
                          </>
                        )}
                      </Button>
                    </div>

                    {expandedMembership === membership.id && (
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        {loadingRewards === membership.id ? (
                          <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                          </div>
                        ) : membership.rewards && membership.rewards.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {membership.rewards.map((reward) => (
                              <div key={reward.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                {reward.image_url ? (
                                  <img src={reward.image_url} alt={reward.title} className="w-16 h-16 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center flex-shrink-0">
                                    <Gift className="w-8 h-8 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-gray-900 text-sm mb-1 truncate">{reward.title}</h4>
                                  <p className="text-xs text-gray-600 line-clamp-2">{reward.description}</p>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Award className="w-3 h-3 text-gray-500" />
                                    <span className="text-xs text-gray-500">{reward.brands.name}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-gray-500 py-4">No rewards available</p>
                        )}
                      </div>
                    )}

                    {membership.membership_programs.benefits && membership.membership_programs.benefits.length > 0 && (
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Gift className="w-5 h-5 text-blue-600" />
                          Membership Benefits
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {membership.membership_programs.benefits.map((benefit, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
