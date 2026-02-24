import { useEffect, useState } from 'react';
import { Gift, Award, CheckCircle, ExternalLink, Building2, Settings, Ticket } from 'lucide-react';
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

interface RewardAllocation {
  id: string;
  member_id: string;
  quantity_allocated: number;
  quantity_redeemed: number;
  allocated_at: string;
  expires_at: string | null;
  client: Client;
  membership_programs?: {
    name: string;
    tier_level: string | null;
  };
  rewards: {
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    reward_type: string | null;
    discount_value: number | null;
    currency: string;
    redemption_link: string | null;
    brands: {
      name: string;
      logo_url: string | null;
    };
  };
}

export function MemberRewards() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<RewardAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadRewards();
    }
  }, [user]);

  const loadRewards = async () => {
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
        .from('member_rewards_allocation')
        .select(`
          *,
          rewards (
            id,
            title,
            description,
            image_url,
            reward_type,
            discount_value,
            currency,
            redemption_link,
            brands (
              name,
              logo_url
            )
          ),
          member_memberships!member_rewards_allocation_membership_id_fkey (
            membership_programs (
              name,
              tier_level
            )
          )
        `)
        .in('member_id', memberIds)
        .order('allocated_at', { ascending: false });

      if (error) throw error;

      const allocationsWithClients = (data || []).map((allocation: any) => {
        const memberUser = memberDataList.find(m => m.id === allocation.member_id);
        return {
          ...allocation,
          client: memberUser?.client || { id: '', name: 'Unknown', logo_url: null, primary_color: '#3B82F6' },
          membership_programs: allocation.member_memberships?.membership_programs || null
        };
      });

      setAllocations(allocationsWithClients);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRewardTypeDisplay = (type: string | null, value: number | null, currency: string) => {
    if (!type || !value) return null;

    const displays: any = {
      flat_discount: `${currency} ${value} OFF`,
      percentage_discount: `${value}% OFF`,
      upto_discount: `Up to ${currency} ${value} OFF`,
      fixed_value: `${currency} ${value} Value`,
      free_item: 'Free Item',
    };

    return displays[type] || null;
  };

  const handleRedeem = async (allocationId: string, memberId: string) => {
    setRedeeming(allocationId);
    try {
      const { data, error } = await supabase.rpc('redeem_reward', {
        p_allocation_id: allocationId,
        p_member_id: memberId
      });

      if (error) throw error;

      alert('Reward redeemed successfully! Check your vouchers to see your code.');
      await loadRewards();
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      alert(error.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <DashboardLayout menuItems={memberMenuItems} title="Available Rewards">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Available Rewards</h1>
          <p className="text-gray-600 mt-2">Browse and redeem your allocated rewards</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : allocations.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No Rewards Available</p>
              <p className="text-sm text-gray-500">You don't have any rewards allocated yet</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allocations.map((allocation) => {
              const available = allocation.quantity_allocated - allocation.quantity_redeemed;
              const isExpired = allocation.expires_at && new Date(allocation.expires_at) < new Date();

              return (
                <Card key={allocation.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    {allocation.rewards.image_url ? (
                      <img
                        src={allocation.rewards.image_url}
                        alt={allocation.rewards.title}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Gift className="w-16 h-16 text-white" />
                      </div>
                    )}
                    {getRewardTypeDisplay(
                      allocation.rewards.reward_type,
                      allocation.rewards.discount_value,
                      allocation.rewards.currency
                    ) && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {getRewardTypeDisplay(
                          allocation.rewards.reward_type,
                          allocation.rewards.discount_value,
                          allocation.rewards.currency
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: `${allocation.client.primary_color}20`, color: allocation.client.primary_color }}>
                        {allocation.client.name}
                      </span>
                      {allocation.membership_programs && (
                        <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          {allocation.membership_programs.name}
                          {allocation.membership_programs.tier_level && ` - ${allocation.membership_programs.tier_level.toUpperCase()}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 mb-1">
                          {allocation.rewards.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          {allocation.rewards.brands.logo_url ? (
                            <img
                              src={allocation.rewards.brands.logo_url}
                              alt={allocation.rewards.brands.name}
                              className="w-4 h-4 rounded"
                            />
                          ) : (
                            <Award className="w-4 h-4" />
                          )}
                          <span>{allocation.rewards.brands.name}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {allocation.rewards.description}
                    </p>

                    <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-600">Available</p>
                        <p className="text-2xl font-bold text-gray-900">{available}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Allocated</p>
                        <p className="text-lg font-semibold text-gray-700">{allocation.quantity_allocated}</p>
                      </div>
                    </div>

                    {allocation.expires_at && (
                      <p className={`text-xs mb-4 ${isExpired ? 'text-red-600' : 'text-gray-500'}`}>
                        {isExpired ? 'Expired' : 'Expires'}: {new Date(allocation.expires_at).toLocaleDateString()}
                      </p>
                    )}

                    <Button
                      className="w-full"
                      disabled={available === 0 || isExpired || redeeming === allocation.id}
                      onClick={() => handleRedeem(allocation.id, allocation.member_id)}
                    >
                      <Ticket className="w-4 h-4 mr-2" />
                      {redeeming === allocation.id ? 'Redeeming...' : 'Redeem Reward'}
                    </Button>
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
