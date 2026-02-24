import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Award, Calendar, Sparkles, Edit } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface Program {
  id: string;
  name: string;
  description: string;
  tier_level: string | null;
  validity_days: number;
  is_active: boolean;
  member_count: number;
  benefits: string[];
}

interface Member {
  id: string;
  full_name: string;
  email: string;
}

export function MembershipManagement() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.client_id) return;

      const [programsRes, membersRes] = await Promise.all([
        supabase
          .from('membership_programs')
          .select('*')
          .eq('client_id', profile.client_id)
          .eq('is_active', true)
          .order('priority', { ascending: false }),
        supabase
          .from('member_users')
          .select('id, full_name, email')
          .eq('client_id', profile.client_id)
          .eq('is_active', true)
          .order('full_name')
      ]);

      if (programsRes.data) {
        const programsWithCounts = await Promise.all(
          programsRes.data.map(async (program) => {
            const { count } = await supabase
              .from('member_memberships')
              .select('id', { count: 'exact', head: true })
              .eq('program_id', program.id)
              .eq('status', 'active');

            return {
              ...program,
              member_count: count || 0
            };
          })
        );
        setPrograms(programsWithCounts);
      }

      if (membersRes.data) setMembers(membersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignMemberships = async () => {
    if (!selectedProgram || selectedMembers.length === 0) {
      alert('Please select a program and at least one member');
      return;
    }

    try {
      const program = programs.find(p => p.id === selectedProgram);
      if (!program) return;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + program.validity_days);

      const memberships = selectedMembers.map(memberId => ({
        member_id: memberId,
        program_id: selectedProgram,
        status: 'active',
        activated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        enrollment_source: 'manual'
      }));

      const { error } = await supabase
        .from('member_memberships')
        .insert(memberships);

      if (error) throw error;

      alert('Memberships assigned successfully');
      setShowAssignModal(false);
      setSelectedProgram('');
      setSelectedMembers([]);
      loadData();
    } catch (error: any) {
      console.error('Error assigning memberships:', error);
      alert(error.message || 'Failed to assign memberships');
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Membership Management">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membership Programs</h1>
            <p className="text-gray-600 mt-1">Manage member enrollments and programs</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate('/client/programs/new')}>
              <Sparkles className="w-4 h-4 mr-2" />
              Create Program
            </Button>
            <Button onClick={() => setShowAssignModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Assign Memberships
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading programs...</div>
        ) : programs.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No membership programs available</p>
              <p className="text-sm text-gray-500">Contact your administrator to create programs</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((program) => (
              <Card key={program.id}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                      {program.tier_level && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 capitalize mt-2">
                          {program.tier_level}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/client/membership-programs/${program.id}/edit`)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{program.description}</p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{program.member_count} active members</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Valid for {program.validity_days} days</span>
                    </div>
                  </div>

                  {program.benefits && program.benefits.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-2">Benefits:</p>
                      <ul className="space-y-1">
                        {program.benefits.slice(0, 3).map((benefit, index) => (
                          <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>{benefit}</span>
                          </li>
                        ))}
                        {program.benefits.length > 3 && (
                          <li className="text-xs text-gray-500 italic">
                            +{program.benefits.length - 3} more benefits
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Assign Memberships</h3>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Program <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedProgram}
                    onChange={(e) => setSelectedProgram(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Choose a program...</option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name} {program.tier_level ? `(${program.tier_level})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Members <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                    {members.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => toggleMemberSelection(member.id)}
                          className="rounded border-gray-300"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                          <div className="text-xs text-gray-500">{member.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedProgram('');
                    setSelectedMembers([]);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAssignMemberships}>
                  Assign Memberships
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
