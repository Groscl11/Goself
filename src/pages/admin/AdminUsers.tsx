import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users as UsersIcon, Mail, Shield, Building2, Award } from 'lucide-react';
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
}

interface Client {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

export function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesResult, clientsResult, brandsResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name'),
        supabase.from('brands').select('id, name'),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (clientsResult.error) throw clientsResult.error;
      if (brandsResult.error) throw brandsResult.error;

      setProfiles(profilesResult.data || []);
      setClients(clientsResult.data || []);
      setBrands(brandsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return null;
    return clients.find((c) => c.id === clientId)?.name;
  };

  const getBrandName = (brandId: string | null) => {
    if (!brandId) return null;
    return brands.find((b) => b.id === brandId)?.name;
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
        return <Shield className="w-4 h-4" />;
      case 'client':
        return <Building2 className="w-4 h-4" />;
      case 'brand':
        return <Award className="w-4 h-4" />;
      default:
        return <UsersIcon className="w-4 h-4" />;
    }
  };

  const filteredProfiles = profiles.filter((profile) => {
    const matchesSearch =
      profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || profile.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
          <p className="text-gray-600 mt-1">Manage platform users and their roles</p>
        </div>
        <Link to="/admin/users/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </Link>
      </div>

      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="client">Client</option>
              <option value="brand">Brand</option>
              <option value="member">Member</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredProfiles.length === 0 ? (
            <div className="p-12 text-center">
              <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500">
                {searchQuery || roleFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first user'}
              </p>
            </div>
          ) : (
            filteredProfiles.map((profile) => (
              <Link
                key={profile.id}
                to={`/admin/users/${profile.id}`}
                className="block hover:bg-gray-50 transition-colors"
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <UsersIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {profile.full_name || 'Unnamed User'}
                            </h3>
                            <span
                              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(
                                profile.role
                              )}`}
                            >
                              {getRoleIcon(profile.role)}
                              {profile.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Mail className="w-4 h-4" />
                            {profile.email}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            {profile.client_id && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-4 h-4" />
                                Client: {getClientName(profile.client_id) || 'Unknown'}
                              </span>
                            )}
                            {profile.brand_id && (
                              <span className="flex items-center gap-1">
                                <Award className="w-4 h-4" />
                                Brand: {getBrandName(profile.brand_id) || 'Unknown'}
                              </span>
                            )}
                            <span>
                              Joined{' '}
                              {new Date(profile.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
