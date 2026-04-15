import React, { useEffect } from 'react';
import { ThemeProvider } from '../../context/ThemeContext';
import { useTheme } from '../../hooks/useTheme';
import { useClaimToken } from '../../hooks/useClaimToken';
import { RewardSelectScreen } from '../../components/claim/RewardSelectScreen';
import { RedemptionScreen } from '../../components/claim/RedemptionScreen';

// Identity verification form shown when token requires email/phone match
function IdentityGate({
  hint,
  campaignName,
  error,
  onVerify,
}: {
  hint: string;
  campaignName: string;
  error: string | null;
  onVerify: (identity: string) => void;
}) {
  const { theme } = useTheme();
  const [value, setValueState] = React.useState('');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12" style={{ background: '#f6f6f3' }}>
      <div className="w-full max-w-md text-center">
        {theme.logoUrl && (
          <img
            src={theme.logoUrl}
            alt={theme.brandName}
            className="h-10 w-auto object-contain mx-auto mb-6"
          />
        )}
        <div className="text-4xl mb-3">🔒</div>
        <h1
          className="text-xl sm:text-2xl font-bold mb-2"
          style={{ color: 'var(--gs-brand-dark)', fontFamily: 'var(--gs-display-font)' }}
        >
          Verify your identity
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          This reward was sent to
        </p>
        {hint && (
          <p
            className="text-sm font-semibold mb-5"
            style={{ color: 'var(--gs-brand)' }}
          >
            {hint}
          </p>
        )}
        <p className="text-xs text-gray-400 mb-6">
          Enter the email or phone number used for your {campaignName || 'order'} to unlock your reward.
        </p>
        <input
          type="text"
          placeholder="Email or phone number"
          value={value}
          onChange={(e) => setValueState(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && value.trim() && onVerify(value.trim())}
          className="w-full px-4 py-3 rounded-xl border text-sm mb-3 focus:outline-none"
          style={{
            borderColor: error ? '#ef4444' : 'var(--gs-brand-light)',
            background: '#fff',
            color: '#1a1a1a',
          }}
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <button
          disabled={!value.trim()}
          onClick={() => onVerify(value.trim())}
          className="w-full py-3.5 rounded-xl text-sm font-semibold"
          style={{
            background: value.trim()
              ? 'linear-gradient(135deg, var(--gs-brand), var(--gs-brand-dark))'
              : '#ccc',
            color: '#fff',
          }}
        >
          Unlock my reward
        </button>
      </div>
    </div>
  );
}

// Full-screen status screens: loading / expired / invalid / no_token  
function StatusScreen({ stage }: { stage: string }) {
  const { theme } = useTheme();
  const configs: Record<string, { emoji: string; title: string; body: string }> = {
    loading: { emoji: '⏳', title: 'Loading your reward…', body: 'Please wait a moment.' },
    expired: { emoji: '⌛', title: 'Offer expired', body: 'This reward link has expired.' },
    invalid: { emoji: '❌', title: 'Invalid link', body: 'This reward link is invalid or has already been used.' },
    no_token: { emoji: '🔗', title: 'No reward link', body: 'Please use the reward link sent to you.' },
  };
  const cfg = configs[stage] ?? configs.invalid;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 py-12"
      style={{ background: '#f6f6f3' }}
    >
      <div className="w-full max-w-md text-center">
        {theme.logoUrl && (
          <img
            src={theme.logoUrl}
            alt={theme.brandName}
            className="h-10 w-auto object-contain mx-auto mb-6"
          />
        )}
        {stage === 'loading' ? (
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent mb-6 mx-auto animate-spin"
            style={{ borderColor: 'var(--gs-brand-light)', borderTopColor: 'var(--gs-brand)' }}
          />
        ) : (
          <div className="text-5xl mb-4 select-none">{cfg.emoji}</div>
        )}
        <h1
          className="text-xl sm:text-2xl font-bold mb-2"
          style={{ color: 'var(--gs-brand-dark)', fontFamily: 'var(--gs-display-font)' }}
        >
          {cfg.title}
        </h1>
        <p className="text-sm text-gray-500">{cfg.body}</p>
      </div>
    </div>
  );
}

// Inner component: has access to useTheme via ThemeProvider above it
function ClaimPageInner() {
  const { loadTheme } = useTheme();
  const {
    stage,
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
    error,
    verifyIdentity,
    claimRewards,
  } = useClaimToken();

  // Identity stored in state so it can be passed through to claimRewards
  const [identity, setIdentity] = React.useState('');

  // Load client theme as soon as we have a clientId
  useEffect(() => {
    if (clientId) loadTheme(clientId);
  }, [clientId, loadTheme]);

  function handleVerify(id: string) {
    setIdentity(id);
    verifyIdentity(id);
  }

  function handleClaim(selectedIds: string[]) {
    claimRewards(selectedIds, identity);
  }

  if (stage === 'loading' || stage === 'no_token' || stage === 'expired' || stage === 'invalid') {
    return <StatusScreen stage={stage} />;
  }

  if (stage === 'identity_required') {
    return (
      <IdentityGate
        hint={identityHint}
        campaignName={campaignName}
        error={error}
        onVerify={handleVerify}
      />
    );
  }

  if (stage === 'claimed' || stage === 'already_claimed') {
    return (
      <RedemptionScreen
        allocations={stage === 'claimed' ? allocations : claimedRewards}
        campaignName={campaignName}
        alreadyClaimed={stage === 'already_claimed'}
      />
    );
  }

  // stage === 'ready' | 'claiming'
  return (
    <RewardSelectScreen
      campaignName={campaignName}
      expiresAt={expiresAt}
      rewards={rewards}
      minRewards={minRewards}
      maxRewards={maxRewards}
      error={error}
      isClaiming={stage === 'claiming'}
      onClaim={handleClaim}
    />
  );
}

export default function ClaimPage() {
  return (
    <ThemeProvider>
      <ClaimPageInner />
    </ThemeProvider>
  );
}
