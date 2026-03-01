import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Store,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Webhook,
  Plug,
  Calendar,
  Mail,
  Phone,
  Globe,
  CreditCard,
  Search,
  Filter,
  Eye,
  RefreshCw
,ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminMenuItems } from './adminMenuItems';

interface StoreInstallation {
  id: string;
  client_id: string;
  shop_domain: string;
  shop_name: string;
  shop_email: string;
  shop_owner: string;
  shop_phone: string;
  shop_country: string;
  shop_currency: string;
  shop_plan: string;
  installation_status: string;
  installed_at: string;
  last_active_at: string;
  webhooks_registered: boolean;
  webhook_health_status: string;
  last_webhook_received_at: string;
  billing_plan: string;
  billing_status: string;
  plugins_count: number;
  users_count: number;
  webhooks_count: number;
  clients: {
    name: string;
    contact_email: string;
  };
}

interface StoreDetails extends StoreInstallation {
  plugins: Array<{
    plugin_type: string;
    plugin_name: string;
    status: string;
    installed_at: string;
  }>;
  webhooks: Array<{
    webhook_topic: string;
    status: string;
    total_events_received: number;
    last_event_at: string;
  }>;
  users: Array<{
    email: string;
    full_name: string;
    role: string;
    status: string;
  }>;
  members: Array<{
    id: string;
    email: string;
    full_name: string;
    created_at: string;
    points_balance: number;
  }>;
  orders: Array<{
    id: string;
    order_number: string;
    customer_email: string;
    total_price: number;
    currency: string;
    processed_at: string;
    created_at: string;
  }>;
}

export function StoreInstallations() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStore, setSelectedStore] = useState<StoreDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    webhooksHealthy: 0,
  });

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('store_installations')
        .select(`
          *,
          clients(name, contact_email),
          store_plugins(id),
          store_users(id),
          store_webhooks(id)
        `)
        .order('installed_at', { ascending: false });

      if (error) throw error;

      const formattedStores: StoreInstallation[] = (data || []).map((store: any) => ({
        ...store,
        clients: store.clients || { name: store.shop_name || store.shop_domain, contact_email: store.shop_email || '' },
        plugins_count: store.store_plugins?.length || 0,
        users_count: store.store_users?.length || 0,
        webhooks_count: store.store_webhooks?.length || 0,
      }));

      setStores(formattedStores);

      // Calculate stats
      const totalStores = formattedStores.length;
      const activeStores = formattedStores.filter(s => s.installation_status === 'active').length;
      const inactiveStores = formattedStores.filter(s => s.installation_status !== 'active').length;
      const healthyWebhooks = formattedStores.filter(s => s.webhook_health_status === 'healthy').length;

      setStats({
        total: totalStores,
        active: activeStores,
        inactive: inactiveStores,
        webhooksHealthy: healthyWebhooks,
      });
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreDetails = async (storeId: string, knownClientId?: string) => {
    try {
      const { data: store, error: storeError } = await supabase
        .from('store_installations')
        .select('*')
        .eq('id', storeId)
        .single();

      if (storeError) throw storeError;

      const { data: plugins } = await supabase
        .from('store_plugins')
        .select('plugin_type, plugin_name, status, installed_at')
        .eq('store_installation_id', storeId)
        .order('installed_at', { ascending: false });

      const { data: webhooks } = await supabase
        .from('store_webhooks')
        .select('webhook_topic, status, total_events_received, last_event_at')
        .eq('store_installation_id', storeId)
        .order('webhook_topic');

      const { data: users } = await supabase
        .from('store_users')
        .select('email, full_name, role, status')
        .eq('store_installation_id', storeId)
        .order('role');

      // Resolve the correct client_id for member lookups.
      // Edge functions always prefer integration_configs.client_id (the merchant's real profile client)
      // over store_installations.client_id (which may be an OAuth auto-created client).
      let clientId = knownClientId || store.client_id;

      const { data: integrationConfig } = await supabase
        .from('integration_configs')
        .select('client_id')
        .eq('shop_domain', store.shop_domain)
        .maybeSingle();

      if (integrationConfig?.client_id) {
        clientId = integrationConfig.client_id;
      }

      let members: StoreDetails['members'] = [];
      let orders: StoreDetails['orders'] = [];

      if (clientId) {
        const { data: memberData, error: memberError } = await supabase
          .from('member_users')
          .select('id, email, full_name, created_at, member_loyalty_status(points_balance)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (memberError) console.error('Error loading loyalty members:', memberError);

        members = (memberData || []).map((m: any) => ({
          id: m.id,
          email: m.email,
          full_name: m.full_name,
          created_at: m.created_at,
          points_balance: Array.isArray(m.member_loyalty_status)
            ? (m.member_loyalty_status[0]?.points_balance ?? 0)
            : (m.member_loyalty_status?.points_balance ?? 0),
        }));

        const { data: orderData, error: orderError } = await supabase
          .from('shopify_orders')
          .select('id, order_number, customer_email, total_price, currency, processed_at, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (orderError) console.error('Error loading orders:', orderError);
        orders = orderData || [];
      }

      const storeWithDetails: StoreDetails = {
        ...store,
        plugins: plugins || [],
        webhooks: webhooks || [],
        users: users || [],
        members,
        orders,
        plugins_count: plugins?.length || 0,
        users_count: users?.length || 0,
        webhooks_count: webhooks?.length || 0,
        clients: stores.find(s => s.id === storeId)?.clients || { name: '', contact_email: '' }
      };

      setSelectedStore(storeWithDetails);
      setShowDetails(true);
    } catch (error) {
      console.error('Error loading store details:', error);
    }
  };

  const filteredStores = stores.filter(store => {
    const matchesSearch =
      store.shop_domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.shop_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.shop_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || store.installation_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'uninstalled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWebhookStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <DashboardLayout menuItems={adminMenuItems}>
      <div className="space-y-6">
        <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Store Installations</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track all Shopify stores that have installed your plugins
            </p>
          </div>
          <Button onClick={loadStores} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Stores</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Store className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.inactive}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Webhooks Healthy</p>
                  <p className="text-2xl font-bold text-green-600">{stats.webhooksHealthy}</p>
                </div>
                <Webhook className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search stores by domain, name, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="uninstalled">Uninstalled</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stores Table */}
        <Card>
          <CardHeader>
            <CardTitle>Installed Stores ({filteredStores.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading stores...</p>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No stores found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Store
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Webhooks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plugins
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Users
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Installed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStores.map((store) => (
                      <tr key={store.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Store className="w-5 h-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {store.shop_name || store.shop_domain}
                              </div>
                              <div className="text-sm text-gray-500">{store.shop_domain}</div>
                              {store.shop_email && (
                                <div className="text-xs text-gray-400">{store.shop_email}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(store.installation_status)}`}>
                            {store.installation_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getWebhookStatusIcon(store.webhook_health_status)}
                            <span className="text-sm text-gray-900">{store.webhooks_count}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <Plug className="w-4 h-4 text-gray-400" />
                            {store.plugins_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-gray-400" />
                            {store.users_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(store.installed_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Button
                            onClick={() => loadStoreDetails(store.id, store.client_id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Store Details Modal */}
        {showDetails && selectedStore && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedStore.shop_name}</h2>
                    <p className="text-sm text-gray-500">{selectedStore.shop_domain}</p>
                  </div>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Store Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Email:</span>
                      <span className="text-gray-900">{selectedStore.shop_email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Phone:</span>
                      <span className="text-gray-900">{selectedStore.shop_phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Country:</span>
                      <span className="text-gray-900">{selectedStore.shop_country || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Plan:</span>
                      <span className="text-gray-900">{selectedStore.shop_plan || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Plugins */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Installed Plugins ({selectedStore.plugins.length})</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedStore.plugins.map((plugin, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Plug className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-900">{plugin.plugin_name}</span>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(plugin.status)}`}>
                            {plugin.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Type: {plugin.plugin_type}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Webhooks */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhooks ({selectedStore.webhooks.length})</h3>
                  <div className="space-y-2">
                    {selectedStore.webhooks.map((webhook, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Webhook className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-gray-900">{webhook.webhook_topic}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {webhook.total_events_received} events
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(webhook.status)}`}>
                              {webhook.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Users */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Users ({selectedStore.users.length})</h3>
                  <div className="space-y-2">
                    {selectedStore.users.map((user, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-600" />
                            <div>
                              <span className="text-sm font-medium text-gray-900">{user.full_name || user.email}</span>
                              {user.full_name && (
                                <p className="text-xs text-gray-500">{user.email}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 font-medium">{user.role}</span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(user.status)}`}>
                              {user.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Loyalty Members */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Loyalty Members ({selectedStore.members.length})
                  </h3>
                  {selectedStore.members.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-gray-300 rounded-lg">
                      <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No loyalty members yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {selectedStore.members.map((member) => (
                            <tr key={member.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <div>
                                  <span className="font-medium text-gray-900">{member.full_name || member.email}</span>
                                  {member.full_name && (
                                    <p className="text-xs text-gray-500">{member.email}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <span className="font-semibold text-blue-700">{member.points_balance.toLocaleString()}</span>
                              </td>
                              <td className="px-4 py-2 text-gray-500">
                                {new Date(member.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Orders */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent Orders ({selectedStore.orders.length})
                  </h3>
                  {selectedStore.orders.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-gray-300 rounded-lg">
                      <p className="text-sm text-gray-500">No orders yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {selectedStore.orders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-mono text-xs text-gray-700">
                                #{order.order_number || order.id.slice(0, 8)}
                              </td>
                              <td className="px-4 py-2 text-gray-700">
                                {order.customer_email || '—'}
                              </td>
                              <td className="px-4 py-2 font-semibold text-gray-900">
                                {order.total_price != null
                                  ? `${order.currency} ${Number(order.total_price).toFixed(2)}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-2 text-gray-500">
                                {new Date(order.processed_at || order.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end">
                <Button onClick={() => setShowDetails(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
