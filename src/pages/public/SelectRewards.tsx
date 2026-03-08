import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Check, Gift, AlertCircle, Loader, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
  const [maxSelections, setMaxSelections] = useState<number | null>(null);
  const [minSelections, setMinSelections] = useState<number>(1);
  const [error, setError] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [tokenMode, setTokenMode] = useState(false);
  const [standaloneMode, setStandaloneMode] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const email = searchParams.get('email');
  const campaignId = searchParams.get('campaign');
  const orderId = searchParams.get('order');
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      loadFromToken();
    } else if (!campaignId) {
      setError('Invalid reward link');
      setLoading(false);
    } else {
      loadRewards();
    }
  }, [token, campaignId]);

  const loadFromToken = async () => {
    try {
      setLoading(true);
      const { data, error: fnError } = await supabase.functions.invoke('validate-campaign-token', {
        body: { token },
      });

      if (fnError) throw fnError;

      if (!data?.valid) {
        const reasons: Record<string, string> = {
          not_found: 'This reward link is invalid or has already been used.',
          already_claimed: 'This reward link has already been claimed.',
          expired: 'This reward link has expired.',
          campaign_inactive: 'This campaign is no longer active.',
        };
        setError(reasons[data?.reason] || 'This reward link is no longer valid.');
        return;
      }

      setTokenMode(true);
      setCampaignName(data.campaign_name || '');
      setExpiresAt(data.expires_at || null);
      setMinSelections(data.min_rewards ?? 1);
      setMaxSelections(data.max_rewards ?? null);
      setRewards(data.rewards || []);
    } catch (err: any) {
      console.error('Error validating token:', err);
      setError('Failed to load your rewards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadRewards = async () => {
    try {
      // ── Try standalone campaign rule first (new wizard campaigns) ──────────
      const { data: standaloneData, error: standaloneFnError } = await supabase.functions.invoke(
        'claim-standalone-campaign',
        { body: { campaign_rule_id: campaignId } }
      );

      if (!standaloneFnError && standaloneData?.success) {
        // This is a standalone campaign — use its reward pool
        setStandaloneMode(true);
        setCampaignName(standaloneData.campaign_name || '');
        setMinSelections(standaloneData.min_rewards ?? 1);
        setMaxSelections(standaloneData.max_rewards ?? null);
        // Map rewards to local shape (standalone uses value_description not discount_value)
        const rewardsList = (standaloneData.rewards || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          reward_type: r.category,
          discount_value: undefined,
          category: r.category,
          image_url: r.image_url,
          terms_conditions: r.value_description,
          brands: r.brand ? { name: r.brand.name, logo_url: r.brand.logo_url } : undefined,
        }));
        setRewards(rewardsList);
        return;
      }

      // ── Fall back: legacy membership campaign (old campaign_rewards table) ──
      const { data: crData, error: crError } = await supabase
        .from('campaign_rewards')
        .select(`
          reward_id (
            id,
            title,
            description,
            reward_type,
            discount_value,
            category,
            image_url,
            terms_conditions,
            brand_id (name, logo_url)
          )
        `)
        .eq('campaign_id', campaignId!)
        .eq('is_active', true)
        .order('priority');

      if (crError) throw crError;

      const rewardsList = (crData ?? [])
        .map((item: any) => item.reward_id)
        .filter((r: any) => r && r.id)
        .map((r: any) => ({ ...r, brands: r.brand_id }));

      setRewards(rewardsList);

      // Fetch campaign name + client name + program limits
      const { data: campData } = await supabase
        .from('campaign_rules')
        .select('name, clients:client_id(name), membership_programs:program_id(max_rewards_total)')
        .eq('id', campaignId!)
        .single();

      if (campData) {
        setCampaignName(campData.name);
        setClientName((campData.clients as any)?.name || '');
        const maxTotal = (campData.membership_programs as any)?.max_rewards_total;
        if (maxTotal) setMaxSelections(maxTotal);
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
      if (maxSelections && newSelected.size >= maxSelections) return; // limit reached
      newSelected.add(rewardId);
    }
    setSelectedRewards(newSelected);
  };

  const handleRedeem = async () => {
    if (selectedRewards.size === 0) {
      alert('Please select at least one reward');
      return;
    }
    if (selectedRewards.size < minSelections) {
      alert(`Please select at least ${minSelections} reward${minSelections !== 1 ? 's' : ''}`);
      return;
    }

    setRedeeming(true);
    try {
      if (standaloneMode) {
        // Standalone campaign — direct URL flow (no token)
        const { data: result, error: fnError } = await supabase.functions.invoke('claim-standalone-campaign', {
          body: {
            campaign_rule_id: campaignId,
            email,
            reward_ids: Array.from(selectedRewards),
            claim: true,
          },
        });

        if (fnError) throw fnError;
        if (!result?.success) {
          const reasons: Record<string, string> = {
            campaign_inactive: 'This campaign is no longer active.',
            campaign_ended: 'This campaign has ended.',
            no_rewards_selected: 'Please select at least one reward.',
          };
          throw new Error(reasons[result?.reason] || result?.error || `Claim failed: ${result?.reason || 'unknown error'}`);
        }

        navigate('/redemption-success', {
          state: {
            allocations: result?.allocations || [],
            rewardCount: selectedRewards.size,
            campaignName,
          },
        });
      } else if (tokenMode) {
        // Standalone token claim
        const { data: result, error: fnError } = await supabase.functions.invoke('validate-campaign-token', {
          body: {
            token,
            claim: true,
            reward_ids: Array.from(selectedRewards),
          },
        });

        if (fnError) throw fnError;
        if (!result?.valid) {
          const reasons: Record<string, string> = {
            already_claimed: 'This reward link has already been claimed.',
            expired: 'This reward link has expired.',
            campaign_inactive: 'This campaign is no longer active.',
          };
          throw new Error(reasons[result?.reason] || 'Failed to claim rewards. Please try again.');
        }

        navigate('/redemption-success', {
          state: {
            allocations: result?.allocations || [],
            rewardCount: selectedRewards.size,
            campaignName,
          },
        });
      } else {
        // Legacy campaign rewards claim
        const { data: result, error: fnError } = await supabase.functions.invoke('redeem-campaign-rewards', {
          body: {
            campaign_id: campaignId,
            reward_ids: Array.from(selectedRewards),
            email: email,
            order_id: orderId,
          },
        });

        if (fnError) throw fnError;

        navigate('/redemption-success', {
          state: {
            allocations: result?.allocations || [],
            rewardCount: selectedRewards.size,
            campaignName,
          },
        });
      }
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
            {minSelections > 1 || (maxSelections && maxSelections > 1) ? (
              <>
                <strong>
                  Select {minSelections === maxSelections
                    ? `exactly ${minSelections}`
                    : maxSelections
                    ? `${minSelections}–${maxSelections}`
                    : `at least ${minSelections}`} reward{(maxSelections ?? minSelections) !== 1 ? 's' : ''}
                </strong>{' '}
                to claim your benefits.
                {maxSelections && ` (${selectedRewards.size}/${maxSelections} selected)`}
              </>
            ) : (
              <>
                <strong>Select {maxSelections ? `up to ${maxSelections}` : 'one or more'} reward{maxSelections !== 1 ? 's' : ''}</strong> to claim your benefits.
                {maxSelections && ` (${selectedRewards.size}/${maxSelections} selected)`}
              </>
            )}
          </p>
          {expiresAt && (
            <p className="text-xs text-orange-700 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Link expires: {new Date(expiresAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {rewards.map((reward) => {
            const isSelected = selectedRewards.has(reward.id);
            const isDisabled = !isSelected && maxSelections !== null && selectedRewards.size >= maxSelections;
            return (
              <div
                key={reward.id}
                role="button"
                tabIndex={0}
                onClick={() => !isDisabled && toggleReward(reward.id)}
                onKeyDown={(e) => e.key === 'Enter' && !isDisabled && toggleReward(reward.id)}
                className={`bg-white rounded-lg border shadow-sm transition-all select-none ${
                  isSelected
                    ? 'ring-2 ring-blue-600 border-blue-400 bg-blue-50 cursor-pointer'
                    : isDisabled
                    ? 'border-gray-200 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:shadow-lg hover:border-blue-300 cursor-pointer'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {reward.image_url && (
                        <img
                          src={reward.image_url}
                          alt={reward.title}
                          className="w-full h-32 object-cover rounded-lg mb-4"
                        />
                      )}

                      <h3 className="text-lg font-bold text-gray-900 mb-1">{reward.title}</h3>

                      {reward.brands && (
                        <div className="flex items-center gap-2 mb-2">
                          {reward.brands.logo_url && (
                            <img src={reward.brands.logo_url} alt={reward.brands.name} className="w-5 h-5 object-contain" />
                          )}
                          <span className="text-sm text-gray-500">{reward.brands.name}</span>
                        </div>
                      )}

                      <p className="text-gray-600 text-sm mb-3">{reward.description}</p>

                      {reward.discount_value && reward.reward_type && (
                        <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-2">
                          {reward.reward_type === 'percentage_discount' ? `${reward.discount_value}% OFF`
                            : reward.reward_type === 'flat_discount' ? `₹${reward.discount_value} OFF`
                            : reward.reward_type === 'fixed_value' ? `$${reward.discount_value} Value`
                            : reward.reward_type === 'upto_discount' ? `Up to $${reward.discount_value} OFF`
                            : `${reward.discount_value} OFF`}
                        </div>
                      )}

                      {reward.category && (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {reward.category}
                        </span>
                      )}

                      {reward.terms_conditions && (
                        <details className="mt-3" onClick={(e) => e.stopPropagation()}>
                          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                            Terms &amp; Conditions
                          </summary>
                          <p className="text-xs text-gray-600 mt-2">{reward.terms_conditions}</p>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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
              disabled={selectedRewards.size === 0 || selectedRewards.size < minSelections || redeeming}
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
