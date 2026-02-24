import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Check, Gift, AlertCircle, Loader } from 'lucide-react';

interface Reward {
  id: string;
  title: string;
  description: string;
  reward_type: string;
  discount_value: number;
  category: string;
  image_url?: string;
  terms_conditions?: string;
  brands?: {
    name: string;
    logo_url?: string;
  };
}

export function SelectRewards() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<Set<string>>(new Set());
  const [campaignName, setCampaignName] = useState('');
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const email = searchParams.get('email');
  const campaignId = searchParams.get('campaign');
  const orderId = searchParams.get('order');

  useEffect(() => {
    if (!campaignId) {
      setError('Invalid reward link');
      setLoading(false);
      return;
    }
    loadRewards();
  }, [campaignId]);

  const loadRewards = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/rest/v1/campaign_rewards?campaign_id=eq.${campaignId}&is_active=eq.true&select=reward_id(id,title,description,reward_type,discount_value,category,image_url,terms_conditions,brand_id(name,logo_url))&order=priority`,
        {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load rewards');
      }

      const data = await response.json();
      const rewardsList = data
        .map((item: any) => item.reward_id)
        .filter((r: any) => r && r.id);

      setRewards(rewardsList);

      const campaignResponse = await fetch(
        `${supabaseUrl}/rest/v1/campaign_rules?id=eq.${campaignId}&select=name,clients:client_id(name)`,
        {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        }
      );

      if (campaignResponse.ok) {
        const campaignData = await campaignResponse.json();
        if (campaignData.length > 0) {
          setCampaignName(campaignData[0].name);
          setClientName(campaignData[0].clients?.name || '');
        }
      }
    } catch (err: any) {
      console.error('Error loading rewards:', err);
      setError('Failed to load rewards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleReward = (rewardId: string) => {
    const newSelected = new Set(selectedRewards);
    if (newSelected.has(rewardId)) {
      newSelected.delete(rewardId);
    } else {
      newSelected.add(rewardId);
    }
    setSelectedRewards(newSelected);
  };

  const handleRedeem = async () => {
    if (selectedRewards.size === 0) {
      alert('Please select at least one reward');
      return;
    }

    setRedeeming(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/redeem-campaign-rewards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          reward_ids: Array.from(selectedRewards),
          email: email,
          order_id: orderId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to redeem rewards');
      }

      navigate(`/redemption-success?rewards=${selectedRewards.size}`);
    } catch (err: any) {
      console.error('Error redeeming rewards:', err);
      alert(err.message || 'Failed to redeem rewards. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your rewards...</p>
        </Card>
      </div>
    );
  }

  if (error || rewards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {error || 'No Rewards Available'}
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'This campaign does not have any active rewards at the moment.'}
          </p>
          <Button onClick={() => window.close()}>Close</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Select Your Rewards
          </h1>
          {clientName && (
            <p className="text-lg text-gray-600 mb-1">{clientName}</p>
          )}
          <p className="text-gray-600">
            {campaignName || 'Choose from the rewards below'}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Select one or more rewards</strong> to claim your benefits. You can choose multiple rewards from this campaign.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {rewards.map((reward) => {
            const isSelected = selectedRewards.has(reward.id);
            return (
              <Card
                key={reward.id}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? 'ring-2 ring-blue-600 bg-blue-50'
                    : 'hover:shadow-lg hover:border-blue-300'
                }`}
                onClick={() => toggleReward(reward.id)}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>

                    <div className="flex-1">
                      {reward.image_url && (
                        <img
                          src={reward.image_url}
                          alt={reward.title}
                          className="w-full h-32 object-cover rounded-lg mb-4"
                        />
                      )}

                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {reward.title}
                      </h3>

                      {reward.brands && (
                        <div className="flex items-center gap-2 mb-2">
                          {reward.brands.logo_url && (
                            <img
                              src={reward.brands.logo_url}
                              alt={reward.brands.name}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                          <span className="text-sm text-gray-600">
                            {reward.brands.name}
                          </span>
                        </div>
                      )}

                      <p className="text-gray-600 mb-3">{reward.description}</p>

                      {reward.reward_type === 'discount' && reward.discount_value && (
                        <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-3">
                          {reward.discount_value}% OFF
                        </div>
                      )}

                      {reward.category && (
                        <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                          {reward.category}
                        </div>
                      )}

                      {reward.terms_conditions && (
                        <details className="mt-3">
                          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                            Terms & Conditions
                          </summary>
                          <p className="text-xs text-gray-600 mt-2">
                            {reward.terms_conditions}
                          </p>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-6 sticky bottom-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {selectedRewards.size} reward{selectedRewards.size !== 1 ? 's' : ''} selected
              </p>
            </div>
            <Button
              onClick={handleRedeem}
              disabled={selectedRewards.size === 0 || redeeming}
              className="min-w-[200px]"
            >
              {redeeming ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Redeeming...
                </>
              ) : (
                'Claim Selected Rewards'
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
