import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Download,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';

interface ClientRow {
  id: string;
  name: string;
  slug: string;
}

interface SubscriptionRow {
  client_id: string;
  plan_id: string;
  status: SubStatus;
  billing_cycle: 'monthly' | 'annual';
  amount_inr: number | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
}

interface EnrichedSub extends SubscriptionRow {
  client_name: string;
  client_slug: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<SubStatus, { label: string; cls: string; icon: JSX.Element }> = {
  trialing:  { label: 'Trial',     cls: 'bg-yellow-100 text-yellow-800',  icon: <Clock className="w-3.5 h-3.5" /> },
  active:    { label: 'Active',    cls: 'bg-green-100 text-green-800',    icon: <CheckCircle className="w-3.5 h-3.5" /> },
  past_due:  { label: 'Past Due',  cls: 'bg-orange-100 text-orange-800',  icon: <AlertCircle className="w-3.5 h-3.5" /> },
  suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-800',        icon: <XCircle className="w-3.5 h-3.5" /> },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600',      icon: <XCircle className="w-3.5 h-3.5" /> },
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminBilling() {
  const [subs, setSubs] = useState<EnrichedSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientsRes, subsRes] = await Promise.all([
        supabase.from('clients').select('id, name, slug'),
        supabase.from('client_subscriptions').select('*'),
      ]);

      const clientMap = new Map<string, ClientRow>(
        ((clientsRes.data || []) as ClientRow[]).map(c => [c.id, c])
      );

      const enriched: EnrichedSub[] = ((subsRes.data || []) as SubscriptionRow[]).map(s => ({
        ...s,
        client_name: clientMap.get(s.client_id)?.name ?? s.client_id,
        client_slug: clientMap.get(s.client_id)?.slug ?? '',
      }));

      setSubs(enriched);
    } catch {
      setError('Failed to load billing data.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived metrics ──────────────────────────────────────────────────────

  const activeSubs = subs.filter(s => s.status === 'active');
  const trialSubs  = subs.filter(s => s.status === 'trialing');
  const overdueSubs = subs.filter(s => s.status === 'past_due');
  const mrr = activeSubs.reduce((acc, s) => {
    const amt = s.amount_inr ?? 0;
    return acc + (s.billing_cycle === 'annual' ? Math.round(amt / 12) : amt);
  }, 0);
  const arr = mrr * 12;

  const filtered = subs.filter(s =>
    !search || s.client_name.toLowerCase().includes(search.toLowerCase())
  );

  const metrics = [
    { label: 'MRR', value: `₹${mrr.toLocaleString('en-IN')}`, icon: <TrendingUp className="w-6 h-6 text-violet-600" />, bg: 'bg-violet-50' },
    { label: 'ARR', value: `₹${arr.toLocaleString('en-IN')}`, icon: <TrendingUp className="w-6 h-6 text-indigo-600" />, bg: 'bg-indigo-50' },
    { label: 'Active clients', value: activeSubs.length.toString(), icon: <CheckCircle className="w-6 h-6 text-green-600" />, bg: 'bg-green-50' },
    { label: 'In trial', value: trialSubs.length.toString(), icon: <Clock className="w-6 h-6 text-yellow-600" />, bg: 'bg-yellow-50' },
    { label: 'Past due', value: overdueSubs.length.toString(), icon: <AlertCircle className="w-6 h-6 text-orange-600" />, bg: 'bg-orange-50' },
    { label: 'Total clients', value: subs.length.toString(), icon: <Users className="w-6 h-6 text-gray-500" />, bg: 'bg-gray-50' },
  ];

  function exportCSV() {
    const header = ['Client', 'Plan', 'Status', 'Billing', 'Amount (₹)', 'Renewal'];
    const rows = filtered.map(s => [
      s.client_name,
      s.plan_id,
      s.status,
      s.billing_cycle,
      s.amount_inr ?? 0,
      fmt(s.current_period_end),
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Billing">
      <div className="space-y-6 max-w-6xl">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing Overview</h1>
            <p className="text-sm text-gray-500 mt-0.5">All client subscriptions and revenue</p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Metric cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map(m => (
            <Card key={m.label} padding="none">
              <div className="p-4">
                <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center mb-3`}>
                  {m.icon}
                </div>
                <div className="text-xl font-bold text-gray-900">{loading ? '—' : m.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{m.label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Subscriptions table ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              Client subscriptions
            </h2>
            <input
              type="text"
              placeholder="Search client…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-violet-300 w-48"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
              <div className="w-7 h-7 border-2 border-t-violet-600 border-gray-200 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 text-sm text-gray-400">
              No subscriptions found.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Client</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Plan</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Billing</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Renewal</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(s => {
                    const stCfg = STATUS_LABELS[s.status] ?? STATUS_LABELS.active;
                    return (
                      <tr key={s.client_id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{s.client_name}</td>
                        <td className="px-5 py-3.5 capitalize text-gray-700">{s.plan_id}</td>
                        <td className="px-5 py-3.5">
                          <span className={`flex items-center gap-1 w-fit px-2.5 py-1 rounded-full text-xs font-medium ${stCfg.cls}`}>
                            {stCfg.icon}
                            {stCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 capitalize">{s.billing_cycle}</td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">
                          {s.amount_inr != null && s.amount_inr > 0
                            ? `₹${s.amount_inr.toLocaleString('en-IN')}`
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 text-xs">
                          {s.status === 'trialing' ? fmt(s.trial_ends_at) : fmt(s.current_period_end)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to={`/admin/clients/${s.client_id}/subscription`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
                          >
                            Manage
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
