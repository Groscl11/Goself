import React from 'react';
import type { TokenReward } from '../../hooks/useClaimToken';
import { categoryEmoji } from './FilterChips';

interface TopPickCardProps {
  reward: TokenReward;
  selected: boolean;
  onToggle: () => void;
}

export function TopPickCard({ reward, selected, onToggle }: TopPickCardProps) {
  const isFlash = reward.available_vouchers < 10;

  return (
    <button
      onClick={onToggle}
      className="relative flex-shrink-0 w-[110px] overflow-hidden transition-all duration-200 text-left"
      style={{
        borderRadius: 'var(--gs-radius)',
        border: selected
          ? '2px solid var(--gs-brand)'
          : '2px solid transparent',
        background: selected ? 'var(--gs-brand-light)' : '#f8f8f6',
        boxShadow: selected ? '0 0 0 3px var(--gs-brand-light)' : 'none',
      }}
      aria-pressed={selected}
    >
      {/* Image / emoji fallback */}
      <div
        className="w-full h-[72px] flex items-center justify-center overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 'calc(var(--gs-radius) - 2px) calc(var(--gs-radius) - 2px) 0 0' }}
      >
        {reward.image_url ? (
          <img
            src={reward.image_url}
            alt={reward.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl">{categoryEmoji(reward.category)}</span>
        )}
      </div>

      {/* Flash badge */}
      {isFlash && (
        <div
          className="absolute top-1 right-1 px-1.5 py-0.5 text-[9px] font-bold text-white rounded-full"
          style={{ background: '#ef4444' }}
        >
          {reward.available_vouchers} left
        </div>
      )}

      {/* Selected checkmark */}
      {selected && (
        <div
          className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'var(--gs-brand)' }}
        >
          ✓
        </div>
      )}

      {/* Title */}
      <div className="px-2 py-1.5">
        <p
          className="text-[11px] font-semibold leading-tight line-clamp-2"
          style={{ color: '#1a1a1a', fontFamily: 'var(--gs-font)' }}
        >
          {reward.title}
        </p>
        {reward.value_description && (
          <p
            className="text-[10px] mt-0.5 font-normal leading-tight"
            style={{ color: 'var(--gs-brand)' }}
          >
            {reward.value_description}
          </p>
        )}
      </div>
    </button>
  );
}
