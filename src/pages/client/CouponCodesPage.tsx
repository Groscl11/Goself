import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag, ShoppingBag, TrendingUp, Plus, X, Search, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerType = 'influencer' | 'creator' | 'brand' | 'other';
type CodeStatus = 'active' | 'paused' | 'removed';

interface CodeAssignment {
  id: string;
  code: string;
  discount_description: string | null;
  status: CodeStatus;
  assigned_at: string;
}

interface Partner {
  id: string;
  name: string;
  partner_type: PartnerType;
  status: string;
  affiliate_code_assignments: CodeAssignment[];
}

interface ShopifyOrder {
  shopify_order_id: string;
  customer_email: string;
  total_price: number;
  processed_at: string;
  order_data: {
    discount_codes?: { code: string; amount: string; type: string }[];
  } | null;
}

interface CodeRow {
  code: string;
  partnerName: string;
  partnerType: PartnerType;
  partnerId: string;
  assignmentId: string;
  assignmentStatus: CodeStatus;
  discountDescription: string | null;
  assignedAt: string;
  redemptions: number;
  revenue: number;
  avgOrder: number;
  lastUsed: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-purple-500 to-indigo-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-red-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-lime-500 to-green-600',
];

function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtCurrency(val: number) {
  return `₹${val.toLocaleString('en-IN')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_BADGE: Record<string, string> = {
  influencer: 'bg-pink-100 text-pink-700',
  creator: 'bg-orange-100 text-orange-700',
  brand: 'bg-blue-100 text-blue-700',
  other: 'bg-gray-100 text-gray-600',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Assign Code Drawer ───────────────────────────────────────────────────────

interface AssignDrawerProps {
  clientId: string;
  partners: Partner[];
  onClose: () => void;
  onSaved: () => void;
}

function AssignCodeDrawer({ clientId, partners, onClose, onSaved }: AssignDrawerProps) {
  const [partnerId, setPartnerId] = useState('');
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!partnerId) { setError('Select a partner.'); return; }
    if (!code.trim()) { setError('Enter a discount code.'); return; }
    setSaving(true);
    setError('');
    try {
      const { error: e } = await supabase.from('affiliate_code_assignments').insert({
        partner_id: partnerId,
        client_id: clientId,
        code: code.trim().toUpperCase(),
        code_source: 'manual',
        discount_description: desc || null,
        status: 'active',
      });
      if (e) throw e;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign code.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[440px] bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Assign Code</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Partner *</label>
            <select
              value={partnerId}
              onChange={e => setPartnerId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">Select a partner…</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Discount Code *</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="PARTNER20"
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="e.g. 15% off all orders"
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
            <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-500">
              Manual
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg py-2 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gray-900 text-white text-sm rounded-lg py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Assign Code'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CouponCodesPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? '';

  const [partners, setPartners] = useState<Partner[]>([]);
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'removed'>('all');
  const [showAssignDrawer, setShowAssignDrawer] = useState(false);

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [{ data: partnersData, error: pErr }, { data: ordersData, error: oErr }] =
      await Promise.all([
        supabase
          .from('affiliate_partners')
          .select('id, name, partner_type, status, affiliate_code_assignments(id, code, discount_description, status, assigned_at)')
          .eq('client_id', clientId)
          .neq('status', 'archived')
          .order('name'),
        supabase
          .from('shopify_orders')
          .select('shopify_order_id, customer_email, total_price, processed_at, order_data')
          .eq('client_id', clientId)
          .gte('processed_at', ninetyDaysAgo.toISOString())
          .order('processed_at', { ascending: false })
          .limit(2000),
      ]);

    if (pErr) setError(pErr.message);
    if (oErr) setError(oErr.message);
    setPartners((partnersData as Partner[]) ?? []);
    setOrders((ordersData as ShopifyOrder[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  const allRows = useMemo<CodeRow[]>(() => {
    const rows: CodeRow[] = [];
    for (const partner of partners) {
      for (const assignment of partner.affiliate_code_assignments) {
        const codeUpper = assignment.code.toUpperCase();
        const matchingOrders = orders.filter(o =>
          o.order_data?.discount_codes?.some(dc => dc.code.toUpperCase() === codeUpper)
        );
        const redemptions = matchingOrders.length;
        const revenue = matchingOrders.reduce((s, o) => s + Number(o.total_price), 0);
        const avgOrder = redemptions > 0 ? revenue / redemptions : 0;
        const lastUsed =
          matchingOrders.length > 0
            ? matchingOrders.reduce((best, o) =>
                new Date(o.processed_at) > new Date(best) ? o.processed_at : best,
                matchingOrders[0].processed_at
              )
            : null;
        rows.push({
          code: assignment.code,
          partnerName: partner.name,
          partnerType: partner.partner_type,
          partnerId: partner.id,
          assignmentId: assignment.id,
          assignmentStatus: assignment.status,
          discountDescription: assignment.discount_description,
          assignedAt: assignment.assigned_at,
          redemptions,
          revenue,
          avgOrder,
          lastUsed,
        });
      }
    }
    return rows;
  }, [partners, orders]);

  const filteredRows = useMemo(() => {
    return allRows
      .filter(row => {
        if (statusFilter !== 'all' && row.assignmentStatus !== statusFilter) return false;
        if (
          search &&
          !row.code.toLowerCase().includes(search.toLowerCase()) &&
          !row.partnerName.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => b.redemptions - a.redemptions);
  }, [allRows, search, statusFilter]);

  const totalCodes = allRows.length;
  const activeCodes = allRows.filter(r => r.assignmentStatus === 'active').length;
  const totalRedemptions = allRows.reduce((s, r) => s + r.redemptions, 0);
  const totalRevenue = allRows.reduce((s, r) => s + r.revenue, 0);

  const statusDot: Record<CodeStatus, string> = {
    active: 'bg-green-500',
    paused: 'bg-amber-400',
    removed: 'bg-gray-400',
  };

  return (
    <DashboardLayout menuItems={clientMenuItems}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Coupon Codes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              All affiliate discount codes and their redemption performance
            </p>
          </div>
          <button
            onClick={() => setShowAssignDrawer(true)}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm rounded-xl px-4 py-2 hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" /> Assign Code
          </button>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Codes" value={String(totalCodes)} icon={Tag} />
            <StatCard label="Active Codes" value={String(activeCodes)} icon={Tag} />
            <StatCard label="Total Redemptions" value={String(totalRedemptions)} icon={ShoppingBag} sub="Last 90 days" />
            <StatCard label="Total Revenue" value={fmtCurrency(totalRevenue)} icon={TrendingUp} sub="Last 90 days" />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search codes or partners…"
              className="w-full border border-gray-200 rounded-lg text-sm pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="border border-gray-200 rounded-lg text-sm px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="removed">Removed</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-16">
              <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No coupon codes found</p>
              <p className="text-xs text-gray-400 mt-1">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Assign a code to a partner to get started'}
              </p>
              {!search && statusFilter === 'all' && (
                <button
                  onClick={() => setShowAssignDrawer(true)}
                  className="mt-4 bg-gray-900 text-white px-4 py-2 text-sm rounded-lg hover:bg-gray-800 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Assign Code
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      'Code',
                      'Partner',
                      'Description',
                      'Method',
                      'Redemptions',
                      'Revenue',
                      'Avg Order',
                      'Last Used',
                      'Status',
                    ].map(h => (
                      <th
                        key={h}
                        className="text-left text-xs text-gray-500 uppercase tracking-wide px-4 py-3 font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map(row => (
                    <tr key={row.assignmentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900 text-sm">
                          {row.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarGradient(row.partnerName)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
                          >
                            {initials(row.partnerName)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-xs">{row.partnerName}</p>
                            <span
                              className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${TYPE_BADGE[row.partnerType]}`}
                            >
                              {row.partnerType}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {row.discountDescription ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-gray-100 text-gray-600">
                          manual
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.redemptions > 0 ? row.redemptions : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.redemptions > 0 ? fmtCurrency(row.revenue) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.redemptions > 0 ? fmtCurrency(row.avgOrder) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {row.lastUsed ? fmtDate(row.lastUsed) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${statusDot[row.assignmentStatus]}`}
                          />
                          <span className="text-xs text-gray-600 capitalize">
                            {row.assignmentStatus}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary footer */}
        {!loading && filteredRows.length > 0 && (
          <p className="text-xs text-gray-400 text-center">
            Showing {filteredRows.length} code{filteredRows.length !== 1 ? 's' : ''} · Redemption data from last 90 days
          </p>
        )}
      </div>

      {showAssignDrawer && (
        <AssignCodeDrawer
          clientId={clientId}
          partners={partners}
          onClose={() => setShowAssignDrawer(false)}
          onSaved={loadData}
        />
      )}
    </DashboardLayout>
  );
}
