import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Building2,
  Mail,
  Phone,
  Users,
  Gift,
  TrendingUp,
  Award,
  ShoppingBag,
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
  updated_at: string;
}

interface MembershipProgram {
  id: string;
  name: string;
  description: string;
  validity_days: number;
  is_active: boolean;
  created_at: string;
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [programs, setPrograms] = useState<MembershipProgram[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'programs' | 'members'>('overview');
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalPrograms: 0,
    activePrograms: 0,
  });

  useEffect(() => {
    if (id) {
      fetchClientData();
    }
  }, [id]);

  const fetchClientData = async () => {
    try {
      const [clientResult, programsResult, membersResult] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('membership_programs')
          .select('*')
          .eq('client_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('member_users')
          .select('*')
          .eq('client_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (clientResult.error) throw clientResult.error;
      if (programsResult.error) throw programsResult.error;
      if (membersResult.error) throw membersResult.error;

      setClient(clientResult.data);
      setPrograms(programsResult.data || []);
      setMembers(membersResult.data || []);

      setStats({
        totalMembers: membersResult.data?.length || 0,
        activeMembers: membersResult.data?.filter((m) => m.is_active).length || 0,
        totalPrograms: programsResult.data?.length || 0,
        activePrograms: programsResult.data?.filter((p) => p.is_active).length || 0,
      });
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={adminMenuItems} title="Client Detail">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-gray-500">Loading client details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout menuItems={adminMenuItems} title="Client Detail">
        <div className="text-center py-12">
          <p className="text-gray-500">Client not found</p>
          <Button onClick={() => navigate('/admin/clients')} className="mt-4">Back to Clients</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Client Detail">
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/clients')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-gray-600 mt-1">{client.description}</p>
        </div>
        <Link to={`/admin/clients/${id}/edit`}>
          <Button variant="secondary">
            <Edit className="w-4 h-4 mr-2" />
            Edit Client
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500">Total Members</div>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalMembers}</div>
            <div className="text-sm text-gray-600 mt-1">
              {stats.activeMembers} active
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500">Programs</div>
              <ShoppingBag className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalPrograms}</div>
            <div className="text-sm text-gray-600 mt-1">
              {stats.activePrograms} active
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500">Engagement</div>
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totalMembers > 0
                ? ((stats.activeMembers / stats.totalMembers) * 100).toFixed(0)
                : 0}
              %
            </div>
            <div className="text-sm text-gray-600 mt-1">Active rate</div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500">Status</div>
              <Award className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {client.is_active ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-red-600">Inactive</span>
              )}
            </div>
            <div className="text-sm text-gray-600 mt-1">Client status</div>
          </div>
        </Card>
      </div>

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
          <button
            onClick={() => setActiveTab('programs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'programs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Programs ({programs.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Members ({members.length})
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Client Information</h2>
              <div className="flex items-start gap-6 mb-6">
                {client.logo_url ? (
                  <img
                    src={client.logo_url}
                    alt={client.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Building2 className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{client.name}</h3>
                  {client.description && (
                    <p className="text-gray-600 mb-3">{client.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: client.primary_color }}
                    />
                    <span className="text-sm text-gray-500">Brand color</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a
                    href={`mailto:${client.contact_email}`}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {client.contact_email}
                  </a>
                </div>
                {client.contact_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a
                      href={`tel:${client.contact_phone}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {client.contact_phone}
                    </a>
                  </div>
                )}
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500 mb-1">Created</div>
                  <div className="font-medium">
                    {new Date(client.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'programs' && (
        <div className="space-y-4">
          {programs.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No programs yet</h3>
                <p className="text-gray-500">This client hasn't created any membership programs</p>
              </div>
            </Card>
          ) : (
            programs.map((program) => (
              <Card key={program.id}>
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            program.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {program.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {program.description && (
                        <p className="text-gray-600 mb-3">{program.description}</p>
                      )}
                      <div className="text-sm text-gray-500">
                        Valid for {program.validity_days} days
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-4">
          {members.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No members yet</h3>
                <p className="text-gray-500">This client hasn't added any members</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-gray-200">
                {members.map((member) => (
                  <div key={member.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-gray-900">{member.full_name}</h3>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              member.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {member.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">{member.email}</div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Joined{' '}
                        {new Date(member.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
