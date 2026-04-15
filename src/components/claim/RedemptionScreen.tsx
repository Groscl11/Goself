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
    <div className="min-h-screen" style={{ background: '#f6f6f3' }}>
      {/* Celebration header — full width with centered inner content */}
      <div
        ref={confettiRef}
        className="relative px-4 pt-10 pb-10 text-center"
        style={{ background: 'linear-gradient(160deg, var(--gs-brand-dark) 0%, var(--gs-brand) 100%)' }}
      >
        <div className="mx-auto w-full max-w-2xl">
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
            className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1"
            style={{ fontFamily: 'var(--gs-display-font)' }}
          >
            {alreadyClaimed ? 'Already claimed!' : 'Rewards claimed!'}
          </h1>
          <p className="text-sm text-white opacity-75">
            {alreadyClaimed
              ? 'Here are the rewards you previously claimed.'
              : `You've successfully claimed your ${campaignName} rewards.`}
          </p>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none">
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="w-full h-5 block">
            <path d="M0,20 C300,40 900,0 1200,20 L1200,40 L0,40 Z" fill="#f6f6f3" />
          </svg>
        </div>
      </div>

      {/* Main content — centered on desktop */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Your rewards
        </p>
        {/* 2-col grid on desktop when multiple rewards */}
        <div className={`grid gap-4 ${allocations.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {allocations.map((a) => (
            <RewardCodeBox key={a.reward_id} allocation={a} />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-auto w-full max-w-2xl px-4">
        <div className="border-t border-gray-100" />
      </div>

      {/* Share footer */}
      <div className="mx-auto w-full max-w-2xl">
        <ShareFooter brandName={theme.brandName} allocations={allocations} />
      </div>

      {/* GoSelf powered-by footer */}
      <div className="py-4 text-center">
        <p className="text-[10px] text-gray-300 font-medium">
          Powered by <span style={{ color: 'var(--gs-brand)' }}>GoSelf</span>
        </p>
      </div>
    </div>
  );
}
