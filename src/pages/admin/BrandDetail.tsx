import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Building2,
  ExternalLink,
  Users,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Plus,
  Gift,
  TrendingUp,
  Eye,
  Award,
  DollarSign,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface Brand {
  id: string;
  name: string;
  description: string;
  long_description: string;
  tagline: string;
  logo_url: string;
  website_url: string;
  status: string;
  contact_email: string;
  contact_phone: string;
  founders: string;
  employee_count: string;
  year_founded: number;
  industry: string;
  company_size: string;
  linkedin_url: string;
  twitter_url: string;
  facebook_url: string;
  instagram_url: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  created_at: string;
  updated_at: string;
}

interface Reward {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  image_url: string;
  voucher_count: number;
  redeemed_count: number;
  created_at: string;
}

interface Analytics {
  total_rewards: number;
  active_rewards: number;
  total_redemptions: number;
  total_views: number;
  unique_members: number;
  revenue_generated: number;
}

export function BrandDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'analytics'>('overview');

  useEffect(() => {
    if (id) {
      fetchBrandData();
    }
  }, [id]);

  const fetchBrandData = async () => {
    try {
      const [brandResult, rewardsResult, analyticsResult] = await Promise.all([
        supabase.from('brands').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('rewards')
          .select('*')
          .eq('brand_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('brand_analytics')
          .select('*')
          .eq('brand_id', id)
          .order('date', { ascending: false })
          .limit(30),
      ]);

      if (brandResult.error) throw brandResult.error;
      if (rewardsResult.error) throw rewardsResult.error;

      setBrand(brandResult.data);
      setRewards(rewardsResult.data || []);

      if (analyticsResult.data && analyticsResult.data.length > 0) {
        const aggregated = analyticsResult.data.reduce(
          (acc, curr) => ({
            total_rewards: Math.max(acc.total_rewards, curr.total_rewards || 0),
            active_rewards: Math.max(acc.active_rewards, curr.active_rewards || 0),
            total_redemptions: acc.total_redemptions + (curr.total_redemptions || 0),
            total_views: acc.total_views + (curr.total_views || 0),
            unique_members: Math.max(acc.unique_members, curr.unique_members || 0),
            revenue_generated: acc.revenue_generated + parseFloat(curr.revenue_generated || '0'),
          }),
          {
            total_rewards: 0,
            active_rewards: 0,
            total_redemptions: 0,
            total_views: 0,
            unique_members: 0,
            revenue_generated: 0,
          }
        );
        setAnalytics(aggregated);
      }
    } catch (error) {
      console.error('Error fetching brand data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-500">Loading brand details...</div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Brand not found</p>
        <Button onClick={() => navigate('/admin/brands')} className="mt-4">
          Back to Brands
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/brands')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{brand.name}</h1>
          {brand.tagline && <p className="text-gray-600 mt-1">{brand.tagline}</p>}
        </div>
        <Link to={`/admin/brands/${id}/edit`}>
          <Button variant="secondary">
            <Edit className="w-4 h-4 mr-2" />
            Edit Brand
          </Button>
        </Link>
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
            onClick={() => setActiveTab('rewards')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'rewards'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Rewards ({rewards.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Analytics
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Brand Information</h2>
                <div className="flex items-start gap-6 mb-6">
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center">
                      <Building2 className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{brand.name}</h3>
                    {brand.description && (
                      <p className="text-gray-600 mb-3">{brand.description}</p>
                    )}
                    {brand.website_url && (
                      <a
                        href={brand.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Visit Website
                      </a>
                    )}
                  </div>
                </div>
                {brand.long_description && (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">About</h3>
                    <p className="text-gray-600 whitespace-pre-wrap">{brand.long_description}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Company Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  {brand.industry && (
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Industry</div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{brand.industry}</span>
                      </div>
                    </div>
                  )}
                  {brand.employee_count && (
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Employees</div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{brand.employee_count}</span>
                      </div>
                    </div>
                  )}
                  {brand.year_founded && (
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Founded</div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{brand.year_founded}</span>
                      </div>
                    </div>
                  )}
                  {brand.company_size && (
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Company Size</div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{brand.company_size}</span>
                      </div>
                    </div>
                  )}
                  {brand.founders && (
                    <div className="col-span-2">
                      <div className="text-sm text-gray-500 mb-1">Founders</div>
                      <div className="font-medium">{brand.founders}</div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
                <div className="space-y-3">
                  {brand.contact_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${brand.contact_email}`} className="text-blue-600 hover:text-blue-700">
                        {brand.contact_email}
                      </a>
                    </div>
                  )}
                  {brand.contact_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${brand.contact_phone}`} className="text-blue-600 hover:text-blue-700">
                        {brand.contact_phone}
                      </a>
                    </div>
                  )}
                  {(brand.address || brand.city || brand.state || brand.country) && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        {brand.address && <div>{brand.address}</div>}
                        <div>
                          {[brand.city, brand.state, brand.postal_code].filter(Boolean).join(', ')}
                        </div>
                        {brand.country && <div>{brand.country}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Social Media</h2>
                <div className="space-y-3">
                  {brand.linkedin_url && (
                    <a
                      href={brand.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </a>
                  )}
                  {brand.twitter_url && (
                    <a
                      href={brand.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Twitter className="w-4 h-4" />
                      Twitter
                    </a>
                  )}
                  {brand.facebook_url && (
                    <a
                      href={brand.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </a>
                  )}
                  {brand.instagram_url && (
                    <a
                      href={brand.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Instagram className="w-4 h-4" />
                      Instagram
                    </a>
                  )}
                  {!brand.linkedin_url &&
                    !brand.twitter_url &&
                    !brand.facebook_url &&
                    !brand.instagram_url && (
                      <p className="text-sm text-gray-500">No social media links added</p>
                    )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              Manage all rewards for {brand.name}
            </p>
            <Link to={`/admin/rewards/new?brand_id=${id}`}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Reward
              </Button>
            </Link>
          </div>

          {rewards.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <Gift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No rewards yet</h3>
                <p className="text-gray-500 mb-4">Create the first reward for this brand</p>
                <Link to={`/admin/rewards/new?brand_id=${id}`}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Reward
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rewards.map((reward) => (
                <Link key={reward.id} to={`/admin/rewards/${reward.id}`}>
                  <Card className="hover:shadow-lg transition-shadow h-full">
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                      {reward.image_url ? (
                        <img
                          src={reward.image_url}
                          alt={reward.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Gift className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 line-clamp-1">
                          {reward.title}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                            reward.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : reward.status === 'draft'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {reward.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {reward.description}
                      </p>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Award className="w-4 h-4" />
                          {reward.category}
                        </span>
                        <span>
                          {reward.redeemed_count}/{reward.voucher_count} redeemed
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">Total Rewards</div>
                  <Gift className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics?.total_rewards || rewards.length}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {analytics?.active_rewards || rewards.filter((r) => r.status === 'active').length} active
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">Total Redemptions</div>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics?.total_redemptions || rewards.reduce((sum, r) => sum + r.redeemed_count, 0)}
                </div>
                <div className="text-sm text-green-600 mt-1">All time</div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">Total Views</div>
                  <Eye className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics?.total_views || 0}
                </div>
                <div className="text-sm text-gray-600 mt-1">Reward views</div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">Unique Members</div>
                  <Users className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics?.unique_members || 0}
                </div>
                <div className="text-sm text-gray-600 mt-1">Engaged users</div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">Revenue Generated</div>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  ${analytics?.revenue_generated.toFixed(2) || '0.00'}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total value</div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">Redemption Rate</div>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {rewards.reduce((sum, r) => sum + r.voucher_count, 0) > 0
                    ? (
                        (rewards.reduce((sum, r) => sum + r.redeemed_count, 0) /
                          rewards.reduce((sum, r) => sum + r.voucher_count, 0)) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </div>
                <div className="text-sm text-gray-600 mt-1">Conversion rate</div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
              <div className="space-y-4">
                {rewards.length > 0 ? (
                  rewards.slice(0, 5).map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                          {reward.image_url ? (
                            <img
                              src={reward.image_url}
                              alt={reward.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <Gift className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{reward.title}</div>
                          <div className="text-sm text-gray-500">{reward.category}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {reward.redeemed_count}/{reward.voucher_count}
                        </div>
                        <div className="text-sm text-gray-500">
                          {reward.voucher_count > 0
                            ? ((reward.redeemed_count / reward.voucher_count) * 100).toFixed(0)
                            : 0}
                          % redeemed
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No rewards data available</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
