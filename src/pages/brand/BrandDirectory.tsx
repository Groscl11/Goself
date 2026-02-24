import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Search,
  Building2,
  Users,
  MapPin,
  ExternalLink,
  Calendar,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Brand {
  id: string;
  name: string;
  description: string;
  long_description: string | null;
  logo_url: string | null;
  website_url: string | null;
  industry: string | null;
  company_size: string | null;
  year_founded: number | null;
  city: string | null;
  country: string | null;
  tagline: string | null;
  status: string;
}

export function BrandDirectory() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');
  const [currentBrandId, setCurrentBrandId] = useState<string>('');

  useEffect(() => {
    loadCurrentBrand();
    loadBrands();
  }, []);

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

  const loadBrands = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('status', 'approved')
        .order('name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error loading brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const industries = [
    'all',
    'Fashion',
    'Technology',
    'Food & Beverage',
    'Health & Wellness',
    'Travel',
    'Entertainment',
    'Retail',
    'Services',
  ];

  const filteredBrands = brands
    .filter((brand) => brand.id !== currentBrandId)
    .filter((brand) => {
      const matchesSearch =
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        brand.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (brand.industry && brand.industry.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesIndustry =
        filterIndustry === 'all' ||
        (brand.industry && brand.industry.toLowerCase() === filterIndustry.toLowerCase());

      return matchesSearch && matchesIndustry;
    });

  const handleViewProfile = (brandId: string) => {
    navigate(`/brand/directory/${brandId}`);
  };

  return (
    <DashboardLayout
      menuItems={[
        {
          label: 'Dashboard',
          path: '/brand',
          icon: <Building2 className="w-5 h-5" />,
        },
        {
          label: 'Brand Directory',
          path: '/brand/directory',
          icon: <Users className="w-5 h-5" />,
        },
      ]}
      title="Brand Directory"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Brand Directory</h1>
          <p className="text-gray-600 mt-2">
            Explore and connect with other brands for exclusive collaborations
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search brands by name, description, or industry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {industries.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry === 'all' ? 'All Industries' : industry}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBrands.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No brands found</p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery || filterIndustry !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No brands available at the moment'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBrands.map((brand) => (
              <Card
                key={brand.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewProfile(brand.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {brand.name}
                      </h3>
                      {brand.tagline && (
                        <p className="text-sm text-gray-600 truncate">{brand.tagline}</p>
                      )}
                    </div>
                  </div>

                  {brand.industry && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 mb-3">
                      {brand.industry}
                    </span>
                  )}

                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {brand.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    {brand.city && brand.country && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {brand.city}, {brand.country}
                        </span>
                      </div>
                    )}
                    {brand.year_founded && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>Founded {brand.year_founded}</span>
                      </div>
                    )}
                    {brand.company_size && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users className="w-4 h-4" />
                        <span>{brand.company_size}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewProfile(brand.id);
                      }}
                    >
                      View Profile
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    {brand.website_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(brand.website_url!, '_blank');
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
