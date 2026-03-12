import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Building2, Mail, Phone, CheckCircle, XCircle, X,
  ChevronRight, Users, Store, Gift, CreditCard, Layers,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';

interface Client {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  primary_color: string;
  contact_email: string;
  contact_phone: string;
  is_active: boolean;
  created_at: string;
}

export function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  const [programCounts, setProgramCounts] = useState<Map<string, number>>(new Map());
  const [rewardCounts, setRewardCounts] = useState<Map<string, number>>(new Map());
  const [storeCounts, setStoreCounts] = useState<Map<string, number>>(new Map());
  const [clientBrandsMap, setClientBrandsMap] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, membersRes, programsRes, rewardsRes, storesRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('member_users').select('client_id'),
        supabase.from('membership_programs').select('client_id'),
        supabase.from('rewards').select('brand_id, client_id, brands(name)'),
        supabase.from('shopify_store_installations').select('client_id'),
      ]);

      setClients(clientsRes.data || []);

      const mMap = new Map<string, number>();
      (membersRes.data || []).forEach((r: any) => r.client_id && mMap.set(r.client_id, (mMap.get(r.client_id) || 0) + 1));
      setMemberCounts(mMap);

      const pMap = new Map<string, number>();
      (programsRes.data || []).forEach((r: any) => r.client_id && pMap.set(r.client_id, (pMap.get(r.client_id) || 0) + 1));
      setProgramCounts(pMap);

      const rMap = new Map<string, number>();
      (rewardsRes.data || []).forEach((r: any) => r.brand_id && rMap.set(r.brand_id, (rMap.get(r.brand_id) || 0) + 1));
      setRewardCounts(rMap);

      const sMap = new Map<string, number>();
      (storesRes.data || []).forEach((r: any) => r.client_id && sMap.set(r.client_id, (sMap.get(r.client_id) || 0) + 1));
      setStoreCounts(sMap);

      // Build client_id → brand names map
      const bMap = new Map<string, string[]>();
      (rewardsRes.data || []).forEach((r: any) => {
        if (!r.client_id || !r.brands?.name) return;
        const existing = bMap.get(r.client_id) || [];
        if (!existing.includes(r.brands.name)) existing.push(r.brands.name);
        bMap.set(r.client_id, existing);
      });
      setClientBrandsMap(bMap);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalActive = useMemo(() => clients.filter(c => c.is_active).length, [clients]);
  const totalInactive = useMemo(() => clients.filter(c => !c.is_active).length, [clients]);

  const filteredClients = useMemo(() => clients.filter((c) => {
    if (searchQuery && !c.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !c.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter === 'active' && !c.is_active) return false;
    if (statusFilter === 'inactive' && c.is_active) return false;
    return true;
  }), [clients, searchQuery, statusFilter]);

  const activeFilters = [
    statusFilter !== 'all' && { key: 'status', label: `Status: ${statusFilter}`, clear: () => setStatusFilter('all') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const statCards = [
    { label: 'Total Clients', count: clients.length, color: 'text-gray-800', bg: 'bg-gray-50', value: 'all' },
    { label: 'Active', count: totalActive, color: 'text-green-700', bg: 'bg-green-50', value: 'active' },
    { label: 'Inactive', count: totalInactive, color: 'text-red-700', bg: 'bg-red-50', value: 'inactive' },
  ];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Clients Management">
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-gray-500">Loading clients...</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Clients Management</h1>
                <p className="text-gray-600 mt-1">Manage client organizations and their profiles</p>
              </div>
              <Link to="/admin/clients/new">
                <Button><Plus className="w-4 h-4 mr-2" />Add Client</Button>
              </Link>
            </div>

            {/* Clickable summary stat cards */}
            <div className="grid grid-cols-3 gap-4">
              {statCards.map((stat) => (
                <button
                  key={stat.value}
                  onClick={() => setStatusFilter(stat.value)}
                  className={`${stat.bg} rounded-xl p-4 text-left transition-all border-2 ${statusFilter === stat.value ? 'border-blue-400 shadow-sm' : 'border-transparent hover:border-gray-200'}`}
                >
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
                </button>
              ))}
            </div>

            <Card>
              {/* Filters */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-52 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by name or email…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {activeFilters.map(f => (
                      <span key={f.key} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                        {f.label}
                        <button onClick={f.clear} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                Showing <span className="font-medium text-gray-700">{filteredClients.length}</span> of {clients.length} clients
              </div>

              {filteredClients.length === 0 ? (
                <div className="p-12 text-center">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base font-medium text-gray-900 mb-1">No clients found</h3>
                  <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Client</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Contact</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Members</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Programs</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Brands</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Stores</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Joined</th>
                        <th className="px-4 py-3 w-24 text-right font-medium text-gray-500 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredClients.map((client) => {
                        const members = memberCounts.get(client.id) || 0;
                        const programs = programCounts.get(client.id) || 0;
                        const stores = storeCounts.get(client.id) || 0;
                        const linkedBrands = clientBrandsMap.get(client.id) || [];
                        return (
                          <tr key={client.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <Link to={`/admin/clients/${client.id}`} className="flex items-center gap-3 min-w-0">
                                {client.logo_url ? (
                                  <img src={client.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0"
                                    style={client.primary_color ? { backgroundColor: client.primary_color + '22' } : {}}>
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate max-w-[180px]">{client.name}</div>
                                  {client.description && <div className="text-xs text-gray-400 truncate max-w-[180px]">{client.description}</div>}
                                </div>
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {client.is_active ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                  <CheckCircle className="w-3 h-3" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                  <XCircle className="w-3 h-3" /> Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-xs text-gray-500 truncate max-w-[180px]">
                                  <Mail className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{client.contact_email}</span>
                                </div>
                                {client.contact_phone && (
                                  <div className="flex items-center gap-1 text-xs text-gray-400">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    {client.contact_phone}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Link to={`/admin/users?client=${client.id}`}
                                className={`inline-flex items-center gap-1 font-semibold transition-colors ${members > 0 ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300'}`}>
                                <Users className="w-3.5 h-3.5" />
                                {members}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 font-semibold ${programs > 0 ? 'text-purple-600' : 'text-gray-300'}`}>
                                <Gift className="w-3.5 h-3.5" />
                                {programs}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {linkedBrands.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {linkedBrands.slice(0, 3).map(b => (
                                    <span key={b} className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-100 truncate max-w-[90px]">{b}</span>
                                  ))}
                                  {linkedBrands.length > 3 && (
                                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">+{linkedBrands.length - 3}</span>
                                  )}
                                </div>
                              ) : <span className="text-gray-300 text-sm">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Link to={`/admin/store-installations?client=${client.id}`}
                                className={`inline-flex items-center gap-1 font-semibold transition-colors ${stores > 0 ? 'text-indigo-600 hover:text-indigo-800' : 'text-gray-300'}`}>
                                <Store className="w-3.5 h-3.5" />
                                {stores}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link to={`/admin/clients/${client.id}/subscription`}
                                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Subscription">
                                  <CreditCard className="w-3.5 h-3.5" />
                                </Link>
                                <Link to={`/admin/clients/${client.id}/features`}
                                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Features">
                                  <Layers className="w-3.5 h-3.5" />
                                </Link>
                                <Link to={`/admin/clients/${client.id}`}
                                  className="p-1.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors">
                                  <ChevronRight className="w-4 h-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
