import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Building2, ExternalLink, Calendar, MapPin,
  CheckCircle, XCircle, Clock, Gift, TrendingUp, X, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';

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

interface RewardRow {
  brand_id: string;
  status: string;
  voucher_count: number | null;
  redeemed_count: number | null;
}

export function AdminBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rewardRows, setRewardRows] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [brandsRes, rewardsRes] = await Promise.all([
        supabase.from('brands').select('*').order('created_at', { ascending: false }),
        supabase.from('rewards').select('brand_id, status, voucher_count, redeemed_count'),
      ]);
      setBrands(brandsRes.data || []);
      setRewardRows(rewardsRes.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const brandStats = useMemo(() => {
    const map = new Map<string, { total: number; active: number; redeemed: number }>();
    rewardRows.forEach((r) => {
      const s = map.get(r.brand_id) || { total: 0, active: 0, redeemed: 0 };
      s.total += 1;
      if (r.status === 'active') s.active += 1;
      s.redeemed += r.redeemed_count || 0;
      map.set(r.brand_id, s);
    });
    return map;
  }, [rewardRows]);

  const industries = useMemo(() => [...new Set(brands.map(b => b.industry).filter(Boolean))].sort(), [brands]);
  const countries = useMemo(() => [...new Set(brands.map(b => b.country).filter(Boolean))].sort(), [brands]);

  const statusCounts = useMemo(() =>
    brands.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, {} as Record<string, number>),
    [brands]
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'rejected': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'suspended': return <XCircle className="w-3.5 h-3.5 text-orange-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => ({
    approved: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-700',
    suspended: 'bg-orange-100 text-orange-700',
  } as Record<string, string>)[status] || 'bg-gray-100 text-gray-700';

  const filteredBrands = useMemo(() => brands.filter((b) => {
    if (searchQuery && !b.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !b.industry?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (industryFilter !== 'all' && b.industry !== industryFilter) return false;
    if (countryFilter !== 'all' && b.country !== countryFilter) return false;
    return true;
  }), [brands, searchQuery, statusFilter, industryFilter, countryFilter]);

  const activeFilters = [
    statusFilter !== 'all' && { key: 'status', label: `Status: ${statusFilter}`, clear: () => setStatusFilter('all') },
    industryFilter !== 'all' && { key: 'industry', label: `Industry: ${industryFilter}`, clear: () => setIndustryFilter('all') },
    countryFilter !== 'all' && { key: 'country', label: `Country: ${countryFilter}`, clear: () => setCountryFilter('all') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const statCards = [
    { label: 'Total Brands', count: brands.length, color: 'text-gray-800', bg: 'bg-gray-50', value: 'all' },
    { label: 'Approved', count: statusCounts['approved'] || 0, color: 'text-green-700', bg: 'bg-green-50', value: 'approved' },
    { label: 'Pending', count: statusCounts['pending'] || 0, color: 'text-yellow-700', bg: 'bg-yellow-50', value: 'pending' },
    { label: 'Rejected', count: statusCounts['rejected'] || 0, color: 'text-red-700', bg: 'bg-red-50', value: 'rejected' },
    { label: 'Suspended', count: statusCounts['suspended'] || 0, color: 'text-orange-700', bg: 'bg-orange-50', value: 'suspended' },
  ];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Brands Management">
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-gray-500">Loading brands...</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Brands Management</h1>
                <p className="text-gray-600 mt-1">Manage partner brands and their profiles</p>
              </div>
              <Link to="/admin/brands/new">
                <Button><Plus className="w-4 h-4 mr-2" />Add Brand</Button>
              </Link>
            </div>

            {/* Clickable summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {statCards.map((stat) => (
                <button
                  key={stat.value}
                  onClick={() => setStatusFilter(stat.value)}
                  className={`${stat.bg} rounded-xl p-4 text-left transition-all border-2 ${statusFilter === stat.value ? 'border-blue-400 shadow-sm' : 'border-transparent hover:border-gray-200'}`}
                >
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
                </button>
              ))}
            </div>

            <Card>
              {/* Filters */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-52 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by name or industry…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  {industries.length > 0 && (
                    <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="all">All Industries</option>
                      {industries.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  )}
                  {countries.length > 0 && (
                    <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="all">All Countries</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {activeFilters.map(f => (
                      <span key={f.key} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                        {f.label}
                        <button onClick={f.clear} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                Showing <span className="font-medium text-gray-700">{filteredBrands.length}</span> of {brands.length} brands
              </div>

              {filteredBrands.length === 0 ? (
                <div className="p-12 text-center">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base font-medium text-gray-900 mb-1">No brands found</h3>
                  <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Brand</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Industry</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Location</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Rewards</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Active</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Redeemed</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Founded</th>
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredBrands.map((brand) => {
                        const stats = brandStats.get(brand.id) || { total: 0, active: 0, redeemed: 0 };
                        return (
                          <tr key={brand.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <Link to={`/admin/brands/${brand.id}`} className="flex items-center gap-3 min-w-0">
                                {brand.logo_url ? (
                                  <img src={brand.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate max-w-[160px]">{brand.name}</div>
                                  {brand.tagline && <div className="text-xs text-gray-400 truncate max-w-[160px]">{brand.tagline}</div>}
                                </div>
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-sm">{brand.industry || <span className="text-gray-200">—</span>}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(brand.status)}`}>
                                {getStatusIcon(brand.status)}
                                {brand.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {(brand.city || brand.country) ? (
                                <span className="flex items-center gap-1 text-gray-500 text-xs">
                                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                  {[brand.city, brand.country].filter(Boolean).join(', ')}
                                </span>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 font-semibold ${stats.total > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                <Gift className="w-3.5 h-3.5" />
                                {stats.total}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${stats.active > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                                {stats.active}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 font-semibold ${stats.redeemed > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                <TrendingUp className="w-3.5 h-3.5" />
                                {stats.redeemed}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {brand.year_founded ? (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {brand.year_founded}
                                </span>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                {brand.website_url && (
                                  <a href={brand.website_url} target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-300 hover:text-blue-500 transition-colors">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                                <Link to={`/admin/brands/${brand.id}`} className="text-gray-300 hover:text-gray-500">
                                  <ChevronRight className="w-4 h-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
