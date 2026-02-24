import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Filter, Gift, Star, Calendar, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Reward {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  terms_conditions: string;
  value_description: string;
  image_url: string | null;
  category: string;
  voucher_count: number;
  expiry_date: string | null;
  brands: Brand;
}

export function RewardsMarketplace() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rewards')
        .select(`
          *,
          brands (
            id,
            name,
            logo_url
          )
        `)
        .eq('is_marketplace', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'all', label: 'All Rewards' },
    { value: 'dining', label: 'Dining' },
    { value: 'travel', label: 'Travel' },
    { value: 'fitness', label: 'Fitness' },
    { value: 'wellness', label: 'Wellness' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'entertainment', label: 'Entertainment' },
  ];

  const filteredRewards = rewards.filter((reward) => {
    const matchesSearch =
      reward.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reward.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reward.brands.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || reward.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Rewards Marketplace">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Rewards Marketplace</h1>
          <p className="text-gray-600 mt-2">
            Browse and select rewards from our partner brands for your membership programs
          </p>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search rewards or brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRewards.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No rewards found</p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Check back later for new rewards'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRewards.map((reward) => (
              <Card
                key={reward.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedReward(reward)}
              >
                <div className="relative h-48 overflow-hidden bg-gray-100">
                  {reward.image_url ? (
                    <img
                      src={reward.image_url}
                      alt={reward.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white capitalize">
                      {reward.category}
                    </span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {reward.brands.logo_url && (
                      <img
                        src={reward.brands.logo_url}
                        alt={reward.brands.name}
                        className="w-6 h-6 rounded object-cover"
                      />
                    )}
                    <p className="text-xs text-gray-500 font-medium">
                      {reward.brands.name}
                    </p>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {reward.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {reward.description}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-green-600 font-semibold">
                      <Tag className="w-4 h-4" />
                      {reward.value_description}
                    </span>
                    <span className="text-gray-500">
                      {reward.voucher_count} available
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedReward && (
          <div
            className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedReward(null)}
          >
            <div
              className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-64 overflow-hidden bg-gray-100">
                {selectedReward.image_url ? (
                  <img
                    src={selectedReward.image_url}
                    alt={selectedReward.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="w-24 h-24 text-gray-300" />
                  </div>
                )}
              </div>

              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  {selectedReward.brands.logo_url && (
                    <img
                      src={selectedReward.brands.logo_url}
                      alt={selectedReward.brands.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm text-gray-500 font-medium">
                      {selectedReward.brands.name}
                    </p>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedReward.title}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-50 text-green-700">
                    <Tag className="w-4 h-4 mr-2" />
                    {selectedReward.value_description}
                  </span>
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-50 text-blue-700 capitalize">
                    {selectedReward.category}
                  </span>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </h3>
                    <p className="text-gray-600">{selectedReward.description}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Terms & Conditions
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {selectedReward.terms_conditions}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Available Vouchers</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedReward.voucher_count}
                      </p>
                    </div>
                    {selectedReward.expiry_date && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Valid Until</p>
                        <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(selectedReward.expiry_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      console.log('Add to program:', selectedReward.id);
                      setSelectedReward(null);
                    }}
                  >
                    Add to Program
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedReward(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
