/**
 * RewardPickerModal — Excel-style full-screen reward picker
 *
 * Table columns:
 *   □  Img  Title/Brand  Source  Type  Discount  Min Order  Expiry  Available  ID  [T&C]  [Steps]
 */

import { useState, useMemo, useRef, ElementType } from 'react';
import {
  X, Search, Check, Gift, ChevronDown, ChevronUp,
  Store, Users, Globe, FileText, BookOpen, Info,
} from 'lucide-react';

export interface RewardPoolItem {
  id: string;
  reward_id: string | null;            // human-readable RWD-XXXXXXXX
  title: string;
  description: string;
  value_description: string;
  image_url: string | null;
  category: string;
  coupon_type: 'generic' | 'unique';
  offer_type: string | null;           // store_discount | partner_voucher | marketplace_offer
  reward_type: string | null;          // flat_discount | percentage_discount | cashback | gift | general
  discount_value: number | null;
  min_purchase_amount: number | null;
  terms_conditions: string | null;
  steps_to_redeem: string | null;
  status: string;
  expiry_date: string | null;          // maps to DB expiry_date column
  available_vouchers: number;
  brand: { id: string; name: string; logo_url: string | null } | null;
}

interface BrandOption { id: string; name: string; }

interface RewardPickerModalProps {
  rewards: RewardPoolItem[];
  brands: BrandOption[];
  selected: RewardPoolItem[];
  onToggle: (reward: RewardPoolItem) => void;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_FILTERS = [
  { value: '', label: 'All Sources' },
  { value: 'store_discount', label: 'Store Offers' },
  { value: 'partner_voucher', label: 'Partner Vouchers' },
  { value: 'marketplace_offer', label: 'Marketplace' },
];

const COUPON_FILTERS = [
  { value: '', label: 'Any Code' },
  { value: 'generic', label: 'Generic' },
  { value: 'unique', label: 'Unique' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatExpiry(dateStr: string | null): { text: string; expired: boolean } {
  if (!dateStr) return { text: 'No expiry', expired: false };
  const d = new Date(dateStr);
  const expired = d < new Date();
  return {
    text: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    expired,
  };
}

function formatDiscount(reward: RewardPoolItem): string {
  if (reward.reward_type === 'percentage_discount' && reward.discount_value != null) {
    return `${reward.discount_value}% off`;
  }
  if (reward.reward_type === 'flat_discount' && reward.discount_value != null) {
    return `₹${reward.discount_value}`;
  }
  if (reward.discount_value != null && reward.discount_value > 0) return `₹${reward.discount_value}`;
  return reward.value_description || '—';
}

function formatRewardType(rt: string | null): string {
  switch (rt) {
    case 'flat_discount':       return 'Flat Discount';
    case 'percentage_discount': return 'Percentage';
    case 'cashback':            return 'Cashback';
    case 'gift':                return 'Gift';
    case 'general':             return 'General';
    default:                    return rt ?? '—';
  }
}

function getSourceConfig(offerType: string | null): { label: string; color: string; dot: string; Icon: ElementType } {
  switch (offerType) {
    case 'store_discount':
      return { label: 'Store', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', Icon: Store };
    case 'partner_voucher':
      return { label: 'Partner', color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500', Icon: Users };
    case 'marketplace_offer':
      return { label: 'Market', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', Icon: Globe };
    default:
      return { label: offerType ?? 'Other', color: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400', Icon: Gift };
  }
}

function shortId(id: string): string {
  return id.length > 8 ? '…' + id.slice(-8) : id;
}

// ── Tooltip component ─────────────────────────────────────────────────────────

function Tooltip({ content, icon: Icon, label, color }: { content: string | null; icon: ElementType; label: string; color: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  if (!content) {
    return (
      <div className="w-6 h-6 flex items-center justify-center opacity-20 cursor-not-allowed">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`w-6 h-6 flex items-center justify-center rounded-full border transition-colors ${color}`}
        title={label}
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-7 z-50 w-64 bg-gray-900 text-white text-[11px] leading-relaxed rounded-lg p-3 shadow-xl pointer-events-none">
          <p className="font-semibold text-gray-300 mb-1">{label}</p>
          <p className="whitespace-pre-wrap">{content}</p>
          <div className="absolute bottom-[-4px] right-3 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RewardPickerModal({ rewards, brands, selected, onToggle, onClose }: RewardPickerModalProps) {
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
    <div className="fixed inset-0 z-[60] bg-gray-50 flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        {/* Header row */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <h2 className="text-base font-bold text-gray-900 flex-1">Select Rewards for Pool</h2>
          {selected.length > 0 && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full">
              {selected.length} selected
            </span>
          )}
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-2.5">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by reward name or brand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters row */}
        <div className="px-5 pb-2.5 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">

            {/* Source chips */}
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-0.5">Source</span>
            {SOURCE_FILTERS.map(sf => (
              <button
                key={sf.value}
                onClick={() => setFilterSource(sf.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filterSource === sf.value
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                }`}
              >
                {sf.label}
              </button>
            ))}

            <span className="w-px h-5 bg-gray-200 mx-1" />

            {/* Coupon chips */}
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-0.5">Code</span>
            {COUPON_FILTERS.map(cf => (
              <button
                key={cf.value}
                onClick={() => setFilterCoupon(cf.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filterCoupon === cf.value
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                }`}
              >
                {cf.label}
              </button>
            ))}

            <span className="w-px h-5 bg-gray-200 mx-1" />

            {/* Brand dropdown */}
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-0.5">Brand</span>
            <div className="relative">
              <button
                onClick={() => setShowBrandDropdown(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filterBrand
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                }`}
              >
                {filterBrand ? selectedBrandName : 'All Brands'}
                {showBrandDropdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showBrandDropdown && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-xl z-20 max-h-56 overflow-y-auto">
                  <button
                    onClick={() => { setFilterBrand(''); setShowBrandDropdown(false); }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 ${!filterBrand ? 'font-semibold text-purple-700' : 'text-gray-700'}`}
                  >
                    All Brands
                  </button>
                  {brands.map(b => (
                    <button
                      key={b.id}
                      onClick={() => { setFilterBrand(b.id); setShowBrandDropdown(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 ${filterBrand === b.id ? 'font-semibold text-purple-700 bg-purple-50' : 'text-gray-700'}`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeFilterCount > 0 && (
              <>
                <span className="w-px h-5 bg-gray-200 mx-1" />
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Gift className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No rewards match your filters</p>
            <button onClick={clearAllFilters} className="mt-2 text-xs text-purple-600 hover:underline">Clear all filters</button>
          </div>
        ) : (
          <table className="w-full min-w-[1100px] border-collapse">
            {/* Column headers */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="w-10 px-3 py-2.5">
                  {/* bulk-select-all */}
                  <button
                    onClick={() => filtered.forEach(r => { if (!selectedSet.has(r.id)) onToggle(r); })}
                    className="w-4 h-4 rounded border-2 border-gray-400 hover:border-purple-500 transition-colors block mx-auto"
                    title="Select all shown"
                  />
                </th>
                <th className="w-10 px-2 py-2.5" />
                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reward</th>
                <th className="w-28 px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Source</th>
                <th className="w-32 px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reward Type</th>
                <th className="w-24 px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="w-28 px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Min Order</th>
                <th className="w-28 px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Expiry</th>
                <th className="w-24 px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Available</th>
                <th className="w-24 px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reward ID</th>
                <th className="w-14 px-3 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">T&C</th>
                <th className="w-14 px-3 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Steps</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((reward, idx) => {
                const isSelected = selectedSet.has(reward.id);
                const expiry = formatExpiry(reward.expiry_date);
                const src = getSourceConfig(reward.offer_type);
                const SrcIcon = src.Icon;
                const isGeneric = reward.coupon_type === 'generic';
                const discountLabel = formatDiscount(reward);
                const typeLabel = formatRewardType(reward.reward_type);
                const minOrder = reward.min_purchase_amount && reward.min_purchase_amount > 0
                  ? `₹${reward.min_purchase_amount}`
                  : '—';

                return (
                  <tr
                    key={reward.id}
                    onClick={() => onToggle(reward)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-purple-50 hover:bg-purple-100'
                        : idx % 2 === 0
                          ? 'bg-white hover:bg-gray-50'
                          : 'bg-gray-50/60 hover:bg-gray-100'
                    } ${expiry.expired ? 'opacity-55' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3" onClick={e => { e.stopPropagation(); onToggle(reward); }}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                        isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300 group-hover:border-purple-400'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                    </td>

                    {/* Thumbnail */}
                    <td className="px-2 py-3">
                      {reward.image_url ? (
                        <img src={reward.image_url} alt="" className="w-8 h-8 rounded-md object-cover border border-gray-100" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <Gift className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </td>

                    {/* Title + Brand + coupon badge */}
                    <td className="px-3 py-3 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{reward.title}</p>
                          <p className="text-xs text-gray-400 truncate">{reward.brand?.name ?? 'No Brand'}</p>
                        </div>
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          isGeneric
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {isGeneric ? 'Generic' : 'Unique'}
                        </span>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${src.color}`}>
                        <SrcIcon className="w-3 h-3" />
                        {src.label}
                      </span>
                    </td>

                    {/* Reward Type */}
                    <td className="px-3 py-3">
                      <span className="text-xs text-gray-700 font-medium">{typeLabel}</span>
                    </td>

                    {/* Discount */}
                    <td className="px-3 py-3">
                      <span className="text-xs font-bold text-gray-900">{discountLabel}</span>
                    </td>

                    {/* Min Order */}
                    <td className="px-3 py-3">
                      <span className="text-xs text-gray-600">{minOrder}</span>
                    </td>

                    {/* Expiry */}
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium ${expiry.expired ? 'text-red-500' : expiry.text === 'No expiry' ? 'text-gray-400' : 'text-gray-700'}`}>
                        {expiry.expired && '⚠ '}
                        {expiry.text}
                      </span>
                    </td>

                    {/* Availability */}
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold ${isGeneric ? 'text-purple-600' : 'text-gray-700'}`}>
                        {isGeneric ? 'Unlimited' : `${reward.available_vouchers}`}
                      </span>
                    </td>

                    {/* Reward ID */}
                    <td className="px-3 py-3">
                      <span
                        className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded select-all whitespace-nowrap"
                        title={reward.id}
                      >
                        {reward.reward_id ?? shortId(reward.id)}
                      </span>
                    </td>

                    {/* T&C tooltip */}
                    <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <Tooltip
                        content={reward.terms_conditions}
                        icon={FileText}
                        label="Terms & Conditions"
                        color={reward.terms_conditions
                          ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'border-gray-200 bg-gray-50 text-gray-400'}
                      />
                    </td>

                    {/* Steps tooltip */}
                    <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <Tooltip
                        content={reward.steps_to_redeem}
                        icon={BookOpen}
                        label="Steps to Redeem"
                        color={reward.steps_to_redeem
                          ? 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                          : 'border-gray-200 bg-gray-50 text-gray-400'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-5 py-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-800">{filtered.length}</span> of{' '}
          <span className="font-semibold text-gray-800">{rewards.length}</span> rewards
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="ml-2 text-purple-600 hover:underline">Clear filters</button>
          )}
        </p>

        {/* Selected chips panel */}
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSelectedPanel(v => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700"
            >
              <span className="w-5 h-5 bg-purple-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {selected.length}
              </span>
              {showSelectedPanel ? 'Hide selected' : 'Show selected'}
              {showSelectedPanel ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            <button
              onClick={() => selected.forEach(r => onToggle(r))}
              className="text-xs text-red-500 hover:text-red-700 font-medium ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Selected chips expanded */}
      {selected.length > 0 && showSelectedPanel && (
        <div className="flex-shrink-0 bg-purple-50 border-t border-purple-100 px-5 py-2.5 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {selected.map(r => (
            <span key={r.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-purple-800 text-xs rounded-full border border-purple-200 shadow-sm max-w-[220px]">
              <span className="truncate">{r.title}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggle(r); }}
                className="flex-shrink-0 text-purple-400 hover:text-purple-700"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
