import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Mail,
  Shield,
  Building2,
  Award,
  Calendar,
  Users,
  Gift,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface Profile {
  id: string;
  role: string;
  full_name: string;
  email: string;
  client_id: string | null;
  brand_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Client {
  id: string;
  name: string;
  description: string;
  logo_url: string;
}

interface Brand {
  id: string;
  name: string;
  description: string;
  logo_url: string;
}

interface RewardAllocation {
  id: string;
  allocated_at: string;
  quantity_allocated: number;
  quantity_redeemed: number;
  reward: {
    title: string;
    reward_id: string;
    brand: {
      name: string;
    };
  };
  membership: {
    program: {
      name: string;
      client: {
        name: string;
      };
    };
  };
}

interface Redemption {
  id: string;
  redeemed_at: string;
  redemption_channel: string;
  reward: {
    title: string;
    reward_id: string;
    brand: {
      name: string;
    };
  };
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [memberUser, setMemberUser] = useState<any>(null);
  const [allocations, setAllocations] = useState<RewardAllocation[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'history'>('overview');

  useEffect(() => {
    if (id) {
      fetchUserData();
    }
  }, [id]);

  const fetchUserData = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData) {
        setProfile(profileData);

        if (profileData.client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', profileData.client_id)
            .maybeSingle();
          setClient(clientData);
        }

        if (profileData.brand_id) {
          const { data: brandData } = await supabase
            .from('brands')
            .select('*')
            .eq('id', profileData.brand_id)
            .maybeSingle();
          setBrand(brandData);
        }

        const { data: memberData } = await supabase
          .from('member_users')
          .select('*')
          .eq('auth_user_id', id)
          .maybeSingle();

        if (memberData) {
          setMemberUser(memberData);

          const { data: allocationsData } = await supabase
            .from('member_rewards_allocation')
            .select(`
              *,
              reward:rewards(
                title,
                reward_id,
                brand:brands(name)
              ),
              membership:member_memberships(
                program:membership_programs(
                  name,
                  client:clients(name)
                )
              )
            `)
            .eq('member_id', memberData.id)
            .order('allocated_at', { ascending: false });

          setAllocations(allocationsData || []);

          const { data: redemptionsData } = await supabase
            .from('redemptions')
            .select(`
              *,
              reward:rewards(
                title,
                reward_id,
                brand:brands(name)
              )
            `)
            .eq('member_id', memberData.id)
            .order('redeemed_at', { ascending: false });

          setRedemptions(redemptionsData || []);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-700',
      client: 'bg-blue-100 text-blue-700',
      brand: 'bg-green-100 text-green-700',
      member: 'bg-orange-100 text-orange-700',
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-5 h-5" />;
      case 'client':
        return <Building2 className="w-5 h-5" />;
      case 'brand':
        return <Award className="w-5 h-5" />;
      default:
        return <Users className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-500">Loading user details...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">User not found</p>
        <Button onClick={() => navigate('/admin/users')} className="mt-4">
          Back to Users
        </Button>
      </div>
    );
  }

  const totalRewards = allocations.reduce((sum, a) => sum + a.quantity_allocated, 0);
  const totalRedeemed = allocations.reduce((sum, a) => sum + a.quantity_redeemed, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/users')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {profile.full_name || 'Unnamed User'}
          </h1>
          <p className="text-gray-600 mt-1">{profile.email}</p>
        </div>
        <Link to={`/admin/users/${id}/edit`}>
          <Button variant="secondary">
            <Edit className="w-4 h-4 mr-2" />
            Edit User
          </Button>
        </Link>
      </div>

      {profile.role === 'member' && memberUser && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500">Total Rewards</div>
                <Gift className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{totalRewards}</div>
              <div className="text-sm text-gray-600 mt-1">Allocated</div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500">Redeemed</div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{totalRedeemed}</div>
              <div className="text-sm text-gray-600 mt-1">
                {totalRewards > 0 ? ((totalRedeemed / totalRewards) * 100).toFixed(0) : 0}% rate
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500">Programs</div>
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {new Set(allocations.map((a) => a.membership.program.name)).size}
              </div>
              <div className="text-sm text-gray-600 mt-1">Enrolled</div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500">Clients</div>
                <Building2 className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {new Set(allocations.map((a) => a.membership.program.client.name)).size}
              </div>
              <div className="text-sm text-gray-600 mt-1">Connected</div>
            </div>
          </Card>
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          {profile.role === 'member' && (
            <>
              <button
                onClick={() => setActiveTab('rewards')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'rewards'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Rewards ({allocations.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Transaction History ({redemptions.length})
              </button>
            </>
          )}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">User Information</h2>
                <div className="flex items-start gap-6 mb-6">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {profile.full_name || 'Unnamed User'}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        {profile.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full ${getRoleBadge(
                            profile.role
                          )}`}
                        >
                          {getRoleIcon(profile.role)}
                          {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {client && (
              <Card>
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Associated Client</h2>
                  <Link
                    to={`/admin/clients/${client.id}`}
                    className="flex items-start gap-4 hover:bg-gray-50 p-4 rounded-lg transition-colors"
                  >
                    {client.logo_url ? (
                      <img
                        src={client.logo_url}
                        alt={client.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{client.name}</h3>
                      {client.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{client.description}</p>
                      )}
                    </div>
                  </Link>
                </div>
              </Card>
            )}

            {brand && (
              <Card>
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Associated Brand</h2>
                  <Link
                    to={`/admin/brands/${brand.id}`}
                    className="flex items-start gap-4 hover:bg-gray-50 p-4 rounded-lg transition-colors"
                  >
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                        <Award className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{brand.name}</h3>
                      {brand.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{brand.description}</p>
                      )}
                    </div>
                  </Link>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Account Details</h2>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">User ID</div>
                    <div className="font-mono text-sm text-gray-900 break-all">{profile.id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Created</div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">
                        {new Date(profile.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Last Updated</div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">
                        {new Date(profile.updated_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Role Information</h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Current Role</div>
                    <div className="flex items-center gap-2">
                      {getRoleIcon(profile.role)}
                      <span className="font-medium capitalize">{profile.role}</span>
                    </div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-500 mb-2">Role Permissions</div>
                    <ul className="text-sm space-y-1 text-gray-700">
                      {profile.role === 'admin' && (
                        <>
                          <li>Full platform access</li>
                          <li>Manage all users</li>
                          <li>Manage clients and brands</li>
                          <li>View all analytics</li>
                        </>
                      )}
                      {profile.role === 'client' && (
                        <>
                          <li>Manage membership programs</li>
                          <li>Manage members</li>
                          <li>Select rewards from marketplace</li>
                          <li>View client analytics</li>
                        </>
                      )}
                      {profile.role === 'brand' && (
                        <>
                          <li>Manage brand profile</li>
                          <li>Create and manage rewards</li>
                          <li>View redemption analytics</li>
                          <li>Track performance</li>
                        </>
                      )}
                      {profile.role === 'member' && (
                        <>
                          <li>Access membership portal</li>
                          <li>View available rewards</li>
                          <li>Redeem vouchers</li>
                          <li>Track redemption history</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="space-y-4">
          {allocations.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <Gift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No rewards allocated</h3>
                <p className="text-gray-500">This user hasn't received any rewards yet</p>
              </div>
            </Card>
          ) : (
            allocations.map((allocation) => (
              <Card key={allocation.id}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {allocation.reward.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Award className="w-4 h-4" />
                        <span>{allocation.reward.brand.name}</span>
                        <span className="text-gray-400">•</span>
                        <span className="font-mono text-xs">{allocation.reward.reward_id}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {allocation.quantity_redeemed}/{allocation.quantity_allocated}
                      </div>
                      <div className="text-sm text-gray-600">redeemed</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 mb-1">Client</div>
                      <div className="font-medium">{allocation.membership.program.client.name}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Program</div>
                      <div className="font-medium">{allocation.membership.program.name}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Allocated</div>
                      <div className="font-medium">
                        {new Date(allocation.allocated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Status</div>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          allocation.quantity_redeemed === allocation.quantity_allocated
                            ? 'bg-green-100 text-green-700'
                            : allocation.quantity_redeemed > 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {allocation.quantity_redeemed === allocation.quantity_allocated
                          ? 'Fully Redeemed'
                          : allocation.quantity_redeemed > 0
                          ? 'Partially Redeemed'
                          : 'Available'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {redemptions.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No redemptions yet</h3>
                <p className="text-gray-500">This user hasn't redeemed any rewards</p>
              </div>
            </Card>
          ) : (
            redemptions.map((redemption) => (
              <Card key={redemption.id}>
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {redemption.reward.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <Award className="w-4 h-4" />
                        <span>{redemption.reward.brand.name}</span>
                        <span className="text-gray-400">•</span>
                        <span className="font-mono text-xs">{redemption.reward.reward_id}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(redemption.redeemed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <span className="text-gray-400">•</span>
                        <div className="capitalize">{redemption.redemption_channel}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
