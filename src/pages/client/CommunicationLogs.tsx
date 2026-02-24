import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { Mail, MessageSquare, Phone, CheckCircle, XCircle, Clock, Send, RefreshCw, Copy } from 'lucide-react';

interface CommunicationLog {
  id: string;
  member_id: string;
  campaign_rule_id: string;
  communication_type: 'email' | 'sms' | 'whatsapp';
  recipient_email: string | null;
  recipient_phone: string | null;
  subject: string;
  message_body: string;
  personalized_url: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'clicked';
  sent_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  created_at: string;
  metadata: any;
  member_users: {
    full_name: string;
  };
  campaign_rules: {
    name: string;
  } | null;
}

export default function CommunicationLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.client_id) {
      fetchLogs();
    }
  }, [profile?.client_id, filter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('communication_logs')
        .select(`
          *,
          member_users (full_name),
          campaign_rules (name)
        `)
        .eq('client_id', profile?.client_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching communication logs:', error);
      alert('Failed to fetch communication logs');
    } finally {
      setLoading(false);
    }
  };

  const sendCommunication = async (communicationId: string) => {
    try {
      setSending(communicationId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign-communication`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ communication_id: communicationId }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to send communication');
      }

      alert('Communication sent successfully!');
      fetchLogs();
    } catch (error: any) {
      console.error('Error sending communication:', error);
      alert(`Failed to send: ${error.message}`);
    } finally {
      setSending(null);
    }
  };

  const sendBatchCommunications = async () => {
    if (!confirm('Send all pending communications?')) return;

    try {
      setSending('batch');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign-communication`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ batch_send: true }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error('Failed to send batch communications');
      }

      alert(`Sent ${result.processed} communications`);
      fetchLogs();
    } catch (error: any) {
      console.error('Error sending batch:', error);
      alert(`Failed to send batch: ${error.message}`);
    } finally {
      setSending(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'clicked':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'pending':
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-5 w-5 text-blue-600" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5 text-green-600" />;
      case 'whatsapp':
        return <Phone className="h-5 w-5 text-green-600" />;
      default:
        return <Mail className="h-5 w-5 text-gray-600" />;
    }
  };

  const copyLinkToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pendingCount = logs.filter(log => log.status === 'pending').length;

  return (
    <DashboardLayout
      menuItems={clientMenuItems}
      title="Communication Logs"
      subtitle="Track all communications sent to members"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['all', 'pending', 'sent', 'failed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending' && pendingCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-white text-blue-600 rounded-full text-xs">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {pendingCount > 0 && (
              <button
                onClick={sendBatchCommunications}
                disabled={sending === 'batch'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send All Pending ({pendingCount})
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading communications...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No communications found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Recipient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Campaign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(log.communication_type)}
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {log.communication_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {log.member_users?.full_name || 'Unknown'}
                          </div>
                          <div className="text-gray-500">
                            {log.recipient_email || log.recipient_phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {log.campaign_rules?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {log.subject}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {log.status}
                          </span>
                        </div>
                        {log.error_message && (
                          <div className="text-xs text-red-600 mt-1">
                            {log.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.sent_at || log.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-y-2">
                        {log.status === 'pending' && (
                          <button
                            onClick={() => sendCommunication(log.id)}
                            disabled={sending === log.id}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 w-full justify-center"
                          >
                            {sending === log.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            Send
                          </button>
                        )}
                        {log.personalized_url && (
                          <button
                            onClick={() => copyLinkToClipboard(log.personalized_url, log.id)}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors w-full justify-center"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedId === log.id ? 'Copied!' : 'Copy Link'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
