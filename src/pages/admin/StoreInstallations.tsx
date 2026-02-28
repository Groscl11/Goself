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
  RefreshCw,
  Package
} from 'lucide-react';
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
}

export function StoreInstallations() {
  const [stores, setStores] = useState<StoreInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('store_installations')
        .select(`
          *,
          clients!inner(name, contact_email),
          store_plugins(id),
          store_users(id),
          store_webhooks(id)
        `)
        .order('installed_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching stores:', fetchError);
        throw new Error(`Failed to load stores: ${fetchError.message}`);
      }

      const formattedStores: StoreInstallation[] = (data || []).map((store: any) => ({
        ...store,
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
    } catch (err) {
      console.error('Error loading stores:', err);
      setError(err instanceof Error ? err.message : 'Failed to load store installations');
    } finally {
      setLoading(false);
    }
  };

  const loadStoreDetails = async (storeId: string) => {
    try {
      const { data: store, error: storeError } = await supabase
        .from('store_installations')
        .select('*, clients(name, contact_email)')
        .eq('id', storeId)
        .single();

      if (storeError) throw storeError;

      const { data: plugins, error: pluginsError } = await supabase
        .from('store_plugins')
        .select('plugin_type, plugin_name, status, installed_at')
        .eq('store_installation_id', storeId)
        .order('installed_at', { ascending: false });

      if (pluginsError) {
        console.error('Error fetching plugins:', pluginsError);
      }

      const { data: webhooks, error: webhooksError } = await supabase
        .from('store_webhooks')
        .select('webhook_topic, status, total_events_received, last_event_at')
        .eq('store_installation_id', storeId)
        .order('webhook_topic');

      if (webhooksError) {
        console.error('Error fetching webhooks:', webhooksError);
      }

      const { data: users, error: usersError } = await supabase
        .from('store_users')
        .select('email, full_name, role, status')
        .eq('store_installation_id', storeId)
        .order('role');

      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      const storeWithDetails: StoreDetails = {
        ...store,
        plugins: plugins || [],
        webhooks: webhooks || [],
        users: users || [],
        plugins_count: plugins?.length || 0,
        users_count: users?.length || 0,
        webhooks_count: webhooks?.length || 0,
        clients: store.clients || { name: '', contact_email: '' }
      };

      setSelectedStore(storeWithDetails);
      setShowDetails(true);
    } catch (error) {
      console.error('Error loading store details:', error);
      alert('Failed to load store details. Please try again.');
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
      case 'configured':
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'inactive':
      case 'pending':
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
      case 'uninstalled':
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWebhookStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Store Installations">
      <div className="space-y-6">
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
                  <p className="text-sm font-medium text-gray-600">Healthy Webhooks</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.webhooksHealthy}</p>
                </div>
                <Webhook className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stores Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Installed Stores</CardTitle>
              <Button onClick={loadStores} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by domain, name, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="uninstalled">Uninstalled</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Error Loading Stores</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading stores...</p>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Stores Found</h3>
                <p className="text-gray-500 mb-4">
                  {stores.length === 0
                    ? 'No stores have been installed yet.'
                    : 'No stores match your search criteria.'}
                </p>
                {searchTerm || statusFilter !== 'all' ? (
                  <Button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : null}
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
                            onClick={() => loadStoreDetails(store.id)}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Installed Plugins ({selectedStore.plugins.length})
                  </h3>
                  {selectedStore.plugins.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No plugins installed yet</p>
                    </div>
                  ) : (
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
                          <p className="text-xs text-gray-400 mt-1">
                            Installed: {new Date(plugin.installed_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Webhooks */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Webhooks ({selectedStore.webhooks.length})
                  </h3>
                  {selectedStore.webhooks.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No webhooks registered</p>
                    </div>
                  ) : (
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
                  )}
                </div>

                {/* Users */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Store Users ({selectedStore.users.length})
                  </h3>
                  {selectedStore.users.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No users registered</p>
                    </div>
                  ) : (
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