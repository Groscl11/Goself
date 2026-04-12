import React, { useEffect, useRef } from 'react';
import type { ClaimAllocation } from '../../hooks/useClaimToken';
import { RewardCodeBox } from './RewardCodeBox';
import { ShareFooter } from './ShareFooter';
import { useTheme } from '../../hooks/useTheme';

interface RedemptionScreenProps {
  allocations: ClaimAllocation[];
  campaignName: string;
  alreadyClaimed?: boolean;
}

export function RedemptionScreen({
  allocations,
  campaignName,
  alreadyClaimed = false,
}: RedemptionScreenProps) {
  const { theme } = useTheme();
  const confettiRef = useRef<HTMLDivElement>(null);

  /* Simple CSS-based confetti burst on mount (no deps needed) */
  useEffect(() => {
    if (alreadyClaimed) return; // skip animation for replay
    const el = confettiRef.current;
    if (!el) return;
    el.classList.add('confetti-burst');
    const t = setTimeout(() => el.classList.remove('confetti-burst'), 1200);
    return () => clearTimeout(t);
  }, [alreadyClaimed]);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#f6f6f3' }}>
      {/* Celebration header */}
      <div
        ref={confettiRef}
        className="relative px-4 pt-10 pb-6 text-center"
        style={{ background: 'linear-gradient(160deg, var(--gs-brand-dark) 0%, var(--gs-brand) 100%)' }}
      >
        {/* Brand mark */}
        {theme.logoUrl ? (
          <img
            src={theme.logoUrl}
            alt={theme.brandName}
            className="h-10 w-auto object-contain mx-auto mb-4 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.15)', padding: '6px 12px' }}
          />
        ) : (
          <p
            className="text-base font-bold text-white mb-4 opacity-90"
            style={{ fontFamily: 'var(--gs-display-font)' }}
          >
            {theme.brandName}
          </p>
        )}

        <div className="text-5xl mb-3 select-none">🎉</div>

        <h1
          className="text-xl font-bold text-white leading-tight mb-1"
          style={{ fontFamily: 'var(--gs-display-font)' }}
        >
          {alreadyClaimed ? 'Already claimed!' : 'Rewards claimed!'}
        </h1>
        <p className="text-sm text-white opacity-75">
          {alreadyClaimed
            ? 'Here are the rewards you previously claimed.'
            : `You've successfully claimed your ${campaignName} rewards.`}
        </p>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none">
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="w-full h-5 block">
            <path d="M0,20 C300,40 900,0 1200,20 L1200,40 L0,40 Z" fill="#f6f6f3" />
          </svg>
        </div>
      </div>

      {/* Reward code boxes */}
      <div className="flex-1 px-4 pt-6 pb-6 space-y-4">
        <p
          className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1"
        >
          Your rewards
        </p>
        {allocations.map((a) => (
          <RewardCodeBox key={a.reward_id} allocation={a} />
        ))}
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-100" />

      {/* Share footer */}
      <ShareFooter brandName={theme.brandName} allocations={allocations} />

      {/* GoSelf powered-by footer */}
      <div className="py-4 text-center">
        <p className="text-[10px] text-gray-300 font-medium">
          Powered by <span style={{ color: 'var(--gs-brand)' }}>GoSelf</span>
        </p>
      </div>
    </div>
  );
}
