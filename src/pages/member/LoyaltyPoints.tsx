import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { TrendingUp, TrendingDown, Award, Calendar, Receipt } from 'lucide-react';

interface LoyaltyStatus {
  id: string;
  points_balance: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  total_orders: number;
  total_spend: number;
  tier_achieved_at: string;
  current_tier: {
    tier_name: string;
    tier_level: number;
    color_code: string;
    benefits_description: string;
    min_orders: number;
    min_spend: number;
    points_earn_rate: number;
    points_earn_divisor: number;
    max_redemption_percent: number;
  };
  loyalty_program: {
    program_name: string;
    points_name: string;
    points_name_singular: string;
    currency: string;
  };
}

interface PointsTransaction {
  id: string;
  transaction_type: string;
  points_amount: number;
  balance_after: number;
  description: string;
  order_amount: number | null;
  created_at: string;
  expires_at: string | null;
}

interface NextTier {
  tier_name: string;
  orders_needed: number;
  spend_needed: number;
}

export default function LoyaltyPoints() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyStatus | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [nextTier, setNextTier] = useState<NextTier | null>(null);

  useEffect(() => {
    loadLoyaltyData();
  }, [user]);

  const loadLoyaltyData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: memberData } = await supabase
        .from('member_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!memberData) {
        setLoading(false);
        return;
      }

      const { data: statusData } = await supabase
        .from('member_loyalty_status')
        .select(`
          *,
          current_tier:loyalty_tiers(*),
          loyalty_program:loyalty_programs(*)
        `)
        .eq('member_user_id', memberData.id)
        .maybeSingle();

      if (statusData) {
        setLoyaltyStatus(statusData as any);
        loadTransactions(statusData.id);
        loadNextTier(statusData);
      }
    } catch (error) {
      console.error('Error loading loyalty data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (statusId: string) => {
    const { data, error } = await supabase
      .from('loyalty_points_transactions')
      .select('*')
      .eq('member_loyalty_status_id', statusId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setTransactions(data);
    if (error) console.error('Error loading transactions:', error);
  };

  const loadNextTier = async (status: any) => {
    try {
      const { data: tiers } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .eq('loyalty_program_id', status.loyalty_program_id)
        .gt('tier_level', status.current_tier?.tier_level || 0)
        .order('tier_level')
        .limit(1);

      if (tiers && tiers.length > 0) {
        const tier = tiers[0];
        const ordersNeeded = Math.max(0, tier.min_orders - status.total_orders);
        const spendNeeded = Math.max(0, tier.min_spend - status.total_spend);
        setNextTier({
          tier_name: tier.tier_name,
          orders_needed: ordersNeeded,
          spend_needed: spendNeeded,
        });
      }
    } catch (error) {
      console.error('Error loading next tier:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned':
      case 'bonus':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'redeemed':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      default:
        return <Receipt className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earned':
      case 'bonus':
        return 'text-green-600';
      case 'redeemed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading your loyalty points...</p>
      </div>
    );
  }

  if (!loyaltyStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <Award className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Loyalty Program</h2>
          <p className="text-gray-600">
            You are not enrolled in any loyalty program yet. Contact your membership provider to get started.
          </p>
        </Card>
      </div>
    );
  }

  const { loyalty_program, current_tier } = loyaltyStatus;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{loyalty_program.program_name}</h1>
          <p className="text-gray-600">Track and manage your loyalty points</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Current Balance</h3>
              <Award className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-4xl font-bold text-gray-900">
              {loyaltyStatus.points_balance.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-1">{loyalty_program.points_name}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lifetime Earned</h3>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-4xl font-bold text-gray-900">
              {loyaltyStatus.lifetime_points_earned.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-1">{loyalty_program.points_name}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lifetime Redeemed</h3>
              <TrendingDown className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-4xl font-bold text-gray-900">
              {loyaltyStatus.lifetime_points_redeemed.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-1">{loyalty_program.points_name}</p>
          </Card>
        </div>

        {current_tier && (
          <Card className="p-6 mb-8" style={{ borderLeftColor: current_tier.color_code, borderLeftWidth: '6px' }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Award className="w-8 h-8" style={{ color: current_tier.color_code }} />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{current_tier.tier_name} Tier</h2>
                    <p className="text-sm text-gray-600">Level {current_tier.tier_level}</p>
                  </div>
                </div>

                {current_tier.benefits_description && (
                  <p className="text-gray-700 mb-4">{current_tier.benefits_description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Earn Rate</p>
                    <p className="font-semibold">
                      {current_tier.points_earn_rate} {loyalty_program.points_name_singular} / {loyalty_program.currency} {current_tier.points_earn_divisor}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Max Redemption</p>
                    <p className="font-semibold">{current_tier.max_redemption_percent}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Orders</p>
                    <p className="font-semibold">{loyaltyStatus.total_orders}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Spend</p>
                    <p className="font-semibold">{loyalty_program.currency} {loyaltyStatus.total_spend.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {nextTier && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Next Tier: {nextTier.tier_name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nextTier.orders_needed > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Orders to go</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (loyaltyStatus.total_orders / (loyaltyStatus.total_orders + nextTier.orders_needed)) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold">{nextTier.orders_needed}</span>
                      </div>
                    </div>
                  )}
                  {nextTier.spend_needed > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Spend to go</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (loyaltyStatus.total_spend / (loyaltyStatus.total_spend + nextTier.spend_needed)) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold">{loyalty_program.currency} {nextTier.spend_needed.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Transaction History</h2>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Receipt className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{transaction.description}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(transaction.created_at)}
                        </span>
                        {transaction.order_amount && (
                          <span>
                            Order: {loyalty_program.currency} {transaction.order_amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {transaction.expires_at && new Date(transaction.expires_at) > new Date() && (
                        <p className="text-xs text-orange-600 mt-1">
                          Expires: {formatDate(transaction.expires_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getTransactionColor(transaction.transaction_type)}`}>
                      {transaction.points_amount > 0 ? '+' : ''}{transaction.points_amount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Balance: {transaction.balance_after.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
