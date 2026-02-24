import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Gift, Mail, Phone, CheckCircle, XCircle, Loader } from 'lucide-react';

interface RewardDetails {
  campaign_name: string;
  program_name: string;
  program_description: string;
  client_name: string;
  order_number: string;
  rewards: Array<{
    id: string;
    brand_name: string;
    reward_name: string;
    reward_description: string;
    reward_type: string;
    points_required: number;
  }>;
}

export default function RedeemRewards() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardDetails, setRewardDetails] = useState<RewardDetails | null>(null);

  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (token) {
      fetchRewardDetails();
    }
  }, [token]);

  const fetchRewardDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('member_redemption_tokens')
        .select(`
          id,
          used,
          expires_at,
          campaign_rules (
            name,
            membership_programs (
              id,
              name,
              description,
              client_id,
              clients (
                name
              ),
              reward_allocations (
                id,
                rewards (
                  id,
                  name,
                  description,
                  type,
                  brands (
                    name
                  )
                ),
                points_required
              )
            )
          ),
          shopify_orders (
            order_number
          )
        `)
        .eq('token', token)
        .maybeSingle();

      if (fetchError || !data) {
        setError('Invalid or expired reward link');
        return;
      }

      if (data.used) {
        setError('This reward has already been redeemed');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('This reward link has expired');
        return;
      }

      const program = data.campaign_rules?.membership_programs;
      if (!program) {
        setError('Reward program not found');
        return;
      }

      const rewards = program.reward_allocations?.map((allocation: any) => ({
        id: allocation.rewards.id,
        brand_name: allocation.rewards.brands?.name || 'Unknown Brand',
        reward_name: allocation.rewards.name,
        reward_description: allocation.rewards.description,
        reward_type: allocation.rewards.type,
        points_required: allocation.points_required,
      })) || [];

      setRewardDetails({
        campaign_name: data.campaign_rules.name,
        program_name: program.name,
        program_description: program.description,
        client_name: program.clients?.name || '',
        order_number: data.shopify_orders?.order_number || '',
        rewards,
      });
    } catch (err: any) {
      console.error('Error fetching reward details:', err);
      setError('Failed to load reward details');
    } finally {
      setLoading(false);
    }
  };

  const handleRedemption = async () => {
    const contact = contactMethod === 'email' ? email : phone;

    if (!contact) {
      setError(`Please enter your ${contactMethod}`);
      return;
    }

    if (contactMethod === 'email' && !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      // Call edge function to process redemption
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-reward-redemption`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            token,
            contact_method: contactMethod,
            contact_value: contact,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Redemption failed');
      }

      setRedeemed(true);
    } catch (err: any) {
      console.error('Error redeeming reward:', err);
      setError(err.message || 'Failed to redeem reward');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your rewards...</p>
        </div>
      </div>
    );
  }

  if (error && !rewardDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Rewards</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (redeemed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Rewards Redeemed!</h1>
          <p className="text-gray-600 mb-6">
            Your rewards have been successfully redeemed and sent to your {contactMethod}.
            {contactMethod === 'email' ? ' Check your inbox!' : ' Check your messages!'}
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              You can also view your rewards anytime in your membership portal.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-blue-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-green-600 p-8 text-white text-center">
            <Gift className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Congratulations!</h1>
            <p className="text-blue-100">You've earned exclusive rewards</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Order Info */}
            <div className="mb-8 pb-6 border-b">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">From your order</p>
                <p className="text-2xl font-bold text-gray-900">#{rewardDetails?.order_number}</p>
                <p className="text-sm text-gray-600 mt-2">{rewardDetails?.client_name}</p>
              </div>
            </div>

            {/* Program Info */}
            <div className="mb-8 bg-blue-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {rewardDetails?.program_name}
              </h2>
              <p className="text-sm text-gray-600 mb-3">
                {rewardDetails?.program_description}
              </p>
              <p className="text-xs text-gray-500">
                Campaign: {rewardDetails?.campaign_name}
              </p>
            </div>

            {/* Available Rewards */}
            {rewardDetails?.rewards && rewardDetails.rewards.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Rewards</h3>
                <div className="space-y-3">
                  {rewardDetails.rewards.map((reward) => (
                    <div key={reward.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              {reward.brand_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {reward.reward_type}
                            </span>
                          </div>
                          <h4 className="font-medium text-gray-900 mb-1">{reward.reward_name}</h4>
                          <p className="text-sm text-gray-600">{reward.reward_description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Method Selection */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                How would you like to receive your rewards?
              </h3>

              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setContactMethod('email')}
                  className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    contactMethod === 'email'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                  <span className="font-medium">Email</span>
                </button>
                <button
                  onClick={() => setContactMethod('phone')}
                  className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    contactMethod === 'phone'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Phone className="w-5 h-5" />
                  <span className="font-medium">SMS</span>
                </button>
              </div>

              {contactMethod === 'email' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleRedemption}
                disabled={verifying}
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg px-6 py-3 font-medium hover:from-blue-700 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    Claim My Rewards
                  </>
                )}
              </button>

              <p className="mt-4 text-xs text-center text-gray-500">
                Your rewards will be sent to your {contactMethod} within a few minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
