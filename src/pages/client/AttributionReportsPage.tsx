import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, ShoppingBag, Users, MousePointer, Download, ChevronDown, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerType = 'influencer' | 'creator' | 'brand' | 'other';

interface RawPartner {
  id: string;
  name: string;
  partner_type: PartnerType;
  affiliate_code_assignments: { code: string }[];
}

interface ShopifyOrder {
  shopify_order_id: string;
  total_price: number;
  processed_at: string;
  order_data: {
    discount_codes?: { code: string; amount: string; type: string }[];
  } | null;
}

interface UTMRow {
  id: string;
  partner_id: string | null;
  slug: string;
  clicks: number;
}

interface PartnerReport {
  partnerId: string;
  partnerName: string;
  partnerType: PartnerType;
  couponOrders: number;
  couponRevenue: number;
  utmClicks: number;
  totalOrders: number;
  totalRevenue: number;
  codes: { code: string; orders: number; revenue: number }[];
  utmLinks: { slug: string; clicks: number }[];
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttributionReportsPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? '';

  const [rawPartners, setRawPartners] = useState<RawPartner[]>([]);
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [utmLinks, setUtmLinks] = useState<UTMRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setPageError('');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dateRange);

    const [
      { data: partnersData, error: pErr },
      { data: ordersData, error: oErr },
      { data: utmData, error: uErr },
    ] = await Promise.all([
      supabase
        .from('affiliate_partners')
        .select('id, name, partner_type, affiliate_code_assignments(code)')
        .eq('client_id', clientId)
        .neq('status', 'archived')
        .order('name'),
      supabase
        .from('shopify_orders')
        .select('shopify_order_id, total_price, processed_at, order_data')
        .eq('client_id', clientId)
        .gte('processed_at', cutoff.toISOString())
        .limit(5000),
      supabase
        .from('attribution_utm_links')
        .select('id, partner_id, slug, clicks')
        .eq('client_id', clientId),
    ]);

    if (pErr) setPageError(pErr.message);
    if (oErr) setPageError(oErr.message);
    if (uErr) setPageError(uErr.message);
    setRawPartners((partnersData as RawPartner[]) ?? []);
    setOrders((ordersData as ShopifyOrder[]) ?? []);
    setUtmLinks((utmData as UTMRow[]) ?? []);
    setLoading(false);
  }, [clientId, dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  function toggleExpand(partnerId: string) {
    setExpandedPartners(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  }

  const { reports, unattributedOrders, totalUtmClicks } = useMemo(() => {
    // Build code → partnerId map
    const codeMap: Record<string, string> = {};
    for (const p of rawPartners) {
      for (const a of p.affiliate_code_assignments) {
        codeMap[a.code.toUpperCase()] = p.id;
      }
    }

    // Per-partner, per-code order accumulation
    const partnerCodeOrders: Record<string, Record<string, ShopifyOrder[]>> = {};
    const unattributed: ShopifyOrder[] = [];

    for (const order of orders) {
      const codes = order.order_data?.discount_codes ?? [];
      let attributed = false;
      for (const dc of codes) {
        const pid = codeMap[dc.code.toUpperCase()];
        if (pid) {
          attributed = true;
          if (!partnerCodeOrders[pid]) partnerCodeOrders[pid] = {};
          const codeKey = dc.code.toUpperCase();
          if (!partnerCodeOrders[pid][codeKey]) partnerCodeOrders[pid][codeKey] = [];
          partnerCodeOrders[pid][codeKey].push(order);
        }
      }
      if (!attributed) unattributed.push(order);
    }

    // Build UTM clicks per partner
    const partnerUtmClicks: Record<string, { slug: string; clicks: number }[]> = {};
    let totalUtmClicks = 0;
    for (const link of utmLinks) {
      totalUtmClicks += link.clicks;
      if (link.partner_id) {
        if (!partnerUtmClicks[link.partner_id]) partnerUtmClicks[link.partner_id] = [];
        partnerUtmClicks[link.partner_id].push({ slug: link.slug, clicks: link.clicks });
      }
    }

    // Build reports
    const reports: PartnerReport[] = rawPartners.map(p => {
      const codeOrderMap = partnerCodeOrders[p.id] ?? {};
      const codes = Object.entries(codeOrderMap).map(([code, orderList]) => ({
        code,
        orders: orderList.length,
        revenue: orderList.reduce((s, o) => s + Number(o.total_price), 0),
      }));
      const couponOrders = codes.reduce((s, c) => s + c.orders, 0);
      const couponRevenue = codes.reduce((s, c) => s + c.revenue, 0);
      const utmLinksList = partnerUtmClicks[p.id] ?? [];
      const utmClicks = utmLinksList.reduce((s, l) => s + l.clicks, 0);

      return {
        partnerId: p.id,
        partnerName: p.name,
        partnerType: p.partner_type,
        couponOrders,
        couponRevenue,
        utmClicks,
        totalOrders: couponOrders,
        totalRevenue: couponRevenue,
        codes,
        utmLinks: utmLinksList,
      };
    });

    // Sort by revenue desc
    reports.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return { reports, unattributedOrders: unattributed, totalUtmClicks };
  }, [rawPartners, orders, utmLinks]);

  const totalAttributedRevenue = reports.reduce((s, r) => s + r.totalRevenue, 0);
  const totalAttributedOrders = reports.reduce((s, r) => s + r.totalOrders, 0);
  const topPartner = reports[0]?.partnerName ?? '—';

  function exportCsv() {
    const rows: string[][] = [
      ['Partner', 'Type', 'Codes', 'UTM Links', 'Orders', 'Revenue', 'Avg Order', 'Share %'],
    ];
    for (const r of reports) {
      const avgOrder = r.totalOrders > 0 ? r.totalRevenue / r.totalOrders : 0;
      const share =
        totalAttributedRevenue > 0
          ? ((r.totalRevenue / totalAttributedRevenue) * 100).toFixed(1)
          : '0.0';
      rows.push([
        r.partnerName,
        r.partnerType,
        String(r.codes.length),
        String(r.utmLinks.length),
        String(r.totalOrders),
        String(r.totalRevenue.toFixed(2)),
        String(avgOrder.toFixed(2)),
        `${share}%`,
      ]);
    }
    if (unattributedOrders.length > 0) {
      const rev = unattributedOrders.reduce((s, o) => s + Number(o.total_price), 0);
      rows.push(['Unattributed', '—', '—', '—', String(unattributedOrders.length), String(rev.toFixed(2)), '—', '—']);
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attribution-report-${dateRange}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout menuItems={clientMenuItems}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Attribution Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Coupon code redemptions and UTM click attribution, broken down by partner
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date range switcher */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {([7, 30, 90] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDateRange(d)}
                  className={`px-4 py-1.5 text-sm transition-colors ${
                    dateRange === d ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={exportCsv}
              disabled={loading || reports.length === 0}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {pageError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{pageError}</p>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Revenue Attributed"
              value={fmtCurrency(totalAttributedRevenue)}
              icon={TrendingUp}
              sub={`Last ${dateRange} days`}
            />
            <StatCard
              label="Attributed Orders"
              value={String(totalAttributedOrders)}
              icon={ShoppingBag}
              sub={`Last ${dateRange} days`}
            />
            <StatCard
              label="Top Partner"
              value={topPartner}
              icon={Users}
              sub="By revenue"
            />
            <StatCard
              label="Total UTM Clicks"
              value={totalUtmClicks.toLocaleString('en-IN')}
              icon={MousePointer}
              sub="All time"
            />
          </div>
        )}

        {/* Partner Breakdown Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Partner Breakdown</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Click a row to expand code-level detail
            </p>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : reports.length === 0 && unattributedOrders.length === 0 ? (
            <div className="text-center py-16">
              <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No data for this period</p>
              <p className="text-xs text-gray-400 mt-1">
                Assign coupon codes to partners and process orders to see attribution
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      'Partner',
                      'Type',
                      'Codes',
                      'UTM Links',
                      'Orders',
                      'Revenue',
                      'Avg Order',
                      'Share of Revenue',
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
                  {reports.map(r => {
                    const avgOrder = r.totalOrders > 0 ? r.totalRevenue / r.totalOrders : 0;
                    const share =
                      totalAttributedRevenue > 0
                        ? (r.totalRevenue / totalAttributedRevenue) * 100
                        : 0;
                    const isExpanded = expandedPartners.has(r.partnerId);

                    return (
                      <>
                        <tr
                          key={r.partnerId}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleExpand(r.partnerId)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {r.codes.length > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                )
                              ) : (
                                <span className="w-3.5 h-3.5 flex-shrink-0" />
                              )}
                              <div
                                className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarGradient(r.partnerName)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
                              >
                                {initials(r.partnerName)}
                              </div>
                              <span className="font-medium text-gray-900">{r.partnerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs rounded-full px-2 py-0.5 font-medium ${TYPE_BADGE[r.partnerType]}`}
                            >
                              {r.partnerType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{r.codes.length}</td>
                          <td className="px-4 py-3 text-gray-700">{r.utmLinks.length}</td>
                          <td className="px-4 py-3 text-gray-700">{r.totalOrders || '—'}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {r.totalRevenue > 0 ? fmtCurrency(r.totalRevenue) : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {avgOrder > 0 ? fmtCurrency(avgOrder) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
                                <div
                                  className="bg-gray-900 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(share, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 w-10 text-right">
                                {share.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded code sub-rows */}
                        {isExpanded &&
                          r.codes.map(c => {
                            const codeAvg = c.orders > 0 ? c.revenue / c.orders : 0;
                            return (
                              <tr key={`${r.partnerId}-${c.code}`} className="bg-gray-50/70">
                                <td className="px-4 py-2 pl-14">
                                  <span className="text-xs text-gray-500">↳</span>{' '}
                                  <code className="text-xs font-mono font-medium text-gray-700 ml-1">
                                    {c.code}
                                  </code>
                                </td>
                                <td className="px-4 py-2" />
                                <td className="px-4 py-2" />
                                <td className="px-4 py-2" />
                                <td className="px-4 py-2 text-xs text-gray-600">{c.orders}</td>
                                <td className="px-4 py-2 text-xs text-gray-600">
                                  {c.revenue > 0 ? fmtCurrency(c.revenue) : '—'}
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-600">
                                  {codeAvg > 0 ? fmtCurrency(codeAvg) : '—'}
                                </td>
                                <td className="px-4 py-2" />
                              </tr>
                            );
                          })}
                      </>
                    );
                  })}

                  {/* Unattributed row */}
                  {unattributedOrders.length > 0 && (
                    <tr className="border-t-2 border-gray-200">
                      <td className="px-4 py-3" colSpan={1}>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-sm italic text-gray-400">Unattributed</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 italic text-xs">—</td>
                      <td className="px-4 py-3 text-gray-400 italic text-xs">—</td>
                      <td className="px-4 py-3 text-gray-400 italic text-xs">—</td>
                      <td className="px-4 py-3 text-gray-500 italic text-sm">
                        {unattributedOrders.length}
                      </td>
                      <td className="px-4 py-3 text-gray-500 italic text-sm">
                        {fmtCurrency(
                          unattributedOrders.reduce((s, o) => s + Number(o.total_price), 0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 italic text-xs">—</td>
                      <td className="px-4 py-3 text-gray-400 italic text-xs">—</td>
                    </tr>
                  )}
                </tbody>

                {/* Totals footer */}
                {(totalAttributedOrders > 0 || unattributedOrders.length > 0) && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-4 py-3 font-semibold text-gray-900 text-sm">Total</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {totalAttributedOrders + unattributedOrders.length}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {fmtCurrency(
                          totalAttributedRevenue +
                            unattributedOrders.reduce((s, o) => s + Number(o.total_price), 0)
                        )}
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Attribution note */}
        {!loading && (
          <p className="text-xs text-gray-400 text-center">
            Attribution is based on discount code usage in the last {dateRange} days. UTM click data is all-time.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
