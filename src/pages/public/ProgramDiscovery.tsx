import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Calendar, Users, DollarSign, CheckCircle, AlertCircle, Clock, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface Client {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  primary_color: string;
}

interface Program {
  id: string;
  name: string;
  description: string;
  validity_days: number;
  enrollment_fee: number;
  max_enrollments: number | null;
  current_members: number;
  enrollment_start_date: string | null;
  enrollment_end_date: string | null;
  is_enrolled: boolean;
}

interface EnrollmentModal {
  show: boolean;
  program: Program | null;
  loading: boolean;
  error: string;
  eligibility: any;
}

export function ProgramDiscovery() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberUserId, setMemberUserId] = useState<string | null>(null);

  const [enrollmentModal, setEnrollmentModal] = useState<EnrollmentModal>({
    show: false,
    program: null,
    loading: false,
    error: '',
    eligibility: null
  });

  useEffect(() => {
    if (!user) {
      navigate(`/login?redirect=/join/${clientSlug}/programs`);
      return;
    }
    loadData();
  }, [clientSlug, user]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('slug', clientSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!clientData) {
        setError('Client not found');
        return;
      }

      setClient(clientData);

      let memberUserIdValue = null;
      const { data: memberData } = await supabase
        .from('member_users')
        .select('id')
        .eq('auth_user_id', user?.id)
        .eq('client_id', clientData.id)
        .maybeSingle();

      if (memberData) {
        memberUserIdValue = memberData.id;
        setMemberUserId(memberData.id);
      }

      const { data: programsData, error: programsError } = await supabase
        .from('membership_programs')
        .select('*')
        .eq('client_id', clientData.id)
        .eq('is_active', true)
        .eq('allow_self_enrollment', true);

      if (programsError) throw programsError;

      const programsWithDetails = await Promise.all(
        (programsData || []).map(async (program) => {
          const { count } = await supabase
            .from('member_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', program.id)
            .in('status', ['active', 'pending']);

          let isEnrolled = false;
          if (memberUserIdValue) {
            const { data: enrollment } = await supabase
              .from('member_memberships')
              .select('id')
              .eq('member_id', memberUserIdValue)
              .eq('program_id', program.id)
              .eq('status', 'active')
              .maybeSingle();

            isEnrolled = !!enrollment;
          }

          return {
            ...program,
            current_members: count || 0,
            is_enrolled: isEnrolled
          };
        })
      );

      setPrograms(programsWithDetails);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }

  async function checkEligibilityAndShowModal(program: Program) {
    if (!memberUserId) {
      setError('You must be registered with this client to enroll in programs');
      return;
    }

    setEnrollmentModal({
      show: true,
      program,
      loading: true,
      error: '',
      eligibility: null
    });

    try {
      const { data, error: eligError } = await supabase.rpc('check_enrollment_eligibility', {
        p_program_id: program.id,
        p_member_id: memberUserId
      });

      if (eligError) throw eligError;

      setEnrollmentModal(prev => ({
        ...prev,
        loading: false,
        eligibility: data
      }));
    } catch (err: any) {
      console.error('Eligibility check error:', err);
      setEnrollmentModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to check eligibility'
      }));
    }
  }

  async function handleEnrollment() {
    if (!memberUserId || !enrollmentModal.program) return;

    setEnrollmentModal(prev => ({ ...prev, loading: true, error: '' }));

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + enrollmentModal.program.validity_days);

      const { error: enrollError } = await supabase
        .from('member_memberships')
        .insert({
          member_id: memberUserId,
          program_id: enrollmentModal.program.id,
          status: enrollmentModal.program.enrollment_fee > 0 ? 'pending' : 'active',
          enrolled_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          enrollment_source: 'self_enrollment'
        });

      if (enrollError) throw enrollError;

      setEnrollmentModal({
        show: false,
        program: null,
        loading: false,
        error: '',
        eligibility: null
      });

      await loadData();
    } catch (err: any) {
      console.error('Enrollment error:', err);
      setEnrollmentModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to complete enrollment'
      }));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading programs...</p>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/member')}>Go to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            {client?.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-12" />
            ) : (
              <Building2 className="h-12 w-12" style={{ color: client?.primary_color }} />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client?.name}</h1>
              <p className="text-gray-600">Available Membership Programs</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!memberUserId && (
          <Card className="p-4 mb-6 bg-yellow-50 border-yellow-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800">
                  You are not yet registered with {client?.name}. To enroll in programs, please complete your profile first.
                </p>
              </div>
            </div>
          </Card>
        )}

        {programs.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Programs Available</h2>
            <p className="text-gray-600">There are currently no programs available for enrollment.</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((program) => (
              <Card key={program.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{program.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-3">{program.description}</p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Valid for {program.validity_days} days</span>
                  </div>

                  {program.enrollment_fee > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <DollarSign className="h-4 w-4" />
                      <span>Fee: ${program.enrollment_fee.toFixed(2)}</span>
                    </div>
                  )}

                  {program.max_enrollments && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>
                        {program.current_members}/{program.max_enrollments} enrolled
                      </span>
                    </div>
                  )}

                  {program.enrollment_end_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>
                        Enrollment ends {new Date(program.enrollment_end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {program.is_enrolled ? (
                  <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-50 text-green-700 rounded-lg">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Already Enrolled</span>
                  </div>
                ) : (
                  <Button
                    onClick={() => checkEligibilityAndShowModal(program)}
                    className="w-full"
                    style={{ backgroundColor: client?.primary_color }}
                    disabled={!memberUserId}
                  >
                    Enroll Now
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {enrollmentModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Enroll in Program</h3>
              <button
                onClick={() => setEnrollmentModal({ show: false, program: null, loading: false, error: '', eligibility: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {enrollmentModal.loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Checking eligibility...</p>
              </div>
            ) : enrollmentModal.eligibility?.eligible ? (
              <div>
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900">You're eligible to enroll!</p>
                      <p className="text-sm text-green-700 mt-1">{enrollmentModal.eligibility.reason}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Program:</span>
                    <span className="font-medium text-gray-900">{enrollmentModal.program?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Validity:</span>
                    <span className="font-medium text-gray-900">{enrollmentModal.program?.validity_days} days</span>
                  </div>
                  {enrollmentModal.program && enrollmentModal.program.enrollment_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Enrollment Fee:</span>
                      <span className="font-medium text-gray-900">${enrollmentModal.program.enrollment_fee.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {enrollmentModal.error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{enrollmentModal.error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setEnrollmentModal({ show: false, program: null, loading: false, error: '', eligibility: null })}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEnrollment}
                    className="flex-1"
                    style={{ backgroundColor: client?.primary_color }}
                    disabled={enrollmentModal.loading}
                  >
                    {enrollmentModal.loading ? 'Enrolling...' : 'Confirm Enrollment'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Not Eligible</p>
                      <p className="text-sm text-red-700 mt-1">
                        {enrollmentModal.eligibility?.reason || enrollmentModal.error || 'Unable to check eligibility'}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  onClick={() => setEnrollmentModal({ show: false, program: null, loading: false, error: '', eligibility: null })}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
