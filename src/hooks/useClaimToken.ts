import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export interface TokenReward {
  id: string;
  title: string;
  description: string;
  value_description: string;
  image_url: string | null;
  category: string;
  coupon_type: string;
  generic_coupon_code: string | null;
  brand: { id: string; name: string; logo_url: string | null } | null;
  available_vouchers: number;
  expiry_date: string | null;
}

export interface ClaimAllocation {
  reward_id: string;
  reward_title: string;
  voucher_code: string | null;
  redemption_url: string | null;
}

export type ClaimStage =
  | 'loading'
  | 'identity_required'
  | 'ready'
  | 'claiming'
  | 'claimed'
  | 'already_claimed'
  | 'expired'
  | 'invalid'
  | 'no_token';

interface UseClaimTokenResult {
  stage: ClaimStage;
  token: string | null;
  campaignId: string | null;
  clientId: string | null;
  campaignName: string;
  expiresAt: string | null;
  identityHint: string;
  rewards: TokenReward[];
  minRewards: number;
  maxRewards: number;
  allocations: ClaimAllocation[];
  claimedRewards: ClaimAllocation[];
  claimedAt: string;
  error: string | null;
  verifyIdentity: (identity: string) => Promise<void>;
  claimRewards: (rewardIds: string[], identity: string) => Promise<void>;
}

export function useClaimToken(): UseClaimTokenResult {
  const [searchParams] = useSearchParams();
  const params = useParams<{ token?: string }>();

  // Token can come from ?token= or /claim/:token
  const token = searchParams.get('token') || params.token || null;

  const [stage, setStage] = useState<ClaimStage>(
    token ? 'loading' : 'no_token'
  );
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [identityHint, setIdentityHint] = useState('');
  const [rewards, setRewards] = useState<TokenReward[]>([]);
  const [minRewards, setMinRewards] = useState(1);
  const [maxRewards, setMaxRewards] = useState(1);
  const [allocations, setAllocations] = useState<ClaimAllocation[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<ClaimAllocation[]>([]);
  const [claimedAt, setClaimedAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Resolve client_id from campaign_id so ThemeProvider can load branding. */
  const resolveClientId = useCallback(async (campId: string) => {
    try {
      const { data } = await supabase
        .from('campaign_rules')
        .select('client_id')
        .eq('id', campId)
        .maybeSingle();
      if (data?.client_id) setClientId(data.client_id);
    } catch {
      // non-critical — theme falls back to default
    }
  }, []);

  const applyVerifiedPayload = useCallback(
    (data: any) => {
      const campId = data.campaign_id;
      setCampaignId(campId);
      setCampaignName(data.campaign_name || '');
      setExpiresAt(data.expires_at || null);
      setMinRewards(data.min_rewards ?? 1);
      setMaxRewards(data.max_rewards ?? 1);
      setRewards(
        (data.rewards || []).map((r: any) => ({
          ...r,
          expiry_date: r.expiry_date ?? null,
        }))
      );
      setStage('ready');
      if (campId) resolveClientId(campId);
    },
    [resolveClientId]
  );

  // Initial probe
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          'validate-campaign-token',
          { body: { token } }
        );
        if (fnErr) throw fnErr;

        if (!data?.valid) {
          if (data?.reason === 'already_claimed') {
            setClaimedRewards(data.claimed_rewards || []);
            setClaimedAt(data.claimed_at || '');
            setStage('already_claimed');
          } else if (data?.reason === 'expired') {
            setStage('expired');
          } else {
            setError(
              data?.reason === 'not_found'
                ? 'This reward link is invalid or has been used.'
                : 'This reward link is no longer valid.'
            );
            setStage('invalid');
          }
          return;
        }

        if (data.requires_identity) {
          setCampaignName(data.campaign_name || '');
          setExpiresAt(data.expires_at || null);
          setIdentityHint(data.identity_hint || '');
          setStage('identity_required');
          return;
        }

        applyVerifiedPayload(data);
      } catch (err: any) {
        setError('Failed to load your rewards. Please try again.');
        setStage('invalid');
      }
    })();
  }, [token, applyVerifiedPayload]);

  const verifyIdentity = useCallback(
    async (identity: string) => {
      if (!token) return;
      setStage('loading');
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          'validate-campaign-token',
          { body: { token, identity } }
        );
        if (fnErr) throw fnErr;

        if (data?.reason === 'identity_mismatch') {
          setError(
            'The email or phone number you entered does not match our records.'
          );
          setStage('identity_required');
          return;
        }
        if (!data?.valid) {
          setError('This reward link is no longer valid.');
          setStage('invalid');
          return;
        }
        setError(null);
        applyVerifiedPayload(data);
      } catch {
        setError('Verification failed. Please try again.');
        setStage('identity_required');
      }
    },
    [token, applyVerifiedPayload]
  );

  const claimRewards = useCallback(
    async (rewardIds: string[], identity: string) => {
      if (!token) return;
      setStage('claiming');
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          'validate-campaign-token',
          {
            body: {
              token,
              identity: identity || undefined,
              claim: true,
              reward_ids: rewardIds,
            },
          }
        );
        if (fnErr) throw fnErr;

        if (!data?.valid || !data?.claimed) {
          const msgs: Record<string, string> = {
            already_claimed: 'This link has already been claimed.',
            expired: 'This reward link has expired.',
            campaign_inactive: 'This campaign is no longer active.',
          };
          setError(msgs[data?.reason] || 'Claim failed. Please try again.');
          setStage('ready');
          return;
        }

        setAllocations(data.allocations || []);
        setStage('claimed');
      } catch {
        setError('Failed to claim rewards. Please try again.');
        setStage('ready');
      }
    },
    [token]
  );

  return {
    stage,
    token,
    campaignId,
    clientId,
    campaignName,
    expiresAt,
    identityHint,
    rewards,
    minRewards,
    maxRewards,
    allocations,
    claimedRewards,
    claimedAt,
    error,
    verifyIdentity,
    claimRewards,
  };
}
