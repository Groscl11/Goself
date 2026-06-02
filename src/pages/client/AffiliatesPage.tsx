import { useState, useEffect, useCallback } from 'react';
import {
  Link2, Users, BarChart3, Plus, X, ChevronLeft, Trash2, Edit2,
  Pause, Play, TrendingUp, ShoppingBag, Copy, ExternalLink, Search,
} from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerType = 'influencer' | 'creator' | 'brand' | 'other';
type PartnerStatus = 'active' | 'paused' | 'archived';
type CodeSource = 'shopify' | 'manual';
type CodeStatus = 'active' | 'paused' | 'removed';

interface Platform {
  id?: string;
  platform: string;
  handle: string;
  follower_count: number | null;
}

interface CodeAssignment {
  id: string;
  partner_id: string;
  client_id: string;
  code: string;
  reward_id: string | null;
  code_source: CodeSource;
  discount_description: string | null;
  status: CodeStatus;
  assigned_at: string;
}

interface Partner {
  id: string;
  client_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  partner_type: PartnerType;
  notes: string | null;
  status: PartnerStatus;
  created_at: string;
  updated_at: string;
  affiliate_partner_platforms: Platform[];
  affiliate_code_assignments: CodeAssignment[];
}

interface ShopifyOrder {
  shopify_order_id: string;
  customer_email: string;
  total_price: number;
  processed_at: string;
  order_data: {
    discount_codes?: { code: string; amount: string; type: string }[];
  } | null;
}

interface ShopifyPriceRule {
  id: number;
  title: string;
  reward_type: string;
  discount_value: string;
  ends_at: string | null;
  status: string;
  codes: string[];
  already_imported: boolean;
}

interface RedemptionStat {
  count: number;
  revenue: number;
  orders: ShopifyOrder[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-purple-500 to-indigo-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-red-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-lime-500 to-green-600',
];

function avatarGradient(name: string) {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

function initials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local[0] || ''}***@${domain}`;
}

function fmtCurrency(val: number) {
  return `₹${val.toLocaleString('en-IN')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_BADGE: Record<PartnerType, string> = {
  influencer: 'bg-pink-100 text-pink-700',
  creator: 'bg-orange-100 text-orange-700',
  brand: 'bg-blue-100 text-blue-700',
  other: 'bg-gray-100 text-gray-600',
};

const STATUS_BADGE: Record<PartnerStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  archived: 'bg-gray-100 text-gray-500',
};

const CODE_STATUS_BADGE: Record<CodeStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  removed: 'bg-red-100 text-red-600',
};

// ─── Redemption computation ───────────────────────────────────────────────────

function computeRedemptions(
  partners: Partner[],
  orders: ShopifyOrder[]
): Record<string, Record<string, RedemptionStat>> {
  // Map code (uppercase) -> { partnerId, assignmentId }
  const codeMap: Record<string, { partnerId: string; assignmentId: string }> = {};
  for (const p of partners) {
    for (const a of p.affiliate_code_assignments) {
      codeMap[a.code.toUpperCase()] = { partnerId: p.id, assignmentId: a.id };
    }
  }

  // result[partnerId][assignmentId] = { count, revenue, orders }
  const result: Record<string, Record<string, RedemptionStat>> = {};

  for (const order of orders) {
    const codes = order.order_data?.discount_codes ?? [];
    for (const dc of codes) {
      const mapping = codeMap[dc.code.toUpperCase()];
      if (!mapping) continue;
      const { partnerId, assignmentId } = mapping;
      if (!result[partnerId]) result[partnerId] = {};
      if (!result[partnerId][assignmentId]) result[partnerId][assignmentId] = { count: 0, revenue: 0, orders: [] };
      result[partnerId][assignmentId].count += 1;
      result[partnerId][assignmentId].revenue += Number(order.total_price) || 0;
      result[partnerId][assignmentId].orders.push(order);
    }
  }
  return result;
}

function partnerTotals(
  partner: Partner,
  redemptionMap: Record<string, Record<string, RedemptionStat>>
) {
  const byAssignment = redemptionMap[partner.id] ?? {};
  let count = 0;
  let revenue = 0;
  for (const stat of Object.values(byAssignment)) {
    count += stat.count;
    revenue += stat.revenue;
  }
  return { count, revenue };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string; icon: React.ElementType; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Platform row editor ──────────────────────────────────────────────────────

function PlatformRows({
  platforms,
  onChange,
}: {
  platforms: Platform[];
  onChange: (p: Platform[]) => void;
}) {
  function update(i: number, field: keyof Platform, val: string) {
    const next = [...platforms];
    if (field === 'follower_count') {
      next[i] = { ...next[i], follower_count: val === '' ? null : Number(val) };
    } else {
      next[i] = { ...next[i], [field]: val };
    }
    onChange(next);
  }
  function add() {
    onChange([...platforms, { platform: 'instagram', handle: '', follower_count: null }]);
  }
  function remove(i: number) {
    onChange(platforms.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {platforms.map((p, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select
            value={p.platform}
            onChange={e => update(i, 'platform', e.target.value)}
            className="border border-gray-300 rounded-lg text-sm px-2 py-1.5 bg-white"
          >
            {['instagram', 'youtube', 'tiktok', 'twitter', 'facebook', 'linkedin', 'other'].map(pl => (
              <option key={pl} value={pl}>{pl}</option>
            ))}
          </select>
          <input
            placeholder="@handle"
            value={p.handle}
            onChange={e => update(i, 'handle', e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg text-sm px-3 py-1.5"
          />
          <input
            placeholder="Followers"
            type="number"
            value={p.follower_count ?? ''}
            onChange={e => update(i, 'follower_count', e.target.value)}
            className="w-28 border border-gray-300 rounded-lg text-sm px-3 py-1.5"
          />
          <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-indigo-600 hover:underline">+ Add platform</button>
    </div>
  );
}

// ─── AddPartnerDrawer / EditPartnerDrawer ─────────────────────────────────────

interface PartnerDrawerProps {
  clientId: string;
  editPartner?: Partner | null;
  onClose: () => void;
  onSaved: () => void;
}

function PartnerDrawer({ clientId, editPartner, onClose, onSaved }: PartnerDrawerProps) {
  const isEdit = !!editPartner;
  const [name, setName] = useState(editPartner?.name ?? '');
  const [email, setEmail] = useState(editPartner?.email ?? '');
  const [phone, setPhone] = useState(editPartner?.phone ?? '');
  const [partnerType, setPartnerType] = useState<PartnerType>(editPartner?.partner_type ?? 'influencer');
  const [notes, setNotes] = useState(editPartner?.notes ?? '');
  const [platforms, setPlatforms] = useState<Platform[]>(editPartner?.affiliate_partner_platforms ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      let partnerId = editPartner?.id;
      if (isEdit && partnerId) {
        const { error: e } = await supabase
          .from('affiliate_partners')
          .update({ name: name.trim(), email: email || null, phone: phone || null, partner_type: partnerType, notes: notes || null, updated_at: new Date().toISOString() })
          .eq('id', partnerId);
        if (e) throw e;
        // re-insert platforms
        await supabase.from('affiliate_partner_platforms').delete().eq('partner_id', partnerId);
      } else {
        const { data, error: e } = await supabase
          .from('affiliate_partners')
          .insert({ client_id: clientId, name: name.trim(), email: email || null, phone: phone || null, partner_type: partnerType, notes: notes || null, status: 'active' })
          .select('id')
          .single();
        if (e) throw e;
        partnerId = data.id;
      }
      if (platforms.length > 0 && partnerId) {
        const rows = platforms.filter(p => p.handle.trim()).map(p => ({
          partner_id: partnerId!,
          platform: p.platform,
          handle: p.handle.trim(),
          follower_count: p.follower_count,
        }));
        if (rows.length > 0) await supabase.from('affiliate_partner_platforms').insert(rows);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save partner.');
    } finally {
      setSaving(false);
    }
  }

  const typeOptions: { value: PartnerType; label: string; desc: string }[] = [
    { value: 'influencer', label: 'Influencer', desc: 'Social media reach' },
    { value: 'creator', label: 'Creator', desc: 'Content creator' },
    { value: 'brand', label: 'Brand', desc: 'Brand partnership' },
    { value: 'other', label: 'Other', desc: 'Other type' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Edit Partner' : 'Add Partner'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Partner name"
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
                className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..."
                className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Partner Type</label>
            <div className="grid grid-cols-2 gap-2">
              {typeOptions.map(opt => (
                <button key={opt.value} onClick={() => setPartnerType(opt.value)}
                  className={`text-left border rounded-xl p-3 transition-all ${partnerType === opt.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Social Platforms</label>
            <PlatformRows platforms={platforms} onChange={setPlatforms} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Internal notes..."
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg py-2 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-gray-900 text-white text-sm rounded-lg py-2 hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Partner'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── AssignCodesModal ─────────────────────────────────────────────────────────

interface AssignCodesModalProps {
  clientId: string;
  partner: Partner;
  allPartners: Partner[];
  onClose: () => void;
  onSaved: () => void;
}

function AssignCodesModal({ clientId, partner, allPartners, onClose, onSaved }: AssignCodesModalProps) {
  const [tab, setTab] = useState<'shopify' | 'manual'>('shopify');
  const [priceRules, setPriceRules] = useState<ShopifyPriceRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [manualCode, setManualCode] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const assignedCodes = new Set(partner.affiliate_code_assignments.map(a => a.code.toUpperCase()));

  // Count how many partners use each code
  const codePartnerCount: Record<string, number> = {};
  for (const p of allPartners) {
    for (const a of p.affiliate_code_assignments) {
      const key = a.code.toUpperCase();
      codePartnerCount[key] = (codePartnerCount[key] ?? 0) + 1;
    }
  }

  useEffect(() => {
    if (tab !== 'shopify') return;
    setLoadingRules(true);
    fetch(`${supabaseUrl}/functions/v1/shopify-fetch-discounts?client_id=${clientId}`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    })
      .then(r => r.json())
      .then(json => setPriceRules(json.price_rules ?? []))
      .catch(() => setError('Failed to fetch Shopify discounts.'))
      .finally(() => setLoadingRules(false));
  }, [tab, clientId]);

  function toggleCode(code: string) {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  async function handleAssign() {
    setError('');
    setSaving(true);
    try {
      if (tab === 'shopify') {
        if (selectedCodes.size === 0) { setError('Select at least one code.'); setSaving(false); return; }
        const rows = Array.from(selectedCodes).map(code => ({
          partner_id: partner.id,
          client_id: clientId,
          code,
          code_source: 'shopify' as CodeSource,
          discount_description: null,
          status: 'active' as CodeStatus,
        }));
        const { error: e } = await supabase.from('affiliate_code_assignments').insert(rows);
        if (e) throw e;
      } else {
        if (!manualCode.trim()) { setError('Enter a code.'); setSaving(false); return; }
        const { error: e } = await supabase.from('affiliate_code_assignments').insert({
          partner_id: partner.id,
          client_id: clientId,
          code: manualCode.trim().toUpperCase(),
          code_source: 'manual' as CodeSource,
          discount_description: manualDesc || null,
          status: 'active' as CodeStatus,
        });
        if (e) throw e;
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign code.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Assign Codes — {partner.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex border-b border-gray-200 px-6">
          {(['shopify', 'manual'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'shopify' ? 'Import from Shopify' : 'Enter Manually'}
            </button>
          ))}
        </div>
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
          {tab === 'shopify' ? (
            loadingRules ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : priceRules.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No Shopify discounts found.</p>
            ) : (
              <div className="space-y-2">
                {priceRules.flatMap(rule =>
                  rule.codes.map(code => {
                    const upperCode = code.toUpperCase();
                    const alreadyAssigned = assignedCodes.has(upperCode);
                    const sharedCount = codePartnerCount[upperCode] ?? 0;
                    const isSelected = selectedCodes.has(upperCode);
                    return (
                      <label key={code}
                        className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${alreadyAssigned ? 'opacity-50 cursor-not-allowed bg-gray-50' : isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="checkbox" checked={isSelected} disabled={alreadyAssigned}
                          onChange={() => !alreadyAssigned && toggleCode(upperCode)}
                          className="rounded border-gray-300" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium text-gray-900">{code}</span>
                            {alreadyAssigned && <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">Already assigned</span>}
                            {sharedCount > 1 && !alreadyAssigned && <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Used by {sharedCount} partners</span>}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{rule.title} · {rule.discount_value}% off</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Discount Code *</label>
                <input value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                  placeholder="PARTNER20" className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Discount Description</label>
                <input value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                  placeholder="e.g. 20% off all orders" className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg py-2 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleAssign} disabled={saving}
            className="flex-1 bg-gray-900 text-white text-sm rounded-lg py-2 hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Assigning...' : 'Assign Code(s)'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics View ───────────────────────────────────────────────────────────

interface AnalyticsViewProps {
  partners: Partner[];
  orders: ShopifyOrder[];
  redemptionMap: Record<string, Record<string, RedemptionStat>>;
}

function AnalyticsView({ partners, orders, redemptionMap }: AnalyticsViewProps) {
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);
  const [partnerFilter, setPartnerFilter] = useState<string>('all');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dateRange);

  const prevCutoff = new Date(cutoff);
  prevCutoff.setDate(prevCutoff.getDate() - dateRange);

  // Build set of all assigned codes for current period
  const allCodes = new Set<string>();
  for (const p of partners) {
    for (const a of p.affiliate_code_assignments) allCodes.add(a.code.toUpperCase());
  }

  // code -> partnerId lookup
  const codeToPartner: Record<string, string> = {};
  for (const p of partners) {
    for (const a of p.affiliate_code_assignments) codeToPartner[a.code.toUpperCase()] = p.id;
  }

  const filteredOrders = orders.filter(o => {
    const d = new Date(o.processed_at);
    if (d < cutoff) return false;
    const codes = o.order_data?.discount_codes?.map(dc => dc.code.toUpperCase()) ?? [];
    const hit = codes.some(c => allCodes.has(c));
    if (!hit) return false;
    if (partnerFilter !== 'all') {
      return codes.some(c => codeToPartner[c] === partnerFilter);
    }
    return true;
  });

  const prevOrders = orders.filter(o => {
    const d = new Date(o.processed_at);
    if (d < prevCutoff || d >= cutoff) return false;
    const codes = o.order_data?.discount_codes?.map(dc => dc.code.toUpperCase()) ?? [];
    return codes.some(c => allCodes.has(c));
  });

  const totalRevenue = filteredOrders.reduce((s, o) => s + Number(o.total_price), 0);
  const uniqueCustomers = new Set(filteredOrders.map(o => o.customer_email)).size;
  const avgOrder = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

  // Top code
  const codeCount: Record<string, number> = {};
  for (const o of filteredOrders) {
    for (const dc of o.order_data?.discount_codes ?? []) {
      const k = dc.code.toUpperCase();
      if (allCodes.has(k)) codeCount[k] = (codeCount[k] ?? 0) + 1;
    }
  }
  const topCode = Object.entries(codeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  // Daily bars for the chart
  const days: { label: string; count: number }[] = [];
  for (let i = dateRange - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const count = filteredOrders.filter(o => {
      const od = new Date(o.processed_at);
      return od.toDateString() === d.toDateString();
    }).length;
    days.push({ label, count });
  }
  const maxBar = Math.max(...days.map(d => d.count), 1);

  // Code breakdown
  const codeBreakdown: { code: string; partnerId: string; redemptions: number; uniqueCustomers: number; revenue: number; prevRedemptions: number }[] = [];
  const codesSet = new Set<string>();
  for (const o of [...filteredOrders, ...prevOrders]) {
    for (const dc of o.order_data?.discount_codes ?? []) {
      if (allCodes.has(dc.code.toUpperCase())) codesSet.add(dc.code.toUpperCase());
    }
  }
  for (const code of codesSet) {
    const curr = filteredOrders.filter(o => o.order_data?.discount_codes?.some(dc => dc.code.toUpperCase() === code));
    const prev = prevOrders.filter(o => o.order_data?.discount_codes?.some(dc => dc.code.toUpperCase() === code));
    codeBreakdown.push({
      code,
      partnerId: codeToPartner[code] ?? '',
      redemptions: curr.length,
      uniqueCustomers: new Set(curr.map(o => o.customer_email)).size,
      revenue: curr.reduce((s, o) => s + Number(o.total_price), 0),
      prevRedemptions: prev.length,
    });
  }
  codeBreakdown.sort((a, b) => b.redemptions - a.redemptions);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {([7, 30, 90] as const).map(d => (
            <button key={d} onClick={() => setDateRange(d)}
              className={`px-4 py-1.5 text-sm transition-colors ${dateRange === d ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {d}d
            </button>
          ))}
        </div>
        <select value={partnerFilter} onChange={e => setPartnerFilter(e.target.value)}
          className="border border-gray-200 rounded-lg text-sm px-3 py-1.5 bg-white">
          <option value="all">All Partners</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Redemptions" value={String(filteredOrders.length)} icon={ShoppingBag} />
        <StatCard label="Unique Customers" value={String(uniqueCustomers)} icon={Users} />
        <StatCard label="Revenue Influenced" value={fmtCurrency(totalRevenue)} icon={TrendingUp} />
        <StatCard label="Avg Order Value" value={avgOrder > 0 ? fmtCurrency(avgOrder) : '—'} icon={BarChart3} />
        <StatCard label="Top Code" value={topCode} icon={Link2} />
      </div>

      {/* Bar chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Redemptions</h3>
        <div className="flex items-end gap-1 h-32">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full bg-gray-900 rounded-t transition-all"
                style={{ height: `${(d.count / maxBar) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                title={`${d.label}: ${d.count}`} />
            </div>
          ))}
        </div>
        {dateRange <= 30 && (
          <div className="flex items-center mt-1">
            {days.filter((_, i) => i % Math.ceil(days.length / 7) === 0).map((d, i) => (
              <div key={i} className="flex-1 text-center text-xs text-gray-400">{d.label}</div>
            ))}
          </div>
        )}
      </div>

      {/* Code breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Code Breakdown</h3>
        </div>
        {codeBreakdown.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No redemptions in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Code', 'Partner', 'Redemptions', 'Unique Customers', 'Revenue', 'AOV', 'Trend'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codeBreakdown.map(row => {
                const partner = partners.find(p => p.id === row.partnerId);
                const aov = row.redemptions > 0 ? row.revenue / row.redemptions : 0;
                const trend = row.redemptions > row.prevRedemptions ? '↑' : row.redemptions < row.prevRedemptions ? '↓' : '—';
                const trendColor = trend === '↑' ? 'text-green-600' : trend === '↓' ? 'text-red-500' : 'text-gray-400';
                return (
                  <tr key={row.code} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{row.code}</td>
                    <td className="px-4 py-3 text-gray-700">{partner?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{row.redemptions}</td>
                    <td className="px-4 py-3 text-gray-700">{row.uniqueCustomers}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtCurrency(row.revenue)}</td>
                    <td className="px-4 py-3 text-gray-700">{aov > 0 ? fmtCurrency(aov) : '—'}</td>
                    <td className={`px-4 py-3 font-semibold ${trendColor}`}>{trend}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Partner breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Partner Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Partner', 'Type', 'Codes', 'Redemptions', 'Revenue', 'Conv. Rate'].map(h => (
                <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {partners.map(p => {
              const pOrders = filteredOrders.filter(o =>
                o.order_data?.discount_codes?.some(dc =>
                  p.affiliate_code_assignments.some(a => a.code.toUpperCase() === dc.code.toUpperCase())
                )
              );
              const revenue = pOrders.reduce((s, o) => s + Number(o.total_price), 0);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarGradient(p.name)} flex items-center justify-center text-white text-xs font-semibold`}>
                        {initials(p.name)}
                      </div>
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${TYPE_BADGE[p.partner_type]}`}>{p.partner_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.affiliate_code_assignments.length}</td>
                  <td className="px-4 py-3 text-gray-700">{pOrders.length}</td>
                  <td className="px-4 py-3 text-gray-700">{fmtCurrency(revenue)}</td>
                  <td className="px-4 py-3 text-gray-500">—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AffiliatesPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? '';

  const [view, setView] = useState<'list' | 'detail' | 'analytics'>('list');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [detailTab, setDetailTab] = useState<'codes' | 'log'>('codes');
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [{ data: partnersData }, { data: ordersData }] = await Promise.all([
      supabase
        .from('affiliate_partners')
        .select('*, affiliate_partner_platforms(*), affiliate_code_assignments(*)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('shopify_orders')
        .select('shopify_order_id, customer_email, total_price, processed_at, order_data')
        .eq('client_id', clientId)
        .not('order_data', 'is', null),
    ]);
    setPartners((partnersData as Partner[]) ?? []);
    setOrders((ordersData as ShopifyOrder[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Keep selectedPartner in sync after reload
  useEffect(() => {
    if (selectedPartner) {
      const updated = partners.find(p => p.id === selectedPartner.id);
      if (updated) setSelectedPartner(updated);
    }
  }, [partners]);

  const redemptionMap = computeRedemptions(partners, orders);

  // Summary stats
  const totalActive = partners.filter(p => p.status === 'active').length;
  const totalCodes = partners.reduce((s, p) => s + p.affiliate_code_assignments.filter(a => a.status === 'active').length, 0);
  let totalRedemptions = 0;
  let totalRevenue = 0;
  for (const byAssignment of Object.values(redemptionMap)) {
    for (const stat of Object.values(byAssignment)) {
      totalRedemptions += stat.count;
      totalRevenue += stat.revenue;
    }
  }

  // Filter + search
  const displayed = partners.filter(p => {
    if (filter === 'active' && p.status !== 'active') return false;
    if (filter === 'paused' && p.status !== 'paused') return false;
    if (filter === 'influencer' && p.partner_type !== 'influencer') return false;
    if (filter === 'creator' && p.partner_type !== 'creator') return false;
    if (filter === 'brand' && p.partner_type !== 'brand') return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleRemoveCode(assignmentId: string) {
    const { error } = await supabase.from('affiliate_code_assignments').update({ status: 'removed' }).eq('id', assignmentId).eq('client_id', clientId);
    if (!error) loadData();
  }

  async function handleToggleCodeStatus(assignment: CodeAssignment) {
    const next = assignment.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('affiliate_code_assignments').update({ status: next }).eq('id', assignment.id).eq('client_id', clientId);
    if (!error) loadData();
  }

  async function handleTogglePartnerStatus(partner: Partner) {
    const next = partner.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('affiliate_partners').update({ status: next }).eq('id', partner.id).eq('client_id', clientId);
    if (!error) loadData();
  }

  // ── List View ──────────────────────────────────────────────────────────────
  function renderList() {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Affiliate Partners</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your affiliate and creator network</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView('analytics')}
              className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" /> Analytics
            </button>
            <button onClick={() => setShowAddDrawer(true)}
              className="bg-gray-900 text-white px-4 py-2 text-sm rounded-lg hover:bg-gray-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Partner
            </button>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Partners" value={String(partners.length)} icon={Users} sub={`${totalActive} active`} />
            <StatCard label="Active Codes" value={String(totalCodes)} icon={Link2} />
            <StatCard label="Total Redemptions" value={String(totalRedemptions)} icon={ShoppingBag} />
            <StatCard label="Revenue Influenced" value={fmtCurrency(totalRevenue)} icon={TrendingUp} />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 flex-wrap">
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'paused', label: 'Paused' },
              { key: 'influencer', label: 'Influencer' },
              { key: 'creator', label: 'Creator' },
              { key: 'brand', label: 'Brand' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filter === f.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search partners..."
              className="border border-gray-200 rounded-lg text-sm pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No partners found</p>
              <p className="text-xs text-gray-400 mt-1">Add your first affiliate partner to get started</p>
              <button onClick={() => setShowAddDrawer(true)}
                className="mt-4 bg-gray-900 text-white px-4 py-2 text-sm rounded-lg hover:bg-gray-800 inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Partner
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Partner', 'Type', 'Codes', 'Redemptions', 'Revenue', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map(p => {
                  const { count, revenue } = partnerTotals(p, redemptionMap);
                  const handle = p.affiliate_partner_platforms[0]?.handle;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(p.name)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                            {initials(p.name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{p.name}</p>
                            {handle && <p className="text-xs text-gray-400">{handle}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${TYPE_BADGE[p.partner_type]}`}>{p.partner_type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.affiliate_code_assignments.filter(a => a.status === 'active').length}</td>
                      <td className="px-4 py-3 text-gray-700">{count}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtCurrency(revenue)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setSelectedPartner(p); setView('detail'); setDetailTab('codes'); }}
                          className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ── Detail View ────────────────────────────────────────────────────────────
  function renderDetail() {
    const p = selectedPartner;
    if (!p) return null;
    const { count, revenue } = partnerTotals(p, redemptionMap);
    const avgOrder = count > 0 ? revenue / count : 0;

    // Redemption log orders for this partner
    const partnerCodes = new Set(p.affiliate_code_assignments.map(a => a.code.toUpperCase()));
    const partnerOrders = orders.filter(o =>
      o.order_data?.discount_codes?.some(dc => partnerCodes.has(dc.code.toUpperCase()))
    );

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <button onClick={() => { setView('list'); setSelectedPartner(null); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ChevronLeft className="w-4 h-4" /> Affiliates
        </button>

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGradient(p.name)} flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}>
              {initials(p.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-gray-900">{p.name}</h2>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${TYPE_BADGE[p.partner_type]}`}>{p.partner_type}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[p.status]}`}>{p.status}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {p.email && <span>{p.email}</span>}
                {p.phone && <span>{p.phone}</span>}
                <span>Added {fmtDate(p.created_at)}</span>
              </div>
              {p.affiliate_partner_platforms.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {p.affiliate_partner_platforms.map((pl, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                      {pl.platform}: {pl.handle}{pl.follower_count ? ` · ${pl.follower_count.toLocaleString('en-IN')} followers` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleTogglePartnerStatus(p)}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 text-xs rounded-lg hover:bg-gray-50 flex items-center gap-1">
                {p.status === 'active' ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Activate</>}
              </button>
              <button onClick={() => setEditPartner(p)}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 text-xs rounded-lg hover:bg-gray-50 flex items-center gap-1">
                <Edit2 className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => setShowAssignModal(true)}
                className="bg-gray-900 text-white px-3 py-1.5 text-xs rounded-lg hover:bg-gray-800 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Assign Code
              </button>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Codes Assigned" value={String(p.affiliate_code_assignments.length)} icon={Link2} />
          <StatCard label="Redemptions" value={String(count)} icon={ShoppingBag} />
          <StatCard label="Revenue" value={fmtCurrency(revenue)} icon={TrendingUp} />
          <StatCard label="Avg Order Value" value={avgOrder > 0 ? fmtCurrency(avgOrder) : '—'} icon={BarChart3} />
          <StatCard label="Conv. Rate" value="—" icon={BarChart3} sub="Phase 2: UTM tracking" />
        </div>

        {/* Tabs */}
        <div>
          <div className="flex border-b border-gray-200 mb-4">
            {([['codes', 'Assigned Codes'], ['log', 'Redemption Log']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setDetailTab(key)}
                className={`py-3 px-5 text-sm font-medium border-b-2 -mb-px transition-colors ${detailTab === key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {detailTab === 'codes' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {p.affiliate_code_assignments.length === 0 ? (
                <div className="text-center py-12">
                  <Link2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No codes assigned yet</p>
                  <button onClick={() => setShowAssignModal(true)}
                    className="mt-3 bg-gray-900 text-white px-4 py-2 text-sm rounded-lg hover:bg-gray-800 inline-flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Assign Code
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Code', 'Discount', 'Source', 'Redemptions', 'Revenue', 'Status', ''].map(h => (
                        <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {p.affiliate_code_assignments.map(a => {
                      const stat = redemptionMap[p.id]?.[a.id] ?? { count: 0, revenue: 0 };
                      return (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium text-gray-900">{a.code}</span>
                              <button onClick={() => navigator.clipboard.writeText(a.code)} className="text-gray-400 hover:text-gray-600">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{a.discount_description ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${a.code_source === 'shopify' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {a.code_source}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{stat.count}</td>
                          <td className="px-4 py-3 text-gray-700">{fmtCurrency(stat.revenue)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${CODE_STATUS_BADGE[a.status]}`}>{a.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleToggleCodeStatus(a)}
                                className="p-1 text-gray-400 hover:text-amber-600" title={a.status === 'active' ? 'Pause' : 'Activate'}>
                                {a.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => handleRemoveCode(a.id)}
                                className="p-1 text-gray-400 hover:text-red-500" title="Remove">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {detailTab === 'log' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {partnerOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No redemptions recorded yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Order ID', 'Code Used', 'Customer', 'Order Value', 'Discount', 'Date'].map(h => (
                        <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {partnerOrders.slice().sort((a, b) => new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime()).map(o => {
                      const usedCodes = o.order_data?.discount_codes?.filter(dc => partnerCodes.has(dc.code.toUpperCase())) ?? [];
                      const discountAmt = usedCodes.reduce((s, dc) => s + Number(dc.amount), 0);
                      return (
                        <tr key={o.shopify_order_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">#{o.shopify_order_id}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {usedCodes.map((dc, i) => (
                                <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">{dc.code}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{maskEmail(o.customer_email)}</td>
                          <td className="px-4 py-3 text-gray-700">{fmtCurrency(Number(o.total_price))}</td>
                          <td className="px-4 py-3 text-gray-700">{discountAmt > 0 ? fmtCurrency(discountAmt) : '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(o.processed_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">UTM link tracking coming in Phase 2</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout menuItems={clientMenuItems} title="Affiliates">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {view === 'list' && renderList()}
        {view === 'detail' && renderDetail()}
        {view === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Affiliate Analytics</h1>
                <p className="text-sm text-gray-500 mt-0.5">Performance insights across your affiliate network</p>
              </div>
              <button onClick={() => setView('list')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
                <ChevronLeft className="w-4 h-4" /> Back to Partners
              </button>
            </div>
            <AnalyticsView partners={partners} orders={orders} redemptionMap={redemptionMap} />
          </div>
        )}
      </div>

      {showAddDrawer && (
        <PartnerDrawer clientId={clientId} onClose={() => setShowAddDrawer(false)} onSaved={loadData} />
      )}
      {editPartner && (
        <PartnerDrawer clientId={clientId} editPartner={editPartner} onClose={() => setEditPartner(null)} onSaved={loadData} />
      )}
      {showAssignModal && selectedPartner && (
        <AssignCodesModal
          clientId={clientId}
          partner={selectedPartner}
          allPartners={partners}
          onClose={() => setShowAssignModal(false)}
          onSaved={loadData}
        />
      )}
    </DashboardLayout>
  );
}
