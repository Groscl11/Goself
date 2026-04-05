import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import {
  ChevronDown, ChevronUp, Plus, Trash2, Save, Check, Info,
  Award, Zap, Layers, ShoppingBag,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LoyaltyProgram {
  id: string;
  client_id: string;
  program_name: string;
  points_name: string;
  points_name_singular: string;
  is_active: boolean;
  currency: string;
  allow_redemption: boolean;
  points_expiry_days: number | null;
  welcome_bonus_points: number;
  referral_reward_trigger: string;
  base_earn_rate: number;
  base_earn_divisor: number;
  base_points_value: number;
}

type QualMode = 'any' | 'all' | 'points_only' | 'spend_only' | 'orders_only';
type QualPeriod = 'lifetime' | 'rolling_12_months' | 'calendar_year';
type DowngradePolicy = 'never' | 'rolling_period' | 'calendar_year';

interface Perk {
  type: string;
  enabled: boolean;
  label?: string;
  value?: number;
}

interface LoyaltyTier {
  id?: string;
  loyalty_program_id?: string;
  tier_name: string;
  tier_level: number;
  is_default: boolean;
  color_code: string;
  qualification_mode: QualMode;
  min_lifetime_spend: number;
  min_orders: number;
  min_lifetime_points: number;
  qualification_period: QualPeriod;
  tier_duration_days: number | null;
  earn_multiplier: number;
  category_multipliers: Record<string, number>;
  points_earn_rate: number;
  points_earn_divisor: number;
  points_value: number;
  max_redemption_percent: number;
  max_redemption_points: number | null;
  min_redemption_points: number;
  min_order_value_to_redeem: number;
  redemption_step_size: number;
  perks: Perk[];
  benefits_description: string;
  downgrade_policy: DowngradePolicy;
  downgrade_grace_days: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#f97316', label: 'Orange' },
];

const PERK_TYPES: {
  type: string;
  label: string;
  hasValue?: boolean;
  valueSuffix?: string;
  hasLabel?: boolean;
}[] = [
  { type: 'free_shipping', label: 'Free shipping' },
  { type: 'early_access', label: 'Early access to sales' },
  { type: 'birthday_multiplier', label: 'Birthday bonus points', hasValue: true, valueSuffix: '× multiplier' },
  { type: 'priority_support', label: 'Priority customer support' },
  { type: 'exclusive_offers', label: 'Exclusive offers' },
  { type: 'custom', label: 'Custom perk', hasLabel: true },
];

const DEFAULT_PERKS: Perk[] = PERK_TYPES.map(p => ({
  type: p.type,
  enabled: false,
  label: p.hasLabel ? '' : undefined,
  value: p.hasValue ? 2 : undefined,
}));

const BASE_EARN_RATE_DEFAULT = 10;
const BASE_EARN_DIVISOR_DEFAULT = 100;

const EMPTY_PROGRAM: Omit<LoyaltyProgram, 'id' | 'client_id'> = {
  program_name: '',
  points_name: 'Points',
  points_name_singular: 'Point',
  is_active: true,
  currency: 'INR',
  allow_redemption: true,
  points_expiry_days: null,
  welcome_bonus_points: 0,
  referral_reward_trigger: 'first_order',
  base_earn_rate: BASE_EARN_RATE_DEFAULT,
  base_earn_divisor: BASE_EARN_DIVISOR_DEFAULT,
  base_points_value: 0.1,
};

function makeDefaultTier(level: number, isDefault: boolean): LoyaltyTier {
  const names = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];
  return {
    tier_name: names[level - 1] ?? `Tier ${level}`,
    tier_level: level,
    is_default: isDefault,
    color_code: colors[level - 1] ?? '#3b82f6',
    qualification_mode: 'any',
    min_lifetime_spend: 0,
    min_orders: 0,
    min_lifetime_points: 0,
    qualification_period: 'lifetime',
    tier_duration_days: null,
    earn_multiplier: isDefault ? 1.0 : level,
    category_multipliers: {},
    points_earn_rate: BASE_EARN_RATE_DEFAULT * (isDefault ? 1 : level),
    points_earn_divisor: BASE_EARN_DIVISOR_DEFAULT,
    points_value: 0.1,
    max_redemption_percent: 100,
    max_redemption_points: null,
    min_redemption_points: 10,
    min_order_value_to_redeem: 500,
    redemption_step_size: 1,
    perks: [...DEFAULT_PERKS],
    benefits_description: '',
    downgrade_policy: 'never',
    downgrade_grace_days: 30,
  };
}

// ─── Steps config ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Program Basics', icon: Award },
  { id: 2, label: 'Base Earn Rate', icon: Zap },
  { id: 3, label: 'Membership Tiers', icon: Layers },
  { id: 4, label: 'Redemption & Save', icon: ShoppingBag },
];

// ─── Shared mini-components ─────────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {hint && <span className="ml-1 text-xs text-gray-400 font-normal">{hint}</span>}
    </label>
  );
}

function TextInput({
  value, onChange, type = 'text', placeholder, className = '',
  min, max, step, disabled,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
    />
  );
}

function DropdownSelect({
  value, onChange, children, className = '',
}: {
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white ${className}`}
    >
      {children}
    </select>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${checked ? 'bg-indigo-600' : 'bg-gray-200'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

function LiveHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-indigo-600 bg-indigo-50 rounded px-2 py-1">{children}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 mt-5 first:mt-0">
      {children}
    </h4>
  );
}

function ColorDotPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PRESET_COLORS.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          title={c.label}
          className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${value === c.value ? 'ring-2 ring-offset-2 ring-gray-700 scale-110' : ''}`}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  );
}

// ─── Step 1 — Program Basics ────────────────────────────────────────────────────

function Step1({
  program,
  onChange,
}: {
  program: Omit<LoyaltyProgram, 'id' | 'client_id'>;
  onChange: <K extends keyof Omit<LoyaltyProgram, 'id' | 'client_id'>>(
    k: K,
    v: Omit<LoyaltyProgram, 'id' | 'client_id'>[K]
  ) => void;
}) {
  const expiryOptions = [
    { label: 'Never expire', value: '' },
    { label: '90 days', value: '90' },
    { label: '180 days', value: '180' },
    { label: '365 days (1 year)', value: '365' },
    { label: '2 years (730 days)', value: '730' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Program Basics</h3>
        <p className="text-sm text-gray-500">Set your program name, currency, and global settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <FieldLabel>Program name</FieldLabel>
          <TextInput
            value={program.program_name}
            onChange={v => onChange('program_name', v)}
            placeholder="e.g. Houme Coins, Gems Rewards"
          />
        </div>

        <div>
          <FieldLabel hint="(plural)">Points name</FieldLabel>
          <TextInput
            value={program.points_name}
            onChange={v => onChange('points_name', v)}
            placeholder="e.g. Gems"
          />
        </div>
        <div>
          <FieldLabel hint="(singular)">Points name singular</FieldLabel>
          <TextInput
            value={program.points_name_singular}
            onChange={v => onChange('points_name_singular', v)}
            placeholder="e.g. Gem"
          />
        </div>
        <div>
          <FieldLabel hint="(awarded on join / first activity)">Welcome bonus points</FieldLabel>
          <TextInput
            type="number"
            value={program.welcome_bonus_points}
            onChange={v => onChange('welcome_bonus_points', Math.max(0, Number(v)))}
            min={0}
            placeholder="0"
          />
        </div>
        <div>
          <FieldLabel>Points expiry</FieldLabel>
          <DropdownSelect
            value={program.points_expiry_days ?? ''}
            onChange={v => onChange('points_expiry_days', v === '' ? null : Number(v))}
          >
            {expiryOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </DropdownSelect>
        </div>
        <div>
          <FieldLabel>Currency</FieldLabel>
          <DropdownSelect value={program.currency} onChange={v => onChange('currency', v)}>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="AED">AED (د.إ)</option>
          </DropdownSelect>
        </div>
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
          <div>
            <p className="text-sm font-medium text-gray-900">Allow redemption</p>
            <p className="text-xs text-gray-500">Members can redeem points for discounts</p>
          </div>
          <ToggleSwitch
            checked={program.allow_redemption}
            onChange={v => onChange('allow_redemption', v)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 — Base Earn Rate ────────────────────────────────────────────────────

function Step2({
  program,
  onChange,
}: {
  program: Omit<LoyaltyProgram, 'id' | 'client_id'>;
  onChange: <K extends keyof Omit<LoyaltyProgram, 'id' | 'client_id'>>(
    k: K,
    v: Omit<LoyaltyProgram, 'id' | 'client_id'>[K]
  ) => void;
}) {
  const { base_earn_rate, base_earn_divisor, base_points_value, points_name, currency } = program;
  const curr = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : 'د.إ';

  const exampleSpend = 1000;
  const earned = (exampleSpend / Math.max(1, base_earn_divisor)) * base_earn_rate;
  const worth = earned * base_points_value;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Base Earn Rate</h3>
        <p className="text-sm text-gray-500">
          How many points does a member earn per unit of spend? Tiers can multiply this rate.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <FieldLabel>Points earned</FieldLabel>
          <TextInput
            type="number"
            value={base_earn_rate}
            onChange={v => onChange('base_earn_rate', Math.max(1, Number(v)))}
            min={1}
            step={1}
          />
          <LiveHint>{base_earn_rate} {points_name || 'pts'}</LiveHint>
        </div>
        <div>
          <FieldLabel>Per {curr} spent</FieldLabel>
          <TextInput
            type="number"
            value={base_earn_divisor}
            onChange={v => onChange('base_earn_divisor', Math.max(1, Number(v)))}
            min={1}
            step={1}
          />
          <LiveHint>every {curr}{base_earn_divisor}</LiveHint>
        </div>
        <div>
          <FieldLabel>1 pt = {curr}X</FieldLabel>
          <TextInput
            type="number"
            value={base_points_value}
            onChange={v => onChange('base_points_value', Math.max(0.001, Number(v)))}
            min={0.001}
            step={0.01}
          />
          <LiveHint>1 pt ≈ {curr}{base_points_value}</LiveHint>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-indigo-900">Live preview</p>
          <p className="text-sm text-indigo-700 mt-1">
            For a {curr}{exampleSpend.toLocaleString()} order, a member earns{' '}
            <span className="font-bold">{earned.toFixed(0)} {points_name || 'pts'}</span>{' '}
            worth{' '}
            <span className="font-bold">{curr}{worth.toFixed(2)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Perk editor ────────────────────────────────────────────────────────────────

function PerkEditor({ perks, onChange }: { perks: Perk[]; onChange: (p: Perk[]) => void }) {
  const update = (type: string, patch: Partial<Perk>) => {
    const updated = perks.map(p => p.type === type ? { ...p, ...patch } : p);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {PERK_TYPES.map(pt => {
        const perk = perks.find(p => p.type === pt.type) ?? { type: pt.type, enabled: false };
        return (
          <div key={pt.type} className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
            <ToggleSwitch checked={perk.enabled} onChange={v => update(pt.type, { enabled: v })} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 leading-tight">{pt.label}</p>
              {perk.enabled && pt.hasValue && (
                <div className="mt-2 flex items-center gap-2">
                  <TextInput
                    type="number"
                    value={perk.value ?? 2}
                    onChange={v => update(pt.type, { value: Number(v) })}
                    min={1}
                    step={0.5}
                    className="!w-24"
                  />
                  <span className="text-xs text-gray-500">{pt.valueSuffix}</span>
                </div>
              )}
              {perk.enabled && pt.hasLabel && (
                <div className="mt-2">
                  <TextInput
                    value={perk.label ?? ''}
                    onChange={v => update(pt.type, { label: v })}
                    placeholder="Describe this perk…"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tier card ──────────────────────────────────────────────────────────────────

function TierCard({
  tier,
  index,
  program,
  allTiers,
  onUpdate,
  onRemove,
  canRemove,
}: {
  tier: LoyaltyTier;
  index: number;
  program: Omit<LoyaltyProgram, 'id' | 'client_id'>;
  allTiers: LoyaltyTier[];
  onUpdate: (patch: Partial<LoyaltyTier>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const { base_earn_rate, base_earn_divisor, points_name, currency } = program;
  const curr = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : 'د.إ';

  const isDuplicate = allTiers.some(
    (t, i) =>
      i !== index &&
      t.tier_name.trim().toLowerCase() === tier.tier_name.trim().toLowerCase() &&
      t.tier_name.trim() !== ''
  );

  const derivedRate = (base_earn_rate * tier.earn_multiplier).toFixed(1);

  const qualConditions: {
    field: keyof LoyaltyTier;
    label: string;
    prefix: string;
    relevant: boolean;
  }[] = [
    {
      field: 'min_lifetime_spend',
      label: `Min lifetime spend (${curr})`,
      prefix: curr,
      relevant:
        tier.qualification_mode !== 'points_only' &&
        tier.qualification_mode !== 'orders_only',
    },
    {
      field: 'min_orders',
      label: 'Min orders placed',
      prefix: '',
      relevant:
        tier.qualification_mode !== 'points_only' &&
        tier.qualification_mode !== 'spend_only',
    },
    {
      field: 'min_lifetime_points',
      label: 'Min lifetime points',
      prefix: '',
      relevant:
        tier.qualification_mode !== 'spend_only' &&
        tier.qualification_mode !== 'orders_only',
    },
  ];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/10"
          style={{ backgroundColor: tier.color_code }}
        />
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {tier.tier_name || <span className="text-gray-400 italic font-normal">Untitled tier</span>}
          </span>
          {tier.is_default ? (
            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium shrink-0">
              Entry tier · All new members
            </span>
          ) : (
            <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-medium shrink-0">
              Tier {tier.tier_level} · {tier.earn_multiplier}× earn
            </span>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded flex-shrink-0"
            title="Remove tier"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-5 space-y-6">

          {/* Tier name + color */}
          <div>
            <SectionTitle>Tier identity</SectionTitle>
            <FieldLabel>Tier name</FieldLabel>
            <TextInput
              value={tier.tier_name}
              onChange={v => onUpdate({ tier_name: v })}
              placeholder="e.g. Silver · Gold · Platinum"
              className={isDuplicate ? 'border-red-400 focus:ring-red-400' : ''}
            />
            {isDuplicate && (
              <p className="mt-1 text-xs text-red-500">Tier names must be unique.</p>
            )}
            <div className="mt-3">
              <FieldLabel>Colour</FieldLabel>
              <ColorDotPicker value={tier.color_code} onChange={c => onUpdate({ color_code: c })} />
            </div>
          </div>

          {/* Entry tier note */}
          {tier.is_default && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">All new members start here. No qualification needed.</p>
            </div>
          )}

          {/* Earn rate */}
          <div>
            <SectionTitle>Earn rate</SectionTitle>
            {tier.is_default ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center bg-gray-200 text-gray-600 text-sm font-semibold rounded-lg px-3 py-1.5">
                  1× (base)
                </span>
                <span className="text-xs text-gray-500">
                  = {base_earn_rate} {points_name || 'pts'} per {curr}{base_earn_divisor}
                </span>
              </div>
            ) : (
              <div className="max-w-xs">
                <FieldLabel hint="(min 1.0, step 0.5)">Earn multiplier</FieldLabel>
                <TextInput
                  type="number"
                  value={tier.earn_multiplier}
                  onChange={v => {
                    const m = Math.max(1, Number(v));
                    onUpdate({
                      earn_multiplier: m,
                      points_earn_rate: base_earn_rate * m,
                    });
                  }}
                  min={1}
                  step={0.5}
                />
                <LiveHint>= {derivedRate} {points_name || 'pts'} per {curr}{base_earn_divisor}</LiveHint>
              </div>
            )}
          </div>

          {/* Qualification — non-default only */}
          {!tier.is_default && (
            <div>
              <SectionTitle>How members qualify</SectionTitle>

              {/* Mode picker */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                {(
                  [
                    ['any', 'Any one', 'Spend OR orders OR points'],
                    ['all', 'All of', 'Must meet every condition'],
                    ['points_only', 'Points only', 'Lifetime points only'],
                  ] as [QualMode, string, string][]
                ).map(([v, l, d]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdate({ qualification_mode: v })}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      tier.qualification_mode === v
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                          tier.qualification_mode === v
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-gray-300'
                        }`}
                      />
                      <span className="text-xs font-semibold text-gray-800">{l}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-4.5">{d}</p>
                  </button>
                ))}
              </div>

              {/* Condition inputs */}
              <div className="space-y-3">
                {qualConditions.map(cond => (
                  <div
                    key={cond.field as string}
                    className={`transition-opacity ${!cond.relevant ? 'opacity-40 pointer-events-none' : ''}`}
                  >
                    <FieldLabel>{cond.label}</FieldLabel>
                    <TextInput
                      type="number"
                      value={tier[cond.field] as number}
                      onChange={v => onUpdate({ [cond.field]: Number(v) } as Partial<LoyaltyTier>)}
                      min={0}
                      disabled={!cond.relevant}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <FieldLabel>Qualification period</FieldLabel>
                  <DropdownSelect
                    value={tier.qualification_period}
                    onChange={v => onUpdate({ qualification_period: v as QualPeriod })}
                  >
                    <option value="lifetime">Lifetime (permanent)</option>
                    <option value="rolling_12_months">Rolling 12 months</option>
                    <option value="calendar_year">Calendar year (resets Jan 1)</option>
                  </DropdownSelect>
                </div>
                <div>
                  <FieldLabel>Downgrade policy</FieldLabel>
                  <DropdownSelect
                    value={tier.downgrade_policy}
                    onChange={v => onUpdate({ downgrade_policy: v as DowngradePolicy })}
                  >
                    <option value="never">Never downgrade</option>
                    <option value="rolling_period">Downgrade if not re-qualified</option>
                    <option value="calendar_year">Grace period then downgrade</option>
                  </DropdownSelect>
                </div>
              </div>

              {tier.downgrade_policy === 'calendar_year' && (
                <div className="mt-3 max-w-xs">
                  <FieldLabel>Grace period (days)</FieldLabel>
                  <TextInput
                    type="number"
                    value={tier.downgrade_grace_days}
                    onChange={v => onUpdate({ downgrade_grace_days: Math.max(0, Number(v)) })}
                    min={0}
                  />
                </div>
              )}
            </div>
          )}

          {/* Redemption limits */}
          <div>
            <SectionTitle>Redemption limits</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Max % of order (0–100)</FieldLabel>
                <TextInput
                  type="number"
                  value={tier.max_redemption_percent}
                  onChange={v => onUpdate({ max_redemption_percent: Math.min(100, Math.max(0, Number(v))) })}
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <FieldLabel hint="(0 = no cap)">Max points per order</FieldLabel>
                <TextInput
                  type="number"
                  value={tier.max_redemption_points ?? 0}
                  onChange={v =>
                    onUpdate({ max_redemption_points: Number(v) === 0 ? null : Number(v) })
                  }
                  min={0}
                />
              </div>
              <div>
                <FieldLabel>Min points to redeem</FieldLabel>
                <TextInput
                  type="number"
                  value={tier.min_redemption_points}
                  onChange={v => onUpdate({ min_redemption_points: Math.max(0, Number(v)) })}
                  min={0}
                />
              </div>
              <div>
                <FieldLabel>Min order value ({curr})</FieldLabel>
                <TextInput
                  type="number"
                  value={tier.min_order_value_to_redeem}
                  onChange={v => onUpdate({ min_order_value_to_redeem: Math.max(0, Number(v)) })}
                  min={0}
                />
              </div>
              <div>
                <FieldLabel hint="(redemption increments)">Step size (pts)</FieldLabel>
                <TextInput
                  type="number"
                  value={tier.redemption_step_size}
                  onChange={v => onUpdate({ redemption_step_size: Math.max(1, Number(v)) })}
                  min={1}
                />
              </div>
            </div>
          </div>

          {/* Perks */}
          <div>
            <SectionTitle>Tier perks</SectionTitle>
            <PerkEditor perks={tier.perks} onChange={p => onUpdate({ perks: p })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3 — Membership Tiers ─────────────────────────────────────────────────

function Step3({
  tiers,
  program,
  onUpdate,
  onAdd,
  onRemove,
}: {
  tiers: LoyaltyTier[];
  program: Omit<LoyaltyProgram, 'id' | 'client_id'>;
  onUpdate: (index: number, patch: Partial<LoyaltyTier>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Membership Tiers</h3>
          <p className="text-sm text-gray-500">Configure each tier's earn rate, qualification, and perks.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add tier
        </button>
      </div>

      <div className="space-y-3">
        {tiers
          .slice()
          .sort((a, b) => a.tier_level - b.tier_level)
          .map((tier, i) => {
            const originalIndex = tiers.indexOf(tier);
            return (
              <TierCard
                key={tier.id ?? `new-${tier.tier_level}`}
                tier={tier}
                index={i}
                program={program}
                allTiers={tiers}
                onUpdate={patch => onUpdate(originalIndex, patch)}
                onRemove={() => onRemove(originalIndex)}
                canRemove={!tier.is_default && tiers.length > 1}
              />
            );
          })}
      </div>
    </div>
  );
}

// ─── Step 4 — Redemption & Save ────────────────────────────────────────────────

function Step4({
  program,
  tiers,
  saving,
  onSave,
}: {
  program: Omit<LoyaltyProgram, 'id' | 'client_id'>;
  tiers: LoyaltyTier[];
  saving: boolean;
  onSave: () => void;
}) {
  const entryTier = tiers.find(t => t.is_default) ?? tiers[0];
  const { points_name, currency, base_earn_rate, base_earn_divisor } = program;
  const curr = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : 'د.إ';
  const sorted = [...tiers].sort((a, b) => a.tier_level - b.tier_level);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Redemption Review & Save</h3>
        <p className="text-sm text-gray-500">
          Review everything before saving. Entry tier settings serve as the global baseline.
        </p>
      </div>

      {/* Entry tier redemption summary */}
      {entryTier && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <p className="text-sm font-semibold text-blue-900 mb-3">
            Entry tier redemption rules
          </p>
          <ul className="space-y-1.5">
            {[
              `Cart value ≥ ${curr}${entryTier.min_order_value_to_redeem.toLocaleString()}`,
              `Member has ≥ ${entryTier.min_redemption_points} ${points_name}`,
              `Max ${entryTier.max_redemption_percent}% of order value`,
              entryTier.max_redemption_points
                ? `No more than ${entryTier.max_redemption_points} ${points_name} per order`
                : 'No hard cap on points per order',
              `Redemption step: ${entryTier.redemption_step_size} pt increments`,
            ].map(line => (
              <li key={line} className="text-sm text-blue-700 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tier earn rate table */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Tier earn rates</p>
        <div className="space-y-2">
          {sorted.map(t => {
            const rate = (base_earn_rate * t.earn_multiplier).toFixed(1);
            return (
              <div
                key={t.tier_name}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: t.color_code }}
                />
                <span className="flex-1 text-sm font-medium text-gray-900">
                  {t.tier_name || <span className="text-gray-400 italic font-normal">Untitled</span>}
                  {t.is_default && (
                    <span className="ml-1.5 text-xs text-gray-400 font-normal">(entry)</span>
                  )}
                </span>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 rounded px-2 py-0.5">
                  {t.earn_multiplier}×
                </span>
                <span className="text-xs text-gray-500 hidden sm:block">
                  {rate} {points_name || 'pts'} per {curr}{base_earn_divisor}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Program summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Program summary</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            ['Program name', program.program_name || '—'],
            ['Currency', program.currency],
            ['Points name', `${program.points_name} / ${program.points_name_singular}`],
            ['Welcome bonus', `${program.welcome_bonus_points} ${program.points_name}`],
            ['Points expiry', program.points_expiry_days ? `${program.points_expiry_days} days` : 'Never'],
            ['Redemption', program.allow_redemption ? 'Enabled' : 'Disabled'],
            ['Tiers', `${tiers.length} tier${tiers.length !== 1 ? 's' : ''}`],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-gray-500 w-32 shrink-0">{k}</dt>
              <dd className="text-gray-900 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save program
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Toast notification ──────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-none ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {type === 'success' ? <Check className="w-4 h-4" /> : <Info className="w-4 h-4" />}
      {message}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function LoyaltyProgramPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? '';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [programId, setProgramId] = useState<string | null>(null);
  const [program, setProgram] = useState<Omit<LoyaltyProgram, 'id' | 'client_id'>>(EMPTY_PROGRAM);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([makeDefaultTier(1, true)]);
  const [deletedTierIds, setDeletedTierIds] = useState<string[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, []);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) { setLoading(false); return; }

    (async () => {
      setLoading(true);
      try {
        const { data: prog } = await supabase
          .from('loyalty_programs')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();

        if (prog) {
          setProgramId(prog.id);
          setProgram({
            program_name: prog.program_name ?? '',
            points_name: prog.points_name ?? 'Points',
            points_name_singular: prog.points_name_singular ?? 'Point',
            is_active: prog.is_active ?? true,
            currency: prog.currency ?? 'INR',
            allow_redemption: prog.allow_redemption ?? true,
            points_expiry_days: prog.points_expiry_days ?? null,
            welcome_bonus_points: prog.welcome_bonus_points ?? 0,
            referral_reward_trigger: prog.referral_reward_trigger ?? 'first_order',
            base_earn_rate: prog.base_earn_rate ?? BASE_EARN_RATE_DEFAULT,
            base_earn_divisor: prog.base_earn_divisor ?? BASE_EARN_DIVISOR_DEFAULT,
            base_points_value: prog.base_points_value ?? 0.1,
          });

          const { data: tierRows } = await supabase
            .from('loyalty_tiers')
            .select('*')
            .eq('loyalty_program_id', prog.id)
            .order('tier_level');

          if (tierRows && tierRows.length > 0) {
            setTiers(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tierRows.map((t: any): LoyaltyTier => ({
                id: t.id,
                loyalty_program_id: t.loyalty_program_id,
                tier_name: t.tier_name ?? '',
                tier_level: t.tier_level ?? 1,
                is_default: t.is_default ?? false,
                color_code: t.color_code ?? '#3b82f6',
                qualification_mode: t.qualification_mode ?? 'any',
                min_lifetime_spend: t.min_lifetime_spend ?? 0,
                min_orders: t.min_orders ?? 0,
                min_lifetime_points: t.min_lifetime_points ?? 0,
                qualification_period: t.qualification_period ?? 'lifetime',
                tier_duration_days: t.tier_duration_days ?? null,
                earn_multiplier: t.earn_multiplier ?? 1,
                category_multipliers: t.category_multipliers ?? {},
                points_earn_rate: t.points_earn_rate ?? BASE_EARN_RATE_DEFAULT,
                points_earn_divisor: t.points_earn_divisor ?? BASE_EARN_DIVISOR_DEFAULT,
                points_value: t.points_value ?? 0.1,
                max_redemption_percent: t.max_redemption_percent ?? 100,
                max_redemption_points: t.max_redemption_points ?? null,
                min_redemption_points: t.min_redemption_points ?? 10,
                min_order_value_to_redeem: t.min_order_value_to_redeem ?? 500,
                redemption_step_size: t.redemption_step_size ?? 1,
                perks:
                  Array.isArray(t.perks) && t.perks.length > 0
                    ? DEFAULT_PERKS.map(dp => {
                        const saved = (t.perks as Perk[]).find(p => p.type === dp.type);
                        return saved ? { ...dp, ...saved } : dp;
                      })
                    : [...DEFAULT_PERKS],
                benefits_description: t.benefits_description ?? '',
                downgrade_policy: t.downgrade_policy ?? 'never',
                downgrade_grace_days: t.downgrade_grace_days ?? 30,
              }))
            );
          }
        }
      } catch (err) {
        console.error('Error loading loyalty program:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  // ── State handlers ───────────────────────────────────────────────────────────
  const updateProgram = useCallback(
    <K extends keyof Omit<LoyaltyProgram, 'id' | 'client_id'>>(
      k: K,
      v: Omit<LoyaltyProgram, 'id' | 'client_id'>[K]
    ) => {
      setProgram(p => ({ ...p, [k]: v }));
    },
    []
  );

  const updateTier = useCallback((index: number, patch: Partial<LoyaltyTier>) => {
    setTiers(ts => ts.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }, []);

  const addTier = useCallback(() => {
    setTiers(ts => {
      const maxLevel = Math.max(...ts.map(t => t.tier_level));
      return [...ts, makeDefaultTier(maxLevel + 1, false)];
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    setTiers(ts => {
      const tier = ts[index];
      if (tier.id) {
        setDeletedTierIds(ids => [...ids, tier.id!]);
      }
      return ts.filter((_, i) => i !== index);
    });
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      // 1. Upsert loyalty_programs
      const progPayload = programId
        ? { id: programId, client_id: clientId, ...program }
        : { client_id: clientId, ...program };

      const { data: savedProg, error: progErr } = await supabase
        .from('loyalty_programs')
        .upsert(progPayload, { onConflict: 'id' })
        .select('id')
        .single();

      if (progErr) throw progErr;
      const progId: string = savedProg.id;
      if (!programId) setProgramId(progId);

      // 2. Delete removed tiers
      if (deletedTierIds.length > 0) {
        const { error: delErr } = await supabase
          .from('loyalty_tiers')
          .delete()
          .in('id', deletedTierIds);
        if (delErr) throw delErr;
        setDeletedTierIds([]);
      }

      // 3. Upsert tiers
      const updatedTiers = [...tiers];
      for (let i = 0; i < updatedTiers.length; i++) {
        const tier = updatedTiers[i];
        const base = {
          loyalty_program_id: progId,
          tier_name: tier.tier_name,
          tier_level: tier.tier_level,
          is_default: tier.is_default,
          color_code: tier.color_code,
          qualification_mode: tier.qualification_mode,
          min_lifetime_spend: tier.min_lifetime_spend,
          min_orders: tier.min_orders,
          min_lifetime_points: tier.min_lifetime_points,
          qualification_period: tier.qualification_period,
          tier_duration_days: tier.tier_duration_days,
          earn_multiplier: tier.earn_multiplier,
          category_multipliers: tier.category_multipliers,
          points_earn_rate: tier.points_earn_rate,
          points_earn_divisor: tier.points_earn_divisor,
          points_value: tier.points_value,
          max_redemption_percent: tier.max_redemption_percent,
          max_redemption_points: tier.max_redemption_points,
          min_redemption_points: tier.min_redemption_points,
          min_order_value_to_redeem: tier.min_order_value_to_redeem,
          redemption_step_size: tier.redemption_step_size,
          perks: tier.perks,
          benefits_description: tier.benefits_description,
          downgrade_policy: tier.downgrade_policy,
          downgrade_grace_days: tier.downgrade_grace_days,
        };
        const payload = tier.id ? { id: tier.id, ...base } : base;
        const { data: savedTier, error: tierErr } = await supabase
          .from('loyalty_tiers')
          .upsert(payload, { onConflict: 'id' })
          .select('id')
          .single();

        if (tierErr) throw tierErr;

        if (!tier.id && savedTier?.id) {
          updatedTiers[i] = { ...tier, id: savedTier.id, loyalty_program_id: progId };
        }
      }
      setTiers(updatedTiers);

      showToast('Program saved successfully!', 'success');
    } catch (err: unknown) {
      console.error('Error saving loyalty program:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }, [clientId, programId, program, tiers, deletedTierIds, showToast]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Loyalty Program">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-500">Loading your loyalty program…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Loyalty Program">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Program Setup</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure your points program, tier structure, and redemption rules.
          </p>
        </div>

        <div className="flex gap-6 items-start">
          {/* Left step sidebar */}
          <nav className="hidden md:flex flex-col gap-1 w-52 shrink-0 sticky top-8">
            {STEPS.map(s => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : isDone
                      ? 'text-gray-600 hover:bg-gray-100'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isDone
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-normal leading-none mb-0.5">Step {s.id}</div>
                    <div className="leading-tight">{s.label}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Right content panel */}
          <div className="flex-1 min-w-0">
            {/* Mobile step chips */}
            <div className="flex md:hidden gap-1.5 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
              {STEPS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    step === s.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {s.id}. {s.label}
                </button>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              {step === 1 && <Step1 program={program} onChange={updateProgram} />}
              {step === 2 && <Step2 program={program} onChange={updateProgram} />}
              {step === 3 && (
                <Step3
                  tiers={tiers}
                  program={program}
                  onUpdate={updateTier}
                  onAdd={addTier}
                  onRemove={removeTier}
                />
              )}
              {step === 4 && (
                <Step4 program={program} tiers={tiers} saving={saving} onSave={handleSave} />
              )}
            </div>

            {/* Nav footer */}
            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Back
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep(s => Math.min(4, s + 1))}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save program'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </DashboardLayout>
  );
}
