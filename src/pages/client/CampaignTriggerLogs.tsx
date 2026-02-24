import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, CheckCircle, XCircle, Clock, Users, TrendingUp, Filter } from 'lucide-react';

interface CampaignTriggerLog {
  id: string;
  campaign_rule_id: string;
  order_id: string;
  order_number: string;
  order_value: number;
  trigger_result: string;
  member_id: string | null;
  membership_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  reason: string;
  metadata: any;
  created_at: string;
  campaign_rules: {
    name: string;
  } | null;
}

export default function CampaignTriggerLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<CampaignTriggerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterResult, setFilterResult] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    no_member: 0,
    already_enrolled: 0,
    max_reached: 0,
    below_threshold: 0,
  });

  useEffect(() => {
    if (profile?.client_id) {
      fetchLogs();
    }
  }, [profile?.client_id, filterResult]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('campaign_trigger_logs')
        .select('*, campaign_rules(name)')
        .eq('client_id', profile!.client_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterResult !== 'all') {
        query = query.eq('trigger_result', filterResult);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);

      const statsQuery = await supabase
        .from('campaign_trigger_logs')
        .select('trigger_result')
        .eq('client_id', profile!.client_id);

      if (statsQuery.data) {
        const newStats = {
          total: statsQuery.data.length,
          success: statsQuery.data.filter(l => l.trigger_result === 'success').length,
          failed: statsQuery.data.filter(l => l.trigger_result === 'failed').length,
          no_member: statsQuery.data.filter(l => l.trigger_result === 'no_member').length,
          already_enrolled: statsQuery.data.filter(l => l.trigger_result === 'already_enrolled').length,
          max_reached: statsQuery.data.filter(l => l.trigger_result === 'max_reached').length,
          below_threshold: statsQuery.data.filter(l => l.trigger_result === 'below_threshold').length,
        };
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'no_member':
        return <Users className="w-5 h-5 text-orange-600" />;
      case 'already_enrolled':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'max_reached':
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
      case 'below_threshold':
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getResultBadgeColor = (result: string) => {
    switch (result) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'no_member':
        return 'bg-orange-100 text-orange-800';
      case 'already_enrolled':
        return 'bg-blue-100 text-blue-800';
      case 'max_reached':
        return 'bg-purple-100 text-purple-800';
      case 'below_threshold':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatResult = (result: string) => {
    return result.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.order_number?.toLowerCase().includes(search) ||
      log.customer_email?.toLowerCase().includes(search) ||
      log.customer_phone?.toLowerCase().includes(search) ||
      log.campaign_rules?.name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading campaign trigger logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Campaign Trigger Logs</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track all campaign trigger attempts and their outcomes
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Triggers</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Successful</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.success}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-orange-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">No Member</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.no_member}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Failed</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.failed}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by order, email, phone, or campaign..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
                className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="all">All Results</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="no_member">No Member</option>
                <option value="already_enrolled">Already Enrolled</option>
                <option value="max_reached">Max Reached</option>
                <option value="below_threshold">Below Threshold</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Result
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    No campaign trigger logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getResultIcon(log.trigger_result)}
                        <span className={`ml-2 px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getResultBadgeColor(log.trigger_result)}`}>
                          {formatResult(log.trigger_result)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {log.campaign_rules?.name || 'Unknown Campaign'}
                      </div>
                      {log.metadata?.min_order_value && (
                        <div className="text-xs text-gray-500">
                          Min: ${log.metadata.min_order_value}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">#{log.order_number}</div>
                      <div className="text-xs text-gray-500">{log.order_id?.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {log.customer_email || 'No email'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {log.customer_phone || 'No phone'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${log.order_value?.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate" title={log.reason}>
                        {log.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
