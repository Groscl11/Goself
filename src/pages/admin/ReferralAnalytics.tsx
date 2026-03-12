import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Users, UserCheck, ShoppingCart, ArrowUpRight } from 'lucide-react';

interface Client { id: string; name: string; }
interface ReferralRow {
  id: string;
  referrer_name: string | null;
  referrer_email: string | null;
  referee_name: string | null;
  referee_email: string | null;
  client_name: string | null;
  status: 'pending' | 'signup_rewarded' | 'completed' | 'expired' | 'cancelled';
  created_at: string;
  completed_at: string | null;
}

const STATUS_STYLES: Record<ReferralRow['status'], string> = {
  pending:          'bg-blue-50   text-blue-700   border-blue-200',
  signup_rewarded:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  completed:        'bg-green-50  text-green-700  border-green-200',
  expired:          'bg-gray-100  text-gray-500   border-gray-200',
  cancelled:        'bg-red-50    text-red-700    border-red-200',
};

const STATUS_LABELS: Record<ReferralRow['status'], string> = {
  pending:         'Pending',
  signup_rewarded: 'Signed Up',
  completed:       'Completed',
  expired:         'Expired',
  cancelled:       'Cancelled',
};

export function ReferralAnalytics() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      if (data) setClients(data);
    });
    fetchReferrals('');
  }, []);

  async function fetchReferrals(clientId: string) {
    setLoading(true);
    let query = supabase
      .from('member_referrals')
      .select(`
        id, status, created_at, completed_at,
        referrer:member_users!referrer_id(full_name, email, clients(name)),
        referee:member_users!referee_id(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (clientId) {
      // filter by the referrer's client
      query = query.eq('member_users!referrer_id.client_id', clientId);
    }

    const { data } = await query;

    setRows((data || []).map((r: any) => ({
      id: r.id,
      referrer_name: r.referrer?.full_name || null,
      referrer_email: r.referrer?.email || null,
      referee_name: r.referee?.full_name || null,
      referee_email: r.referee?.email || null,
      client_name: r.referrer?.clients?.name || null,
      status: r.status as ReferralRow['status'],
      created_at: r.created_at,
      completed_at: r.completed_at,
    })));
    setLoading(false);
  }

  function handleClientChange(id: string) {
    setSelectedClient(id);
    fetchReferrals(id);
  }

  const total      = rows.length;
  const signedUp   = rows.filter(r => r.status !== 'pending' && r.status !== 'cancelled').length;
  const completed  = rows.filter(r => r.status === 'completed').length;
  const convRate   = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

  const statCards = [
    { label: 'Total Referrals', value: total, icon: Users, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Signed Up', value: signedUp, icon: UserCheck, color: 'bg-yellow-100 text-yellow-600' },
    { label: 'Completed', value: completed, icon: ShoppingCart, color: 'bg-green-100 text-green-600' },
    { label: 'Conversion Rate', value: `${convRate}%`, icon: ArrowUpRight, color: 'bg-teal-100 text-teal-600' },
  ];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Referral Analytics">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Referral Analytics</h1>
              <p className="text-sm text-gray-500">Track referral performance across all clients</p>
            </div>
          </div>
          {/* Client filter */}
          <select
            value={selectedClient}
            onChange={e => handleClientChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-44"
          >
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map(card => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Referral funnel indicator */}
        {total > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Referral Funnel</h3>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex-1 bg-indigo-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '100%' }} />
              </div>
              <span className="text-gray-500 w-20 text-right">{total} referred</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-2">
              <div className="flex-1 bg-yellow-100 rounded-full h-2">
                <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${total > 0 ? (signedUp / total) * 100 : 0}%` }} />
              </div>
              <span className="text-gray-500 w-20 text-right">{signedUp} signed up</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-2">
              <div className="flex-1 bg-green-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
              </div>
              <span className="text-gray-500 w-20 text-right">{completed} ordered</span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No referrals found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600">Referrer</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Referee</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Client</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Referred On</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.referrer_name || '—'}</div>
                        {r.referrer_email && <div className="text-xs text-gray-400">{r.referrer_email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.referee_name || '—'}</div>
                        {r.referee_email && <div className="text-xs text-gray-400">{r.referee_email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {r.client_name ? (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2 py-0.5 rounded-full font-medium">
                            {r.client_name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[r.status]}`}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.completed_at
                          ? new Date(r.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
