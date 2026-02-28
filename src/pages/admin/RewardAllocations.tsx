import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Gift, Users, Building2, Award, Calendar ,ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';

interface RewardAllocation {
  id: string;
  allocated_at: string;
  quantity_allocated: number;
  quantity_redeemed: number;
  expires_at: string;
  reward: {
    id: string;
    reward_id: string;
    title: string;
    brand: {
      name: string;
    };
  };
  member: {
    id: string;
    full_name: string;
    email: string;
    client: {
      name: string;
    };
  };
  membership: {
    program: {
      name: string;
    };
  };
}

export function RewardAllocations() {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState<RewardAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchAllocations();
  }, []);

  const fetchAllocations = async () => {
    try {
      const { data, error } = await supabase
        .from('member_rewards_allocation')
        .select(`
          *,
          reward:rewards!inner(
            id,
            reward_id,
            title,
            brand:brands!inner(name)
          ),
          member:member_users!inner(
            id,
            full_name,
            email,
            client:clients!inner(name)
          ),
          membership:member_memberships!inner(
            program:membership_programs!inner(name)
          )
        `)
        .order('allocated_at', { ascending: false });

      if (error) throw error;
      setAllocations(data || []);
    } catch (error) {
      console.error('Error fetching allocations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAllocations = allocations.filter((allocation) => {
    const matchesSearch =
      allocation.reward.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      allocation.member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      allocation.member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      allocation.member.client.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'redeemed' && allocation.quantity_redeemed > 0) ||
      (filterType === 'pending' && allocation.quantity_redeemed === 0);

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-500">Loading allocations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Back to Admin
      </button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reward Allocations</h1>
          <p className="text-gray-600 mt-1">Track reward assignments and redemptions</p>
        </div>
      </div>

      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search allocations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Allocations</option>
              <option value="redeemed">Redeemed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredAllocations.length === 0 ? (
            <div className="p-12 text-center">
              <Gift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No allocations found</h3>
              <p className="text-gray-500">
                {searchQuery || filterType !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No rewards have been allocated yet'}
              </p>
            </div>
          ) : (
            filteredAllocations.map((allocation) => (
              <div key={allocation.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Gift className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {allocation.reward.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <Award className="w-4 h-4" />
                          <span>{allocation.reward.brand.name}</span>
                          <span className="text-gray-400">•</span>
                          <span className="font-mono text-xs">
                            {allocation.reward.reward_id}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {allocation.quantity_redeemed}/{allocation.quantity_allocated} redeemed
                        </div>
                        <div
                          className={`text-xs px-2 py-1 rounded-full ${
                            allocation.quantity_redeemed === allocation.quantity_allocated
                              ? 'bg-green-100 text-green-700'
                              : allocation.quantity_redeemed > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {allocation.quantity_redeemed === allocation.quantity_allocated
                            ? 'Fully Redeemed'
                            : allocation.quantity_redeemed > 0
                            ? 'Partially Redeemed'
                            : 'Not Redeemed'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {allocation.member.full_name}
                          </div>
                          <div className="text-gray-500">{allocation.member.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500">Client</div>
                          <div className="font-medium text-gray-900">
                            {allocation.member.client.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Gift className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500">Program</div>
                          <div className="font-medium text-gray-900">
                            {allocation.membership.program.name}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Allocated{' '}
                        {new Date(allocation.allocated_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      {allocation.expires_at && (
                        <>
                          <span className="text-gray-400">•</span>
                          <div>
                            Expires{' '}
                            {new Date(allocation.expires_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
