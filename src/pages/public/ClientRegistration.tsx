import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building2, Mail, Lock, User, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface Client {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  primary_color: string;
  welcome_message: string;
  registration_enabled: boolean;
}

interface Program {
  id: string;
  name: string;
  description: string;
  validity_days: number;
  enrollment_fee: number;
  max_enrollments: number | null;
  current_members: number;
}

export function ClientRegistration() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadClientData();
  }, [clientSlug]);

  async function loadClientData() {
    try {
      setLoading(true);
      setError('');

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('slug', clientSlug)
        .eq('is_active', true)
        .eq('registration_enabled', true)
        .maybeSingle();

      if (clientError) throw clientError;

      if (!clientData) {
        setError('Client not found or registration is not available.');
        return;
      }

      setClient(clientData);

      const { data: programsData, error: programsError } = await supabase
        .from('membership_programs')
        .select(`
          id,
          name,
          description,
          validity_days,
          enrollment_fee,
          max_enrollments
        `)
        .eq('client_id', clientData.id)
        .eq('is_active', true)
        .eq('allow_self_enrollment', true);

      if (programsError) throw programsError;

      const programsWithCounts = await Promise.all(
        (programsData || []).map(async (program) => {
          const { count } = await supabase
            .from('member_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', program.id)
            .in('status', ['active', 'pending']);

          return {
            ...program,
            current_members: count || 0
          };
        })
      );

      setPrograms(programsWithCounts);
    } catch (err: any) {
      console.error('Error loading client data:', err);
      setError(err.message || 'Failed to load client information');
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm() || !client) return;

    setSubmitting(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          role: 'member'
        });

      if (profileError) throw profileError;

      const { data: memberData, error: memberError } = await supabase
        .from('member_users')
        .insert({
          auth_user_id: authData.user.id,
          client_id: client.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || null,
          is_active: true
        })
        .select()
        .single();

      if (memberError) throw memberError;

      const { data: signupCampaigns, error: campaignError } = await supabase
        .from('campaign_rules')
        .select('id, program_id, membership_programs(validity_days)')
        .eq('client_id', client.id)
        .eq('trigger_type', 'client_signup')
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString())
        .or('end_date.is.null');

      if (!campaignError && signupCampaigns && signupCampaigns.length > 0) {
        const membershipsToCreate = signupCampaigns.map(campaign => {
          const validityDays = (campaign.membership_programs as any)?.validity_days || 365;
          return {
            member_id: memberData.id,
            program_id: campaign.program_id,
            campaign_rule_id: campaign.id,
            enrollment_source: 'client_registration_link',
            status: 'active',
            activated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()
          };
        });

        await supabase.from('member_memberships').insert(membershipsToCreate);
      }

      setSuccess(true);

      setTimeout(() => {
        navigate('/member');
      }, 2000);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to complete registration');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Registration Not Available</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link to="/login">
            <Button>Go to Login</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
          <p className="text-gray-600 mb-4">
            Welcome to {client?.name}! Redirecting you to your member portal...
          </p>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          {client?.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-16 mx-auto mb-4" />
          ) : (
            <Building2 className="h-16 w-16 mx-auto mb-4" style={{ color: client?.primary_color }} />
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Join {client?.name}
          </h1>
          <p className="text-lg text-gray-600">
            {client?.welcome_message || `Create your account to access exclusive member benefits`}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Your Account</h2>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.full_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="John Doe"
                    />
                  </div>
                  {formErrors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.full_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  {formErrors.password && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Re-enter your password"
                    />
                  </div>
                  {formErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                  style={{ backgroundColor: client?.primary_color }}
                >
                  {submitting ? 'Creating Account...' : 'Create Account'}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link to="/login" className="font-medium hover:underline" style={{ color: client?.primary_color }}>
                    Sign in
                  </Link>
                </p>
              </form>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">About {client?.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{client?.description}</p>
            </Card>

            {programs.length > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Programs</h3>
                <div className="space-y-3">
                  {programs.map((program) => (
                    <div key={program.id} className="border-l-4 pl-3 py-2" style={{ borderColor: client?.primary_color }}>
                      <h4 className="font-medium text-gray-900">{program.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{program.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          Valid for {program.validity_days} days
                        </span>
                        {program.max_enrollments && (
                          <span className="text-xs text-gray-500">
                            {program.current_members}/{program.max_enrollments} members
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
