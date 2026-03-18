import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { Offer, OfferDistribution, MarketplaceOffer, AccessType } from '../../types/offers';
import {
  Badge, Btn, StatusBadge, CodePoolBadge,
  OfferCard, AddCard, EmptyState, SourceDot,
} from '../../components/offers/OfferCard';
import { ManageCodesDrawer, AdoptModal } from '../../components/offers/Drawers';
import { NewOfferDrawer } from '../../components/offers/NewOfferDrawer';
import { PartnerWizard } from '../../components/offers/PartnerWizard';
 
// ─── Tab ids ─────────────────────────────────────────────────────────────────
type TabId = 'store' | 'partner' | 'marketplace' | 'distribution';
 
const TABS: { id: TabId; label: string }[] = [
  { id: 'store',        label: 'My Store Offers' },
  { id: 'partner',      label: 'Partner Vouchers' },
  { id: 'marketplace',  label: 'Marketplace' },
  { id: 'distribution', label: 'Distribution & Points' },
];
 
// ─── Skeleton loader ─────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
      <div className="flex gap-3 mb-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="h-6 bg-gray-100 rounded-full w-20" />
      </div>
      <div className="grid grid-cols-4 gap-3 py-3 border-t border-b border-gray-100 mb-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded" />)}
      </div>
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-7 bg-gray-100 rounded-lg w-24" />)}
      </div>
    </div>
  );
}
 
// ─── Main page ────────────────────────────────────────────────────────────────
export default function OffersPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = profile?.client_id ?? '';
  const shopDomain = (profile as any)?.shop_domain ?? '';
 
  const activeTab = (searchParams.get('tab') as TabId) || 'store';
  const setTab = (t: TabId) => setSearchParams({ tab: t }, { replace: true });
 
  // Store offers state
  const [storeOffers, setStoreOffers] = useState<Offer[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeFilter, setStoreFilter] = useState('all');
 
  // Partner vouchers state
  const [partnerOffers, setPartnerOffers] = useState<Offer[]>([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
 
  // Marketplace state
  const [mktOffers, setMktOffers] = useState<MarketplaceOffer[]>([]);
  const [mktLoading, setMktLoading] = useState(false);
  const [mktFilter, setMktFilter] = useState('All');
  const [mktSubtab, setMktSubtab] = useState<'browse' | 'submit'>('browse');
  const [submissions, setSubmissions] = useState<Offer[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
 
  // Distribution state
  const [distributions, setDistributions] = useState<OfferDistribution[]>([]);
  const [distLoading, setDistLoading] = useState(false);
  const [distEdits, setDistEdits] = useState<Record<string, string>>({});
  const [distSaving, setDistSaving] = useState<Record<string, boolean>>({});
  const [distSaved, setDistSaved] = useState<Record<string, boolean>>({});
 
  // Drawer / modal state
  const [newOfferOpen, setNewOfferOpen] = useState(false);
  const [partnerWizardOpen, setPartnerWizardOpen] = useState(false);
  const [codesDrawer, setCodesDrawer] = useState<Offer | null>(null);
  const [adoptTarget, setAdoptTarget] = useState<MarketplaceOffer | null>(null);
  const [adoptLoading, setAdoptLoading] = useState(false);
  const [adoptError, setAdoptError] = useState<string>('');
  const [newOfferDropdown, setNewOfferDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
 
  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setNewOfferDropdown(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
 
  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchStoreOffers = useCallback(async () => {
    if (!clientId) return;
    setStoreLoading(true);
    const { data } = await supabase
      .from('rewards')
      .select('*, offer_distributions(id, points_cost, access_type, is_active, current_issuances, max_per_member)')
      .eq('owner_client_id', clientId)
      .eq('offer_type', 'store_discount')
      .order('created_at', { ascending: false });
    setStoreOffers(data ?? []);
    setStoreLoading(false);
  }, [clientId]);
 
  const fetchPartnerOffers = useCallback(async () => {
    if (!clientId) return;
    setPartnerLoading(true);
    const { data } = await supabase
      .from('rewards')
      .select('*, offer_distributions(id, points_cost, access_type, is_active, current_issuances, max_per_member)')
      .eq('owner_client_id', clientId)
      .eq('offer_type', 'partner_voucher')
      .order('created_at', { ascending: false });
    setPartnerOffers(data ?? []);
    setPartnerLoading(false);
  }, [clientId]);
 
  // ── FIX 1: Direct Supabase query + excludes own submissions ───────────────
  const fetchMarketplace = useCallback(async () => {
    if (!clientId) return;
    setMktLoading(true);
    try {
      // Get which offers this client has already adopted (active distributions)
      const { data: adoptedDists } = await supabase
        .from('offer_distributions')
        .select('offer_id, points_cost')
        .eq('distributing_client_id', clientId)
        .eq('is_active', true);
 
      const adoptedMap = new Map(
        (adoptedDists ?? []).map(d => [d.offer_id, d.points_cost])
      );
 
      // Query marketplace offers. Keep owner filtering in JS so NULL owner_client_id rows remain visible.
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('offer_type', 'marketplace_offer')
        .eq('is_marketplace_listed', true)
        .eq('is_active', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
 
      if (error) throw error;
 
      // Secondary JS filter: belt-and-suspenders for null owner_client_id edge cases
      const filtered = (data ?? []).filter(o => o.owner_client_id !== clientId);
 
      const enriched = filtered.map(o => ({
        ...o,
        already_adopted: adoptedMap.has(o.id),
        my_points_cost: adoptedMap.get(o.id) ?? null,
      }));
 
      setMktOffers(enriched);
    } catch (err) {
      console.error('fetchMarketplace error:', err);
      setMktOffers([]);
    }
    setMktLoading(false);
  }, [clientId]);
 
  const fetchSubmissions = useCallback(async () => {
    if (!clientId) return;
    setSubmissionsLoading(true);
    const { data } = await supabase
      .from('rewards')
      .select('*, offer_distributions(id, distributing_client_id, current_issuances), offer_codes(status)')
      .eq('owner_client_id', clientId)
      .eq('is_marketplace_listed', true)
      .order('created_at', { ascending: false });
    setSubmissions(data ?? []);
    setSubmissionsLoading(false);
  }, [clientId]);
 
  const fetchDistributions = useCallback(async () => {
    if (!clientId) return;
    setDistLoading(true);
    const { data } = await supabase
      .from('offer_distributions')
      .select(`
        *,
        offer:rewards(
          id, title, reward_type, coupon_type, offer_type,
          available_codes, status, tracking_type, owner_client_id
        )
      `)
      .eq('distributing_client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setDistributions(data ?? []);
    setDistLoading(false);
  }, [clientId]);
 
  // Load data per tab
  useEffect(() => {
    if (activeTab === 'store')        fetchStoreOffers();
    if (activeTab === 'partner')      fetchPartnerOffers();
    if (activeTab === 'marketplace')  fetchMarketplace();
    if (activeTab === 'distribution') fetchDistributions();
  }, [activeTab, fetchStoreOffers, fetchPartnerOffers, fetchMarketplace, fetchDistributions]);
 
  useEffect(() => {
    if (mktSubtab === 'submit' && activeTab === 'marketplace') fetchSubmissions();
  }, [mktSubtab, activeTab, fetchSubmissions]);
 
  // ── Helpers ─────────────────────────────────────────────────────────────────
  function getDistForOffer(offer: Offer): OfferDistribution | null {
    const dists = offer.offer_distributions as OfferDistribution[] | undefined;
    return dists?.find(d => d.distributing_client_id === clientId && d.is_active) ?? null;
  }
 
  const storeFiltered = storeOffers.filter(o => {
    if (storeFilter === 'all') return true;
    if (storeFilter === 'active') return o.status === 'active';
    if (storeFilter === 'draft') return o.status === 'draft';
    if (storeFilter === 'low') return o.coupon_type === 'unique' && (o.available_codes ?? 0) < 10;
    return true;
  });
 
  const MKT_FILTERS = ['All', 'Fashion', 'Food & Drink', 'Lifestyle', 'Health', 'Electronics'];
 
  const FILTER_CATEGORY_MAP: Record<string, string[]> = {
    'Fashion':      ['fashion'],
    'Food & Drink': ['food', 'dining'],
    'Lifestyle':    ['wellness', 'general', 'subscription', 'travel'],
    'Health':       ['fitness', 'wellness'],
    'Electronics':  ['electronics'],
  };
 
  const mktFiltered = mktOffers.filter(o => {
    if (mktFilter === 'All') return true;
    const allowed = FILTER_CATEGORY_MAP[mktFilter] ?? [];
    return allowed.includes((o.category ?? '').toLowerCase());
  });
 
  // ── FIX 2: Adopt — direct Supabase insert, no broken edge function ─────────
  async function handleAdopt(config: { access_type: string; points_cost: number; max_per_member: number }) {
    if (!adoptTarget || !clientId) return;
    setAdoptLoading(true);
    setAdoptError('');
    try {
      // Check if a distribution already exists (even inactive) — upsert it
      const { data: existing } = await supabase
        .from('offer_distributions')
        .select('id')
        .eq('offer_id', adoptTarget.id)
        .eq('distributing_client_id', clientId)
        .maybeSingle();
 
      if (existing) {
        // Reactivate + update config
        const { error } = await supabase
          .from('offer_distributions')
          .update({
            is_active: true,
            access_type: config.access_type,
            points_cost: config.access_type === 'campaign_reward' ? null : config.points_cost,
            max_per_member: config.max_per_member,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Fresh insert
        const { error } = await supabase
          .from('offer_distributions')
          .insert({
            offer_id: adoptTarget.id,
            distributing_client_id: clientId,
            access_type: config.access_type,
            points_cost: config.access_type === 'campaign_reward' ? null : config.points_cost,
            max_per_member: config.max_per_member,
            is_active: true,
          });
        if (error) throw error;
      }
 
      // Optimistically update UI
      setMktOffers(prev => prev.map(o =>
        o.id === adoptTarget.id
          ? { ...o, already_adopted: true, my_points_cost: config.points_cost }
          : o
      ));
      setAdoptTarget(null);
    } catch (err: any) {
      console.error('Adopt error:', err);
      setAdoptError(err?.message || 'Could not add this offer to your store.');
    }
    setAdoptLoading(false);
  }
 
  // ── Distribution inline save ─────────────────────────────────────────────────
  async function saveDistPoints(distId: string) {
    const val = distEdits[distId];
    if (val === undefined) return;
    setDistSaving(p => ({ ...p, [distId]: true }));
    await supabase.from('offer_distributions').update({ points_cost: Number(val) }).eq('id', distId);
    setDistributions(prev => prev.map(d => d.id === distId ? { ...d, points_cost: Number(val) } : d));
    setDistEdits(p => { const n = { ...p }; delete n[distId]; return n; });
    setDistSaving(p => ({ ...p, [distId]: false }));
    setDistSaved(p => ({ ...p, [distId]: true }));
    setTimeout(() => setDistSaved(p => ({ ...p, [distId]: false })), 2000);
  }
 
  async function removeDistribution(distId: string) {
    if (!window.confirm('Remove this offer from your members?')) return;
    await supabase.from('offer_distributions').update({ is_active: false }).eq('id', distId);
    setDistributions(prev => prev.filter(d => d.id !== distId));
  }
 
  async function updateDistAccessType(distId: string, accessType: AccessType) {
    await supabase.from('offer_distributions').update({ access_type: accessType }).eq('id', distId);
    setDistributions(prev => prev.map(d => d.id === distId ? { ...d, access_type: accessType } : d));
  }
 
  // ── Source type helper ────────────────────────────────────────────────────────
  function sourceType(offer: Offer): 'own' | 'partner' | 'marketplace' {
    if (offer.offer_type === 'store_discount') return 'own';
    if (offer.offer_type === 'partner_voucher') return 'partner';
    return 'marketplace';
  }
 
  const accessBadgeVariant: Record<AccessType, { label: string; variant: 'purple' | 'blue' | 'gray' | 'teal' }> = {
    points_redemption: { label: 'Points',    variant: 'purple' },
    campaign_reward:   { label: 'Campaign',  variant: 'blue' },
    free_claim:        { label: 'Free',      variant: 'gray' },
    both:              { label: 'Both',      variant: 'teal' },
  };
 
  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <DashboardLayout menuItems={clientMenuItems} title="Offers & Rewards">
        <div className="max-w-5xl mx-auto px-4 py-2">
 
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Offers & Rewards</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage discount codes, partner vouchers, and marketplace offers for your members
            </p>
          </div>
 
          {/* "+ New Offer" dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setNewOfferDropdown(v => !v)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              + New Offer
              <svg className={`w-4 h-4 transition-transform ${newOfferDropdown ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {newOfferDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <button onClick={() => { setNewOfferDropdown(false); setNewOfferOpen(true); }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                  <div className="font-medium">Store offer</div>
                  <div className="text-xs text-gray-400">Generate or import Shopify codes</div>
                </button>
                <button onClick={() => { setNewOfferDropdown(false); setPartnerWizardOpen(true); }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                  <div className="font-medium">Partner voucher</div>
                  <div className="text-xs text-gray-400">Upload offline partner codes</div>
                </button>
              </div>
            )}
          </div>
        </div>
 
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                ${activeTab === t.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
 
        {/* ── TAB 1: My Store Offers ────────────────────────────────────────── */}
        {activeTab === 'store' && (
          <div>
            <FilterRow
              filters={[
                { id: 'all',    label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'draft',  label: 'Draft' },
                { id: 'low',    label: 'Low stock' },
              ]}
              active={storeFilter}
              onChange={setStoreFilter}
            />
            <div className="space-y-3">
              {storeLoading
                ? [...Array(2)].map((_, i) => <CardSkeleton key={i} />)
                : storeFiltered.length === 0
                  ? <EmptyState
                      title="No store offers yet"
                      description="Create discount codes that your loyalty members can redeem with points or claim via campaigns."
                      action={
                        <Btn size="md" onClick={() => setNewOfferOpen(true)}>
                          + Create your first offer
                        </Btn>
                      }
                    />
                  : storeFiltered.map(offer => {
                      const dist = getDistForOffer(offer);
                      return (
                        <OfferCard key={offer.id} offer={offer} distribution={dist}
                          actions={
                            <>
                              <Btn onClick={() => setTab('distribution')}>Edit Points</Btn>
                              <Btn onClick={() => setCodesDrawer(offer)}>Manage Codes</Btn>
                              <Btn onClick={() => window.location.href = `/client/campaigns/new?offer_id=${offer.id}`}>
                                Use in Campaign
                              </Btn>
                              <MoreMenu offer={offer} onRefresh={fetchStoreOffers} clientId={clientId} />
                            </>
                          }
                        />
                      );
                    })}
            </div>
            {!storeLoading && storeFiltered.length > 0 && (
              <AddCard label="Add another store offer">
                <Btn onClick={() => setNewOfferOpen(true)}>Generate via Shopify</Btn>
                <Btn onClick={() => setNewOfferOpen(true)}>Import from Shopify</Btn>
              </AddCard>
            )}
          </div>
        )}
 
        {/* ── TAB 2: Partner Vouchers ───────────────────────────────────────── */}
        {activeTab === 'partner' && (
          <div>
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-amber-700">
                Partner voucher redemptions are tracked manually. Use "Update Redemptions" to upload a CSV of redeemed codes.
              </span>
            </div>
            <div className="space-y-3">
              {partnerLoading
                ? [...Array(2)].map((_, i) => <CardSkeleton key={i} />)
                : partnerOffers.length === 0
                  ? <EmptyState
                      title="No partner vouchers yet"
                      description="Upload voucher codes from your offline brand partnerships for members to redeem."
                      action={<Btn size="md" onClick={() => setPartnerWizardOpen(true)}>+ Add Partner Voucher</Btn>}
                    />
                  : partnerOffers.map(offer => {
                      const dist = getDistForOffer(offer);
                      return (
                        <OfferCard key={offer.id} offer={offer} distribution={dist}
                          actions={
                            <>
                              <Btn onClick={() => setCodesDrawer(offer)}>Upload Codes</Btn>
                              <Btn variant="default" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                                Update Redemptions
                              </Btn>
                              <Btn onClick={() => setTab('distribution')}>Edit Points</Btn>
                              <Btn onClick={() => window.location.href = `/client/campaigns/new?offer_id=${offer.id}`}>
                                Use in Campaign
                              </Btn>
                            </>
                          }
                        />
                      );
                    })}
            </div>
            {!partnerLoading && (
              <div className="mt-4">
                <AddCard label="Add an offline partner voucher">
                  <Btn onClick={() => setPartnerWizardOpen(true)}>+ Add Partner Voucher</Btn>
                </AddCard>
              </div>
            )}
          </div>
        )}
 
        {/* ── TAB 3: Marketplace ────────────────────────────────────────────── */}
        {activeTab === 'marketplace' && (
          <div>
            {/* Sub-tabs */}
            <div className="flex gap-2 mb-5">
              {(['browse', 'submit'] as const).map(st => (
                <button key={st} onClick={() => setMktSubtab(st)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors
                    ${mktSubtab === st
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                  {st === 'browse' ? 'Browse & Adopt' : 'My Submissions'}
                </button>
              ))}
            </div>
 
            {/* Browse sub-tab */}
            {mktSubtab === 'browse' && (
              <div>
                {/* Filter chips */}
                <div className="flex gap-2 flex-wrap mb-4">
                  {MKT_FILTERS.map(f => (
                    <button key={f} onClick={() => setMktFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                        ${mktFilter === f
                          ? 'bg-gray-900 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                      {f}
                    </button>
                  ))}
                </div>
 
                {mktLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 h-40 animate-pulse">
                        <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
                        <div className="h-6 bg-gray-100 rounded-full w-20 mb-3" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : mktFiltered.length === 0 ? (
                  <EmptyState title="No marketplace offers available" description="Check back later for new offers from partner brands." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mktFiltered.map(offer => (
                      <MktCard key={offer.id} offer={offer} onAdopt={() => setAdoptTarget(offer)} />
                    ))}
                  </div>
                )}
              </div>
            )}
 
            {/* Submissions sub-tab */}
            {mktSubtab === 'submit' && (
              <div>
                <div className="flex justify-end mb-4">
                  <Btn size="md" onClick={() => setNewOfferOpen(true)}>+ Submit an Offer</Btn>
                </div>
                <div className="space-y-3">
                  {submissionsLoading
                    ? [...Array(2)].map((_, i) => <CardSkeleton key={i} />)
                    : submissions.length === 0
                      ? <EmptyState
                          title="No marketplace submissions yet"
                          description="Submit an offer to make it available for other GoSelf clients to adopt for their members."
                          action={<Btn size="md" onClick={() => setNewOfferOpen(true)}>+ Submit first offer</Btn>}
                        />
                      : submissions.map(offer => {
                          const allDists = (offer.offer_distributions as OfferDistribution[] | undefined) ?? [];
                          const adopterCount = new Set(allDists.map(d => d.distributing_client_id).filter(id => id !== clientId)).size;
                          const totalIssued = allDists.reduce((sum, d) => sum + (d.current_issuances ?? 0), 0);
                          const codes = (offer as any).offer_codes as { status: string }[] ?? [];
                          const redeemed = codes.filter(c => c.status === 'redeemed').length;
                          const rate = totalIssued > 0 ? Math.round(redeemed / totalIssued * 100) : 0;
                          return (
                            <div key={offer.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900">{offer.title}</h3>
                                  <p className="text-xs text-gray-500 mt-0.5">Listed on marketplace</p>
                                </div>
                                <StatusBadge status={offer.is_marketplace_listed ? 'active' : 'paused'} />
                              </div>
                              <div className="grid grid-cols-4 gap-3 py-3 border-t border-b border-gray-100 mb-3 text-center">
                                {[
                                  { label: 'Clients adopted', val: adopterCount },
                                  { label: 'Codes remaining', val: offer.available_codes ?? 0 },
                                  { label: 'Total issued',    val: totalIssued },
                                  { label: 'Redemption rate', val: `${rate}%` },
                                ].map(s => (
                                  <div key={s.label}>
                                    <div className="text-sm font-semibold text-gray-900">{s.val}</div>
                                    <div className="text-xs text-gray-500">{s.label}</div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Btn onClick={() => setCodesDrawer(offer)}>Manage Codes</Btn>
                                <Btn variant="danger" onClick={async () => {
                                  await supabase.from('rewards').update({ is_marketplace_listed: false }).eq('id', offer.id);
                                  fetchSubmissions();
                                }}>Unlist</Btn>
                              </div>
                            </div>
                          );
                        })}
                </div>
              </div>
            )}
          </div>
        )}
 
        {/* ── TAB 4: Distribution & Points ──────────────────────────────────── */}
        {activeTab === 'distribution' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              All offers currently available to your members. Edit points cost inline —
              each client sets their own rate independently.
            </p>
            {distLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-white border border-gray-200 rounded-lg animate-pulse" />)}
              </div>
            ) : distributions.length === 0 ? (
              <EmptyState
                title="No offers configured yet"
                description="Add offers from the other tabs to configure how members can redeem them."
                action={
                  <div className="flex gap-2">
                    <Btn size="md" onClick={() => setTab('store')}>My Store Offers</Btn>
                    <Btn size="md" onClick={() => setTab('marketplace')}>Browse Marketplace</Btn>
                  </div>
                }
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Offer', 'Source', 'Access type', 'Points cost', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distributions.map(dist => {
                      const offer = dist.offer as Offer | undefined;
                      if (!offer) return null;
                      const src = sourceType(offer);
                      const ab = accessBadgeVariant[dist.access_type];
                      const isEdited = distEdits[dist.id] !== undefined;
                      const isCampaignOnly = dist.access_type === 'campaign_reward';
                      return (
                        <tr key={dist.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 text-sm">{offer.title}</div>
                            <div className="text-xs text-gray-400 mt-0.5 capitalize">
                              {offer.reward_type?.replace('_', ' ')} · {offer.coupon_type}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <SourceDot type={src} />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={dist.access_type}
                              onChange={e => updateDistAccessType(dist.id, e.target.value as AccessType)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                            >
                              <option value="points_redemption">Points</option>
                              <option value="campaign_reward">Campaign only</option>
                              <option value="free_claim">Free claim</option>
                              <option value="both">Both</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {isCampaignOnly ? (
                              <span className="text-xs text-gray-400 italic">— free via campaign</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={isEdited ? distEdits[dist.id] : (dist.points_cost ?? '')}
                                  placeholder="Set pts"
                                  onChange={e => setDistEdits(p => ({ ...p, [dist.id]: e.target.value }))}
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20 text-center"
                                />
                                <span className="text-xs text-gray-400">pts</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {offer.status && <StatusBadge status={offer.status} />}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isEdited && (
                                <button
                                  onClick={() => saveDistPoints(dist.id)}
                                  disabled={distSaving[dist.id]}
                                  className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
                                >
                                  {distSaving[dist.id] ? '...' : 'Save'}
                                </button>
                              )}
                              {distSaved[dist.id] && (
                                <span className="text-xs text-green-600 font-medium">✓ Saved</span>
                              )}
                              <button
                                onClick={() => removeDistribution(dist.id)}
                                className="text-xs text-red-400 hover:text-red-600 transition-colors px-1"
                                title="Remove from members"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </div>
      </DashboardLayout>
 
      {/* ── Drawers & Modals ─────────────────────────────────────────────────── */}
      <NewOfferDrawer
        open={newOfferOpen}
        onClose={() => setNewOfferOpen(false)}
        clientId={clientId}
        shopDomain={shopDomain}
        onCreated={() => { fetchStoreOffers(); fetchDistributions(); }}
      />
 
      <PartnerWizard
        open={partnerWizardOpen}
        onClose={() => setPartnerWizardOpen(false)}
        clientId={clientId}
        onCreated={() => { fetchPartnerOffers(); fetchDistributions(); }}
      />
 
      <ManageCodesDrawer
        open={!!codesDrawer}
        onClose={() => setCodesDrawer(null)}
        offer={codesDrawer}
        clientId={clientId}
      />
 
      <AdoptModal
        open={!!adoptTarget}
        onClose={() => { setAdoptTarget(null); setAdoptError(''); }}
        offer={adoptTarget}
        onConfirm={handleAdopt}
        loading={adoptLoading}
        error={adoptError}
      />
    </>
  );
}
 
// ─── Filter row ───────────────────────────────────────────────────────────────
function FilterRow({ filters, active, onChange }: {
  filters: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {filters.map(f => (
        <button key={f.id} onClick={() => onChange(f.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
            ${active === f.id
              ? 'bg-gray-900 text-white'
              : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400'}`}>
          {f.label}
        </button>
      ))}
    </div>
  );
}
 
// ─── Marketplace card ─────────────────────────────────────────────────────────
function MktCard({ offer, onAdopt }: { offer: MarketplaceOffer; onAdopt: () => void }) {
  const isGenericReusable = offer.coupon_type === 'generic' || Boolean(offer.generic_coupon_code);
  const outOfStock = !isGenericReusable && offer.coupon_type === 'unique' && (offer.available_codes ?? 0) <= 0;
 
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
      {offer.issuer_name && (
        <p className="text-xs text-gray-400 mb-1">{offer.issuer_name}</p>
      )}
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{offer.title}</h3>
      <div className="flex gap-2 mb-3 flex-wrap">
        <Badge variant={
          offer.reward_type === 'percentage_discount' ? 'purple'
          : offer.reward_type === 'free_item' ? 'green'
          : 'blue'
        }>
          {offer.reward_type === 'flat_discount' ? `₹${offer.discount_value} off`
            : offer.reward_type === 'percentage_discount' ? `${offer.discount_value}% off`
            : offer.reward_type === 'free_item' ? 'Free item'
            : 'Other'}
        </Badge>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {isGenericReusable
          ? 'Unlimited (generic code)'
          : outOfStock
            ? 'Out of stock'
            : `${offer.available_codes} codes available`}
      </p>
 
      {offer.already_adopted ? (
        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Added · {offer.my_points_cost} pts
        </div>
      ) : (
        <button
          onClick={onAdopt}
          disabled={outOfStock}
          className="w-full py-2 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {outOfStock ? 'Out of stock' : 'Add to My Store'}
        </button>
      )}
    </div>
  );
}
 
// ─── More menu (⋯) ────────────────────────────────────────────────────────────
function MoreMenu({ offer, onRefresh, clientId }: { offer: Offer; onRefresh: () => void; clientId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
 
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
 
  async function toggleMarketplace() {
    await supabase.from('rewards').update({
      is_marketplace_listed: !offer.is_marketplace_listed,
    }).eq('id', offer.id);
    setOpen(false);
    onRefresh();
  }
 
  async function togglePause() {
    await supabase.from('rewards').update({
      status: offer.status === 'paused' ? 'active' : 'paused',
    }).eq('id', offer.id);
    setOpen(false);
    onRefresh();
  }
 
  return (
    <div className="relative ml-auto" ref={ref}>
      <Btn onClick={() => setOpen(v => !v)}>
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </Btn>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
          <button onClick={toggleMarketplace}
            className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100">
            {offer.is_marketplace_listed ? 'Unlist from Marketplace' : 'Submit to Marketplace'}
          </button>
          <button onClick={togglePause}
            className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50">
            {offer.status === 'paused' ? 'Reactivate' : 'Pause offer'}
          </button>
        </div>
      )}
    </div>
  );
}