import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Inbox,
  Send,
  Check,
  X,
  Clock,
  Gift,
  Megaphone,
  Building2,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Interaction {
  id: string;
  requester_brand_id: string;
  target_brand_id: string;
  interaction_type: string;
  request_type: string;
  message: string;
  status: string;
  response_message: string | null;
  responded_at: string | null;
  created_at: string;
  expires_at: string;
  requester_brand?: Brand;
  target_brand?: Brand;
}

export function BrandCollaborations() {
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBrandId, setCurrentBrandId] = useState<string>('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState('');

  useEffect(() => {
    loadCurrentBrand();
  }, []);

  useEffect(() => {
    if (currentBrandId) {
      loadInteractions();
    }
  }, [currentBrandId, activeTab]);

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

  const loadInteractions = async () => {
    try {
      setLoading(true);

      if (activeTab === 'received') {
        const { data, error } = await supabase
          .from('brand_interactions')
          .select(
            `
            *,
            requester_brand:brands!brand_interactions_requester_brand_id_fkey(
              id,
              name,
              logo_url
            )
          `
          )
          .eq('target_brand_id', currentBrandId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setInteractions(data || []);
      } else {
        const { data, error } = await supabase
          .from('brand_interactions')
          .select(
            `
            *,
            target_brand:brands!brand_interactions_target_brand_id_fkey(
              id,
              name,
              logo_url
            )
          `
          )
          .eq('requester_brand_id', currentBrandId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setInteractions(data || []);
      }
    } catch (error) {
      console.error('Error loading interactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (interactionId: string, status: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('brand_interactions')
        .update({
          status,
          response_message: responseMessage || null,
          responded_at: new Date().toISOString(),
        })
        .eq('id', interactionId);

      if (error) throw error;

      alert(`Request ${status} successfully!`);
      setRespondingTo(null);
      setResponseMessage('');
      loadInteractions();
    } catch (error) {
      console.error('Error responding to request:', error);
      alert('Failed to respond. Please try again.');
    }
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      exclusive_coupon: 'Exclusive Coupon',
      bulk_vouchers: 'Bulk Vouchers',
      special_deal: 'Special Deal',
      limited_offer: 'Limited Offer',
      social_barter: 'Social Media Barter',
      offline_distribution: 'Offline Distribution',
      co_marketing: 'Co-Marketing',
      event_collaboration: 'Event Collaboration',
      influencer_partnership: 'Influencer Partnership',
      cross_promotion: 'Cross-Promotion',
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      accepted: 'bg-green-50 text-green-700 border-green-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
      expired: 'bg-gray-50 text-gray-700 border-gray-200',
    };
    return colors[status] || colors.pending;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Check className="w-4 h-4" />;
      case 'rejected':
        return <X className="w-4 h-4" />;
      case 'expired':
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const pendingCount = interactions.filter((i) => i.status === 'pending').length;

  return (
    <DashboardLayout
      menuItems={[
        {
          label: 'Dashboard',
          path: '/brand',
          icon: <Building2 className="w-5 h-5" />,
        },
      ]}
      title="Collaborations"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Brand Collaborations</h1>
          <p className="text-gray-600 mt-2">
            Manage your incoming and outgoing collaboration requests
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'received' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('received')}
            className="flex-1"
          >
            <Inbox className="w-4 h-4 mr-2" />
            Received Requests
            {pendingCount > 0 && activeTab === 'received' && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {pendingCount}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === 'sent' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('sent')}
            className="flex-1"
          >
            <Send className="w-4 h-4 mr-2" />
            Sent Requests
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : interactions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              {activeTab === 'received' ? (
                <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              ) : (
                <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              )}
              <p className="text-gray-600 text-lg">
                {activeTab === 'received'
                  ? 'No requests received yet'
                  : 'No requests sent yet'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {activeTab === 'received'
                  ? 'When brands send you collaboration requests, they will appear here'
                  : 'Visit the Brand Directory to connect with other brands'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => {
              const brand =
                activeTab === 'received'
                  ? interaction.requester_brand
                  : interaction.target_brand;
              const isExpired = new Date(interaction.expires_at) < new Date();

              return (
                <Card key={interaction.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {brand?.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {brand?.name}
                              </h3>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                  isExpired && interaction.status === 'pending'
                                    ? 'expired'
                                    : interaction.status
                                )}`}
                              >
                                {getStatusIcon(
                                  isExpired && interaction.status === 'pending'
                                    ? 'expired'
                                    : interaction.status
                                )}
                                {isExpired && interaction.status === 'pending'
                                  ? 'Expired'
                                  : interaction.status.charAt(0).toUpperCase() +
                                    interaction.status.slice(1)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                {interaction.interaction_type === 'offer_request' ? (
                                  <Gift className="w-4 h-4" />
                                ) : (
                                  <Megaphone className="w-4 h-4" />
                                )}
                                {getRequestTypeLabel(interaction.request_type)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(interaction.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 mb-3">
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {interaction.message}
                          </p>
                        </div>

                        {interaction.response_message && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-blue-900 mb-1">
                                  Response
                                </p>
                                <p className="text-sm text-blue-800">
                                  {interaction.response_message}
                                </p>
                                {interaction.responded_at && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    {new Date(interaction.responded_at).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'received' &&
                          interaction.status === 'pending' &&
                          !isExpired && (
                            <div className="flex gap-3">
                              {respondingTo === interaction.id ? (
                                <div className="flex-1 space-y-3">
                                  <textarea
                                    rows={3}
                                    placeholder="Add a response message (optional)..."
                                    value={responseMessage}
                                    onChange={(e) => setResponseMessage(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleRespond(interaction.id, 'accepted')}
                                    >
                                      <Check className="w-4 h-4 mr-2" />
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleRespond(interaction.id, 'rejected')}
                                    >
                                      <X className="w-4 h-4 mr-2" />
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setRespondingTo(null);
                                        setResponseMessage('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => setRespondingTo(interaction.id)}
                                  >
                                    Respond
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleRespond(interaction.id, 'accepted')}
                                  >
                                    <Check className="w-4 h-4 mr-2" />
                                    Quick Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleRespond(interaction.id, 'rejected')}
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Quick Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          )}

                        {isExpired && interaction.status === 'pending' && (
                          <div className="text-sm text-gray-500 italic">
                            This request has expired
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
