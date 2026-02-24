import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface Transaction {
  id: string;
  created_at: string;
  member_email: string;
  member_name: string;
  transaction_type: string;
  points_amount: number;
  balance_after: number;
  description: string;
  order_id: string | null;
  order_amount: number | null;
  transaction_reference_id: string | null;
}

export function LoyaltyTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string>('');
  const [loyaltyProgramId, setLoyaltyProgramId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalRedeemed: 0,
    totalExpired: 0,
    netPoints: 0,
  });

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
      loadTransactions();
    }
  }, [loyaltyProgramId, filterType, dateRange]);

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

  const loadTransactions = async () => {
    try {
      setLoading(true);

      // Calculate date filter
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      let query = supabase
        .from('loyalty_points_transactions')
        .select(`
          id,
          created_at,
          transaction_type,
          points_amount,
          balance_after,
          description,
          order_id,
          order_amount,
          transaction_reference_id,
          member_users!inner(
            email,
            full_name
          ),
          member_loyalty_status!inner(
            loyalty_program_id
          )
        `)
        .eq('member_loyalty_status.loyalty_program_id', loyaltyProgramId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('transaction_type', filterType);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedTransactions: Transaction[] = (data || []).map((txn: any) => ({
        id: txn.id,
        created_at: txn.created_at,
        member_email: txn.member_users.email,
        member_name: txn.member_users.full_name,
        transaction_type: txn.transaction_type,
        points_amount: txn.points_amount,
        balance_after: txn.balance_after,
        description: txn.description,
        order_id: txn.order_id,
        order_amount: txn.order_amount,
        transaction_reference_id: txn.transaction_reference_id,
      }));

      setTransactions(formattedTransactions);

      // Calculate stats
      const earned = formattedTransactions
        .filter(t => ['earn', 'earned', 'bonus'].includes(t.transaction_type))
        .reduce((sum, t) => sum + Math.abs(t.points_amount), 0);

      const redeemed = formattedTransactions
        .filter(t => ['redeem', 'redeemed'].includes(t.transaction_type))
        .reduce((sum, t) => sum + Math.abs(t.points_amount), 0);

      const expired = formattedTransactions
        .filter(t => ['expire', 'expired'].includes(t.transaction_type))
        .reduce((sum, t) => sum + Math.abs(t.points_amount), 0);

      setStats({
        totalEarned: earned,
        totalRedeemed: redeemed,
        totalExpired: expired,
        netPoints: earned - redeemed - expired,
      });
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Transaction ID', 'Member', 'Email', 'Type', 'Points', 'Balance After', 'Description', 'Order ID'];
    const rows = transactions.map(txn => [
      new Date(txn.created_at).toLocaleString(),
      txn.transaction_reference_id || 'N/A',
      txn.member_name,
      txn.member_email,
      txn.transaction_type,
      txn.points_amount,
      txn.balance_after,
      txn.description,
      txn.order_id || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loyalty-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredTransactions = transactions;

  return (
    <DashboardLayout menuItems={clientMenuItems}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Loyalty Transactions</h1>
            <p className="text-gray-600 mt-1">View all points activity across your loyalty program</p>
          </div>
          <Button onClick={exportToCSV} className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Earned</p>
                  <p className="text-2xl font-bold text-green-600">+{stats.totalEarned.toLocaleString()}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Redeemed</p>
                  <p className="text-2xl font-bold text-blue-600">-{stats.totalRedeemed.toLocaleString()}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Expired</p>
                  <p className="text-2xl font-bold text-red-600">-{stats.totalExpired.toLocaleString()}</p>
                </div>
                <div className="bg-red-100 p-3 rounded-lg">
                  <Calendar className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Net Points</p>
                  <p className={`text-2xl font-bold ${stats.netPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.netPoints >= 0 ? '+' : ''}{stats.netPoints.toLocaleString()}
                  </p>
                </div>
                <div className={`${stats.netPoints >= 0 ? 'bg-green-100' : 'bg-red-100'} p-3 rounded-lg`}>
                  <Filter className={`h-6 w-6 ${stats.netPoints >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="earned">Earned</option>
                  <option value="redeemed">Redeemed</option>
                  <option value="expired">Expired</option>
                  <option value="adjusted">Adjustments</option>
                  <option value="bonus">Bonus</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="365">Last year</option>
                  <option value="3650">All time</option>
                </select>
              </div>

              <div className="flex-1"></div>

              <div className="flex items-end">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold">{filteredTransactions.length}</span> transactions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading transactions...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
                <p className="text-gray-600">No transactions match your current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Transaction ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Date & Time</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Member</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Points</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Balance After</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-blue-600 font-semibold">
                            {txn.transaction_reference_id || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(txn.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{txn.member_name}</div>
                            <div className="text-xs text-gray-500">{txn.member_email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            ['earn', 'earned', 'bonus'].includes(txn.transaction_type)
                              ? 'bg-green-100 text-green-800'
                              : ['redeem', 'redeemed'].includes(txn.transaction_type)
                              ? 'bg-blue-100 text-blue-800'
                              : ['expire', 'expired'].includes(txn.transaction_type)
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {txn.transaction_type}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${
                          txn.points_amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {txn.points_amount >= 0 ? '+' : ''}{txn.points_amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-900">
                          {txn.balance_after.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {txn.description || 'No description'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {txn.order_id ? (
                            <span className="font-mono text-xs">#{txn.order_id.slice(0, 8)}...</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
