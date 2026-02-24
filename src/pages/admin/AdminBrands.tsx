import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, ExternalLink, Users, Calendar, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface Brand {
  id: string;
  name: string;
  description: string;
  tagline: string;
  logo_url: string;
  website_url: string;
  status: string;
  employee_count: string;
  year_founded: number;
  industry: string;
  city: string;
  country: string;
  created_at: string;
}

export function AdminBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'suspended':
        return <XCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      approved: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700',
      suspended: 'bg-orange-100 text-orange-700',
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const filteredBrands = brands.filter((brand) => {
    const matchesSearch =
      brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.industry?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || brand.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-500">Loading brands...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brands Management</h1>
          <p className="text-gray-600 mt-1">Manage partner brands and their profiles</p>
        </div>
        <Link to="/admin/brands/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Brand
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
                placeholder="Search brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredBrands.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No brands found</h3>
              <p className="text-gray-500">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first brand'}
              </p>
            </div>
          ) : (
            filteredBrands.map((brand) => (
              <Link
                key={brand.id}
                to={`/admin/brands/${brand.id}`}
                className="block hover:bg-gray-50 transition-colors"
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {brand.name}
                            </h3>
                            {getStatusIcon(brand.status)}
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                                brand.status
                              )}`}
                            >
                              {brand.status}
                            </span>
                          </div>
                          {brand.tagline && (
                            <p className="text-sm text-gray-600 mb-2">{brand.tagline}</p>
                          )}
                          {brand.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                              {brand.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            {brand.industry && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-4 h-4" />
                                {brand.industry}
                              </span>
                            )}
                            {brand.employee_count && (
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {brand.employee_count} employees
                              </span>
                            )}
                            {brand.year_founded && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Founded {brand.year_founded}
                              </span>
                            )}
                            {(brand.city || brand.country) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {[brand.city, brand.country].filter(Boolean).join(', ')}
                              </span>
                            )}
                            {brand.website_url && (
                              <span className="flex items-center gap-1 text-blue-600">
                                <ExternalLink className="w-4 h-4" />
                                Website
                              </span>
                            )}
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
