import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ShoppingBag, DollarSign, User, Gift, Zap, Building2, Search, Package, Coins, X, ChevronRight, ReceiptText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminMenuItems } from './adminMenuItems';

interface OrderData {
  id: string;
  client_id: string;
  order_id: string;
  order_number: string;
  customer_email: string;
  customer_phone: string;
  total_price: number;
  currency: string;
  order_data: any;
  processed_at: string;
  created_at: string;
}

interface EnrichedOrder extends OrderData {
  client_name: string;
  triggered_campaigns: string[];
  triggered_memberships: string[];
  member_name: string | null;
  member_id: string | null;
  points_earned: number;
  discount_total: number;
  order_status: string | null;
  fulfillment_status: string | null;
  line_items_count: number;
  items_summary: string;
}

export function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrder, setSelectedOrder] = useState<EnrichedOrder | null>(null);

  useEffect(() => {
    loadClients();
    loadOrders();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);

      const { data: ordersData, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const enrichedOrders = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          const lineItems: any[] = order.order_data?.line_items || [];
          const enriched: EnrichedOrder = {
            ...order,
            client_name: order.clients?.name || 'Unknown Client',
            triggered_campaigns: [],
            triggered_memberships: [],
            member_name: null,
            member_id: null,
            points_earned: 0,
            discount_total: parseFloat(order.order_data?.total_discounts || '0') || 0,
            order_status: order.order_data?.financial_status || null,
            fulfillment_status: order.order_data?.fulfillment_status || null,
            line_items_count: lineItems.length,
            items_summary: lineItems.slice(0, 2).map((i: any) => i.title || i.name).filter(Boolean).join(', ') +
              (lineItems.length > 2 ? ` +${lineItems.length - 2} more` : ''),
          };

          const { data: member } = await supabase
            .from('member_users')
            .select('id, full_name, first_name, last_name')
            .eq('email', order.customer_email)
            .maybeSingle();

          if (member) {
            enriched.member_id = member.id;
            enriched.member_name = member.full_name ||
              `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown';

            const [enrollments, campaigns, loyaltyTxns] = await Promise.all([
              supabase.from('member_program_enrollments')
                .select('program_id, membership_programs(name)')
                .eq('member_id', member.id)
                .gte('enrollment_date', order.created_at),
              supabase.from('campaign_executions')
                .select('campaign_id, campaigns(name)')
                .eq('member_id', member.id)
                .gte('executed_at', order.created_at),
              supabase.from('loyalty_transactions')
                .select('points')
                .eq('member_id', member.id)
                .eq('transaction_type', 'earn')
                .gte('created_at', order.created_at)
                .lte('created_at', new Date(new Date(order.created_at).getTime() + 5 * 60 * 1000).toISOString()),
            ]);

            if (enrollments.data?.length) {
              enriched.triggered_memberships = enrollments.data
                .map((e: any) => e.membership_programs?.name).filter(Boolean);
            }
            if (campaigns.data?.length) {
              enriched.triggered_campaigns = campaigns.data
                .map((c: any) => c.campaigns?.name).filter(Boolean);
            }
            if (loyaltyTxns.data?.length) {
              enriched.points_earned = loyaltyTxns.data.reduce((s: number, t: any) => s + (t.points || 0), 0);
            }
          }

          return enriched;
        })
      );

      setOrders(enrichedOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone?.includes(searchTerm) ||
      order.client_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClient = filterClient === 'all' || order.client_id === filterClient;

    let matchesDate = true;
    if (filterDate !== 'all') {
      const orderDate = new Date(order.created_at);
      const now = new Date();
      const daysDiff = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);

      switch (filterDate) {
        case 'today':
          matchesDate = daysDiff < 1;
          break;
        case 'week':
          matchesDate = daysDiff < 7;
          break;
        case 'month':
          matchesDate = daysDiff < 30;
          break;
      }
    }

    return matchesSearch && matchesDate && matchesClient;
  });

  const stats = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + (order.total_price || 0), 0),
    withCampaigns: orders.filter((o) => o.triggered_campaigns.length > 0).length,
    withMemberships: orders.filter((o) => o.triggered_memberships.length > 0).length,
    uniqueClients: new Set(orders.map((o) => o.client_id)).size,
    totalPoints: orders.reduce((s, o) => s + o.points_earned, 0),
  };

  const STATUS_STYLE: Record<string, string> = {
    paid:     'bg-green-50 text-green-700 border-green-200',
    pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
    refunded: 'bg-red-50 text-red-700 border-red-200',
    voided:   'bg-gray-100 text-gray-500 border-gray-200',
    partially_refunded: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  const FULFIL_STYLE: Record<string, string> = {
    fulfilled:   'bg-blue-50 text-blue-700 border-blue-200',
    unfulfilled: 'bg-gray-100 text-gray-500 border-gray-200',
    partial:     'bg-orange-50 text-orange-700 border-orange-200',
    null:        'bg-gray-100 text-gray-500 border-gray-200',
  };

  return (
    <DashboardLayout menuItems={adminMenuItems} title="All Orders">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Orders & Transactions</h1>
            <p className="text-sm text-gray-500">All orders across clients with loyalty triggers</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Total Orders',      value: stats.totalOrders.toLocaleString(),           icon: ShoppingBag, color: 'bg-blue-100 text-blue-600' },
            { label: 'Total Revenue',     value: `₹${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'bg-green-100 text-green-600' },
            { label: 'Clients',           value: stats.uniqueClients.toString(),               icon: Building2,  color: 'bg-sky-100 text-sky-600' },
            { label: 'Points Awarded',    value: stats.totalPoints.toLocaleString(),           icon: Coins,      color: 'bg-yellow-100 text-yellow-600' },
            { label: 'Campaign Triggers', value: stats.withCampaigns.toLocaleString(),         icon: Zap,        color: 'bg-purple-100 text-purple-600' },
            { label: 'Enrollments',       value: stats.withMemberships.toLocaleString(),       icon: Gift,       color: 'bg-orange-100 text-orange-600' },
          ].map(card => (
            <Card key={card.label}>
              <CardContent className="pt-4 pb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-gray-900">{card.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by order #, email, phone, client…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
            />
          </div>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 min-w-44"
          >
            <option value="all">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {/* Orders table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="mt-2 text-gray-500">Loading orders…</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No orders found</p>
              <p className="text-sm text-gray-400 mt-1">
                {orders.length === 0 ? 'Orders will appear once integrations are active' : 'Try adjusting filters'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-600">Order</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Customer</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Items</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-right">Points</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Triggers</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        {/* Order column */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">#{order.order_number}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">
                              {order.client_name}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>

                        {/* Customer column */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate max-w-40">{order.customer_email}</span>
                          </div>
                          {order.customer_phone && (
                            <div className="text-xs text-gray-400 mt-0.5 ml-5">{order.customer_phone}</div>
                          )}
                          {order.member_name && (
                            <div className="text-xs text-emerald-600 font-medium mt-0.5 ml-5">{order.member_name}</div>
                          )}
                        </td>

                        {/* Items column */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-xs">{order.line_items_count} item{order.line_items_count !== 1 ? 's' : ''}</span>
                          </div>
                          {order.items_summary && (
                            <div className="text-xs text-gray-400 mt-0.5 ml-5 max-w-44 truncate">{order.items_summary}</div>
                          )}
                          {order.discount_total > 0 && (
                            <div className="text-xs text-green-600 mt-0.5 ml-5">−₹{order.discount_total.toFixed(2)} disc.</div>
                          )}
                        </td>

                        {/* Amount column */}
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900">
                            {order.currency} {order.total_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>

                        {/* Points column */}
                        <td className="px-4 py-3 text-right">
                          {order.points_earned > 0 ? (
                            <span className="font-semibold text-yellow-700">+{order.points_earned.toLocaleString()} pts</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Status column */}
                        <td className="px-4 py-3">
                          {order.order_status && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium block w-fit ${
                              STATUS_STYLE[order.order_status] || 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}>
                              {order.order_status}
                            </span>
                          )}
                          {order.fulfillment_status && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium block w-fit mt-1 ${
                              FULFIL_STYLE[order.fulfillment_status] || 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}>
                              {order.fulfillment_status}
                            </span>
                          )}
                        </td>

                        {/* Triggers column */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {order.triggered_campaigns.map((c, i) => (
                              <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">
                                <Zap className="w-2.5 h-2.5 inline mr-0.5" />{c}
                              </span>
                            ))}
                            {order.triggered_memberships.map((m, i) => (
                              <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full font-medium">
                                <Gift className="w-2.5 h-2.5 inline mr-0.5" />{m}
                              </span>
                            ))}
                            {order.triggered_campaigns.length === 0 && order.triggered_memberships.length === 0 && (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            </>
          )}
        </div>
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">
                    Order #{selectedOrder.order_number}
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedOrder.client_name}
                  </span>
                  {selectedOrder.order_status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[selectedOrder.order_status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {selectedOrder.order_status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(selectedOrder.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-gray-400" /> Customer
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Email</span><p className="font-medium text-gray-900">{selectedOrder.customer_email}</p></div>
                    {selectedOrder.customer_phone && <div><span className="text-gray-500">Phone</span><p className="font-medium text-gray-900">{selectedOrder.customer_phone}</p></div>}
                    {selectedOrder.member_name && <div><span className="text-gray-500">Member</span><p className="font-medium text-emerald-700">{selectedOrder.member_name}</p></div>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                    <ReceiptText className="w-4 h-4 text-gray-400" /> Order Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Order ID</span><p className="font-medium text-gray-900 font-mono text-xs">{selectedOrder.order_id}</p></div>
                    <div><span className="text-gray-500">Total</span><p className="font-bold text-gray-900">{selectedOrder.currency} {selectedOrder.total_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                    {selectedOrder.discount_total > 0 && <div><span className="text-gray-500">Discounts</span><p className="font-medium text-green-700">−₹{selectedOrder.discount_total.toFixed(2)}</p></div>}
                    {selectedOrder.points_earned > 0 && <div><span className="text-gray-500">Points Awarded</span><p className="font-semibold text-yellow-700">+{selectedOrder.points_earned.toLocaleString()} pts</p></div>}
                    <div><span className="text-gray-500">Fulfillment</span><p className="font-medium text-gray-900">{selectedOrder.fulfillment_status || 'N/A'}</p></div>
                    <div><span className="text-gray-500">Processed</span><p className="font-medium text-gray-900">{new Date(selectedOrder.processed_at).toLocaleString('en-IN')}</p></div>
                  </div>
                </div>
              </div>

              {selectedOrder.triggered_memberships.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-orange-600" /> Triggered Memberships
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.triggered_memberships.map((m, i) => (
                      <span key={i} className="text-sm px-3 py-1 rounded-full font-medium bg-orange-50 text-orange-700 border border-orange-200">{m}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.triggered_campaigns.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-600" /> Triggered Campaigns
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.triggered_campaigns.map((c, i) => (
                      <span key={i} className="text-sm px-3 py-1 rounded-full font-medium bg-purple-50 text-purple-700 border border-purple-200">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.order_data?.line_items && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" /> Items ({selectedOrder.line_items_count})
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.order_data.line_items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-medium text-gray-900">{item.title || item.name}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}{item.sku ? ` · SKU: ${item.sku}` : ''}</p>
                        </div>
                        <p className="font-semibold text-gray-900">{selectedOrder.currency} {item.price}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setSelectedOrder(null)} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
