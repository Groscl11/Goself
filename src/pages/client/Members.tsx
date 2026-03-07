import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Upload, Eye, EyeOff, UserPlus, Users, Coins, ShoppingBag, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';

interface Member {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  memberships_count?: number;
  rewards_count?: number;
  source?: {
    source_type: string;
    created_at: string;
  };
  // Loyalty fields
  points_balance?: number;
  tier_name?: string | null;
  total_orders?: number;
  total_spend?: number;
}

// ── PI masking helpers ────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  return phone.slice(0, phone.indexOf(digits[0]) + 3) + '****' + digits.slice(-2);
}

function RevealCell({ masked, plain }: { masked: string; plain: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 group">
      <span className={`text-sm ${revealed ? 'text-gray-900' : 'text-gray-500 tracking-wider'}`}>
        {revealed ? plain : masked}
      </span>
      <button
        onClick={() => setRevealed((v) => !v)}
        title={revealed ? 'Hide' : 'Reveal'}
        className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
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
          const [membershipsResult, rewardsResult, sourceResult, loyaltyResult] = await Promise.all([
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
            supabase
              .from('member_loyalty_status')
              .select('points_balance, total_orders, total_spend, current_tier_id, tier:loyalty_tiers(tier_name)')
              .eq('member_user_id', member.id)
              .order('points_balance', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          const loyalty = loyaltyResult.data as any;

          return {
            ...member,
            memberships_count: membershipsResult.count || 0,
            rewards_count: rewardsResult.count || 0,
            source: sourceResult.data || undefined,
            points_balance: loyalty?.points_balance ?? 0,
            tier_name: loyalty?.tier?.tier_name ?? null,
            total_orders: loyalty?.total_orders ?? 0,
            total_spend: loyalty?.total_spend ?? 0,
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
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (member.full_name ?? '').toLowerCase().includes(q) ||
      (member.email ?? '').toLowerCase().includes(q) ||
      (member.phone ?? '').toLowerCase().includes(q);

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
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Member</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Contact
                        <span className="ml-1 text-xs font-normal text-gray-400">(hover to reveal)</span>
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Source</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Registered</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Memberships</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-amber-500" />Tier</span>
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-amber-500" />Points</span>
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        <span className="flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5 text-blue-500" />Orders</span>
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Spend</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                        {/* Member name + ID */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {(member.full_name ?? 'M')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.full_name || 'N/A'}</p>
                              <p className="text-xs text-gray-500">ID: {member.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contact — masked PI */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-0.5">
                            <RevealCell
                              masked={maskEmail(member.email)}
                              plain={member.email}
                            />
                            {member.phone && (
                              <RevealCell
                                masked={maskPhone(member.phone)}
                                plain={member.phone}
                              />
                            )}
                          </div>
                        </td>

                        {/* Source */}
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
                            <span className="text-gray-400">Unknown</span>
                          )}
                        </td>

                        {/* Registered */}
                        <td className="py-4 px-4">
                          <p className="text-gray-900">{new Date(member.created_at).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500">{new Date(member.created_at).toLocaleTimeString()}</p>
                        </td>

                        {/* Memberships */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                            {member.memberships_count || 0}
                          </span>
                        </td>

                        {/* Loyalty Tier */}
                        <td className="py-4 px-4">
                          {member.tier_name ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              {member.tier_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Current Points */}
                        <td className="py-4 px-4">
                          <span className="font-semibold text-amber-700">
                            {(member.points_balance ?? 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Total Orders */}
                        <td className="py-4 px-4">
                          <span className="font-medium text-gray-800">
                            {(member.total_orders ?? 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Total Spend */}
                        <td className="py-4 px-4">
                          <span className="font-medium text-gray-800">
                            {(member.total_spend ?? 0) > 0
                              ? (member.total_spend!).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '—'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            member.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {member.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
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
