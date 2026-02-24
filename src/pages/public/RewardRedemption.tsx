import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Gift, Check, AlertCircle, Loader, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RedemptionLink {
  id: string;
  client_id: string;
  program_id: string;
  unique_code: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
}

interface MembershipProgram {
  id: string;
  name: string;
  description: string;
  benefits: string[];
  validity_days: number;
}

export function RewardRedemption() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redemptionLink, setRedemptionLink] = useState<RedemptionLink | null>(null);
  const [program, setProgram] = useState<MembershipProgram | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (code) {
      loadRedemptionLink();
    } else {
      setError('Invalid or missing redemption code');
      setLoading(false);
    }
  }, [code]);

  const loadRedemptionLink = async () => {
    try {
      setLoading(true);

      const { data: linkData, error: linkError } = await supabase
        .from('redemption_links')
        .select('*')
        .eq('unique_code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (linkError || !linkData) {
        setError('Invalid or expired redemption link');
        setLoading(false);
        return;
      }

      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        setError('This redemption link has expired');
        setLoading(false);
        return;
      }

      if (linkData.max_uses && linkData.uses_count >= linkData.max_uses) {
        setError('This redemption link has reached its maximum uses');
        setLoading(false);
        return;
      }

      setRedemptionLink(linkData);

      const { data: programData, error: programError } = await supabase
        .from('membership_programs')
        .select('id, name, description, benefits, validity_days')
        .eq('id', linkData.program_id)
        .single();

      if (programError || !programData) {
        setError('Unable to load program details');
        setLoading(false);
        return;
      }

      setProgram(programData);
    } catch (err) {
      console.error('Error loading redemption link:', err);
      setError('An error occurred while loading redemption details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!redemptionLink || !program) {
      setError('Invalid redemption link');
      return;
    }

    if (!formData.email || !formData.phone) {
      setError('Please provide both email and phone number');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const { data: existingMember } = await supabase
        .from('member_users')
        .select('id')
        .eq('email', formData.email)
        .maybeSingle();

      let memberId = existingMember?.id;

      if (!existingMember) {
        const { data: newMember, error: memberError } = await supabase
          .from('member_users')
          .insert([{
            email: formData.email,
            phone: formData.phone,
            first_name: '',
            last_name: '',
            status: 'active',
          }])
          .select()
          .single();

        if (memberError) {
          setError('Failed to create member account. Please try again.');
          setSubmitting(false);
          return;
        }

        memberId = newMember.id;
      }

      const { data: existingEnrollment } = await supabase
        .from('member_program_enrollments')
        .select('id')
        .eq('member_id', memberId)
        .eq('program_id', program.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!existingEnrollment) {
        const enrollmentData = {
          member_id: memberId,
          program_id: program.id,
          enrollment_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + program.validity_days * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
        };

        const { error: enrollmentError } = await supabase
          .from('member_program_enrollments')
          .insert([enrollmentData]);

        if (enrollmentError) {
          console.error('Enrollment error:', enrollmentError);
          setError('Failed to enroll in membership program. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      const trackingData = {
        link_id: redemptionLink.id,
        member_id: memberId,
        email: formData.email,
        phone: formData.phone,
        ip_address: '',
        user_agent: navigator.userAgent,
      };

      const { error: trackingError } = await supabase
        .from('redemption_tracking')
        .insert([trackingData]);

      if (trackingError) {
        console.error('Tracking error:', trackingError);
      }

      setSuccess(true);
    } catch (err) {
      console.error('Redemption error:', err);
      setError('An error occurred during redemption. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-gray-600">Loading redemption details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !redemptionLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Invalid Link</h2>
              <p className="text-gray-600 text-center">{error}</p>
              <Link to="/">
                <Button className="mt-4">Go to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Congratulations!</h2>
              <p className="text-gray-600">
                You have successfully enrolled in <strong>{program?.name}</strong>
              </p>
              <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-900 font-semibold mb-2">What's Next?</p>
                <p className="text-sm text-blue-800">
                  Check your email at <strong>{formData.email}</strong> for instructions on accessing
                  your rewards and benefits.
                </p>
              </div>
              {program?.benefits && program.benefits.length > 0 && (
                <div className="w-full mt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Your Membership Benefits:</h3>
                  <ul className="space-y-2 text-left">
                    {program.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Gift className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Claim Your Rewards</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {program && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <h3 className="font-bold text-gray-900 text-lg mb-2">{program.name}</h3>
              <p className="text-gray-700 text-sm mb-3">{program.description}</p>
              {program.benefits && program.benefits.length > 0 && (
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-2">Benefits Include:</p>
                  <ul className="space-y-1">
                    {program.benefits.slice(0, 3).map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-900">
                By claiming these rewards, you agree to join the membership program and receive
                communications about your benefits and rewards.
              </p>
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Claim Rewards
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
