import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Building2,
  MapPin,
  Calendar,
  Users,
  ExternalLink,
  Globe,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  ArrowLeft,
  Send,
  Gift,
  Megaphone,
  AlertCircle,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Brand {
  id: string;
  name: string;
  description: string;
  long_description: string | null;
  tagline: string | null;
  logo_url: string | null;
  website_url: string | null;
  industry: string | null;
  company_size: string | null;
  year_founded: number | null;
  founders: string | null;
  employee_count: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  contact_email: string;
  contact_phone: string | null;
}

interface RequestForm {
  interaction_type: 'offer_request' | 'campaign_request';
  request_type: string;
  message: string;
}

export function BrandProfileView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [currentBrandId, setCurrentBrandId] = useState<string>('');
  const [dailyLimit, setDailyLimit] = useState({ used: 0, max: 3 });
  const [submitting, setSubmitting] = useState(false);

  const [requestForm, setRequestForm] = useState<RequestForm>({
    interaction_type: 'offer_request',
    request_type: 'exclusive_coupon',
    message: '',
  });

  useEffect(() => {
    loadCurrentBrand();
    loadBrand();
  }, [id]);

  useEffect(() => {
    if (currentBrandId) {
      loadDailyLimit();
    }
  }, [currentBrandId]);

  const loadCurrentBrand = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('brand_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (profile?.brand_id) {
        setCurrentBrandId(profile.brand_id);
      }
    } catch (error) {
      console.error('Error loading current brand:', error);
    }
  };

  const loadBrand = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setBrand(data);
    } catch (error) {
      console.error('Error loading brand:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyLimit = async () => {
    try {
      const { data, error } = await supabase
        .from('brand_interaction_limits')
        .select('requests_sent, max_daily_requests')
        .eq('brand_id', currentBrandId)
        .eq('date', new Date().toISOString().split('T')[0])
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setDailyLimit({ used: data.requests_sent, max: data.max_daily_requests });
      } else {
        setDailyLimit({ used: 0, max: 3 });
      }
    } catch (error) {
      console.error('Error loading daily limit:', error);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (dailyLimit.used >= dailyLimit.max) {
      alert('You have reached your daily request limit. Please try again tomorrow.');
      return;
    }

    try {
      setSubmitting(true);

      const { data: checkData, error: checkError } = await supabase.rpc(
        'check_daily_request_limit',
        {
          p_brand_id: currentBrandId,
        }
      );

      if (checkError) throw checkError;

      if (!checkData) {
        alert('Daily request limit reached. Please try again tomorrow.');
        return;
      }

      const { error: insertError } = await supabase.from('brand_interactions').insert([
        {
          requester_brand_id: currentBrandId,
          target_brand_id: id,
          interaction_type: requestForm.interaction_type,
          request_type: requestForm.request_type,
          message: requestForm.message,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);

      if (insertError) throw insertError;

      const { error: incrementError } = await supabase.rpc('increment_request_count', {
        p_brand_id: currentBrandId,
      });

      if (incrementError) throw incrementError;

      alert('Request sent successfully! The brand will be notified via email and SMS.');
      setShowRequestModal(false);
      setRequestForm({
        interaction_type: 'offer_request',
        request_type: 'exclusive_coupon',
        message: '',
      });
      loadDailyLimit();
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Failed to send request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const offerTypes = [
    { value: 'exclusive_coupon', label: 'Exclusive Coupon/Discount' },
    { value: 'bulk_vouchers', label: 'Bulk Vouchers' },
    { value: 'special_deal', label: 'Special Partnership Deal' },
    { value: 'limited_offer', label: 'Limited Time Offer' },
  ];

  const campaignTypes = [
    { value: 'social_barter', label: 'Social Media Barter Campaign' },
    { value: 'offline_distribution', label: 'Offline Voucher Distribution' },
    { value: 'co_marketing', label: 'Co-Marketing Campaign' },
    { value: 'event_collaboration', label: 'Event Collaboration' },
    { value: 'influencer_partnership', label: 'Influencer Partnership' },
    { value: 'cross_promotion', label: 'Cross-Promotion Campaign' },
  ];

  if (loading) {
    return (
      <DashboardLayout
        menuItems={[
          {
            label: 'Dashboard',
            path: '/brand',
            icon: <Building2 className="w-5 h-5" />,
          },
        ]}
        title="Brand Profile"
      >
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <Card>
              <CardContent className="p-6">
                <div className="h-32 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!brand) {
    return (
      <DashboardLayout
        menuItems={[
          {
            label: 'Dashboard',
            path: '/brand',
            icon: <Building2 className="w-5 h-5" />,
          },
        ]}
        title="Brand Profile"
      >
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-600">Brand not found</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const canRequest = dailyLimit.used < dailyLimit.max;

  return (
    <DashboardLayout
      menuItems={[
        {
          label: 'Dashboard',
          path: '/brand',
          icon: <Building2 className="w-5 h-5" />,
        },
      ]}
      title={brand.name}
    >
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/brand/directory')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Directory
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-6 mb-6">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{brand.name}</h1>
                    {brand.tagline && (
                      <p className="text-lg text-gray-600 mb-3">{brand.tagline}</p>
                    )}
                    {brand.industry && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                        {brand.industry}
                      </span>
                    )}
                  </div>
                </div>

                <div className="prose max-w-none">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
                  <p className="text-gray-600">
                    {brand.long_description || brand.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {brand.year_founded && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Founded</p>
                        <p className="font-medium text-gray-900">{brand.year_founded}</p>
                      </div>
                    </div>
                  )}
                  {brand.company_size && (
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Company Size</p>
                        <p className="font-medium text-gray-900">{brand.company_size}</p>
                      </div>
                    </div>
                  )}
                  {(brand.city || brand.country) && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p className="font-medium text-gray-900">
                          {[brand.city, brand.state, brand.country]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {brand.founders && (
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Founders</p>
                        <p className="font-medium text-gray-900">{brand.founders}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {(brand.website_url ||
              brand.linkedin_url ||
              brand.twitter_url ||
              brand.facebook_url ||
              brand.instagram_url) && (
              <Card>
                <CardHeader>
                  <CardTitle>Social Links</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {brand.website_url && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(brand.website_url!, '_blank')}
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Website
                      </Button>
                    )}
                    {brand.linkedin_url && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(brand.linkedin_url!, '_blank')}
                      >
                        <Linkedin className="w-4 h-4 mr-2" />
                        LinkedIn
                      </Button>
                    )}
                    {brand.twitter_url && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(brand.twitter_url!, '_blank')}
                      >
                        <Twitter className="w-4 h-4 mr-2" />
                        Twitter
                      </Button>
                    )}
                    {brand.facebook_url && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(brand.facebook_url!, '_blank')}
                      >
                        <Facebook className="w-4 h-4 mr-2" />
                        Facebook
                      </Button>
                    )}
                    {brand.instagram_url && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(brand.instagram_url!, '_blank')}
                      >
                        <Instagram className="w-4 h-4 mr-2" />
                        Instagram
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connect with {brand.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">Daily Request Limit</p>
                        <p>
                          {dailyLimit.used} of {dailyLimit.max} requests used today
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => setShowRequestModal(true)}
                    disabled={!canRequest}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {canRequest ? 'Send Request' : 'Daily Limit Reached'}
                  </Button>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-900 mb-3">Request Types</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Gift className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Offer Requests</p>
                          <p className="text-xs text-gray-600">
                            Exclusive coupons, bulk vouchers, special deals
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Megaphone className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Campaign Requests
                          </p>
                          <p className="text-xs text-gray-600">
                            Social barter, offline distribution, co-marketing
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{brand.contact_email}</p>
                  </div>
                  {brand.contact_phone && (
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">{brand.contact_phone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showRequestModal && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowRequestModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                Send Request to {brand.name}
              </h2>
              <p className="text-gray-600 mt-2">
                Choose the type of request and provide details
              </p>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Request Category *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setRequestForm({
                        ...requestForm,
                        interaction_type: 'offer_request',
                        request_type: 'exclusive_coupon',
                      })
                    }
                    className={`p-4 border-2 rounded-lg text-left transition-colors ${
                      requestForm.interaction_type === 'offer_request'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Gift className="w-6 h-6 text-blue-600 mb-2" />
                    <p className="font-semibold text-gray-900">Offer Request</p>
                    <p className="text-xs text-gray-600">
                      Coupons, vouchers, special deals
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRequestForm({
                        ...requestForm,
                        interaction_type: 'campaign_request',
                        request_type: 'social_barter',
                      })
                    }
                    className={`p-4 border-2 rounded-lg text-left transition-colors ${
                      requestForm.interaction_type === 'campaign_request'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Megaphone className="w-6 h-6 text-green-600 mb-2" />
                    <p className="font-semibold text-gray-900">Campaign Request</p>
                    <p className="text-xs text-gray-600">
                      Marketing, events, partnerships
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Specific Request Type *
                </label>
                <select
                  required
                  value={requestForm.request_type}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, request_type: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {requestForm.interaction_type === 'offer_request'
                    ? offerTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))
                    : campaignTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Request Message *
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Describe your request in detail. Include your goals, expectations, and any specific requirements..."
                  value={requestForm.message}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, message: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Minimum 50 characters ({requestForm.message.length}/50)
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <p className="font-semibold mb-1">Important Notes:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>You can send {dailyLimit.max} requests per day</li>
                      <li>The brand will receive email and SMS notifications</li>
                      <li>Requests expire after 7 days if not responded</li>
                      <li>Be professional and specific in your request</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitting || requestForm.message.length < 50}
                >
                  {submitting ? (
                    'Sending...'
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Send Request
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowRequestModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
