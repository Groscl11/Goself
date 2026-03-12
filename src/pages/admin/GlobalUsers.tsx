import { useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';
import { supabase } from '../../lib/supabase';
import { Globe, Search, User, ChevronRight } from 'lucide-react';

interface MemberEntry {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  client_id: string;
  client_name: string | null;
  total_points: number;
  created_at: string;
}

interface GlobalUserResult {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  members: MemberEntry[];
}

export function GlobalUsers() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalUserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = { current: 0 as ReturnType<typeof setTimeout> };

  function handleSearch(val: string) {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(() => runSearch(val.trim()), 500);
  }

  async function runSearch(q: string) {
    setLoading(true);
    setSearched(true);

    // Search global_users by email or phone
    const { data: globalUsers } = await supabase
      .from('global_users')
      .select('id, email, phone, created_at')
      .or(`email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(30);

    if (!globalUsers || globalUsers.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const globalIds = globalUsers.map(u => u.id);

    // Fetch member records for all matched global users
    const { data: members } = await supabase
      .from('member_users')
      .select('id, full_name, email, phone, client_id, total_points, created_at, global_user_id, clients(name)')
      .in('global_user_id', globalIds);

    const memberMap: Record<string, MemberEntry[]> = {};
    for (const m of members || []) {
      const gid = (m as any).global_user_id;
      if (!memberMap[gid]) memberMap[gid] = [];
      memberMap[gid].push({
        id: m.id,
        full_name: m.full_name,
        email: m.email,
        phone: m.phone,
        client_id: m.client_id,
        client_name: (m as any).clients?.name || null,
        total_points: m.total_points || 0,
        created_at: m.created_at,
      });
    }

    setResults(globalUsers.map(u => ({
      ...u,
      members: memberMap[u.id] || [],
    })));
    setLoading(false);
  }

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Global Users">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Global Users</h1>
            <p className="text-sm text-gray-500">Search a user across all client memberships by email or phone</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by email address or phone number…"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm"
          />
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Searching…</div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No matches found</p>
            <p className="text-sm text-gray-400 mt-1">Try searching with different email or phone</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 font-medium">
              {results.length} global identit{results.length === 1 ? 'y' : 'ies'} matched
            </p>
            {results.map(user => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Identity header */}
                <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100">
                  <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{user.email || 'No email'}</div>
                    <div className="text-sm text-gray-500">{user.phone || 'No phone'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Registered</div>
                    <div className="text-sm font-medium text-gray-700">
                      {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Memberships */}
                {user.members.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400 italic">No client memberships linked</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {user.members.map(m => (
                      <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{m.full_name || 'Unknown name'}</span>
                            <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2 py-0.5 rounded-full font-medium">
                              {m.client_name || m.client_id}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                            {m.email && <span>{m.email}</span>}
                            {m.email && m.phone && <span>·</span>}
                            {m.phone && <span>{m.phone}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-gray-900">{m.total_points.toLocaleString()} pts</div>
                          <div className="text-xs text-gray-400">
                            Joined {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Enter an email or phone number to search</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
