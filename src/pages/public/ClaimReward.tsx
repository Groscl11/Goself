import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Gift, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

export default function ClaimReward() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      setValidating(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('validate_redemption_token', {
        p_token: token,
      });

      if (rpcError) throw rpcError;

      if (!data || !data.valid) {
        setError(data?.error || 'Invalid or expired link');
        setLoading(false);
        setValidating(false);
        return;
      }

      setTokenData(data);

      if (data.membership?.program_id) {
        await fetchMembershipRewards(data.membership.program_id, data.member.id);
      }

      setLoading(false);
      setValidating(false);
    } catch (err: any) {
      console.error('Token validation error:', err);
      setError('Failed to validate link. Please try again.');
      setLoading(false);
      setValidating(false);
    }
  };

  const fetchMembershipRewards = async (programId: string, memberId: string) => {
    try {
      const { data: allocations, error: allocError } = await supabase
        .from('reward_allocations')
        .select(`
          id,
          status,
          quantity_allocated,
          quantity_redeemed,
          allocated_at,
          rewards (
            id,
            title,
            description,
            reward_type,
            discount_value,
            points_required,
            image_url
          )
        `)
        .eq('member_id', memberId)
        .eq('program_id', programId)
        .eq('status', 'active');

      if (allocError) throw allocError;

      setRewards(allocations || []);
    } catch (err) {
      console.error('Error fetching rewards:', err);
    }
  };

  const handleClaim = () => {
    setClaimed(true);
  };

  const handleLoginRedirect = () => {
    if (tokenData?.requires_auth) {
      navigate(`/login?redirect=/member/rewards&ref=${token}`);
    }
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Validating your link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Successfully Claimed!</h1>
          <p className="text-gray-600 mb-6">
            Your rewards have been noted. Check your email for further instructions.
          </p>
          {tokenData?.requires_auth && (
            <button
              onClick={handleLoginRedirect}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Login to View Rewards
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="h-12 w-12" />
              <div>
                <h1 className="text-3xl font-bold">Welcome to {tokenData?.client?.name}!</h1>
                <p className="text-blue-100 mt-1">You've been enrolled in an exclusive membership</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Hello, {tokenData?.member?.name}!
              </h2>
              <p className="text-gray-700">
                You've been automatically enrolled in our membership program based on your recent activity.
                {tokenData?.campaign?.name && ` (${tokenData.campaign.name})`}
              </p>
            </div>

            {rewards.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Rewards</h3>
                <div className="grid gap-4">
                  {rewards.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {allocation.rewards.title}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {allocation.rewards.description}
                          </p>
                          {allocation.rewards.reward_type === 'discount' && (
                            <div className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                              {allocation.rewards.discount_value}% OFF
                            </div>
                          )}
                          <div className="mt-2 text-sm text-gray-500">
                            Available: {allocation.quantity_allocated - allocation.quantity_redeemed} / {allocation.quantity_allocated}
                          </div>
                        </div>
                        {allocation.rewards.image_url && (
                          <img
                            src={allocation.rewards.image_url}
                            alt={allocation.rewards.title}
                            className="w-20 h-20 object-cover rounded-lg ml-4"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">What's Next?</h3>
              <ul className="space-y-2 text-gray-700">
                {tokenData?.link_type === 'one_click' ? (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>This is a one-time access link valid for limited time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Click claim below to acknowledge your rewards</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Login anytime to redeem and manage your benefits</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Login to access your full rewards dashboard</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Redeem your benefits anytime</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Track your membership status and history</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleClaim}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Claim Rewards
              </button>
              {tokenData?.requires_auth && (
                <button
                  onClick={handleLoginRedirect}
                  className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  <ExternalLink className="h-5 w-5" />
                  Login
                </button>
              )}
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
              <p>
                Contact: {tokenData?.member?.email || tokenData?.member?.phone}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
