import { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';
import { supabase } from '../../lib/supabase';
import { Globe, Search, Users, Layers, Store, ChevronDown, ChevronUp } from 'lucide-react';

interface Client { id: string; name: string; }

interface MemberRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  client_id: string;
  client_name: string | null;
  total_points: number;
  created_at: string;
  store_name: string | null;
}

interface UserGroup {
  key: string; // email or phone as grouping key
  display_name: string | null;
  email: string | null;
  phone: string | null;
  members: MemberRow[];
  total_points: number;
  earliest_joined: string;
}

export function GlobalUsers() {
  const [allMembers, setAllMembers] = useState<MemberRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [membersRes, clientsRes, storesRes] = await Promise.all([
      supabase
        .from('member_users')
        .select('id, full_name, email, phone, client_id, total_points, created_at, clients(name)')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('shopify_store_installations').select('client_id, shop_name'),
    ]);
    // Build client_id → shop_name lookup (first store per client)
    const storeMap = new Map<string, string>();
    (storesRes.data || []).forEach((s: any) => {
      if (s.client_id && !storeMap.has(s.client_id)) storeMap.set(s.client_id, s.shop_name);
    });
    const rows: MemberRow[] = (membersRes.data || []).map((m: any) => ({
      id: m.id,
      full_name: m.full_name || null,
      email: m.email || null,
      phone: m.phone || null,
      client_id: m.client_id,
      client_name: m.clients?.name || null,
      total_points: m.total_points || 0,
      created_at: m.created_at,
      store_name: storeMap.get(m.client_id) || null,
    }));
    setAllMembers(rows);
    if (clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
  }

  // Group by email (or phone fallback) to detect multi-store users
  function buildGroups(members: MemberRow[]): UserGroup[] {
    const map = new Map<string, UserGroup>();
    for (const m of members) {
      const key = m.email || m.phone || m.id;
      if (!map.has(key)) {
        map.set(key, {
          key,
          display_name: m.full_name,
          email: m.email,
          phone: m.phone,
          members: [],
          total_points: 0,
          earliest_joined: m.created_at,
        });
      }
      const g = map.get(key)!;
      g.members.push(m);
      g.total_points += m.total_points;
      if (m.full_name && !g.display_name) g.display_name = m.full_name;
      if (m.created_at < g.earliest_joined) g.earliest_joined = m.created_at;
    }
    return Array.from(map.values());
  }

  // Apply filters
  const filtered = allMembers.filter(m => {
    const q = query.toLowerCase();
    const matchesSearch = !q ||
      m.full_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.phone?.includes(q);
    const matchesClient = !filterClient || m.client_id === filterClient;
    return matchesSearch && matchesClient;
  });

  const groups = buildGroups(filtered);
  const multiStoreCount = groups.filter(g => g.members.length > 1).length;

  function handleQueryChange(val: string) {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {}, 0); // instant filtering
  }

  function initials(name: string | null, email: string | null) {
    if (name) return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    if (email) return email[0].toUpperCase();
    return '?';
  }

  const BG_COLORS = ['bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700', 'bg-violet-100 text-violet-700',
    'bg-orange-100 text-orange-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700'];
  const colorFor = (key: string) => BG_COLORS[key.charCodeAt(0) % BG_COLORS.length];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Global Users">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Global Users</h1>
            <p className="text-sm text-gray-500">All member identities across every client store</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="w-9 h-9 bg-sky-100 rounded-lg flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{groups.length.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Unique Identities</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
              <Layers className="w-5 h-5 text-violet-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{multiStoreCount.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Multi-Store Members</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
              <Store className="w-5 h-5 text-teal-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{filtered.length.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Memberships</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="Search by name, email or phone…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 min-w-44"
          >
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-gray-400">Loading users…</div>
          ) : groups.length === 0 ? (
            <div className="py-20 text-center">
              <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No users found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-600">Member</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Contact</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Stores / Clients</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-right">Total Points</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Joined</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groups.map(group => (
                      <>
                        <tr
                          key={group.key}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setExpandedKey(expandedKey === group.key ? null : group.key)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${colorFor(group.key)}`}>
                                {initials(group.display_name, group.email)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{group.display_name || '—'}</div>
                                {group.members.length > 1 && (
                                  <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full font-medium">
                                    {group.members.length} stores
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-700 text-sm">{group.email || '—'}</div>
                            {group.phone && <div className="text-xs text-gray-400 mt-0.5">{group.phone}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {group.members.map(m => (
                                <span key={m.id} className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2 py-0.5 rounded-full font-medium">
                                  {m.client_name || m.client_id}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-gray-900">{group.total_points.toLocaleString()}</span>
                            <span className="text-xs text-gray-400 ml-1">pts</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">
                            {new Date(group.earliest_joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {expandedKey === group.key
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>

                        {/* Expanded detail rows */}
                        {expandedKey === group.key && group.members.map(m => (
                          <tr key={`detail-${m.id}`} className="bg-sky-50/40">
                            <td className="pl-16 pr-4 py-2.5 text-xs text-gray-500 italic">
                              {m.client_name || m.client_id}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">
                              {m.email || m.phone || '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              {m.store_name && (
                                <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
                                  {m.store_name}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium text-gray-700">
                              {m.total_points.toLocaleString()} pts
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-400" colSpan={2}>
                              Joined {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                Showing {groups.length} identities · {filtered.length} total memberships
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
