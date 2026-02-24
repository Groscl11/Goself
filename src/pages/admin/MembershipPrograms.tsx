import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Users, Gift, Calendar, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { adminMenuItems } from './adminMenuItems';

interface MembershipProgram {
  id: string;
  name: string;
  description: string;
  client_id: string;
  tier_level: string | null;
  enrollment_type: string;
  validity_days: number;
  max_rewards_total: number | null;
  max_rewards_per_brand: number | null;
  enrollment_fee: number;
  renewal_fee: number;
  is_active: boolean;
  created_at: string;
  clients: {
    name: string;
  };
  member_count?: number;
  rewards_count?: number;
}

export function MembershipPrograms() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<MembershipProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: 'all',
    client: 'all',
    searchTerm: ''
  });

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('membership_programs')
        .select(`
          *,
          clients (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const programsWithCounts = await Promise.all(
        (data || []).map(async (program) => {
          const [membersRes, rewardsRes] = await Promise.all([
            supabase
              .from('member_memberships')
              .select('id', { count: 'exact', head: true })
              .eq('program_id', program.id),
            supabase
              .from('membership_program_rewards')
              .select('id', { count: 'exact', head: true })
              .eq('program_id', program.id)
          ]);

          return {
            ...program,
            member_count: membersRes.count || 0,
            rewards_count: rewardsRes.count || 0
          };
        })
      );

      setPrograms(programsWithCounts);
    } catch (error) {
      console.error('Error loading programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this program?')) return;

    try {
      const { error } = await supabase
        .from('membership_programs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadPrograms();
    } catch (error) {
      console.error('Error deleting program:', error);
      alert('Failed to delete program');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('membership_programs')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadPrograms();
    } catch (error) {
      console.error('Error updating program status:', error);
    }
  };

  const filteredPrograms = programs.filter(program => {
    if (filter.status !== 'all') {
      if (filter.status === 'active' && !program.is_active) return false;
      if (filter.status === 'inactive' && program.is_active) return false;
    }
    if (filter.client !== 'all' && program.client_id !== filter.client) return false;
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      return (
        program.name.toLowerCase().includes(term) ||
        program.description?.toLowerCase().includes(term) ||
        program.clients.name.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const stats = {
    total: programs.length,
    active: programs.filter(p => p.is_active).length,
    totalMembers: programs.reduce((sum, p) => sum + (p.member_count || 0), 0),
    totalRewards: programs.reduce((sum, p) => sum + (p.rewards_count || 0), 0)
  };

  const uniqueClients = Array.from(new Set(programs.map(p => ({ id: p.client_id, name: p.clients.name }))));

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Membership Programs">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membership Programs</h1>
            <p className="text-gray-600 mt-1">Create and manage membership programs</p>
          </div>
          <Button onClick={() => navigate('/admin/membership-programs/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Program
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Programs</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Programs</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.active}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Members</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalMembers}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Rewards</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRewards}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">All Programs</h2>
              <div className="flex gap-2">
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select
                  value={filter.client}
                  onChange={(e) => setFilter({ ...filter, client: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Clients</option>
                  {uniqueClients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search programs..."
                  value={filter.searchTerm}
                  onChange={(e) => setFilter({ ...filter, searchTerm: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="text-gray-500">Loading programs...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enrollment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rewards</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPrograms.map((program) => (
                      <tr key={program.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{program.name}</div>
                          <div className="text-xs text-gray-500">{program.description?.substring(0, 50)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{program.clients.name}</td>
                        <td className="px-4 py-3">
                          {program.tier_level ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 capitalize">
                              {program.tier_level}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {program.enrollment_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{program.member_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{program.rewards_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{program.validity_days} days</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleStatus(program.id, program.is_active)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              program.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {program.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/admin/membership-programs/${program.id}`)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(program.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredPrograms.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No programs found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
