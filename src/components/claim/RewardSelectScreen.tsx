import React, { useMemo, useState } from 'react';
import type { TokenReward } from '../../hooks/useClaimToken';
import { ProgressBar } from './ProgressBar';
import { FilterChips, type FilterKey } from './FilterChips';
import { TopPickCard } from './TopPickCard';
import { RewardCard } from './RewardCard';
import { useTheme } from '../../hooks/useTheme';

interface RewardSelectScreenProps {
  campaignName: string;
  expiresAt: string | null;
  rewards: TokenReward[];
  minRewards: number;
  maxRewards: number;
  error: string | null;
  isClaiming: boolean;
  onClaim: (selectedIds: string[]) => void;
}

export function RewardSelectScreen({
  campaignName,
  expiresAt,
  rewards,
  minRewards,
  maxRewards,
  error,
  isClaiming,
  onClaim,
}: RewardSelectScreenProps) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKey>('all');

  /* Unique categories from rewards */
  const categories = useMemo(() => {
    const cats = new Set<string>();
    rewards.forEach((r) => r.category && cats.add(r.category.toLowerCase()));
    return Array.from(cats);
  }, [rewards]);

  /* Top picks: first 6 rewards by pool order */
  const topPicks = useMemo(() => rewards.slice(0, 6), [rewards]);

  /* Filtered reward list */
  const filtered = useMemo(() => {
    if (filter === 'all') return rewards;
    if (filter === 'trending')
      return rewards.filter((r) => r.available_vouchers > 0 && r.available_vouchers < 50);
    return rewards.filter((r) => r.category?.toLowerCase() === filter);
  }, [rewards, filter]);

  function toggleReward(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxRewards) {
        next.add(id);
      }
      return next;
    });
  }

  const selectionCount = selected.size;
  const canClaim =
    selectionCount >= minRewards && selectionCount <= maxRewards;

  const selectionLabel =
    maxRewards === 1
      ? 'Choose 1 reward'
      : minRewards === maxRewards
      ? `Choose ${maxRewards} rewards`
      : `Choose ${minRewards}–${maxRewards} rewards`;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#f6f6f3' }}>
      {/* Header bar */}
      <header
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{
          background: '#fff',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}
      >
        {theme.logoUrl ? (
          <img
            src={theme.logoUrl}
            alt={theme.brandName}
            className="h-8 w-auto object-contain"
          />
        ) : (
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--gs-brand)', fontFamily: 'var(--gs-display-font)' }}
          >
            {theme.brandName}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-xs text-gray-400 font-medium truncate"
          >
            {campaignName}
          </p>
        </div>
        <div
          className="flex-shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold"
          style={{ background: 'var(--gs-brand-light)', color: 'var(--gs-brand)' }}
        >
          {selectionCount}/{maxRewards}
        </div>
      </header>

      {/* Countdown progress bar */}
      {expiresAt && <ProgressBar expiresAt={expiresAt} />}

      {/* Hero text */}
      <div className="px-4 pt-4 pb-2">
        <h1
          className="text-xl font-bold leading-tight"
          style={{
            color: 'var(--gs-brand-dark)',
            fontFamily: 'var(--gs-display-font)',
          }}
        >
          Your exclusive rewards 🎁
        </h1>
        <p className="text-sm text-gray-500 mt-1">{selectionLabel}</p>
      </div>

      {/* Top picks strip */}
      {topPicks.length > 1 && (
        <div className="px-4 pt-1 pb-3">
          <p
            className="text-xs font-semibold mb-2"
            style={{ color: 'var(--gs-brand)' }}
          >
            ✨ Top Picks
          </p>
          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {topPicks.map((r) => (
              <TopPickCard
                key={r.id}
                reward={r}
                selected={selected.has(r.id)}
                onToggle={() => toggleReward(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filter chips */}
      {categories.length > 0 && (
        <FilterChips categories={categories} active={filter} onChange={setFilter} />
      )}

      {/* Main reward list */}
      <div className="flex-1 px-4 pt-2 pb-24 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-center text-gray-400 py-8">No rewards in this category.</p>
        ) : (
          filtered.map((r) => (
            <RewardCard
              key={r.id}
              reward={r}
              selected={selected.has(r.id)}
              selectable={selected.size < maxRewards || selected.has(r.id)}
              onToggle={() => toggleReward(r.id)}
            />
          ))
        )}
      </div>

      {/* Sticky claim footer */}
      <div
        className="sticky bottom-0 z-30 px-4 py-4 bg-white"
        style={{ boxShadow: '0 -2px 16px rgba(0,0,0,0.08)' }}
      >
        {error && (
          <p className="text-xs text-red-500 text-center mb-2 font-medium">{error}</p>
        )}
        <button
          disabled={!canClaim || isClaiming}
          onClick={() => onClaim(Array.from(selected))}
          className="w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-200"
          style={{
            background:
              canClaim && !isClaiming
                ? 'linear-gradient(135deg, var(--gs-brand), var(--gs-brand-dark))'
                : '#ccc',
            color: '#fff',
            boxShadow: canClaim && !isClaiming ? '0 4px 16px rgba(0,0,0,0.18)' : 'none',
          }}
        >
          {isClaiming
            ? 'Claiming…'
            : `Claim ${selectionCount > 0 ? selectionCount : ''} Reward${selectionCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
