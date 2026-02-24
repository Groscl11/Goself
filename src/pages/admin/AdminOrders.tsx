import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ShoppingBag, Search, Filter, DollarSign, User, Tag, Gift, Zap, Building2 } from 'lucide-react';
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
}

export function AdminOrders() {
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
          const enriched: EnrichedOrder = {
            ...order,
            client_name: order.clients?.name || 'Unknown Client',
            triggered_campaigns: [],
            triggered_memberships: [],
            member_name: null,
          };

          const { data: member } = await supabase
            .from('member_users')
            .select('id, first_name, last_name')
            .eq('email', order.customer_email)
            .maybeSingle();

          if (member) {
            enriched.member_name = `${member.first_name} ${member.last_name}`.trim() || 'Unknown';

            const { data: enrollments } = await supabase
              .from('member_program_enrollments')
              .select('program_id, membership_programs(name)')
              .eq('member_id', member.id)
              .gte('enrollment_date', order.created_at);

            if (enrollments && enrollments.length > 0) {
              enriched.triggered_memberships = enrollments
                .map((e: any) => e.membership_programs?.name)
                .filter(Boolean);
            }

            const { data: campaigns } = await supabase
              .from('campaign_executions')
              .select('campaign_id, campaigns(name)')
              .eq('member_id', member.id)
              .gte('executed_at', order.created_at);

            if (campaigns && campaigns.length > 0) {
              enriched.triggered_campaigns = campaigns
                .map((c: any) => c.campaigns?.name)
                .filter(Boolean);
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
  };

  return (
    <DashboardLayout menuItems={adminMenuItems} title="All Orders">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Orders & Transactions</h1>
          <p className="text-gray-600 mt-2">
            View all orders across clients and track campaign triggers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${stats.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Clients</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.uniqueClients}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Campaign Triggers</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.withCampaigns}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Enrollments</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.withMemberships}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>All Orders</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
                  />
                </div>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No orders found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {orders.length === 0
                    ? 'Orders will appear here once integrations are active'
                    : 'Try adjusting your search or filters'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            Order #{order.order_number}
                          </h3>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {order.client_name}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {order.customer_email}
                          </div>
                          {order.customer_phone && (
                            <div className="flex items-center gap-1">
                              <span>{order.customer_phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {order.currency} {order.total_price?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {(order.triggered_campaigns.length > 0 ||
                      order.triggered_memberships.length > 0) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {order.triggered_memberships.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Gift className="w-4 h-4 text-orange-600" />
                              <span className="text-sm text-gray-700">Memberships:</span>
                              {order.triggered_memberships.map((membership, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700"
                                >
                                  {membership}
                                </span>
                              ))}
                            </div>
                          )}
                          {order.triggered_campaigns.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-purple-600" />
                              <span className="text-sm text-gray-700">Campaigns:</span>
                              {order.triggered_campaigns.map((campaign, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700"
                                >
                                  {campaign}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {order.member_name && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Tag className="w-4 h-4" />
                          <span>Member: {order.member_name}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  Order #{selectedOrder.order_number}
                </h2>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                  {selectedOrder.client_name}
                </span>
              </div>
              <p className="text-gray-600">
                {new Date(selectedOrder.created_at).toLocaleString()}
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="font-medium text-gray-900">{selectedOrder.customer_email}</p>
                    </div>
                    {selectedOrder.customer_phone && (
                      <div>
                        <span className="text-gray-600">Phone:</span>
                        <p className="font-medium text-gray-900">{selectedOrder.customer_phone}</p>
                      </div>
                    )}
                    {selectedOrder.member_name && (
                      <div>
                        <span className="text-gray-600">Member:</span>
                        <p className="font-medium text-gray-900">{selectedOrder.member_name}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Order Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Order ID:</span>
                      <p className="font-medium text-gray-900">{selectedOrder.order_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <p className="font-medium text-gray-900">
                        {selectedOrder.currency} {selectedOrder.total_price?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Processed:</span>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedOrder.processed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedOrder.triggered_memberships.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-orange-600" />
                    Triggered Memberships
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.triggered_memberships.map((membership, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200"
                      >
                        {membership}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.triggered_campaigns.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    Triggered Campaigns
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.triggered_campaigns.map((campaign, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200"
                      >
                        {campaign}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.order_data?.line_items && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Items</h3>
                  <div className="space-y-2">
                    {selectedOrder.order_data.line_items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{item.title || item.name}</p>
                          <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        </div>
                        <p className="font-semibold text-gray-900">
                          {selectedOrder.currency} {item.price}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t">
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
