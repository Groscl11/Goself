import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  ShoppingBag, Search, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, ChevronsUpDown, X, Tag, Star,
  Download, ExternalLink, Eye, EyeOff,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';
import { formatCurrency, getCurrencySymbol } from '../../lib/currency';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscountCode {
  code: string;
  amount: string;
  type: string;
}

interface LineItem {
  title: string;
  name?: string;
  quantity: number;
  price: string;
  sku?: string;
  variant_title?: string;
}

interface OrderRow {
  id: string;
  shopify_order_id: string;
  order_number: string;
  customer_email: string;
  customer_phone: string | null;
  total_price: number;
  currency: string;
  payment_method: string | null;
  order_status: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  processed_at: string;
  created_at: string;
  order_data: any;
  // enriched
  member_name: string | null;
  member_id: string | null;
  points_earned: number;
  discount_total: number;
  subtotal_price: number;
  discount_codes: DiscountCode[];
  line_items: LineItem[];
  item_count: number;
  city: string | null;
}

type SortKey = keyof Pick<
  OrderRow,
  'order_number' | 'customer_email' | 'total_price' | 'discount_total' | 'points_earned' | 'processed_at' | 'financial_status' | 'fulfillment_status' | 'item_count'
>;
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string | null, type: 'financial' | 'fulfillment' | 'order') {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    refunded: 'bg-red-100 text-red-800',
    partially_refunded: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
    voided: 'bg-gray-100 text-gray-600',
    fulfilled: 'bg-blue-100 text-blue-800',
    partial: 'bg-sky-100 text-sky-800',
    unfulfilled: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-800',
  };
  const cls = map[s] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${cls}`}>
      {(status || '—').replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

function SortIcon({ col, sort }: { col: SortKey; sort: { key: SortKey; dir: SortDir } | null }) {
  if (!sort || sort.key !== col) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400 inline ml-1" />;
  return sort.dir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-blue-600 inline ml-1" />
    : <ChevronDown className="w-3.5 h-3.5 text-blue-600 inline ml-1" />;
}

function MaskedPII({ value, className = '' }: { value: string; className?: string }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setRevealed((r) => !r); }}
      className={`text-left flex items-center gap-1 group ${className}`}
      title={revealed ? 'Click to hide' : 'Click to reveal'}
    >
      <span className={`transition-all duration-200 ${revealed ? '' : 'blur-sm select-none'}`}>
        {value}
      </span>
      {revealed
        ? <EyeOff className="w-3 h-3 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100" />
        : <Eye className="w-3 h-3 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Orders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string>('');

  // filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [financialFilter, setFinancialFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [couponFilter, setCouponFilter] = useState('all'); // all | with | without

  // sort
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({
    key: 'processed_at',
    dir: 'desc',
  });

  // pagination
  const [page, setPage] = useState(1);

  // detail modal
  const [selected, setSelected] = useState<OrderRow | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (profile?.client_id) setClientId(profile.client_id);
  }, [profile]);
  useEffect(() => { if (clientId) loadOrders(); }, [clientId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data: raw } = await supabase
        .from('shopify_orders')
        .select('*')
        .eq('client_id', clientId)
        // Exclude phantom / incomplete webhook rows that have no customer and ₹0 total
        .or('customer_email.not.is.null,total_price.gt.0')
        .order('processed_at', { ascending: false });

      if (!raw) { setOrders([]); return; }

      // Batch-load points per order
      const orderIds = raw.map((o) => o.shopify_order_id);
      const { data: txns } = await supabase
        .from('loyalty_points_transactions')
        .select('reference_id, points_amount')
        .in('reference_id', orderIds)
        .eq('transaction_type', 'earned');

      const pointsMap: Record<string, number> = {};
      (txns || []).forEach((t) => {
        pointsMap[t.reference_id] = (pointsMap[t.reference_id] || 0) + t.points_amount;
      });

      // Batch-load member names — fetch ALL members by member_id (covers email + phone-only orders)
      const allMemberIds = [...new Set(raw.map((o) => o.member_id).filter(Boolean))];
      const { data: membersById } = allMemberIds.length > 0
        ? await supabase.from('member_users').select('id, email, full_name, phone').eq('client_id', clientId).in('id', allMemberIds)
        : { data: [] as any[] };

      const memberById: Record<string, { id: string; name: string }> = {};
      (membersById || []).forEach((m: any) => {
        memberById[m.id] = { id: m.id, name: m.full_name || m.phone || m.email || 'Member' };
      });

      // Fallback: email-keyed lookup for orders that have no member_id set yet
      const emailsWithoutMemberId = [...new Set(raw.filter((o) => o.customer_email && !o.member_id).map((o) => o.customer_email))];
      const { data: membersByEmail } = emailsWithoutMemberId.length > 0
        ? await supabase.from('member_users').select('id, email, full_name').eq('client_id', clientId).in('email', emailsWithoutMemberId)
        : { data: [] as any[] };

      const memberByEmail: Record<string, { id: string; name: string }> = {};
      (membersByEmail || []).forEach((m: any) => {
        if (m.email) memberByEmail[m.email] = { id: m.id, name: m.full_name || m.email };
      });

      const enriched: OrderRow[] = raw.map((o) => {
        const od = o.order_data || {};
        const discountCodes: DiscountCode[] = od.discount_codes || [];
        const lineItems: LineItem[] = od.line_items || [];
        // member_id lookup is primary (works for both email + phone orders)
        const memberInfo = (o.member_id ? memberById[o.member_id] : null)
          || (o.customer_email ? memberByEmail[o.customer_email] : null)
          || null;

        return {
          id: o.id,
          shopify_order_id: o.shopify_order_id,
          order_number: o.order_number ? o.order_number.replace(/^#+/, '') : String(o.shopify_order_id || ''),
          customer_email: o.customer_email || '',
          customer_phone: o.customer_phone || null,
          total_price: o.total_price || 0,
          currency: o.currency || 'INR',
          payment_method: o.payment_method || null,
          order_status: o.order_status || null,
          financial_status: o.financial_status || null,
          fulfillment_status: o.fulfillment_status || null,
          processed_at: o.processed_at || o.created_at,
          created_at: o.created_at,
          order_data: od,
          member_name: memberInfo?.name || null,
          member_id: memberInfo?.id || null,
          points_earned: pointsMap[o.shopify_order_id] || 0,
          discount_total: parseFloat(od.total_discounts || '0'),
          subtotal_price: parseFloat(od.subtotal_price || o.total_price || '0'),
          discount_codes: discountCodes,
          line_items: lineItems,
          item_count: lineItems.reduce((s: number, i: LineItem) => s + (i.quantity || 1), 0),
          city: od.shipping_address?.city || od.billing_address?.city || null,
        };
      });

      setOrders(enriched);
    } finally {
      setLoading(false);
    }
  };

  // ── Filter + Sort ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = orders.filter((o) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        o.customer_email.toLowerCase().includes(q) ||
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(q) ||
        (o.member_name || '').toLowerCase().includes(q) ||
        o.discount_codes.some((d) => d.code.toLowerCase().includes(q));

      let matchDate = true;
      if (dateFilter !== 'all') {
        const diff =
          (Date.now() - new Date(o.processed_at).getTime()) / 86_400_000;
        matchDate =
          dateFilter === 'today' ? diff < 1 :
          dateFilter === 'week' ? diff < 7 :
          dateFilter === 'month' ? diff < 30 : true;
      }

      const matchFinancial =
        financialFilter === 'all' || (o.financial_status || '') === financialFilter;
      const matchFulfillment =
        fulfillmentFilter === 'all' || (o.fulfillment_status || 'unfulfilled') === fulfillmentFilter;
      const matchCoupon =
        couponFilter === 'all' ||
        (couponFilter === 'with' && o.discount_codes.length > 0) ||
        (couponFilter === 'without' && o.discount_codes.length === 0);

      return matchSearch && matchDate && matchFinancial && matchFulfillment && matchCoupon;
    });

    if (sort) {
      list = [...list].sort((a, b) => {
        const av = a[sort.key] as any;
        const bv = b[sort.key] as any;
        const cmp =
          typeof av === 'string' ? av.localeCompare(bv) :
          (av ?? 0) < (bv ?? 0) ? -1 : (av ?? 0) > (bv ?? 0) ? 1 : 0;
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [orders, search, dateFilter, financialFilter, fulfillmentFilter, couponFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageOrders = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
    setPage(1);
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, dateFilter, financialFilter, fulfillmentFilter, couponFilter]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: filtered.length,
    revenue: filtered.reduce((s, o) => s + o.total_price, 0),
    discounted: filtered.filter((o) => o.discount_codes.length > 0).length,
    points: filtered.reduce((s, o) => s + o.points_earned, 0),
    currency: orders[0]?.currency || 'INR',
  }), [filtered, orders]);

  // ── CSV export ─────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const headers = [
      'Order #', 'Date', 'Customer Email', 'Customer Phone', 'Member Name',
      'Items', 'Subtotal', 'Discount', 'Coupon Codes', 'Total', 'Currency',
      'Payment', 'Financial Status', 'Fulfillment Status', 'Points Earned', 'City',
    ];
    const rows = filtered.map((o) => [
      o.order_number,
      new Date(o.processed_at).toLocaleDateString(),
      o.customer_email,
      o.customer_phone || '',
      o.member_name || '',
      o.item_count,
      o.subtotal_price.toFixed(2),
      o.discount_total.toFixed(2),
      o.discount_codes.map((d) => d.code).join('; '),
      o.total_price.toFixed(2),
      o.currency,
      o.payment_method || '',
      o.financial_status || '',
      o.fulfillment_status || '',
      o.points_earned,
      o.city || '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'orders.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const th = (label: string, key?: SortKey) => (
    <th
      className={`px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${key ? 'cursor-pointer select-none hover:text-gray-800' : ''}`}
      onClick={key ? () => toggleSort(key) : undefined}
    >
      {label}{key && <SortIcon col={key} sort={sort} />}
    </th>
  );

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Orders">
      <div className="max-w-full mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders & Transactions</h1>
            <p className="text-gray-500 text-sm mt-1">
              All orders from your integrated Shopify store
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Matching Orders', value: stats.total, icon: ShoppingBag, color: 'blue' },
            { label: 'Total Revenue', value: formatCurrency(stats.revenue, stats.currency), icon: null, currencySymbol: getCurrencySymbol(stats.currency), color: 'green' },
            { label: 'With Coupons', value: stats.discounted, icon: Tag, color: 'orange' },
            { label: 'Points Awarded', value: stats.points.toLocaleString(), icon: Star, color: 'purple' },
          ].map(({ label, value, icon: Icon, currencySymbol, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${color}-100`}>
                {currencySymbol
                  ? <span className={`text-lg font-bold text-${color}-600`}>{currencySymbol}</span>
                  : Icon && <Icon className={`w-5 h-5 text-${color}-600`} />}
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search order #, email, coupon…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <select value={financialFilter} onChange={(e) => setFinancialFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            <option value="all">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="voided">Voided</option>
          </select>

          <select value={fulfillmentFilter} onChange={(e) => setFulfillmentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            <option value="all">All Fulfillment</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="partial">Partial</option>
            <option value="unfulfilled">Unfulfilled</option>
          </select>

          <select value={couponFilter} onChange={(e) => setCouponFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            <option value="all">All Coupons</option>
            <option value="with">With Coupon</option>
            <option value="without">No Coupon</option>
          </select>

          {(search || dateFilter !== 'all' || financialFilter !== 'all' || fulfillmentFilter !== 'all' || couponFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setDateFilter('all'); setFinancialFilter('all'); setFulfillmentFilter('all'); setCouponFilter('all'); }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
              <p className="text-gray-500 text-sm">Loading orders…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No orders found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {th('Order #', 'order_number')}
                    {th('Date', 'processed_at')}
                    {th('Customer', 'customer_email')}
                    {th('Member')}
                    {th('Items', 'item_count')}
                    {th('Subtotal')}
                    {th('Discount', 'discount_total')}
                    {th('Coupon Code')}
                    {th('Total', 'total_price')}
                    {th('Payment')}
                    {th('Financial', 'financial_status')}
                    {th('Fulfillment', 'fulfillment_status')}
                    {th('Points', 'points_earned')}
                    {th('City')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {pageOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors text-sm"
                      onClick={() => setSelected(order)}
                    >
                      {/* Order # */}
                      <td className="px-3 py-3 font-medium text-blue-700 whitespace-nowrap">
                        #{order.order_number}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(order.processed_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                        <div className="text-xs text-gray-400">
                          {new Date(order.processed_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-3 max-w-48">
                        <MaskedPII value={order.customer_email} className="text-gray-900 text-sm truncate max-w-44" />
                        {order.customer_phone && (
                          <MaskedPII value={order.customer_phone} className="text-xs text-gray-400 mt-0.5" />
                        )}
                      </td>

                      {/* Member */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {order.member_name ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            {order.member_name}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Items */}
                      <td className="px-3 py-3 text-center text-gray-700 font-medium">
                        {order.item_count}
                        {order.line_items.length > 0 && (
                          <div className="text-xs text-gray-400">
                            {order.line_items.length} SKU{order.line_items.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>

                      {/* Subtotal */}
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                        {formatCurrency(order.subtotal_price, order.currency)}
                      </td>

                      {/* Discount */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {order.discount_total > 0 ? (
                          <span className="text-red-600 font-medium">
                            −{formatCurrency(order.discount_total, order.currency)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Coupon Code */}
                      <td className="px-3 py-3">
                        {order.discount_codes.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {order.discount_codes.map((d, i) => (
                              <span key={i} className="inline-block bg-orange-50 text-orange-700 border border-orange-200 rounded px-2 py-0.5 text-xs font-mono font-semibold whitespace-nowrap">
                                {d.code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-3 py-3 font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(order.total_price, order.currency)}
                      </td>

                      {/* Payment */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium uppercase">
                          {order.payment_method || '—'}
                        </span>
                      </td>

                      {/* Financial status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {statusBadge(order.financial_status, 'financial')}
                      </td>

                      {/* Fulfillment status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {statusBadge(order.fulfillment_status || 'unfulfilled', 'fulfillment')}
                      </td>

                      {/* Points */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {order.points_earned > 0 ? (
                          <span className="inline-flex items-center gap-1 text-purple-700 font-semibold">
                            <Star className="w-3 h-3 fill-purple-500 text-purple-500" />
                            {order.points_earned}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* City */}
                      <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {order.city || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-500">
                Showing{' '}
                <span className="font-medium text-gray-800">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
                </span>{' '}
                of <span className="font-medium text-gray-800">{filtered.length}</span> orders
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1.5 rounded text-sm text-gray-500 hover:bg-white hover:border hover:border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded text-sm text-gray-500 hover:bg-white hover:border hover:border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                        p === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-white hover:border hover:border-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded text-sm text-gray-500 hover:bg-white hover:border hover:border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1.5 rounded text-sm text-gray-500 hover:bg-white hover:border hover:border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Order #{selected.order_number}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {new Date(selected.processed_at).toLocaleString('en-IN')}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status row */}
              <div className="flex flex-wrap gap-2">
                {statusBadge(selected.financial_status, 'financial')}
                {statusBadge(selected.fulfillment_status || 'unfulfilled', 'fulfillment')}
                {selected.payment_method && (
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold uppercase">
                    {selected.payment_method}
                  </span>
                )}
              </div>

              {/* Customer + Order info grid */}
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Customer</h3>
                  <div>
                    <p className="text-gray-500 text-xs">Email</p>
                    <MaskedPII value={selected.customer_email} className="font-medium text-gray-900" />
                  </div>
                  {selected.customer_phone && (
                    <div>
                      <p className="text-gray-500 text-xs">Phone</p>
                      <MaskedPII value={selected.customer_phone} className="font-medium text-gray-900" />
                    </div>
                  )}
                  {selected.member_name && (
                    <div>
                      <p className="text-gray-500 text-xs">Member</p>
                      <p className="font-medium text-green-700">{selected.member_name}</p>
                    </div>
                  )}
                  {selected.city && (
                    <div>
                      <p className="text-gray-500 text-xs">City</p>
                      <p className="font-medium text-gray-900">{selected.city}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Financials</h3>
                  <div>
                    <p className="text-gray-500 text-xs">Subtotal</p>
                    <p className="font-medium text-gray-900">{formatCurrency(selected.subtotal_price, selected.currency)}</p>
                  </div>
                  {selected.discount_total > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs">Discount</p>
                      <p className="font-medium text-red-600">−{formatCurrency(selected.discount_total, selected.currency)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500 text-xs">Order Total</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(selected.total_price, selected.currency)}</p>
                  </div>
                  {selected.points_earned > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs">Points Earned</p>
                      <p className="font-semibold text-purple-700 flex items-center gap-1">
                        <Star className="w-4 h-4 fill-purple-500 text-purple-500" />
                        {selected.points_earned} pts
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Coupon codes */}
              {selected.discount_codes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Coupons Applied</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.discount_codes.map((d, i) => (
                      <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        <p className="font-mono font-bold text-orange-800 text-sm">{d.code}</p>
                        <p className="text-xs text-orange-600 mt-0.5">
                          −{formatCurrency(parseFloat(d.amount), selected.currency)} · {d.type?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Line items */}
              {selected.line_items.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Items ({selected.item_count} units)
                  </h3>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {selected.line_items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{item.title || item.name}</p>
                          {item.variant_title && item.variant_title !== 'Default Title' && (
                            <p className="text-xs text-gray-400">{item.variant_title}</p>
                          )}
                          {item.sku && <p className="text-xs text-gray-400 font-mono">SKU: {item.sku}</p>}
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold text-gray-900 text-sm">
                            {formatCurrency(parseFloat(item.price) * item.quantity, selected.currency)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatCurrency(parseFloat(item.price), selected.currency)} × {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shipping address */}
              {selected.order_data?.shipping_address && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Shipping Address</h3>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                    {[
                      selected.order_data.shipping_address.name,
                      selected.order_data.shipping_address.address1,
                      selected.order_data.shipping_address.address2,
                      [selected.order_data.shipping_address.city, selected.order_data.shipping_address.province_code].filter(Boolean).join(', '),
                      [selected.order_data.shipping_address.zip, selected.order_data.shipping_address.country].filter(Boolean).join(' · '),
                    ].filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              {selected.order_data?.order_status_url && (
                <a
                  href={selected.order_data.order_status_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                  <ExternalLink className="w-4 h-4" /> View on Shopify
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
