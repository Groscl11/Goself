import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Users as UsersIcon, Shield, Building2, Award,
  ChevronRight, X, Gift, CheckCircle, Activity,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';

interface Profile {
  id: string;
  role: string;
  full_name: string;
  email: string;
  client_id: string | null;
  brand_id: string | null;
  avatar_url: string | null;
  created_at: string;
}
interface Client { id: string; name: string; }
interface Brand { id: string; name: string; }

export function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [memberUserMap, setMemberUserMap] = useState<Map<string, { is_active: boolean; member_id: string }>>(new Map());
  const [allocationCounts, setAllocationCounts] = useState<Map<string, number>>(new Map());
  const [redemptionCounts, setRedemptionCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, clientsRes, brandsRes, memberUsersRes, allocationsRes, redemptionsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name'),
        supabase.from('brands').select('id, name'),
        supabase.from('member_users').select('id, auth_user_id, is_active'),
        supabase.from('member_rewards_allocation').select('member_id'),
        supabase.from('redemptions').select('member_id'),
      ]);

      setProfiles(profilesRes.data || []);
      setClients(clientsRes.data || []);
      setBrands(brandsRes.data || []);

      const muMap = new Map<string, { is_active: boolean; member_id: string }>();
      (memberUsersRes.data || []).forEach((mu: any) => {
        if (mu.auth_user_id) muMap.set(mu.auth_user_id, { is_active: mu.is_active, member_id: mu.id });
      });
      setMemberUserMap(muMap);

      const allocMap = new Map<string, number>();
      (allocationsRes.data || []).forEach((a: any) => {
        allocMap.set(a.member_id, (allocMap.get(a.member_id) || 0) + 1);
      });
      setAllocationCounts(allocMap);

      const redeemMap = new Map<string, number>();
      (redemptionsRes.data || []).forEach((r: any) => {
        redeemMap.set(r.member_id, (redeemMap.get(r.member_id) || 0) + 1);
      });
      setRedemptionCounts(redeemMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const roleCounts = useMemo(() =>
    profiles.reduce((acc, p) => { acc[p.role] = (acc[p.role] || 0) + 1; return acc; }, {} as Record<string, number>),
    [profiles]
  );

  const getClientName = (id: string | null) => clients.find(c => c.id === id)?.name ?? null;
  const getBrandName = (id: string | null) => brands.find(b => b.id === id)?.name ?? null;

  const getRoleBadge = (role: string) => ({
    admin: 'bg-purple-100 text-purple-700',
    client: 'bg-blue-100 text-blue-700',
    brand: 'bg-green-100 text-green-700',
    member: 'bg-orange-100 text-orange-700',
  } as Record<string, string>)[role] || 'bg-gray-100 text-gray-700';

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-3.5 h-3.5" />;
      case 'client': return <Building2 className="w-3.5 h-3.5" />;
      case 'brand': return <Award className="w-3.5 h-3.5" />;
      default: return <UsersIcon className="w-3.5 h-3.5" />;
    }
  };

  const filteredProfiles = useMemo(() => profiles.filter((p) => {
    if (searchQuery && !p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) && !p.email?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    if (clientFilter !== 'all' && p.client_id !== clientFilter) return false;
    if (statusFilter !== 'all') {
      const mu = memberUserMap.get(p.id);
      if (statusFilter === 'active' && (!mu || !mu.is_active)) return false;
      if (statusFilter === 'inactive' && (!mu || mu.is_active)) return false;
    }
    return true;
  }), [profiles, searchQuery, roleFilter, clientFilter, statusFilter, memberUserMap]);

  const activeFilters = [
    roleFilter !== 'all' && { key: 'role', label: `Role: ${roleFilter}`, clear: () => setRoleFilter('all') },
    clientFilter !== 'all' && { key: 'client', label: `Client: ${getClientName(clientFilter) || clientFilter}`, clear: () => setClientFilter('all') },
    statusFilter !== 'all' && { key: 'status', label: `Status: ${statusFilter}`, clear: () => setStatusFilter('all') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const statCards = [
    { label: 'Total Users', count: profiles.length, color: 'text-gray-800', bg: 'bg-gray-50', value: 'all' },
    { label: 'Admins', count: roleCounts['admin'] || 0, color: 'text-purple-700', bg: 'bg-purple-50', value: 'admin' },
    { label: 'Clients', count: roleCounts['client'] || 0, color: 'text-blue-700', bg: 'bg-blue-50', value: 'client' },
    { label: 'Brands', count: roleCounts['brand'] || 0, color: 'text-green-700', bg: 'bg-green-50', value: 'brand' },
    { label: 'Members', count: roleCounts['member'] || 0, color: 'text-orange-700', bg: 'bg-orange-50', value: 'member' },
  ];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Users Management">
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-gray-500">Loading users...</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
                <p className="text-gray-600 mt-1">Manage platform users and their roles</p>
              </div>
              <Link to="/admin/users/new">
                <Button><Plus className="w-4 h-4 mr-2" />Add User</Button>
              </Link>
            </div>

            {/* Clickable summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {statCards.map((stat) => (
                <button
                  key={stat.value}
                  onClick={() => setRoleFilter(stat.value)}
                  className={`${stat.bg} rounded-xl p-4 text-left transition-all border-2 ${roleFilter === stat.value ? 'border-blue-400 shadow-sm' : 'border-transparent hover:border-gray-200'}`}
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
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="client">Client</option>
                    <option value="brand">Brand</option>
                    <option value="member">Member</option>
                  </select>
                  <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="all">All Clients</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="all">Member Status</option>
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
                Showing <span className="font-medium text-gray-700">{filteredProfiles.length}</span> of {profiles.length} users
              </div>

              {filteredProfiles.length === 0 ? (
                <div className="p-12 text-center">
                  <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base font-medium text-gray-900 mb-1">No users found</h3>
                  <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">User</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Role</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Organization</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Status</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Rewards</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Redemptions</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Joined</th>
                        <th className="px-4 py-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredProfiles.map((profile) => {
                        const mu = memberUserMap.get(profile.id);
                        const allocCount = mu ? (allocationCounts.get(mu.member_id) || 0) : 0;
                        const redeemCount = mu ? (redemptionCounts.get(mu.member_id) || 0) : 0;
                        const org = getClientName(profile.client_id) || getBrandName(profile.brand_id);
                        return (
                          <tr key={profile.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <Link to={`/admin/users/${profile.id}`} className="flex items-center gap-3 min-w-0">
                                {profile.avatar_url ? (
                                  <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <UsersIcon className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate max-w-[160px]">{profile.full_name || 'Unnamed User'}</div>
                                  <div className="text-xs text-gray-400 truncate max-w-[160px]">{profile.email}</div>
                                </div>
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(profile.role)}`}>
                                {getRoleIcon(profile.role)}
                                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-sm">{org || <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-3 text-center">
                              {profile.role === 'member' && mu ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${mu.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  <Activity className="w-3 h-3" />
                                  {mu.is_active ? 'Active' : 'Inactive'}
                                </span>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {profile.role === 'member' ? (
                                <span className={`inline-flex items-center gap-1 font-semibold ${allocCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                  <Gift className="w-3.5 h-3.5" />
                                  {allocCount}
                                </span>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {profile.role === 'member' ? (
                                <span className={`inline-flex items-center gap-1 font-semibold ${redeemCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  {redeemCount}
                                </span>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3">
                              <Link to={`/admin/users/${profile.id}`} className="text-gray-300 hover:text-gray-500">
                                <ChevronRight className="w-4 h-4" />
                              </Link>
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
