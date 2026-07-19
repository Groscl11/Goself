import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { Offer, OfferDistribution, MarketplaceOffer } from '../../types/offers';
import {
  Badge, Btn, StatusBadge, CodePoolBadge,
  OfferCard, AddCard, EmptyState, SourceDot,
} from '../../components/offers/OfferCard';
import { ManageCodesDrawer, AdoptModal } from '../../components/offers/Drawers';
import { NewOfferDrawer } from '../../components/offers/NewOfferDrawer';
import { PartnerWizard } from '../../components/offers/PartnerWizard';
 
// ─── Tab ids ─────────────────────────────────────────────────────────────────
type TabId = 'store' | 'partner' | 'marketplace' | 'submissions' | 'distribution';

// ─── Widget catalog item ──────────────────────────────────────────────────────
interface WidgetItem {
  rewardId: string;
  rewardShortId: string;   // human-readable RWD-XXXXXXXX
  distId: string | null;
  title: string;
  subtitle: string;
  source: 'own' | 'partner' | 'marketplace';
  rewardStatus: string;
  couponType: string;
  availableCodes: number;
  validUntil: string | null;
  inWidget: boolean;
  pointsCost: number | null;
  maxPerMember: number | null;
  distAccessType: string | null;
  brandName: string | null;
  brandLogo: string | null;
  offerType: string;
  rewardType: string;
}
 
const TABS: { id: TabId; label: string }[] = [
  { id: 'store',        label: 'My Store Offers' },
  { id: 'partner',      label: 'Partner Vouchers' },
  { id: 'submissions',  label: 'My Marketplace Submissions' },
  { id: 'marketplace',  label: 'Brand Offers Marketplace' },
  { id: 'distribution', label: 'Widget Rewards' },
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
 
function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="h-10 bg-gray-50 border-b border-gray-200" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-100 last:border-0 animate-pulse">
          <div className="h-5 w-24 bg-gray-100 rounded" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-40 bg-gray-100 rounded" />
            <div className="h-3 w-24 bg-gray-50 rounded" />
          </div>
          <div className="h-5 w-16 bg-gray-100 rounded-full" />
          <div className="h-5 w-14 bg-gray-100 rounded-full" />
          <div className="h-7 w-20 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OffersPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = profile?.client_id ?? '';
  const brandId = profile?.brand_id ?? '';
  const [shopDomain, setShopDomain] = useState('');

  // Load shop_domain from store_installations (not stored on profile)
  useEffect(() => {
    if (!clientId) return;
    supabase
      .from('store_installations')
      .select('shop_domain')
      .eq('client_id', clientId)
      .eq('installation_status', 'active')
      .maybeSingle()
      .then(({ data }) => { if (data?.shop_domain) setShopDomain(data.shop_domain); });
  }, [clientId]);
 
  const activeTab = (searchParams.get('tab') as TabId) || 'store';
  const setTab = (t: TabId) => setSearchParams({ tab: t }, { replace: true });
 
  // Store offers state
  const [storeOffers, setStoreOffers] = useState<Offer[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeFilter, setStoreFilter] = useState('all');
  const [storeSearch, setStoreSearch] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [submissionsSearch, setSubmissionsSearch] = useState('');
 
  // Partner vouchers state
  const [partnerOffers, setPartnerOffers] = useState<Offer[]>([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerEditTarget, setPartnerEditTarget] = useState<{ offer: Offer; distribution: OfferDistribution | null } | null>(null);
 
  // Marketplace state
  const [mktOffers, setMktOffers] = useState<MarketplaceOffer[]>([]);
  const [mktLoading, setMktLoading] = useState(false);
  const [mktFilter, setMktFilter] = useState('All');
  const [mktSearch, setMktSearch] = useState('');
  const [mktBrand, setMktBrand] = useState('All');
  const [mktHideOutOfStock, setMktHideOutOfStock] = useState(true);
  const [mktPage, setMktPage] = useState(1);
  const MKT_PAGE_SIZE = 15;
  const [submissions, setSubmissions] = useState<Offer[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  // Map of offer_id → pending edit request id (for approved offers with an in-flight edit)
  const [pendingEditMap, setPendingEditMap] = useState<Record<string, string>>({});
 
  // Widget catalog state
  const [widgetItems, setWidgetItems] = useState<WidgetItem[]>([]);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetSearch, setWidgetSearch] = useState('');
  const [widgetFilter, setWidgetFilter] = useState<'all' | 'in_widget' | 'not_configured'>('all');
  const [widgetTypeFilter, setWidgetTypeFilter] = useState('');
  const [widgetBrandFilter, setWidgetBrandFilter] = useState('');
  const [widgetEdits, setWidgetEdits] = useState<Record<string, { points?: string; max?: string }>>({});
  const [widgetSaving, setWidgetSaving] = useState<Record<string, boolean>>({});
  const [widgetSaved, setWidgetSaved] = useState<Record<string, boolean>>({});
  const [widgetToggling, setWidgetToggling] = useState<Record<string, boolean>>({});
 
  // Drawer / modal state
  const [newOfferOpen, setNewOfferOpen] = useState(false);
  const [newOfferMode, setNewOfferMode] = useState<'store' | 'marketplace'>('store');
  const [editOffer, setEditOffer] = useState<Offer | null>(null);
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

    // Fetch offers with distributions + individual code rows for accurate counts
    const { data } = await supabase
      .from('rewards')
      .select('*, offer_distributions(id, distributing_client_id, points_cost, access_type, is_active, current_issuances, max_per_member, created_at, updated_at), offer_codes(status), owner_client:clients!owner_client_id(name, logo_url)')
      .eq('owner_client_id', clientId)
      .eq('offer_type', 'store_discount')
      .order('created_at', { ascending: false });

    const offers = data ?? [];

    // Separately fetch campaign usage counts for these offer IDs
    const offerIds = offers.map((o: any) => o.id as string);
    let campaignUsageMap: Record<string, number> = {};
    if (offerIds.length > 0) {
      const { data: poolData } = await supabase
        .from('campaign_reward_pools')
        .select('reward_id')
        .in('reward_id', offerIds);
      for (const p of poolData ?? []) {
        campaignUsageMap[p.reward_id] = (campaignUsageMap[p.reward_id] ?? 0) + 1;
      }
    }

    // Compute accurate codes counts from offer_codes rows (unique offers only)
    const normalized = offers.map((offer: any) => {
      const extras: any = { campaign_usage_count: campaignUsageMap[offer.id] ?? 0 };
      if (offer.coupon_type === 'unique') {
        const codes = (offer.offer_codes ?? []) as Array<{ status: string }>;
        extras.total_codes_uploaded = codes.length;
        extras.available_codes = codes.filter((c: any) => c.status === 'available').length;
      }
      return { ...offer, ...extras };
    });

    setStoreOffers(normalized);
    setStoreLoading(false);
  }, [clientId]);

  const fetchPartnerOffers = useCallback(async () => {
    if (!clientId) return;
    setPartnerLoading(true);
    const { data } = await supabase
      .from('rewards')
      .select('*, offer_distributions(id, distributing_client_id, points_cost, access_type, is_active, current_issuances, max_per_member, created_at, updated_at), offer_codes(status), owner_client:clients!owner_client_id(name, logo_url)')
      .eq('owner_client_id', clientId)
      .eq('offer_type', 'partner_voucher')
      .order('created_at', { ascending: false });
    const normalized = (data ?? []).map((offer: any) => {
      const codes = (offer.offer_codes ?? []) as Array<{ status: string }>;
      if (!codes.length) return offer;
      const total = codes.length;
      const available = codes.filter(c => c.status === 'available').length;
      return {
        ...offer,
        total_codes_uploaded: total,
        available_codes: available,
      };
    });
    setPartnerOffers(normalized);
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
 
      // Query marketplace offers, join owner client for brand name
      const { data, error } = await supabase
        .from('rewards')
        .select('*, owner_client:clients!owner_client_id(name, logo_url)')
        .eq('offer_type', 'marketplace_offer')
        .order('created_at', { ascending: false });
 
      if (error) throw error;
 
      // Secondary JS filter: belt-and-suspenders for null owner_client_id edge cases
      const filtered = (data ?? []).filter((o: any) => o.owner_client_id !== clientId);
 
      const enriched = filtered.map((o: any) => ({
        ...o,
        issuer_name: o.owner_client?.name ?? null,
        issuer_logo: o.owner_client?.logo_url ?? null,
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
    const [{ data, error }, { data: editReqs }] = await Promise.all([
      supabase
        .from('rewards')
        .select('*, offer_distributions(id, distributing_client_id, current_issuances), owner_client:clients!owner_client_id(name, logo_url), marketplace_status, marketplace_rejection_reason, marketplace_submitted_at')
        .eq('owner_client_id', clientId)
        .eq('offer_type', 'marketplace_offer')
        .order('created_at', { ascending: false }),
      supabase
        .from('rewards_edit_requests')
        .select('id, reward_id')
        .eq('requesting_client_id', clientId)
        .eq('status', 'pending'),
    ]);
    if (error) console.error('fetchSubmissions error:', error);
    setSubmissions(data ?? []);
    // Build a lookup: offer_id → pending edit request id
    const map: Record<string, string> = {};
    for (const req of editReqs ?? []) map[req.reward_id] = req.id;
    setPendingEditMap(map);
    setSubmissionsLoading(false);
  }, [clientId]);
 
  const fetchWidgetCatalog = useCallback(async () => {
    if (!clientId) return;
    setWidgetLoading(true);

    // 1. All distributions for this client (active + inactive) to detect adopted offers + widget status
    const { data: allDists } = await supabase
      .from('offer_distributions')
      .select('id, offer_id, points_cost, access_type, max_per_member, is_active')
      .eq('distributing_client_id', clientId);

    // Build map: offer_id → dist row (prefer active rows)
    const distMap = new Map<string, any>();
    for (const d of (allDists ?? [])) {
      const existing = distMap.get(d.offer_id);
      if (!existing || d.is_active) distMap.set(d.offer_id, d);
    }

    // 2. All own rewards (store + partner)
    const { data: ownRewards } = await supabase
      .from('rewards')
      .select('id, reward_id, title, reward_type, coupon_type, offer_type, available_codes, status, valid_until, image_url, owner_client_id')
      .eq('owner_client_id', clientId)
      .in('offer_type', ['store_discount', 'partner_voucher'])
      .order('created_at', { ascending: false });

    const ownIds = new Set((ownRewards ?? []).map((r: any) => r.id));

    // 3. External (adopted marketplace) rewards not owned by this client
    const adoptedIds = Array.from(distMap.keys()).filter(id => !ownIds.has(id));
    let externalRewards: any[] = [];
    if (adoptedIds.length > 0) {
      const { data } = await supabase
        .from('rewards')
        .select('id, reward_id, title, reward_type, coupon_type, offer_type, available_codes, status, valid_until, image_url, owner_client_id')
        .in('id', adoptedIds);
      externalRewards = data ?? [];
    }

    const allRewards = [...(ownRewards ?? []), ...externalRewards];

    // 4. Fetch brand info for all unique owner_client_ids
    const ownerIds = [...new Set(allRewards.map((r: any) => r.owner_client_id).filter(Boolean))];
    const brandMap = new Map<string, { name: string; logo_url: string | null }>();
    if (ownerIds.length > 0) {
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id, name, logo_url')
        .in('id', ownerIds);
      for (const c of (clientRows ?? [])) {
        brandMap.set(c.id, { name: c.name, logo_url: c.logo_url ?? null });
      }
    }

    const items: WidgetItem[] = allRewards.map((r: any) => {
      const dist = distMap.get(r.id);
      const inWidget = !!(dist?.is_active && ['points_redemption', 'both', 'free_claim'].includes(dist.access_type));
      const brand = brandMap.get(r.owner_client_id);
      return {
        rewardId: r.id,
        rewardShortId: r.reward_id ?? r.id.slice(0, 8),
        distId: dist?.id ?? null,
        title: r.title,
        subtitle: `${(r.reward_type ?? '').replace(/_/g, ' ')} · ${r.coupon_type ?? ''}`,
        source: r.offer_type === 'store_discount' ? 'own' : r.offer_type === 'partner_voucher' ? 'partner' : 'marketplace',
        rewardStatus: r.status ?? 'draft',
        couponType: r.coupon_type ?? '',
        availableCodes: r.available_codes ?? 0,
        validUntil: r.valid_until ?? null,
        inWidget,
        pointsCost: dist?.points_cost ?? null,
        maxPerMember: dist?.max_per_member ?? null,
        distAccessType: dist?.access_type ?? null,
        brandName: brand?.name ?? null,
        brandLogo: r.image_url ?? brand?.logo_url ?? null,
        offerType: r.offer_type ?? '',
        rewardType: r.reward_type ?? '',
      };
    });

    setWidgetItems(items);
    setWidgetLoading(false);
  }, [clientId]);
 
  // Load data per tab
  useEffect(() => {
    if (activeTab === 'store')        fetchStoreOffers();
    if (activeTab === 'partner')      fetchPartnerOffers();
    if (activeTab === 'marketplace')  fetchMarketplace();
    if (activeTab === 'submissions')  fetchSubmissions();
    if (activeTab === 'distribution') fetchWidgetCatalog();
  }, [activeTab, fetchStoreOffers, fetchPartnerOffers, fetchMarketplace, fetchSubmissions, fetchWidgetCatalog]);
 
  // ── Helpers ─────────────────────────────────────────────────────────────────
  function getDistForOffer(offer: Offer): OfferDistribution | null {
    const dists = offer.offer_distributions as OfferDistribution[] | undefined;
    if (!dists?.length) return null;
    const activeClientDists = dists
      .filter(d => d.distributing_client_id === clientId && d.is_active)
      .sort((left, right) => {
        const leftTs = new Date(left.updated_at ?? left.created_at).getTime();
        const rightTs = new Date(right.updated_at ?? right.created_at).getTime();
        return rightTs - leftTs;
      });

    return activeClientDists[0] ?? null;
  }
 
  const storeFiltered = storeOffers.filter(o => {
    if (storeFilter === 'active' && o.status !== 'active') return false;
    if (storeFilter === 'draft' && o.status !== 'draft') return false;
    if (storeFilter === 'low' && !(o.coupon_type === 'unique' && (o.available_codes ?? 0) < 10)) return false;
    if (storeSearch.trim()) {
      const q = storeSearch.trim().toLowerCase();
      if (!o.title.toLowerCase().includes(q) && !o.id.toLowerCase().includes(q) && !((o as any).reward_id ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const partnerFiltered = partnerOffers.filter(o => {
    if (!partnerSearch.trim()) return true;
    const q = partnerSearch.trim().toLowerCase();
    return o.title.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || ((o as any).reward_id ?? '').toLowerCase().includes(q);
  });

  const submissionsFiltered = submissions.filter(o => {
    if (!submissionsSearch.trim()) return true;
    const q = submissionsSearch.trim().toLowerCase();
    return o.title.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || ((o as any).reward_id ?? '').toLowerCase().includes(q);
  });
 
  const MKT_FILTERS = ['All', 'Fashion', 'Food & Drink', 'Lifestyle', 'Health', 'Electronics'];
 
  const FILTER_CATEGORY_MAP: Record<string, string[]> = {
    'Fashion':      ['fashion'],
    'Food & Drink': ['food', 'dining'],
    'Lifestyle':    ['wellness', 'general', 'subscription', 'travel'],
    'Health':       ['fitness', 'wellness'],
    'Electronics':  ['electronics'],
  };
 
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mktFiltered = mktOffers.filter(o => {
    // Only show admin-approved offers on browse tab (belt-and-suspenders: RLS handles DB side)
    if ((o as any).marketplace_status && (o as any).marketplace_status !== 'approved') return false;
    // Hide expired offers from browse list
    if (o.valid_until && new Date(o.valid_until) < today) return false;
    // Hide out-of-stock unique offers when toggle is on
    const isGenericReusable = o.coupon_type === 'generic' || Boolean(o.generic_coupon_code);
    if (mktHideOutOfStock && !isGenericReusable && (o.available_codes ?? 0) <= 0) return false;
    if (mktFilter !== 'All') {
      const allowed = FILTER_CATEGORY_MAP[mktFilter] ?? [];
      if (!allowed.includes((o.category ?? '').toLowerCase())) return false;
    }
    if (mktBrand !== 'All' && o.issuer_name !== mktBrand) return false;
    if (mktSearch.trim()) {
      const q = mktSearch.trim().toLowerCase();
      if (
        !o.title.toLowerCase().includes(q) &&
        !o.id.toLowerCase().includes(q) &&
        !(o.issuer_name ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });
  const mktBrands = ['All', ...Array.from(new Set(mktOffers.map(o => o.issuer_name).filter(Boolean) as string[]))];
  const mktTotalPages = Math.max(1, Math.ceil(mktFiltered.length / MKT_PAGE_SIZE));
  const mktPageOffers = mktFiltered.slice((mktPage - 1) * MKT_PAGE_SIZE, mktPage * MKT_PAGE_SIZE);
 
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
          .eq('id', existing.id)
          .eq('distributing_client_id', clientId);
        if (error) throw error;
      } else {
        // Fresh insert (off by default — client enables via Widget Rewards tab)
        const { error } = await supabase
          .from('offer_distributions')
          .insert({
            offer_id: adoptTarget.id,
            distributing_client_id: clientId,
            access_type: config.access_type,
            points_cost: config.access_type === 'campaign_reward' ? null : config.points_cost,
            max_per_member: config.max_per_member,
            is_active: false,
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
 
  // ── Widget toggle ─────────────────────────────────────────────────────────────
  async function toggleWidgetReward(item: WidgetItem) {
    setWidgetToggling(p => ({ ...p, [item.rewardId]: true }));
    try {
      if (item.inWidget) {
        // Remove from widget
        if (item.distId) {
          if (item.distAccessType === 'both') {
            // Keep dist but downgrade to campaign-only
            await supabase.from('offer_distributions')
              .update({ access_type: 'campaign_reward' })
              .eq('id', item.distId)
              .eq('distributing_client_id', clientId);
            setWidgetItems(prev => prev.map(i =>
              i.rewardId === item.rewardId ? { ...i, inWidget: false, distAccessType: 'campaign_reward' } : i
            ));
          } else {
            await supabase.from('offer_distributions')
              .update({ is_active: false })
              .eq('id', item.distId)
              .eq('distributing_client_id', clientId);
            setWidgetItems(prev => prev.map(i =>
              i.rewardId === item.rewardId ? { ...i, inWidget: false } : i
            ));
          }
        }
      } else {
        // Add to widget
        if (item.distId) {
          const newAccessType = item.distAccessType === 'campaign_reward' ? 'both' : 'points_redemption';
          await supabase.from('offer_distributions')
            .update({ is_active: true, access_type: newAccessType })
            .eq('id', item.distId)
            .eq('distributing_client_id', clientId);
          setWidgetItems(prev => prev.map(i =>
            i.rewardId === item.rewardId ? { ...i, inWidget: true, distAccessType: newAccessType } : i
          ));
        } else {
          const { data: newDist } = await supabase
            .from('offer_distributions')
            .insert({
              offer_id: item.rewardId,
              distributing_client_id: clientId,
              access_type: 'points_redemption',
              points_cost: null,
              is_active: true,
            })
            .select('id')
            .single();
          setWidgetItems(prev => prev.map(i =>
            i.rewardId === item.rewardId
              ? { ...i, inWidget: true, distId: newDist?.id ?? null, distAccessType: 'points_redemption' }
              : i
          ));
        }
      }
    } finally {
      setWidgetToggling(p => ({ ...p, [item.rewardId]: false }));
    }
  }

  async function saveWidgetConfig(item: WidgetItem) {
    const edit = widgetEdits[item.rewardId];
    if (!edit || !item.distId) return;
    setWidgetSaving(p => ({ ...p, [item.rewardId]: true }));
    const updatePayload: any = {};
    if (edit.points !== undefined) updatePayload.points_cost = edit.points === '' ? null : Number(edit.points);
    if (edit.max !== undefined) updatePayload.max_per_member = edit.max === '' ? null : Number(edit.max);
    await supabase.from('offer_distributions').update(updatePayload).eq('id', item.distId).eq('distributing_client_id', clientId);
    setWidgetItems(prev => prev.map(i =>
      i.rewardId === item.rewardId
        ? {
            ...i,
            pointsCost: edit.points !== undefined ? (edit.points === '' ? null : Number(edit.points)) : i.pointsCost,
            maxPerMember: edit.max !== undefined ? (edit.max === '' ? null : Number(edit.max)) : i.maxPerMember,
          }
        : i
    ));
    setWidgetEdits(p => { const n = { ...p }; delete n[item.rewardId]; return n; });
    setWidgetSaving(p => ({ ...p, [item.rewardId]: false }));
    setWidgetSaved(p => ({ ...p, [item.rewardId]: true }));
    setTimeout(() => setWidgetSaved(p => ({ ...p, [item.rewardId]: false })), 2000);
  }

  // ── Copy-to-clipboard state ───────────────────────────────────────────────────
  const [copiedId, setCopiedId] = useState<string | null>(null);
  function copyRewardId(id: string) {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(p => (p === id ? null : p)), 1500);
  }

  // ── Discount type label ───────────────────────────────────────────────────────
  function discountTypeLabel(rt: string): string {
    const map: Record<string, string> = {
      flat_discount: 'Flat', percentage_discount: '% Off',
      free_item: 'Free Item', upto_discount: 'Upto',
      fixed_value: 'Fixed', other: 'Other',
    };
    return map[rt] ?? rt;
  }

  // ── Brand logo cell ───────────────────────────────────────────────────────────
  function BrandCell({ offer }: { offer: Offer }) {
    const logoUrl = (offer as any).owner_client?.logo_url ?? (offer as any).image_url ?? null;
    const name = (offer as any).owner_client?.name ?? offer.title ?? '';
    const initials = name.split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';
    const [imgErr, setImgErr] = React.useState(false);
    if (logoUrl && !imgErr) {
      return <img src={logoUrl} alt={name} onError={() => setImgErr(true)}
        className="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0" />;
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-indigo-600 leading-none">{initials}</span>
      </div>
    );
  }
 
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
                <button onClick={() => { setNewOfferDropdown(false); setNewOfferMode('store'); setNewOfferOpen(true); }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                  <div className="font-medium">Store offer</div>
                  <div className="text-xs text-gray-400">Generate or import Shopify codes</div>
                </button>
                <button onClick={() => { setNewOfferDropdown(false); setNewOfferMode('marketplace'); setNewOfferOpen(true); }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                  <div className="font-medium">Marketplace offer</div>
                  <div className="text-xs text-gray-400">Submit an offer for other brands to adopt</div>
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
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search by title, reward ID..." value={storeSearch}
                  onChange={e => setStoreSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>
              <FilterRow
                filters={[
                  { id: 'all', label: 'All' }, { id: 'active', label: 'Active' },
                  { id: 'draft', label: 'Draft' }, { id: 'low', label: 'Low stock' },
                ]}
                active={storeFilter} onChange={setStoreFilter}
              />
            </div>

            {storeLoading ? <TableSkeleton /> : storeFiltered.length === 0 ? (
              <EmptyState
                title="No store offers yet"
                description="Create discount codes that your loyalty members can redeem with points or claim via campaigns."
                action={<Btn size="md" onClick={() => { setNewOfferMode('store'); setNewOfferOpen(true); }}>+ Create your first offer</Btn>}
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '860px' }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 w-10" />
                      {['Reward ID', 'Title', 'Discount Type', 'Codes', 'Usage', 'Valid Until', 'Status', ''].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {storeFiltered.map(offer => {
                      const dists = (offer.offer_distributions ?? []) as any[];
                      const inWidget = dists.some(d => d.is_active && ['points_redemption', 'both', 'free_claim'].includes(d.access_type));
                      const campaignCount = (offer as any).campaign_usage_count ?? 0;
                      const codesLabel = offer.coupon_type === 'generic'
                        ? 'Reusable / Generic' : `${(offer.available_codes ?? 0).toLocaleString('en-IN')} / ${(offer.total_codes_uploaded ?? 0).toLocaleString('en-IN')}`;
                      const isLowStock = offer.coupon_type === 'unique' && (offer.available_codes ?? 0) < 10;
                      const rewardId = (offer as any).reward_id || ('RWD-' + offer.id.slice(0, 8).toUpperCase());
                      return (
                        <tr key={offer.id} className="hover:bg-gray-50/60 transition-colors">
                          {/* Logo */}
                          <td className="pl-3 pr-1 py-3"><BrandCell offer={offer} /></td>
                          {/* Reward ID — click to copy */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <button onClick={() => copyRewardId(rewardId)} title="Click to copy"
                              className="font-mono text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors cursor-copy">
                              {copiedId === rewardId ? <span className="text-green-600 font-medium">✓ Copied</span> : rewardId}
                            </button>
                          </td>
                          {/* Title */}
                          <td className="px-3 py-3">
                            <p className="font-semibold text-gray-900 text-sm leading-snug">{offer.title}</p>
                          </td>
                          {/* Discount Type */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs text-gray-600">{discountTypeLabel(offer.reward_type)}</span>
                          </td>
                          {/* Codes */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`text-xs font-medium ${isLowStock ? 'text-red-500' : 'text-gray-700'}`}>{codesLabel}</span>
                          </td>
                          {/* Usage (widget + campaigns) */}
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-0.5">
                              {inWidget && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap">🔧 Widget</span>}
                              {campaignCount > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 border border-purple-100 whitespace-nowrap">🎯 {campaignCount} campaign{campaignCount > 1 ? 's' : ''}</span>}
                              {!inWidget && campaignCount === 0 && <span className="text-xs text-gray-300">—</span>}
                            </div>
                          </td>
                          {/* Valid Until */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs text-gray-500">
                              {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="px-3 py-3"><StatusBadge status={offer.status} /></td>
                          {/* Actions */}
                          <td className="px-3 py-3">
                            <MoreMenu
                              offer={offer} onRefresh={fetchStoreOffers} clientId={clientId} hideMarketplace
                              onEdit={() => { setEditOffer(offer); setNewOfferOpen(true); }}
                              onCodes={offer.coupon_type === 'unique' ? () => setCodesDrawer(offer) : undefined}
                              onCampaign={() => { window.location.href = `/client/campaigns?offer_id=${offer.id}`; }}
                            />
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
 
        {/* ── TAB 2: Partner Vouchers ───────────────────────────────────────── */}
        {activeTab === 'partner' && (
          <div>
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-amber-700">Partner voucher redemptions are tracked manually. Use "Update Redemptions" to upload a CSV of redeemed codes.</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search by partner name or reward ID..." value={partnerSearch}
                  onChange={e => setPartnerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>
              <Btn onClick={() => setPartnerWizardOpen(true)}>+ Add Partner Voucher</Btn>
            </div>

            {partnerLoading ? <TableSkeleton /> : partnerFiltered.length === 0 ? (
              <EmptyState
                title="No partner vouchers yet"
                description="Upload voucher codes from your offline brand partnerships for members to redeem."
                action={<Btn size="md" onClick={() => setPartnerWizardOpen(true)}>+ Add Partner Voucher</Btn>}
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '780px' }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 w-10" />
                      {['Reward ID', 'Title', 'Discount Type', 'Codes', 'Valid Until', 'Status', ''].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {partnerFiltered.map(offer => {
                      const dist = getDistForOffer(offer);
                      const codesLabel = offer.coupon_type === 'generic'
                        ? 'Reusable / Generic' : `${(offer.available_codes ?? 0).toLocaleString('en-IN')} / ${(offer.total_codes_uploaded ?? 0).toLocaleString('en-IN')}`;
                      const rewardId = (offer as any).reward_id || ('RWD-' + offer.id.slice(0, 8).toUpperCase());
                      return (
                        <tr key={offer.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="pl-3 pr-1 py-3"><BrandCell offer={offer} /></td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <button onClick={() => copyRewardId(rewardId)} title="Click to copy"
                              className="font-mono text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors cursor-copy">
                              {copiedId === rewardId ? <span className="text-green-600 font-medium">✓ Copied</span> : rewardId}
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-gray-900 text-sm leading-snug">{offer.title}</p>
                            {(offer.steps_to_redeem || offer.description) && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{offer.steps_to_redeem || offer.description}</p>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs text-gray-600">{discountTypeLabel(offer.reward_type)}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs font-medium text-gray-700">{codesLabel}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs text-gray-500">
                              {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3"><StatusBadge status={offer.status} /></td>
                          <td className="px-3 py-3">
                            <MoreMenu
                              offer={offer} onRefresh={fetchPartnerOffers} clientId={clientId} hideMarketplace hidePause
                              onEdit={() => setPartnerEditTarget({ offer, distribution: dist })}
                              onCodes={() => setCodesDrawer(offer)}
                              onCampaign={() => { window.location.href = `/client/campaigns?offer_id=${offer.id}`; }}
                            />
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
 
        {/* ── TAB 3: My Marketplace Submissions ────────────────────────────── */}
        {activeTab === 'submissions' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search by title or reward ID..." value={submissionsSearch}
                  onChange={e => setSubmissionsSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>
              <Btn size="md" onClick={() => { setNewOfferMode('marketplace'); setNewOfferOpen(true); }}>+ Submit an Offer</Btn>
            </div>

            {submissionsLoading ? <TableSkeleton /> : submissionsFiltered.length === 0 ? (
              <EmptyState
                title="No marketplace submissions yet"
                description="Submit an offer to make it available for other GoSelf clients to adopt for their members."
                action={<Btn size="md" onClick={() => { setNewOfferMode('marketplace'); setNewOfferOpen(true); }}>+ Submit first offer</Btn>}
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '820px' }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 w-10" />
                      {['Reward ID', 'Title', 'Submitted', 'Discount Type', 'Codes', 'Marketplace Status', ''].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {submissionsFiltered.map(offer => {
                      const hasPendingEdit = !!pendingEditMap[offer.id];
                      const submittedAt = (offer as any).marketplace_submitted_at;
                      const codesLabel = offer.coupon_type === 'generic'
                        ? 'Reusable / Generic' : `${(offer.available_codes ?? 0).toLocaleString('en-IN')} / ${(offer.total_codes_uploaded ?? 0).toLocaleString('en-IN')}`;
                      const rewardId = (offer as any).reward_id || ('RWD-' + offer.id.slice(0, 8).toUpperCase());
                      const editLabel = hasPendingEdit ? 'Update Edit Request'
                        : (offer as any).marketplace_status === 'approved' ? 'Request Edit' : 'Edit & Resubmit';
                      return (
                        <tr key={offer.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="pl-3 pr-1 py-3"><BrandCell offer={offer} /></td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <button onClick={() => copyRewardId(rewardId)} title="Click to copy"
                              className="font-mono text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors cursor-copy">
                              {copiedId === rewardId ? <span className="text-green-600 font-medium">✓ Copied</span> : rewardId}
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-gray-900 text-sm leading-snug">{offer.title}</p>
                            {offer.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{offer.description}</p>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs text-gray-500">
                              {submittedAt ? new Date(submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs text-gray-600">{discountTypeLabel(offer.reward_type)}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs font-medium text-gray-700">{codesLabel}</span>
                          </td>
                          <td className="px-3 py-3">
                            <MarketplaceStatusBadge offer={offer} hasPendingEdit={hasPendingEdit} />
                          </td>
                          <td className="px-3 py-3">
                            <MoreMenu
                              offer={offer} onRefresh={fetchSubmissions} clientId={clientId!} hidePause
                              onCodes={() => setCodesDrawer(offer)}
                              onEdit={() => { setEditOffer(offer); setNewOfferOpen(true); }}
                            />
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

        {/* ── TAB 4: Brand Offers Marketplace ──────────────────────────────── */}
        {activeTab === 'marketplace' && (
          <div>
            {(
              <div>
                {/* Search + Brand filter + Category chips */}
                <div className="flex flex-wrap gap-2 mb-3 items-center">
                  <input
                    type="text"
                    placeholder="Search by name, brand or reward ID…"
                    value={mktSearch}
                    onChange={e => { setMktSearch(e.target.value); setMktPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 w-64"
                  />
                  <select
                    value={mktBrand}
                    onChange={e => { setMktBrand(e.target.value); setMktPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
                  >
                    {mktBrands.map(b => <option key={b} value={b}>{b === 'All' ? 'All Brands' : b}</option>)}
                  </select>
                  {MKT_FILTERS.map(f => (
                    <button key={f} onClick={() => { setMktFilter(f); setMktPage(1); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                        ${mktFilter === f
                          ? 'bg-gray-900 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                      {f}
                    </button>
                  ))}
                  <label className="flex items-center gap-1.5 ml-auto cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mktHideOutOfStock}
                      onChange={e => { setMktHideOutOfStock(e.target.checked); setMktPage(1); }}
                      className="accent-gray-900 w-3.5 h-3.5"
                    />
                    <span className="text-xs text-gray-500">Hide out of stock</span>
                  </label>
                </div>

                {mktLoading ? (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-12 bg-white border border-gray-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : mktFiltered.length === 0 ? (
                  <EmptyState title="No marketplace offers available" description="Try adjusting your search or filters." />
                ) : (
                  <>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-sm" style={{ minWidth: '860px' }}>
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="px-4 py-3 text-left whitespace-nowrap">Reward ID</th>
                            <th className="px-4 py-3 text-left">Offer</th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">Brand</th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">Discount</th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">Type</th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">Codes</th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">Valid Until</th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">Points Cost</th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">Status</th>
                            <th className="px-4 py-3 text-left"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {mktPageOffers.map(offer => (
                            <MktRow key={offer.id} offer={offer} onAdopt={() => setAdoptTarget(offer)} />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {mktTotalPages > 1 && (
                      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                        <span>{mktFiltered.length} offers · page {mktPage} of {mktTotalPages}</span>
                        <div className="flex gap-1">
                          <button
                            disabled={mktPage === 1}
                            onClick={() => setMktPage(p => p - 1)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                          >← Prev</button>
                          <button
                            disabled={mktPage === mktTotalPages}
                            onClick={() => setMktPage(p => p + 1)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                          >Next →</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
 
        {/* ── TAB 5: Widget Rewards ─────────────────────────────────────────── */}
        {activeTab === 'distribution' && (
          <div>
            {/* Header bar: description + search + filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <p className="text-sm text-gray-500 flex-1 min-w-[200px]">
                Toggle any reward to show it in your loyalty widget. Set the points members need to redeem it.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search rewards…"
                    value={widgetSearch}
                    onChange={e => setWidgetSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 w-44"
                  />
                </div>

                {/* Reward type filter */}
                <select
                  value={widgetTypeFilter}
                  onChange={e => setWidgetTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-600 bg-white"
                >
                  <option value="">All Types</option>
                  {[...new Set(widgetItems.map(i => i.rewardType).filter(Boolean))].sort().map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>

                {/* Brand filter */}
                <select
                  value={widgetBrandFilter}
                  onChange={e => setWidgetBrandFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-600 bg-white"
                >
                  <option value="">All Brands</option>
                  {[...new Set(widgetItems.map(i => i.brandName).filter(Boolean))].sort().map(b => (
                    <option key={b!} value={b!}>{b}</option>
                  ))}
                </select>

                {/* Widget status pills */}
                {(['all', 'in_widget', 'not_configured'] as const).map(f => (
                  <button key={f} onClick={() => setWidgetFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap
                      ${widgetFilter === f
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                    {f === 'all' ? 'All' : f === 'in_widget' ? 'In Widget' : 'Not Configured'}
                  </button>
                ))}
              </div>
            </div>

            {widgetLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-white border border-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : widgetItems.length === 0 ? (
              <EmptyState
                title="No rewards available yet"
                description="Create a store offer or adopt a marketplace reward, then configure it for your widget here."
                action={
                  <div className="flex gap-2">
                    <Btn size="md" onClick={() => setTab('store')}>My Store Offers</Btn>
                    <Btn size="md" onClick={() => setTab('marketplace')}>Browse Marketplace</Btn>
                  </div>
                }
              />
            ) : (() => {
              const filtered = widgetItems
                .filter(item => {
                  if (widgetFilter === 'in_widget' && !item.inWidget) return false;
                  if (widgetFilter === 'not_configured' && item.inWidget) return false;
                  if (widgetTypeFilter && item.rewardType !== widgetTypeFilter) return false;
                  if (widgetBrandFilter && item.brandName !== widgetBrandFilter) return false;
                  if (widgetSearch.trim()) {
                    const q = widgetSearch.trim().toLowerCase();
                    if (!item.title.toLowerCase().includes(q) &&
                        !(item.rewardShortId ?? '').toLowerCase().includes(q) &&
                        !(item.brandName ?? '').toLowerCase().includes(q)) return false;
                  }
                  return true;
                })
                // In-widget first, then alphabetical by title
                .sort((a, b) => {
                  if (a.inWidget !== b.inWidget) return a.inWidget ? -1 : 1;
                  return a.title.localeCompare(b.title);
                });

              return (
                <>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Reward ID</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Brand</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Offer</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Offer Type</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Status</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">In Widget</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Points Cost</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Max / Member</th>
                          <th className="px-3 py-3 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                              No rewards match your filter.
                            </td>
                          </tr>
                        ) : filtered.map(item => {
                          const isEdited = !!widgetEdits[item.rewardId];
                          const isExpired = item.validUntil ? new Date(item.validUntil) < today : false;
                          const noCodesWarning = item.couponType === 'unique' && item.availableCodes === 0 && item.rewardStatus === 'active';

                          return (
                            <tr key={item.rewardId}
                              className={`border-b border-gray-50 transition-colors ${
                                item.inWidget ? 'bg-white hover:bg-gray-50/50' : 'bg-gray-50/40 hover:bg-gray-50/70'
                              }`}>
                              {/* Reward ID — FIRST */}
                              <td className="px-3 py-3">
                                <span className="font-mono text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 select-all whitespace-nowrap">
                                  {item.rewardShortId}
                                </span>
                              </td>

                              {/* Brand — SECOND */}
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {item.brandLogo ? (
                                    <img src={item.brandLogo} alt={item.brandName ?? ''}
                                      className="w-5 h-5 rounded object-cover flex-shrink-0 border border-gray-100" />
                                  ) : (
                                    <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                                      <span className="text-[8px] font-bold text-indigo-600">
                                        {(item.brandName ?? '?')[0]?.toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-xs text-gray-700 truncate max-w-[72px]" title={item.brandName ?? ''}>
                                    {item.brandName ?? '—'}
                                  </span>
                                </div>
                              </td>

                              {/* Offer name + meta — THIRD */}
                              <td className="px-3 py-3">
                                <div className="font-medium text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                                  {item.title}
                                  {isExpired && (
                                    <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                                      ⚠ Expired
                                    </span>
                                  )}
                                  {noCodesWarning && !isExpired && (
                                    <span className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                                      No codes
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5 capitalize">{item.subtitle}</div>
                              </td>

                              {/* Offer Type */}
                              <td className="px-3 py-3">
                                <span className="text-xs text-gray-600 capitalize whitespace-nowrap">
                                  {(item.offerType ?? '').replace(/_/g, ' ')}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="px-3 py-3">
                                <StatusBadge status={item.rewardStatus} />
                              </td>

                              {/* Toggle */}
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => toggleWidgetReward(item)}
                                    disabled={widgetToggling[item.rewardId]}
                                    title={item.inWidget ? 'Remove from widget' : 'Add to widget'}
                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-400 ${
                                      item.inWidget ? 'bg-gray-900' : 'bg-gray-200'
                                    } ${widgetToggling[item.rewardId] ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                  >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                                      item.inWidget ? 'translate-x-4' : 'translate-x-0.5'
                                    }`} />
                                  </button>
                                  {item.inWidget && (
                                    <span className="text-xs text-gray-500">On</span>
                                  )}
                                </div>
                              </td>

                              {/* Points cost */}
                              <td className="px-3 py-3">
                                {item.inWidget ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      value={widgetEdits[item.rewardId]?.points ?? (item.pointsCost ?? '')}
                                      placeholder="0"
                                      onChange={e => setWidgetEdits(p => ({
                                        ...p,
                                        [item.rewardId]: { ...p[item.rewardId], points: e.target.value },
                                      }))}
                                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20 text-center"
                                    />
                                    <span className="text-xs text-gray-400">pts</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </td>

                              {/* Max per member */}
                              <td className="px-3 py-3">
                                {item.inWidget ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={1}
                                      value={widgetEdits[item.rewardId]?.max ?? (item.maxPerMember ?? '')}
                                      placeholder="∞"
                                      onChange={e => setWidgetEdits(p => ({
                                        ...p,
                                        [item.rewardId]: { ...p[item.rewardId], max: e.target.value },
                                      }))}
                                      className="w-14 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/20 text-center"
                                    />
                                    <span className="text-xs text-gray-400">max</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </td>

                              {/* Save */}
                              <td className="px-3 py-3">
                                {isEdited && item.inWidget && (
                                  <button
                                    onClick={() => saveWidgetConfig(item)}
                                    disabled={widgetSaving[item.rewardId]}
                                    className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                                  >
                                    {widgetSaving[item.rewardId] ? '…' : 'Save'}
                                  </button>
                                )}
                                {widgetSaved[item.rewardId] && (
                                  <span className="text-xs text-green-600 font-medium">✓ Saved</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary footer */}
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>
                      {widgetItems.filter(i => i.inWidget).length} of {widgetItems.length} rewards active in widget
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setTab('store')}
                        className="text-gray-500 hover:text-gray-700 underline underline-offset-2">
                        + Create Store Reward
                      </button>
                      <span>·</span>
                      <button onClick={() => setTab('marketplace')}
                        className="text-gray-500 hover:text-gray-700 underline underline-offset-2">
                        Browse Marketplace ↗
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
        </div>
      </DashboardLayout>
 
      {/* ── Drawers & Modals ─────────────────────────────────────────────────── */}
      <NewOfferDrawer
        open={newOfferOpen}
        onClose={() => { setNewOfferOpen(false); setEditOffer(null); }}
        clientId={clientId}
        brandId={brandId}
        shopDomain={shopDomain}
        mode={newOfferMode}
        editOffer={editOffer}
        onCreated={() => {
          const isMarketplaceOffer =
            editOffer
              ? (editOffer as any).offer_type === 'marketplace_offer'
              : newOfferMode === 'marketplace';
          if (isMarketplaceOffer) {
            fetchSubmissions();
          } else {
            fetchStoreOffers();
            fetchWidgetCatalog();
          }
          setEditOffer(null);
        }}
      />
 
      <PartnerWizard
        open={partnerWizardOpen || !!partnerEditTarget}
        onClose={() => { setPartnerWizardOpen(false); setPartnerEditTarget(null); }}
        clientId={clientId}
        shopDomain={shopDomain}
        editTarget={partnerEditTarget}
        onCreated={() => { fetchPartnerOffers(); fetchWidgetCatalog(); }}
      />
 
      <ManageCodesDrawer
        open={!!codesDrawer}
        onClose={() => setCodesDrawer(null)}
        offer={codesDrawer}
        clientId={clientId}
        shopDomain={shopDomain}
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
 
// ─── Marketplace status badge ─────────────────────────────────────────────────
function MarketplaceStatusBadge({ offer, hasPendingEdit = false }: { offer: Offer; hasPendingEdit?: boolean }) {
  const status = (offer as any).marketplace_status as string | undefined;
  const reason = (offer as any).marketplace_rejection_reason as string | undefined;

  let mainBadge: React.ReactNode = null;
  if (!status || status === 'approved') {
    mainBadge = <span className="text-xs text-purple-600 font-medium">✓ Live on marketplace</span>;
  } else if (status === 'pending') {
    mainBadge = <span className="text-xs text-amber-600 font-medium">⏳ Pending admin review</span>;
  } else if (status === 'rejected') {
    mainBadge = (
      <span className="text-xs text-red-600 font-medium" title={reason ?? ''}>
        ✕ Rejected{reason ? `: ${reason.slice(0, 60)}${reason.length > 60 ? '…' : ''}` : ''}
      </span>
    );
  } else if (status === 'unlist_requested') {
    mainBadge = <span className="text-xs text-orange-600 font-medium">⏳ Unlist pending admin review</span>;
  } else if (status === 'unlisted') {
    mainBadge = <span className="text-xs text-gray-500 font-medium">✕ Unlisted from marketplace</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {mainBadge}
      {hasPendingEdit && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Edit pending review
        </span>
      )}
    </span>
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
 
// ─── Marketplace row ─────────────────────────────────────────────────────────
function MktRow({ offer, onAdopt }: { offer: MarketplaceOffer; onAdopt: () => void }) {
  const isGenericReusable = offer.coupon_type === 'generic' || Boolean(offer.generic_coupon_code);
  const outOfStock = !isGenericReusable && offer.coupon_type === 'unique' && (offer.available_codes ?? 0) <= 0;
  const discountLabel =
    offer.reward_type === 'flat_discount' ? `₹${offer.discount_value} off`
    : offer.reward_type === 'percentage_discount' ? `${offer.discount_value}% off`
    : offer.reward_type === 'free_item' ? 'Free item'
    : 'Other';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">{offer.reward_id || '—'}</span>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 leading-snug">{offer.title}</p>
        {offer.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{offer.description}</p>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{offer.issuer_name || '—'}</td>
      <td className="px-4 py-3">
        <Badge variant={
          offer.reward_type === 'percentage_discount' ? 'purple'
          : offer.reward_type === 'free_item' ? 'green'
          : 'blue'
        }>
          {discountLabel}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 capitalize">{offer.coupon_type}</td>
      <td className="px-4 py-3 text-xs text-gray-700">
        {isGenericReusable ? 'Unlimited' : outOfStock ? <span className="text-red-400">Out of stock</span> : offer.available_codes}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
        {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
      </td>
      <td className="px-4 py-3 text-xs">
        {offer.my_points_cost != null
          ? <span className="text-indigo-700 font-semibold">{offer.my_points_cost} pts</span>
          : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3">
        {offer.already_adopted && (
          <span className="text-xs font-medium text-green-700">✓ Added</span>
        )}
      </td>
      <td className="px-4 py-3">
        {!offer.already_adopted && (
          <button
            onClick={onAdopt}
            disabled={outOfStock}
            className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Add to My Store
          </button>
        )}
      </td>
    </tr>
  );
}
 
// ─── More menu (⋯) ────────────────────────────────────────────────────────────
function MoreMenu({ offer, onRefresh, clientId, hideMarketplace = false, hidePause = false, onEdit, onCodes, onCampaign }: {
  offer: Offer; onRefresh: () => void; clientId: string;
  hideMarketplace?: boolean; hidePause?: boolean;
  onEdit?: () => void; onCodes?: () => void; onCampaign?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const campaignCount = ((offer as any).campaign_usage_count as number) ?? 0;
 
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
 
  async function toggleMarketplace() {
    const ms = (offer as any).marketplace_status as string | undefined;
    const isLive = ms === 'approved';
    if (!isLive) {
      // Submit / re-submit path
      await supabase.from('rewards').update({
        offer_type: 'marketplace_offer',
        marketplace_status: 'pending',
        marketplace_submitted_at: new Date().toISOString(),
        status: 'draft',
      }).eq('id', offer.id).eq('owner_client_id', clientId);
    } else {
      // Request unlist — admin must approve before it goes offline
      await supabase.from('rewards').update({
        marketplace_status: 'unlist_requested',
      }).eq('id', offer.id).eq('owner_client_id', clientId);
    }
    setOpen(false);
    onRefresh();
  }


  function handlePauseClick() {
    setOpen(false);
    if (offer.status !== 'inactive' && campaignCount > 0) {
      setPauseConfirm(true);
    } else {
      doPause();
    }
  }

  async function doPause() {
    await supabase.from('rewards').update({
      status: offer.status === 'inactive' ? 'active' : 'inactive',
    }).eq('id', offer.id).eq('owner_client_id', clientId);
    setPauseConfirm(false);
    onRefresh();
  }

  return (
    <>
      <div className="relative ml-auto" ref={ref}>
        <Btn onClick={() => setOpen(v => !v)}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </Btn>
        {open && (
          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            {onEdit && (
              <button onClick={() => { setOpen(false); onEdit(); }}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                Edit Offer
              </button>
            )}
            {onCodes && (
              <button onClick={() => { setOpen(false); onCodes(); }}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                Manage Codes
              </button>
            )}
            {onCampaign && (
              <button onClick={() => { setOpen(false); onCampaign(); }}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                Use in Campaign
              </button>
            )}
            {!hideMarketplace && (() => {
              const ms = (offer as any).marketplace_status as string | undefined;
              if (ms === 'unlist_requested') {
                return (
                  <span className="block w-full text-left px-4 py-2.5 text-xs text-gray-400 border-b border-gray-100 cursor-default">
                    Unlist pending review
                  </span>
                );
              }
              const label = ms === 'approved' ? 'Request Unlist' : 'Submit to Marketplace';
              return (
                <button onClick={toggleMarketplace}
                  className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                  {label}
                </button>
              );
            })()}
            {!hidePause && (
              <button onClick={handlePauseClick}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50">
                {offer.status === 'inactive' ? 'Reactivate' : 'Pause offer'}
              </button>
            )}
          </div>
        )}
      </div>

      {pauseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Pause "{offer.title}"?</h3>
                <p className="text-xs text-gray-500 mt-1">
                  This offer is active in{' '}
                  <span className="font-semibold text-amber-700">{campaignCount} campaign{campaignCount !== 1 ? 's' : ''}</span>.
                  Pausing will stop members from earning it through those campaigns until you reactivate.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Btn variant="ghost" onClick={() => setPauseConfirm(false)}>Cancel</Btn>
              <Btn variant="danger" onClick={doPause}>Pause anyway</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}