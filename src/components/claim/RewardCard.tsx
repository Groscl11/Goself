import React from 'react';
import type { TokenReward } from '../../hooks/useClaimToken';
import { categoryEmoji } from './FilterChips';

interface RewardCardProps {
  reward: TokenReward;
  selected: boolean;
  selectable: boolean; // false when max already reached and this isn't selected
  onToggle: () => void;
}

type OfferType = 'partner_voucher' | 'marketplace_offer' | 'store_discount';

function getOfferType(reward: TokenReward): OfferType {
  // Will be resolved once claimed; we infer from coupon_type + brand here
  if (reward.coupon_type === 'unique' && reward.brand) return 'partner_voucher';
  if (reward.brand) return 'marketplace_offer';
  return 'store_discount';
}

const OFFER_LABELS: Record<OfferType, { label: string; color: string; bg: string }> = {
  partner_voucher: { label: 'Partner Voucher', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  marketplace_offer: { label: 'Marketplace Offer', color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
  store_discount: { label: 'Store Discount', color: 'var(--gs-brand)', bg: 'var(--gs-brand-light)' },
};

export function RewardCard({ reward, selected, selectable, onToggle }: RewardCardProps) {
  const offerType = getOfferType(reward);
  const typeStyle = OFFER_LABELS[offerType];
  const isFlash = reward.available_vouchers > 0 && reward.available_vouchers < 10;
  const dimmed = !selected && !selectable;

  return (
    <button
      onClick={selectable || selected ? onToggle : undefined}
      disabled={dimmed}
      className="w-full flex gap-3 p-3 transition-all duration-200 text-left"
      style={{
        borderRadius: 'var(--gs-radius)',
        border: selected
          ? '2px solid var(--gs-brand)'
          : '2px solid #ebebeb',
        background: selected ? 'var(--gs-brand-light)' : '#fff',
        opacity: dimmed ? 0.45 : 1,
        cursor: dimmed ? 'not-allowed' : 'pointer',
      }}
      aria-pressed={selected}
    >
      {/* Thumbnail */}
      <div
        className="flex-shrink-0 w-[64px] h-[64px] flex items-center justify-center overflow-hidden"
        style={{
          borderRadius: 'calc(var(--gs-radius) / 1.5)',
          background: 'rgba(0,0,0,0.05)',
        }}
      >
        {reward.image_url ? (
          <img
            src={reward.image_url}
            alt={reward.title}
            className="w-full h-full object-cover"
          />
        ) : reward.brand?.logo_url ? (
          <img
            src={reward.brand.logo_url}
            alt={reward.brand.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl">{categoryEmoji(reward.category)}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-sm font-semibold leading-snug line-clamp-2 flex-1"
            style={{ color: '#1a1a1a', fontFamily: 'var(--gs-font)' }}
          >
            {reward.title}
          </p>
          {/* Checkmark */}
          <div
            className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 mt-0.5"
            style={{
              borderColor: selected ? 'var(--gs-brand)' : '#ccc',
              background: selected ? 'var(--gs-brand)' : 'transparent',
            }}
          >
            {selected && (
              <svg
                className="w-2.5 h-2.5 text-white"
                fill="none"
                viewBox="0 0 10 10"
                style={{ color: '#fff' }}
              >
                <path
                  d="M2 5l2.5 2.5L8 3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Value + offer type row */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {reward.value_description && (
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--gs-brand)' }}
            >
              {reward.value_description}
            </span>
          )}
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ color: typeStyle.color, background: typeStyle.bg }}
          >
            {typeStyle.label}
          </span>
        </div>

        {/* Brand */}
        {reward.brand && (
          <p className="text-[11px] text-gray-400 mt-0.5">via {reward.brand.name}</p>
        )}

        {/* Flash strip */}
        {isFlash && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[10px] font-bold text-red-500">
              🔥 Only {reward.available_vouchers} left!
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
