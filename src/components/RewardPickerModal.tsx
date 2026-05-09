/**
 * RewardPickerModal
 *
 * Full-screen overlay for browsing and selecting rewards to add to a
 * campaign's reward pool. Designed to handle 100+ rewards comfortably.
 *
 * Layout:
 *   ┌─ Sticky header: ← Back | title | N selected | Done ─────────┐
 *   │  Full-width search bar                                        │
 *   │  Filter chips: Source | Coupon | Brand dropdown               │
 *   │  "Showing X of Y rewards"                                     │
 *   ├─ Scrollable flat list ────────────────────────────────────────┤
 *   │  □ [img] Title   [Source badge] [Coupon badge]                │
 *   │         Brand · Discount value                                │
 *   │         Expiry: DD MMM YYYY · N avail / Unlimited             │
 *   └─ Sticky bottom: selected chips + Clear all ──────────────────┘
 */

import { useState, useMemo, ElementType } from 'react';
import { X, Search, Check, Gift, ChevronDown, ChevronUp, Store, Users, Globe } from 'lucide-react';

export interface RewardPoolItem {
  id: string;
  title: string;
  description: string;
  value_description: string;
  image_url: string | null;
  category: string;
  coupon_type: 'generic' | 'unique';
  offer_type: string | null;        // store_offer | partner_offer | marketplace_offer
  reward_type: string | null;       // flat_discount | percentage_discount | cashback | gift | general
  discount_value: number | null;    // numeric value (percent or flat amount)
  status: string;
  expiry_date: string | null;
  available_vouchers: number;       // 0 means unlimited for generic codes
  brand: { id: string; name: string; logo_url: string | null } | null;
}

interface BrandOption {
  id: string;
  name: string;
}

interface RewardPickerModalProps {
  rewards: RewardPoolItem[];
  brands: BrandOption[];
  selected: RewardPoolItem[];
  onToggle: (reward: RewardPoolItem) => void;
  onClose: () => void;
}

// Source (offer_type) filter options
const SOURCE_FILTERS = [
  { value: '', label: 'All Sources' },
  { value: 'store_offer', label: 'Store Offers' },
  { value: 'partner_offer', label: 'Partner Vouchers' },
  { value: 'marketplace_offer', label: 'Marketplace' },
];

const COUPON_TYPES = [
  { value: '', label: 'Any Code' },
  { value: 'generic', label: 'Generic' },
  { value: 'unique', label: 'Unique' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return 'No expiry';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDiscountLabel(reward: RewardPoolItem): string | null {
  if (reward.reward_type === 'percentage_discount' && reward.discount_value) {
    return `${reward.discount_value}% off`;
  }
  if (reward.reward_type === 'flat_discount' && reward.discount_value) {
    return `₹${reward.discount_value} off`;
  }
  if (reward.value_description) return reward.value_description;
  return null;
}

function getSourceConfig(offerType: string | null): { label: string; color: string; Icon: ElementType } {
  switch (offerType) {
    case 'store_offer':
      return { label: 'Store', color: 'bg-blue-100 text-blue-700', Icon: Store };
    case 'partner_offer':
      return { label: 'Partner', color: 'bg-violet-100 text-violet-700', Icon: Users };
    case 'marketplace_offer':
      return { label: 'Marketplace', color: 'bg-emerald-100 text-emerald-700', Icon: Globe };
    default:
      return { label: 'Other', color: 'bg-gray-100 text-gray-600', Icon: Gift };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RewardPickerModal({
  rewards,
  brands,
  selected,
  onToggle,
  onClose,
}: RewardPickerModalProps) {
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCoupon, setFilterCoupon] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);

  const selectedSet = useMemo(() => new Set(selected.map(r => r.id)), [selected]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rewards.filter(r => {
      if (q && !r.title.toLowerCase().includes(q) && !(r.brand?.name.toLowerCase().includes(q))) return false;
      if (filterSource && r.offer_type !== filterSource) return false;
      if (filterCoupon && r.coupon_type !== filterCoupon) return false;
      if (filterBrand && r.brand?.id !== filterBrand) return false;
      return true;
    });
  }, [rewards, search, filterSource, filterCoupon, filterBrand]);

  const activeFilterCount = [filterSource, filterCoupon, filterBrand].filter(Boolean).length;
  const selectedBrandName = brands.find(b => b.id === filterBrand)?.name;

  const clearAllFilters = () => {
    setSearch('');
    setFilterSource('');
    setFilterCoupon('');
    setFilterBrand('');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* ── Sticky header ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Select Rewards for Pool</h2>
          </div>
          {selected.length > 0 && (
            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
              {selected.length} selected
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            Done
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search rewards by name or brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips row */}
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">

            {/* Source / offer_type chips */}
            {SOURCE_FILTERS.map(sf => (
              <button
                key={sf.value}
                onClick={() => setFilterSource(sf.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filterSource === sf.value
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {sf.label}
              </button>
            ))}

            {/* Divider */}
            <span className="w-px h-5 bg-gray-200" />

            {/* Coupon type chips */}
            {COUPON_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => setFilterCoupon(ct.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filterCoupon === ct.value
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {ct.label}
              </button>
            ))}

            {/* Divider */}
            <span className="w-px h-5 bg-gray-200" />

            {/* Brand — dropdown chip */}
            <div className="relative">
              <button
                onClick={() => setShowBrandDropdown(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filterBrand
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {filterBrand ? selectedBrandName : 'All Brands'}
                {showBrandDropdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showBrandDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-10 max-h-52 overflow-y-auto">
                  <button
                    onClick={() => { setFilterBrand(''); setShowBrandDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!filterBrand ? 'font-medium text-purple-700' : ''}`}
                  >
                    All Brands
                  </button>
                  {brands.map(b => (
                    <button
                      key={b.id}
                      onClick={() => { setFilterBrand(b.id); setShowBrandDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${filterBrand === b.id ? 'font-medium text-purple-700 bg-purple-50' : ''}`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeFilterCount > 0 && (
              <>
                <span className="w-px h-5 bg-gray-200" />
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>

        {/* Result count + select-all */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing <span className="font-medium text-gray-700">{filtered.length}</span> of{' '}
            <span className="font-medium text-gray-700">{rewards.length}</span> rewards
          </p>
          {filtered.length > 0 && (
            <button
              onClick={() => {
                filtered.forEach(r => {
                  if (!selectedSet.has(r.id)) onToggle(r);
                });
              }}
              className="text-xs text-purple-600 hover:text-purple-800 font-medium"
            >
              Select all {filtered.length > 1 ? `${filtered.length} ` : ''}shown
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable list ── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Gift className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No rewards match your filters</p>
            <button onClick={clearAllFilters} className="mt-2 text-xs text-purple-600 hover:underline">Clear all filters</button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(reward => {
              const isSelected = selectedSet.has(reward.id);
              const expired = isExpired(reward.expiry_date);
              const discountLabel = formatDiscountLabel(reward);
              const expiryText = formatExpiry(reward.expiry_date);
              const src = getSourceConfig(reward.offer_type);
              const SrcIcon = src.Icon;
              const isGeneric = reward.coupon_type === 'generic';
              const availText = isGeneric ? 'Unlimited' : `${reward.available_vouchers} avail.`;

              return (
                <li
                  key={reward.id}
                  onClick={() => onToggle(reward)}
                  className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-purple-50 hover:bg-purple-100' : expired ? 'hover:bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="mt-0.5 flex-shrink-0">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                  </div>

                  {/* Thumbnail */}
                  {reward.image_url ? (
                    <img
                      src={reward.image_url}
                      alt=""
                      className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-gray-100 mt-0.5"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Gift className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  {/* Info block */}
                  <div className="flex-1 min-w-0">
                    {/* Title + source badge */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{reward.title}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Source badge */}
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${src.color}`}>
                          <SrcIcon className="w-2.5 h-2.5" />
                          {src.label}
                        </span>
                        {/* Coupon type badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isGeneric ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {isGeneric ? 'Generic' : 'Unique'}
                        </span>
                      </div>
                    </div>

                    {/* Brand + discount value */}
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {reward.brand?.name ?? 'No Brand'}
                      {discountLabel && <span className="ml-1.5 font-semibold text-gray-700">· {discountLabel}</span>}
                    </p>

                    {/* Expiry + availability */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-medium ${expired ? 'text-red-500' : 'text-gray-400'}`}>
                        {expired ? '⚠ Expired · ' : ''}
                        {expiryText}
                      </span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className={`text-[10px] font-semibold ${isGeneric ? 'text-purple-600' : 'text-gray-500'}`}>
                        {availText}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Sticky selected panel ── */}
      {selected.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <button
            onClick={() => setShowSelectedPanel(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {selected.length}
              </span>
              Selected rewards
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selected.forEach(r => onToggle(r));
                }}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear all
              </button>
              {showSelectedPanel ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {showSelectedPanel && (
            <div className="px-4 pb-3 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
              {selected.map(r => (
                <span
                  key={r.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-800 text-xs rounded-full max-w-[200px]"
                >
                  <span className="truncate">{r.title}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggle(r); }}
                    className="flex-shrink-0 hover:text-purple-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
