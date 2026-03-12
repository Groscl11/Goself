import { useState, useEffect, useMemo } from 'react';
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
  ShoppingBag,
  Phone,
  Hash,
  Package,
  Star,
  DollarSign,
  Activity,
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

interface MemberUserData {
  id: string;
  client_id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  phone: string;
  external_id: string | null;
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  order_id: string;
  order_number: string | null;
  total_price: number | null;
  currency: string;
  order_status: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  processed_at: string | null;
  created_at: string;
  customer_email: string;
  client_id: string | null;
  client_name: string;
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [memberUser, setMemberUser] = useState<MemberUserData | null>(null);
  const [allocations, setAllocations] = useState<RewardAllocation[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'brands' | 'orders' | 'rewards' | 'history'>('overview');

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

          const { data: ordersData } = await supabase
            .from('shopify_orders')
            .select('id, order_id, order_number, total_price, currency, order_status, financial_status, fulfillment_status, processed_at, created_at, customer_email, client_id, clients(name)')
            .or(`member_id.eq.${memberData.id},customer_email.eq.${memberData.email}`)
            .order('created_at', { ascending: false });

          setOrders(
            (ordersData || []).map((o: any) => ({
              ...o,
              client_name: o.clients?.name || 'Unknown Store',
            }))
          );
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
      <DashboardLayout menuItems={adminMenuItems} title="User Detail">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-gray-500">Loading user details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout menuItems={adminMenuItems} title="User Detail">
        <div className="text-center py-12">
          <p className="text-gray-500">User not found</p>
          <Button onClick={() => navigate('/admin/users')} className="mt-4">Back to Users</Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalRewards = allocations.reduce((sum, a) => sum + a.quantity_allocated, 0);
  const totalRedeemed = allocations.reduce((sum, a) => sum + a.quantity_redeemed, 0);
  const totalOrderSpend = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);

  const connectedBrands = useMemo(() => {
    const brandMap = new Map<string, { name: string; allocated: number; redeemed: number; rewardCount: number }>();
    allocations.forEach((a) => {
      const brandName = a.reward.brand.name;
      const existing = brandMap.get(brandName) || { name: brandName, allocated: 0, redeemed: 0, rewardCount: 0 };
      existing.allocated += a.quantity_allocated;
      existing.redeemed += a.quantity_redeemed;
      existing.rewardCount += 1;
      brandMap.set(brandName, existing);
    });
    return Array.from(brandMap.values()).sort((a, b) => b.allocated - a.allocated);
  }, [allocations]);

  const ordersByStore = useMemo(() => {
    const storeMap = new Map<string, { clientName: string; orders: Order[]; totalSpend: number; currency: string }>();
    orders.forEach((o) => {
      const key = o.client_id || 'unknown';
      const existing = storeMap.get(key) || { clientName: o.client_name, orders: [], totalSpend: 0, currency: o.currency || 'MYR' };
      existing.orders.push(o);
      existing.totalSpend += o.total_price || 0;
      storeMap.set(key, existing);
    });
    return Array.from(storeMap.values()).sort((a, b) => b.orders.length - a.orders.length);
  }, [orders]);

  return (
    <DashboardLayout menuItems={adminMenuItems} title="User Detail">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">Rewards</div>
                <Gift className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{totalRewards}</div>
              <div className="text-xs text-gray-600 mt-1">Allocated</div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">Redeemed</div>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{totalRedeemed}</div>
              <div className="text-xs text-gray-600 mt-1">
                {totalRewards > 0 ? ((totalRedeemed / totalRewards) * 100).toFixed(0) : 0}% rate
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">Brands</div>
                <Star className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{connectedBrands.length}</div>
              <div className="text-xs text-gray-600 mt-1">Connected</div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">Programs</div>
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {new Set(allocations.map((a) => a.membership.program.name)).size}
              </div>
              <div className="text-xs text-gray-600 mt-1">Enrolled</div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">Orders</div>
                <ShoppingBag className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
              <div className="text-xs text-gray-600 mt-1">Total</div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">Total Spend</div>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {totalOrderSpend.toFixed(0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {orders.length > 0 ? orders[0].currency : 'MYR'}
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
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
                onClick={() => setActiveTab('brands')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'brands'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Brands ({connectedBrands.length})
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('rewards')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'rewards'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Rewards ({allocations.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                History ({redemptions.length})
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
                      {memberUser?.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {memberUser.phone}
                        </div>
                      )}
                      {memberUser?.external_id && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Hash className="w-4 h-4" />
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{memberUser.external_id}</span>
                          <span className="text-xs text-gray-400">External ID</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full ${getRoleBadge(
                            profile.role
                          )}`}
                        >
                          {getRoleIcon(profile.role)}
                          {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                        </span>
                        {memberUser && (
                          <span className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                            memberUser.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            <Activity className="w-3 h-3" />
                            {memberUser.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
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

      {activeTab === 'brands' && (
        <div className="space-y-4">
          {connectedBrands.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No brand connections</h3>
                <p className="text-gray-500">This member hasn't received any rewards yet</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedBrands.map((brand) => (
                <Card key={brand.name}>
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{brand.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {brand.rewardCount} reward type{brand.rewardCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-blue-700">{brand.allocated}</div>
                        <div className="text-xs text-blue-600 mt-0.5">Allocated</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-green-700">{brand.redeemed}</div>
                        <div className="text-xs text-green-600 mt-0.5">Redeemed</div>
                      </div>
                    </div>
                    {brand.allocated > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Redemption rate</span>
                          <span>{((brand.redeemed / brand.allocated) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min((brand.redeemed / brand.allocated) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-6">
          {orders.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                <p className="text-gray-500">No orders are linked to this member</p>
              </div>
            </Card>
          ) : (
            ordersByStore.map((store, storeIdx) => (
              <Card key={storeIdx}>
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{store.clientName}</h3>
                        <p className="text-sm text-gray-500">
                          {store.orders.length} order{store.orders.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {store.currency} {store.totalSpend.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">Total spend</div>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {store.orders.map((order) => (
                    <div key={order.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Package className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {order.order_number ? `#${order.order_number}` : order.order_id}
                            </div>
                            <div className="text-sm text-gray-500 mt-0.5">
                              {order.processed_at
                                ? new Date(order.processed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {order.order_status && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                              order.order_status === 'paid' || order.order_status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : order.order_status === 'cancelled' || order.order_status === 'refunded'
                                ? 'bg-red-100 text-red-700'
                                : order.order_status === 'pending'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {order.order_status.replace(/_/g, ' ')}
                            </span>
                          )}
                          <div className="font-semibold text-gray-900">
                            {order.currency} {(order.total_price ?? 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      {(order.financial_status || order.fulfillment_status) && (
                        <div className="flex items-center gap-4 mt-2 ml-11">
                          {order.financial_status && (
                            <span className="text-xs text-gray-500 capitalize">
                              Payment: <span className="font-medium text-gray-700">{order.financial_status.replace(/_/g, ' ')}</span>
                            </span>
                          )}
                          {order.fulfillment_status && (
                            <span className="text-xs text-gray-500 capitalize">
                              Fulfillment: <span className="font-medium text-gray-700">{order.fulfillment_status.replace(/_/g, ' ')}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
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
    </DashboardLayout>
  );
}
