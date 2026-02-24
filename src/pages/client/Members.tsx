import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Upload, Eye, UserPlus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';

interface Member {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  memberships_count?: number;
  rewards_count?: number;
  source?: {
    source_type: string;
    created_at: string;
  };
}

export function Members() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (profile?.client_id) {
      loadMembers();
    }
  }, [profile?.client_id]);

  const loadMembers = async () => {
    if (!profile?.client_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('member_users')
        .select('*')
        .eq('client_id', profile.client_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const membersWithCounts = await Promise.all(
        (data || []).map(async (member) => {
          const [membershipsResult, rewardsResult, sourceResult] = await Promise.all([
            supabase
              .from('member_memberships')
              .select('id', { count: 'exact', head: true })
              .eq('member_id', member.id),
            supabase
              .from('member_rewards_allocation')
              .select('id', { count: 'exact', head: true })
              .eq('member_id', member.id),
            supabase
              .from('member_sources')
              .select('source_type, created_at')
              .eq('member_id', member.id)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle(),
          ]);

          return {
            ...member,
            memberships_count: membershipsResult.count || 0,
            rewards_count: rewardsResult.count || 0,
            source: sourceResult.data || undefined,
          };
        })
      );

      setMembers(membersWithCounts);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterActive === null || member.is_active === filterActive;

    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Members">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Members</h1>
            <p className="text-gray-600 mt-2">Manage your member database</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate('/client/members/import')}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Members
            </Button>
            <Button onClick={() => navigate('/client/members/new')}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>All Members ({filteredMembers.length})</CardTitle>
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterActive === null ? 'all' : filterActive ? 'active' : 'inactive'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilterActive(value === 'all' ? null : value === 'active');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No members found</p>
                <p className="text-gray-500 text-sm mt-2">
                  {searchQuery || filterActive !== null
                    ? 'Try adjusting your filters'
                    : 'Add your first member to get started'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Member</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Source</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Registered</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Memberships</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Rewards</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                              {member.full_name?.[0]?.toUpperCase() || 'M'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.full_name || 'N/A'}</p>
                              <p className="text-xs text-gray-500">ID: {member.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-gray-900">{member.email}</p>
                          {member.phone && (
                            <p className="text-sm text-gray-500">{member.phone}</p>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {member.source ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              member.source.source_type === 'campaign' ? 'bg-purple-50 text-purple-700' :
                              member.source.source_type === 'import' ? 'bg-blue-50 text-blue-700' :
                              member.source.source_type === 'organic' ? 'bg-green-50 text-green-700' :
                              member.source.source_type === 'referral' ? 'bg-orange-50 text-orange-700' :
                              'bg-gray-50 text-gray-700'
                            }`}>
                              {member.source.source_type.charAt(0).toUpperCase() + member.source.source_type.slice(1)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">Unknown</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-gray-900">
                            {new Date(member.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(member.created_at).toLocaleTimeString()}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                            {member.memberships_count || 0}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
                            {member.rewards_count || 0}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              member.is_active
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {member.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/client/members/${member.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
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
      </div>
    </DashboardLayout>
  );
}
