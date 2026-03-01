import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Download, Filter, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';

interface Transaction {
  transaction_id: string;
  transaction_date: string;
  transaction_type: 'issued' | 'redeemed';
  member_id: string;
  member_name: string;
  member_email: string;
  client_id: string;
  client_name: string;
  reward_id: string;
  reward_title: string;
  reward_code: string;
  brand_id: string;
  brand_name: string;
  voucher_id: string;
  voucher_code: string;
  voucher_status: string;
  voucher_expires_at: string | null;
  issued_by_email: string | null;
  issued_by_type: string | null;
  issuance_channel: string | null;
  reward_type: string | null;
  discount_value: number | null;
  currency: string;
  redeemed_at: string | null;
}

interface ClientSummary {
  client_id: string;
  client_name: string;
  total_issued: number;
  total_redeemed: number;
  unique_members: number;
  unique_rewards: number;
  unique_brands: number;
  first_transaction: string;
  last_transaction: string;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clientSummaries, setClientSummaries] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: 'all',
    client: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });

  const [stats, setStats] = useState({
    totalIssued: 0,
    totalRedeemed: 0,
    redemptionRate: 0,
    activeMembers: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [transactionsRes, summariesRes] = await Promise.all([
        supabase
          .from('transaction_summary_view')
          .select('*')
          .order('transaction_date', { ascending: false }),
        supabase
          .from('client_transaction_summary')
          .select('*')
          .order('total_redeemed', { ascending: false })
      ]);

      if (transactionsRes.data) {
        setTransactions(transactionsRes.data);
        calculateStats(transactionsRes.data);
      }
      if (summariesRes.data) {
        setClientSummaries(summariesRes.data);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Transaction[]) => {
    const issued = data.filter(t => t.transaction_type === 'issued').length;
    const redeemed = data.filter(t => t.transaction_type === 'redeemed').length;
    const uniqueMembers = new Set(data.map(t => t.member_id)).size;

    setStats({
      totalIssued: issued,
      totalRedeemed: redeemed,
      redemptionRate: issued > 0 ? (redeemed / issued) * 100 : 0,
      activeMembers: uniqueMembers
    });
  };

  const filteredTransactions = transactions.filter(t => {
    if (filter.type !== 'all' && t.transaction_type !== filter.type) return false;
    if (filter.client !== 'all' && t.client_id !== filter.client) return false;
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      return (
        t.member_name.toLowerCase().includes(term) ||
        t.member_email.toLowerCase().includes(term) ||
        t.reward_title.toLowerCase().includes(term) ||
        t.voucher_code.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Member', 'Email', 'Client', 'Reward', 'Voucher Code', 'Status', 'Brand'];
    const rows = filteredTransactions.map(t => [
      new Date(t.transaction_date).toLocaleDateString(),
      t.transaction_type,
      t.member_name,
      t.member_email,
      t.client_name,
      t.reward_title,
      t.voucher_code,
      t.voucher_status,
      t.brand_name
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const uniqueClients = Array.from(new Set(transactions.map(t => ({ id: t.client_id, name: t.client_name }))));

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Transactions">
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading transactions...</div>
        </div>
      ) : (<>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaction Analytics</h1>
          <p className="text-gray-600 mt-1">Track reward issuances and redemptions</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Issued</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalIssued.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Redeemed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRedeemed.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Redemption Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.redemptionRate.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Members</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeMembers.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Redeemed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rewards</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brands</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clientSummaries.map((summary) => (
                  <tr key={summary.client_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{summary.client_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{summary.total_issued.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{summary.total_redeemed.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {summary.total_issued > 0 ? ((summary.total_redeemed / summary.total_issued) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{summary.unique_members.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{summary.unique_rewards.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{summary.unique_brands.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
            <div className="flex gap-2">
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Types</option>
                <option value="issued">Issued</option>
                <option value="redeemed">Redeemed</option>
              </select>
              <select
                value={filter.client}
                onChange={(e) => setFilter({ ...filter, client: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Clients</option>
                {uniqueClients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search..."
                value={filter.searchTerm}
                onChange={(e) => setFilter({ ...filter, searchTerm: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.transaction_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.transaction_type === 'issued'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {transaction.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{transaction.member_name}</div>
                      <div className="text-xs text-gray-500">{transaction.member_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{transaction.client_name}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{transaction.reward_title}</div>
                      <div className="text-xs text-gray-500">{transaction.reward_code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{transaction.voucher_code}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.voucher_status === 'available'
                          ? 'bg-green-100 text-green-800'
                          : transaction.voucher_status === 'redeemed'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.voucher_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{transaction.brand_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions found matching your filters</p>
            </div>
          )}
        </div>
      </Card>
    </>)}
    </div>
    </DashboardLayout>
  );
}
