import React from 'react';
import { Offer, OfferDistribution, OFFER_TYPE_LABELS } from '../../types/offers';

// ─── Badge ───────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray' | 'teal';
}

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  const colors: Record<string, string> = {
    green:  'bg-green-50  text-green-700  border border-green-200',
    amber:  'bg-amber-50  text-amber-700  border border-amber-200',
    red:    'bg-red-50    text-red-700    border border-red-200',
    blue:   'bg-blue-50   text-blue-700   border border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
    gray:   'bg-gray-100  text-gray-600   border border-gray-200',
    teal:   'bg-teal-50   text-teal-700   border border-teal-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    active:    { label: 'Active',    variant: 'green' },
    draft:     { label: 'Draft',     variant: 'gray' },
    paused:    { label: 'Paused',    variant: 'amber' },
    exhausted: { label: 'Exhausted', variant: 'red' },
    expired:   { label: 'Expired',   variant: 'red' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Code pool pill ──────────────────────────────────────────────────────────
export function CodePoolBadge({ offer }: { offer: Offer }) {
  if (offer.coupon_type === 'generic') {
    return offer.generic_coupon_code
      ? <Badge variant="blue">Generic code set</Badge>
      : <Badge variant="red">No generic code</Badge>;
  }
  const avail = offer.available_codes ?? 0;
  const total = offer.total_codes_uploaded ?? 0;
  const variant = avail === 0 ? 'red' : avail < 10 ? 'amber' : 'green';
  return <Badge variant={variant}>{avail} / {total} codes</Badge>;
}

// ─── Stats row ───────────────────────────────────────────────────────────────
interface StatItemProps {
  label: string;
  value: React.ReactNode;
}
function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-xs text-gray-500 truncate">{label}</span>
      <span className="text-sm font-medium text-gray-900 truncate">{value}</span>
    </div>
  );
}

// ─── Offer card ──────────────────────────────────────────────────────────────
interface OfferCardProps {
  offer: Offer;
  distribution?: OfferDistribution | null;
  actions: React.ReactNode;
  showSource?: boolean;
  sourceLabel?: React.ReactNode;
}

export function OfferCard({ offer, distribution, actions, showSource, sourceLabel }: OfferCardProps) {
  const isLowStock =
    offer.coupon_type === 'unique' &&
    (offer.available_codes ?? 0) < 10 &&
    offer.status === 'active';

  const subtitle = [
    offer.reward_type === 'flat_discount' ? 'Flat discount'
      : offer.reward_type === 'percentage_discount' ? 'Percentage discount'
      : offer.reward_type === 'free_item' ? 'Free item'
      : 'Other',
    offer.coupon_type === 'unique' ? 'Unique codes' : 'Generic code',
    offer.code_source === 'shopify_generated' ? 'Shopify generated'
      : offer.code_source === 'shopify_imported' ? 'Shopify imported'
      : offer.code_source === 'csv_uploaded' ? 'CSV uploaded'
      : '',
  ].filter(Boolean).join(' · ');

  const discountLabel = offer.reward_type === 'percentage_discount'
    ? `${offer.discount_value}% off`
    : offer.discount_value
      ? `₹${offer.discount_value.toLocaleString('en-IN')} off`
      : '';

  return (
    <div className="bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
      {/* Low stock warning */}
      {isLowStock && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs text-amber-700">
            Running low — {offer.available_codes} codes left. Upload more.
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{offer.title}</h3>
              {discountLabel && (
                <span className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  {discountLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">
              ID: {offer.id.slice(0, 8)}&hellip; &middot; {new Date(offer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {showSource && sourceLabel && (
              <div className="mt-1">{sourceLabel}</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CodePoolBadge offer={offer} />
            <StatusBadge status={offer.status} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 py-3 border-t border-b border-gray-100 mb-3">
          <StatItem
            label="Points to redeem"
            value={
              distribution?.points_cost != null
                ? `${distribution.points_cost.toLocaleString('en-IN')} pts`
                : distribution?.access_type === 'campaign_reward'
                  ? <span className="text-gray-400">Free (campaign)</span>
                  : <span className="text-red-500 text-xs">Not configured</span>
            }
          />
          <StatItem label="Assigned" value={distribution?.current_issuances?.toLocaleString('en-IN') ?? '—'} />
          <StatItem label="Total codes" value={(offer.total_codes_uploaded ?? 0).toLocaleString('en-IN')} />
          <StatItem
            label="Tracking"
            value={
              offer.tracking_type === 'manual'
                ? <Badge variant="amber">Manual</Badge>
                : <span className="text-gray-500 text-xs">Auto</span>
            }
          />
        </div>

        {(offer.offer_type === 'partner_voucher') && (
          <div className="mb-3 space-y-1 text-xs text-gray-500">
            {(offer.steps_to_redeem || offer.description) && (
              <p><span className="font-medium text-gray-600">Steps to redeem:</span> {offer.steps_to_redeem || offer.description}</p>
            )}
            {offer.redemption_link && (
              <p>
                <span className="font-medium text-gray-600">Redemption URL:</span>{' '}
                <a href={offer.redemption_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 underline">
                  {offer.redemption_link}
                </a>
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
        </div>
      </div>
    </div>
  );
}

// ─── Button variants ─────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export function Btn({ variant = 'default', size = 'sm', className = '', children, ...props }: BtnProps) {
  const base = 'inline-flex items-center font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs gap-1.5', md: 'px-4 py-2 text-sm gap-2' };
  const variants = {
    default: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost:   'bg-transparent border-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100',
    danger:  'bg-white border border-red-300 text-red-600 hover:bg-red-50',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ─── Dashed add card ─────────────────────────────────────────────────────────
interface AddCardProps {
  label: string;
  children: React.ReactNode;
}
export function AddCard({ label, children }: AddCardProps) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-gray-300 transition-colors">
      <p className="text-sm font-medium text-gray-500 mb-3">{label}</p>
      <div className="flex items-center justify-center gap-2">{children}</div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-500 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── Source dot ──────────────────────────────────────────────────────────────
export function SourceDot({ type }: { type: 'own' | 'partner' | 'marketplace' }) {
  const map = {
    own:         { color: 'bg-green-500',  label: 'Your store' },
    partner:     { color: 'bg-amber-500',  label: 'Partner' },
    marketplace: { color: 'bg-blue-500',   label: 'Marketplace' },
  };
  const { color, label } = map[type];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      {label}
    </span>
  );
}
