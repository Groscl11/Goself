import { useEffect, useState } from 'react';
import { Gift, Award, CheckCircle, Copy, ExternalLink, Clock, XCircle, Building2, Settings, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const memberMenuItems = [
  { label: 'Dashboard', path: '/member', icon: <Award className="w-5 h-5" /> },
  { label: 'My Memberships', path: '/member/memberships', icon: <Award className="w-5 h-5" /> },
  { label: 'Available Rewards', path: '/member/rewards', icon: <Gift className="w-5 h-5" /> },
  { label: 'My Vouchers', path: '/member/vouchers', icon: <CheckCircle className="w-5 h-5" /> },
  { label: 'Settings', path: '/member/settings', icon: <Settings className="w-5 h-5" /> },
];

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
}

interface Voucher {
  id: string;
  voucher_code: string;
  status: string;
  expires_at: string | null;
  redeemed_at: string | null;
  issued_at: string;
  redemption_notes: string | null;
  client: Client;
  rewards: {
    title: string;
    description: string;
    image_url: string | null;
    reward_type: string | null;
    discount_value: number | null;
    currency: string;
    redemption_link: string | null;
    terms_conditions: string | null;
    brands: {
      name: string;
      logo_url: string | null;
    };
  };
}

export function MemberVouchers() {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'redeemed' | 'expired'>('available');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedVoucher, setExpandedVoucher] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadVouchers();
    }
  }, [user]);

  const loadVouchers = async () => {
    if (!user) return;

    try {
      const { data: memberDataList, error: memberError } = await supabase
        .from('member_users')
        .select('id, client:clients(id, name, logo_url, primary_color)')
        .eq('auth_user_id', user.id)
        .eq('is_active', true);

      if (memberError) throw memberError;

      if (!memberDataList || memberDataList.length === 0) {
        setLoading(false);
        return;
      }

      const memberIds = memberDataList.map(m => m.id);

      const { data, error } = await supabase
        .from('reward_vouchers')
        .select(`
          *,
          rewards (
            title,
            description,
            image_url,
            reward_type,
            discount_value,
            currency,
            redemption_link,
            terms_conditions,
            brands (
              name,
              logo_url
            )
          )
        `)
        .in('member_id', memberIds)
        .order('issued_at', { ascending: false });

      if (error) throw error;

      const vouchersWithClients = (data || []).map((voucher: any) => {
        const memberUser = memberDataList.find(m => m.id === voucher.member_id);
        return {
          ...voucher,
          client: memberUser?.client || { id: '', name: 'Unknown', logo_url: null, primary_color: '#3B82F6' }
        };
      });

      setVouchers(vouchersWithClients);
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleRedeem = (voucher: Voucher) => {
    const link = voucher.rewards.redemption_link;
    if (link) {
      window.open(link, '_blank');
    } else {
      alert('This reward can be used at the brand\'s store. Show your voucher code at checkout.');
    }
  };

  const filteredVouchers = vouchers.filter((v) => {
    if (filter === 'all') return true;
    if (filter === 'available') return v.status === 'available';
    if (filter === 'redeemed') return v.status === 'redeemed';
    if (filter === 'expired') return v.status === 'expired';
    return true;
  });

  const stats = {
    available: vouchers.filter((v) => v.status === 'available').length,
    redeemed: vouchers.filter((v) => v.status === 'redeemed').length,
    expired: vouchers.filter((v) => v.status === 'expired').length,
  };

  const getStatusIcon = (status: string) => {
    const icons: any = {
      available: <Clock className="w-5 h-5 text-green-600" />,
      redeemed: <CheckCircle className="w-5 h-5 text-blue-600" />,
      expired: <XCircle className="w-5 h-5 text-red-600" />,
    };
    return icons[status] || <Clock className="w-5 h-5 text-gray-600" />;
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      available: 'bg-green-100 text-green-800',
      redeemed: 'bg-blue-100 text-blue-800',
      expired: 'bg-red-100 text-red-800',
      revoked: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <DashboardLayout menuItems={memberMenuItems} title="My Vouchers">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Vouchers</h1>
          <p className="text-gray-600 mt-2">View and redeem your vouchers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.available}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Redeemed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.redeemed}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expired</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="mb-6 flex gap-2">
          {(['all', 'available', 'redeemed', 'expired'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : filteredVouchers.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No Vouchers Found</p>
              <p className="text-sm text-gray-500">
                {filter === 'all'
                  ? 'You don\'t have any vouchers yet'
                  : `No ${filter} vouchers available`}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVouchers.map((voucher) => (
              <Card key={voucher.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      {voucher.rewards.image_url ? (
                        <img
                          src={voucher.rewards.image_url}
                          alt={voucher.rewards.title}
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <Gift className="w-12 h-12 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {voucher.rewards.title}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            {voucher.rewards.brands.logo_url ? (
                              <img
                                src={voucher.rewards.brands.logo_url}
                                alt={voucher.rewards.brands.name}
                                className="w-4 h-4 rounded"
                              />
                            ) : (
                              <Award className="w-4 h-4" />
                            )}
                            <span>{voucher.rewards.brands.name}</span>
                          </div>
                        </div>
                        {getStatusBadge(voucher.status)}
                      </div>

                      <p className="text-sm text-gray-600 mb-4">{voucher.rewards.description}</p>

                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          How to Redeem
                        </h4>
                        {voucher.rewards.redemption_link ? (
                          <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                            <li>Copy your voucher code above</li>
                            <li>Click the "Redeem Online" button below</li>
                            <li>Enter your code at checkout</li>
                            <li>Enjoy your reward!</li>
                          </ol>
                        ) : (
                          <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                            <li>Visit {voucher.rewards.brands.name} store or website</li>
                            <li>Show this voucher code at checkout</li>
                            <li>Your discount will be applied</li>
                          </ol>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1 bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
                          <p className="text-xs text-gray-600 mb-1">Voucher Code</p>
                          <div className="flex items-center justify-between">
                            <code className="text-lg font-mono font-bold text-gray-900">
                              {voucher.voucher_code}
                            </code>
                            <button
                              onClick={() => copyCode(voucher.voucher_code)}
                              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Copy code"
                            >
                              {copiedCode === voucher.voucher_code ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <Copy className="w-5 h-5 text-gray-600" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-4 text-sm">
                          {voucher.expires_at && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>
                                {voucher.status === 'expired' ? 'Expired' : 'Expires'}:{' '}
                                {new Date(voucher.expires_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {voucher.redeemed_at && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <CheckCircle className="w-4 h-4" />
                              <span>Redeemed: {new Date(voucher.redeemed_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {voucher.status === 'available' && (
                            <Button onClick={() => handleRedeem(voucher)} size="sm">
                              {voucher.rewards.redemption_link ? (
                                <>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Redeem Online
                                </>
                              ) : (
                                <>
                                  <Gift className="w-4 h-4 mr-2" />
                                  Use Code
                                </>
                              )}
                            </Button>
                          )}
                          {voucher.rewards.terms_conditions && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedVoucher(expandedVoucher === voucher.id ? null : voucher.id)}
                            >
                              {expandedVoucher === voucher.id ? (
                                <>
                                  <ChevronUp className="w-4 h-4 mr-2" />
                                  Hide T&C
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4 mr-2" />
                                  View T&C
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {expandedVoucher === voucher.id && voucher.rewards.terms_conditions && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Terms & Conditions
                          </h4>
                          <div className="text-sm text-gray-700 whitespace-pre-line">
                            {voucher.rewards.terms_conditions}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
