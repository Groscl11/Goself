import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Drawer } from './Drawers';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { uploadOfferCodesDirect } from '../../lib/offerCodes';
import { CodeSource, RewardType } from '../../types/offers';

const SHOPIFY_CLIENT_ID = import.meta.env.VITE_SHOPIFY_API_KEY || '3290e6e4e5cb6711e4a7876ef40f87e8';
const SHOPIFY_OAUTH_SCOPES = 'read_customers,read_orders,read_discounts,write_discounts,read_price_rules,write_price_rules';

function buildShopifyReconnectUrl(shopDomain: string, clientId: string): string {
  const callbackUrl = `${supabaseUrl}/functions/v1/shopify-oauth-callback`;
  const state = btoa(JSON.stringify({ app_url: window.location.origin, client_id: clientId, ts: Date.now() }));
  const params = new URLSearchParams({
    client_id:    SHOPIFY_CLIENT_ID,
    scope:        SHOPIFY_OAUTH_SCOPES,
    redirect_uri: callbackUrl,
    state,
    // Deliberately NO grant_options[]=per-user → Shopify issues offline shpat_ token
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params}`;
}

type Flow = 'shopify_generated' | 'shopify_imported' | 'generic';

interface ShopifyPriceRule {
  id: number;
  title: string;
  reward_type: RewardType;
  discount_value: number;
  min_purchase_amount: number;
  ends_at: string | null;
  codes: string[];
  total_codes: number;
  already_imported: boolean;
}

interface NewOfferDrawerProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  brandId?: string;
  shopDomain: string;
  onCreated: () => void;
  mode?: 'store' | 'marketplace';
}

const REWARD_TYPES: { value: RewardType; label: string }[] = [
  { value: 'flat_discount',        label: 'Flat discount (₹ off)' },
  { value: 'percentage_discount',  label: 'Percentage discount (% off)' },
  { value: 'free_item',            label: 'Free item' },
];

export const OFFER_CATEGORIES: { value: string; label: string }[] = [
  { value: 'food_dining',        label: 'Food & Dining' },
  { value: 'fashion_apparel',    label: 'Fashion & Apparel' },
  { value: 'health_wellness',    label: 'Health & Wellness' },
  { value: 'travel_hospitality', label: 'Travel & Hospitality' },
  { value: 'entertainment',      label: 'Entertainment' },
  { value: 'electronics',        label: 'Electronics' },
  { value: 'beauty_grooming',    label: 'Beauty & Grooming' },
  { value: 'home_living',        label: 'Home & Living' },
  { value: 'education',          label: 'Education' },
  { value: 'grocery',            label: 'Grocery' },
  { value: 'automotive',         label: 'Automotive' },
  { value: 'sports_fitness',     label: 'Sports & Fitness' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'other',              label: 'Other' },
];

export function NewOfferDrawer({ open, onClose, clientId, brandId, shopDomain, onCreated, mode = 'store', editOffer }: NewOfferDrawerProps & { editOffer?: import('../../types/offers').Offer | null }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);

  // Shopify import picker state
  const [shopifyRules, setShopifyRules] = useState<ShopifyPriceRule[]>([]);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyError, setShopifyError] = useState('');
  const [shopifyTokenExpired, setShopifyTokenExpired] = useState(false);
  const [shopifyReconnectUrl, setShopifyReconnectUrl] = useState('');
  const [shopifySearch, setShopifySearch] = useState('');
  const [shopifyPicked, setShopifyPicked] = useState(false);
  const [shopifyFetched, setShopifyFetched] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    image_url: '',
    offer_category: 'other',
    offer_priority: '0',
    starts_at: '',
    reward_type: 'flat_discount' as RewardType,
    discount_value: '',
    max_cap: '',
    min_purchase_amount: '',
    coupon_type: 'unique',
    generic_coupon_code: '',
    codes_count: '10',
    code_paste: '',
    valid_until: '',
    redemption_link: '',
    terms_conditions: '',
    steps_to_redeem: '',
    // Shopify generate advanced options
    shopify_prefix: '',
    shopify_usage_limit: '1',
    shopify_applies_to: 'all' as 'all' | 'specific_collections' | 'specific_products',
  });

  // Shopify create-discount state
  const [shopifyCreating, setShopifyCreating] = useState(false);

  // Client logo — fetched once, used as default image_url fallback
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!clientId) return;
    supabase.from('clients').select('logo_url').eq('id', clientId).maybeSingle()
      .then(({ data }) => setClientLogoUrl(data?.logo_url ?? null));
  }, [clientId]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Pre-populate form when editing an existing offer
  useEffect(() => {
    if (editOffer && open) {
      const isGeneric = editOffer.coupon_type === 'generic';
      setFlow(isGeneric ? 'generic' : 'shopify_imported');
      setForm({
        title: editOffer.title ?? '',
        description: editOffer.description ?? '',
        image_url: editOffer.image_url ?? '',
        offer_category: (editOffer as any).offer_category ?? 'other',
        offer_priority: String((editOffer as any).offer_priority ?? 0),
        starts_at: (editOffer as any).starts_at ? String((editOffer as any).starts_at).slice(0, 10) : '',
        reward_type: editOffer.reward_type as RewardType,
        discount_value: editOffer.discount_value != null ? String(editOffer.discount_value) : '',
        max_cap: editOffer.max_discount_value != null ? String(editOffer.max_discount_value) : '',
        min_purchase_amount: editOffer.min_purchase_amount != null ? String(editOffer.min_purchase_amount) : '',
        coupon_type: editOffer.coupon_type,
        generic_coupon_code: editOffer.generic_coupon_code ?? '',
        codes_count: '10',
        code_paste: '',
        valid_until: editOffer.valid_until ? editOffer.valid_until.slice(0, 10) : '',
        redemption_link: editOffer.redemption_link ?? '',
        terms_conditions: editOffer.terms_conditions ?? '',
        steps_to_redeem: editOffer.steps_to_redeem ?? '',
        shopify_prefix: '', shopify_usage_limit: '1', shopify_applies_to: 'all',
      });
    } else if (!open) {
      resetState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOffer, open]);

  function resetState() {
    setFlow(null); setLoading(false); setError(''); setSuccess('');
    setParsedCodes([]);
    setShopifyRules([]); setShopifyLoading(false); setShopifyError('');
    setShopifyTokenExpired(false); setShopifyReconnectUrl('');
    setShopifySearch(''); setShopifyPicked(false); setShopifyFetched(false);
    setShopifyCreating(false);
    setForm({
      title: '', description: '', image_url: '', offer_category: 'other', offer_priority: '0',
      starts_at: '', reward_type: 'flat_discount', discount_value: '',
      max_cap: '', min_purchase_amount: '', coupon_type: 'unique', generic_coupon_code: '',
      codes_count: '10', code_paste: '', valid_until: '',
      redemption_link: '', terms_conditions: '', steps_to_redeem: '',
      shopify_prefix: '', shopify_usage_limit: '1', shopify_applies_to: 'all',
    });
  }

  // Fetch Shopify price rules when Import flow is selected
  const fetchShopifyDiscounts = useCallback(async () => {
    if (!shopDomain && !clientId) {
      setShopifyError('No Shopify store domain found for your account. Please complete store setup first.');
      return;
    }
    setShopifyLoading(true);
    setShopifyError('');
    setShopifyTokenExpired(false);
    setShopifyReconnectUrl('');
    try {
      const params = new URLSearchParams();
      if (shopDomain) params.set('shop_domain', shopDomain);
      if (clientId) params.set('client_id', clientId);
      params.set('mode', mode);
      const res = await fetch(
        `${supabaseUrl}/functions/v1/shopify-fetch-discounts?${params.toString()}`,
        { headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` } }
      );
      const json = await res.json();
      if (!json.success) {
        if (json.token_expired) {
          // Token expired — build reconnect OAuth URL client-side (no extra round-trip needed).
          // Fall back to shop_domain from the response when the shopDomain prop is empty
          // (caller used client_id for lookup; the function resolves and echoes the domain).
          // The URL omits grant_options[]=per-user so Shopify issues a permanent shpat_ token.
          setShopifyTokenExpired(true);
          setShopifyError('Your Shopify store connection has expired.');
          const effectiveShopDomain = shopDomain || json.shop_domain || '';
          if (effectiveShopDomain && SHOPIFY_CLIENT_ID) {
            setShopifyReconnectUrl(buildShopifyReconnectUrl(effectiveShopDomain, clientId));
          }
        } else {
          throw new Error(json.error || 'Failed to fetch Shopify discounts');
        }
      } else {
        setShopifyRules(json.price_rules || []);
      }
    } catch (e: any) {
      setShopifyError(e.message);
    }
    setShopifyLoading(false);
    setShopifyFetched(true);
  }, [shopDomain, clientId, mode]);

  function pickShopifyRule(rule: ShopifyPriceRule) {
    set('title', rule.title.replace(/^Loyalty: /i, ''));
    set('reward_type', rule.reward_type);
    set('discount_value', String(rule.discount_value));
    set('min_purchase_amount', rule.min_purchase_amount > 0 ? String(rule.min_purchase_amount) : '');
    set('valid_until', rule.ends_at ? rule.ends_at.slice(0, 10) : '');
    set('code_paste', rule.codes.join('\n'));
    set('coupon_type', rule.codes.length === 1 ? 'generic' : 'unique');
    if (rule.codes.length === 1) set('generic_coupon_code', rule.codes[0]);
    setShopifyPicked(true);
  }

  function handleClose() { resetState(); onClose(); }

  function handleFileRead(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const codes = lines[0]?.toLowerCase().includes('code') ? lines.slice(1) : lines;
      setParsedCodes(codes.slice(0, 1000));
      set('code_paste', codes.join('\n'));
    };
    reader.readAsText(file);
  }

  async function handleSubmit() {
    setError(''); setLoading(true);
    try {
      if (!form.title.trim()) throw new Error('Title is required');
      if (!form.discount_value && flow !== 'generic') throw new Error('Discount value is required');
      if (mode === 'marketplace') {
        if (!form.redemption_link.trim()) throw new Error('Redemption URL is required for marketplace offers');
        if (!form.terms_conditions.trim()) throw new Error('Terms & conditions are required for marketplace offers');
        if (!form.steps_to_redeem.trim()) throw new Error('Steps to redeem are required for marketplace offers');
      }

      // Resolve the actual coupon_type: if flow is 'generic', always use 'generic'
      const resolvedCouponType = flow === 'generic' ? 'generic' : form.coupon_type;

      const codeSource: CodeSource =
        flow === 'shopify_generated' ? 'shopify_generated'
        : flow === 'shopify_imported' ? 'shopify_imported'
        : 'csv_uploaded';

      const rewardPayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        offer_type: mode === 'marketplace' ? 'marketplace_offer' : 'store_discount',
        offer_category: form.offer_category || 'other',
        offer_priority: Number(form.offer_priority) || 0,
        starts_at: form.starts_at || null,
        code_source: codeSource,
        coupon_type: resolvedCouponType,
        generic_coupon_code: resolvedCouponType === 'generic' ? form.generic_coupon_code.trim() || null : null,
        reward_type: form.reward_type,
        discount_value: form.discount_value ? Number(form.discount_value) : null,
        max_discount_value: form.max_cap ? Number(form.max_cap) : null,
        min_purchase_amount: form.min_purchase_amount ? Number(form.min_purchase_amount) : 0,
        image_url: form.image_url.trim() || clientLogoUrl || null,
        valid_until: form.valid_until || null,
        redemption_link: form.redemption_link.trim() || null,
        terms_conditions: form.terms_conditions.trim() || null,
        steps_to_redeem: form.steps_to_redeem.trim() || null,
      };

      if (editOffer) {
        // ── UPDATE existing offer ──────────────────────────────────────────
        const mktStatus = (editOffer as any).marketplace_status as string | undefined;

        if (editOffer.offer_type === 'marketplace_offer' && mktStatus === 'approved') {
          // Approved marketplace offer: do NOT touch the live row.
          // Build diff of only changed fields and submit as an edit request.
          const editableKeys = [
            'title', 'description', 'image_url', 'offer_category', 'reward_type',
            'discount_value', 'max_discount_value', 'min_purchase_amount',
            'coupon_type', 'generic_coupon_code', 'valid_until',
            'redemption_link', 'terms_conditions', 'steps_to_redeem',
          ] as const;
          const changedFields: Record<string, any> = {};
          for (const key of editableKeys) {
            const newVal = (rewardPayload as any)[key] ?? null;
            const oldVal = (editOffer as any)[key] ?? null;
            const normalise = (v: any) => (v === '' || v === undefined ? null : v);
            if (normalise(newVal) !== normalise(oldVal)) {
              changedFields[key] = newVal;
            }
          }
          if (Object.keys(changedFields).length === 0) {
            setError('No changes detected.');
            setLoading(false);
            return;
          }
          // Upsert: if there's already a pending request for this offer+client, replace it
          const { data: existing } = await supabase
            .from('rewards_edit_requests')
            .select('id')
            .eq('reward_id', editOffer.id)
            .eq('requesting_client_id', clientId)
            .eq('status', 'pending')
            .maybeSingle();

          if (existing) {
            await supabase
              .from('rewards_edit_requests')
              .update({ proposed_changes: changedFields, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase.from('rewards_edit_requests').insert({
              reward_id: editOffer.id,
              requesting_client_id: clientId,
              proposed_changes: changedFields,
              status: 'pending',
            });
          }
          setSuccess('Edit request submitted for admin review. The live offer is unchanged until approved.');
          setTimeout(() => { onCreated(); handleClose(); }, 2000);
          setLoading(false);
          return;
        }

        if (editOffer.offer_type === 'marketplace_offer' && (mktStatus === 'pending' || mktStatus === 'rejected')) {
          // Pending/rejected: direct update + reset to pending for re-review
          const { error: updErr } = await supabase
            .from('rewards')
            .update({
              ...rewardPayload,
              marketplace_status: 'pending',
              marketplace_rejection_reason: null,
              marketplace_submitted_at: new Date().toISOString(),
            })
            .eq('id', editOffer.id);
          if (updErr) throw updErr;
          setSuccess('Changes saved and resubmitted for admin review.');
          setTimeout(() => { onCreated(); handleClose(); }, 1800);
          setLoading(false);
          return;
        }

        // Non-marketplace offer: normal update
        const { error: updErr } = await supabase
          .from('rewards')
          .update(rewardPayload)
          .eq('id', editOffer.id);
        if (updErr) throw updErr;
        setSuccess('Offer updated successfully.');
        setTimeout(() => { onCreated(); handleClose(); }, 1500);
        setLoading(false);
        return;
      }

      // ── CREATE new offer ───────────────────────────────────────────────
      // 1. Insert reward row
      const isMarketplace = mode === 'marketplace';
      const { data: reward, error: rwErr } = await supabase
        .from('rewards')
        .insert({
          ...rewardPayload,
          // Marketplace offers start as draft+pending until admin approves
          status: isMarketplace ? 'draft' : 'active',
          ...(isMarketplace ? {
            marketplace_status: 'pending',
            marketplace_submitted_at: new Date().toISOString(),
          } : {}),
          owner_client_id: clientId,
          brand_id: brandId || null,
          redeems_at_shop_domain: isMarketplace ? null : shopDomain,
        })
        .select('id')
        .single();

      if (rwErr) throw rwErr;
      const offerId = reward.id;

      // 2. Upload codes if applicable
      if (resolvedCouponType === 'unique') {
        let codes: string[] = [];
        if (flow === 'shopify_imported') {
          codes = (form.code_paste || '').split('\n').map(c => c.trim()).filter(Boolean).slice(0, 1000);
        } else if (flow === 'shopify_generated') {
          // Call Shopify API to create a real price rule + discount codes
          setShopifyCreating(true);
          const res = await fetch(
            `${supabaseUrl}/functions/v1/shopify-create-discount`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` },
              body: JSON.stringify({
                client_id: clientId,
                shop_domain: shopDomain,
                title: form.title.trim(),
                reward_type: form.reward_type,
                discount_value: Number(form.discount_value),
                min_purchase_amount: Number(form.min_purchase_amount) || 0,
                codes_count: Math.min(Number(form.codes_count) || 10, 250),
                code_prefix: form.shopify_prefix.trim() || form.title.replace(/\s+/g,'').toUpperCase().slice(0,4),
                usage_limit_per_code: Number(form.shopify_usage_limit) || 1,
                valid_until: form.valid_until || null,
              }),
            }
          );
          const json = await res.json();
          setShopifyCreating(false);
          if (!json.success) throw new Error(json.error || 'Shopify discount creation failed');
          codes = json.codes || [];
        }
        if (codes.length > 0) {
          const uploadResult = await uploadOfferCodesDirect({
            supabase,
            offerId,
            codes,
            expiresAt: form.valid_until || null,
          });
          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload codes');
          }
        }
      }

      // 3. Insert offer_distributions placeholder (off by default — client enables via Widget Rewards tab)
      await supabase.from('offer_distributions').insert({
        offer_id: offerId,
        distributing_client_id: clientId,
        access_type: 'points_redemption',
        points_cost: null,
        max_per_member: 1,
        is_active: false,
      });

      setSuccess(isMarketplace
        ? 'Submitted for admin review. Your offer will appear on the marketplace once approved.'
        : 'Offer created. Set a points cost in the Distribution & Points tab.');
      setTimeout(() => { onCreated(); handleClose(); }, 1800);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    }
    setLoading(false);
  }

  const codesPreview = parsedCodes.length > 0
    ? `${parsedCodes.length} codes detected`
    : form.code_paste.split('\n').filter(l => l.trim()).length > 0
      ? `${form.code_paste.split('\n').filter(l => l.trim()).length} codes entered`
      : '';

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={editOffer ? 'Edit offer' : mode === 'marketplace' ? 'Submit marketplace offer' : 'New store offer'}
      subtitle={editOffer ? 'Update the details for this offer' : mode === 'marketplace' ? 'Submit a discount offer to GoSelf marketplace for other clients to adopt' : 'Create a discount code offer for your store customers'}
      footer={
        flow ? (
          <div className="flex items-center gap-3">
            {!editOffer && (
              <button onClick={() => { setFlow(null); setError(''); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
            )}
            <button onClick={handleSubmit} disabled={loading || shopifyCreating || (flow === 'shopify_imported' && !shopifyPicked && !editOffer)}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 ml-auto">
              {shopifyCreating ? 'Creating in Shopify…' : loading ? (editOffer ? 'Saving...' : 'Creating...') : (editOffer ? 'Save Changes' : 'Create Offer')}
            </button>
          </div>
        ) : null
      }
    >
      {/* Flow selector — only shown when creating a new offer */}
      {!flow && !editOffer && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 mb-4">Choose how you want to add discount codes:</p>
          {[
            {
              id: 'shopify_generated' as Flow,
              label: 'Generate via Shopify',
              desc: 'Automatically create new discount codes in your Shopify store',
              icon: '⚡',
            },
            {
              id: 'shopify_imported' as Flow,
              label: 'Import from Shopify',
              desc: 'Pick an existing discount from your Shopify store',
              icon: '📥',
            },
            {
              id: 'generic' as Flow,
              label: 'Generic code',
              desc: 'One code that all members share (e.g. SAVE10)',
              icon: '🏷️',
            },
          ].map(opt => (
            <button key={opt.id} onClick={() => { setFlow(opt.id); if (opt.id === 'shopify_imported') fetchShopifyDiscounts(); }}
              className="w-full text-left flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all">
              <span className="text-xl">{opt.icon}</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </div>
              <svg className="w-4 h-4 text-gray-400 ml-auto mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Form fields */}
      {flow && (
        <div className="space-y-4">
          {/* ── Shopify import picker (shown before form when not yet picked) ── */}
          {flow === 'shopify_imported' && !shopifyPicked && !editOffer && (
            <div>
              {shopifyLoading && (
                <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-400">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Fetching discounts from Shopify…
                </div>
              )}
              {shopifyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-3">
                  {shopifyTokenExpired ? (
                    <div className="space-y-2">
                      <p className="font-medium">Your Shopify store connection has expired.</p>
                      <p className="text-xs text-red-600">The access token stored for your store is no longer valid. You need to reconnect your Shopify store to continue.</p>
                      {shopifyReconnectUrl ? (
                        <a
                          href={shopifyReconnectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                        >
                          🔗 Reconnect Shopify Store →
                        </a>
                      ) : (
                        <p className="text-xs text-red-500 italic">Please reinstall the Goself app from your Shopify admin.</p>
                      )}
                    </div>
                  ) : (
                    <>
                      {shopifyError}
                      <button onClick={fetchShopifyDiscounts} className="ml-2 underline text-xs">Retry</button>
                    </>
                  )}
                </div>
              )}
              {!shopifyLoading && !shopifyError && shopifyFetched && shopifyRules.length === 0 && (
                <div className="text-center text-sm text-gray-400 py-8">No discount codes found in your Shopify store.</div>
              )}
              {!shopifyLoading && shopifyFetched && shopifyRules.length > 0 && (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    Select a discount from your Shopify store to import:
                  </p>
                  <input
                    value={shopifySearch}
                    onChange={e => setShopifySearch(e.target.value)}
                    placeholder="Search by name or code…"
                    className="input-base mb-3"
                  />
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {shopifyRules
                      .filter(r => {
                        const q = shopifySearch.toLowerCase();
                        return !q || r.title.toLowerCase().includes(q) || r.codes.some(c => c.toLowerCase().includes(q));
                      })
                      .map(rule => (
                        <button
                          key={rule.id}
                          onClick={() => !rule.already_imported && pickShopifyRule(rule)}
                          disabled={rule.already_imported}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${rule.already_imported ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">{rule.title.replace(/^Loyalty: /i, '')}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {rule.already_imported && (
                                <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded px-2 py-0.5">Already added</span>
                              )}
                              <span className="text-xs font-bold text-white bg-gray-700 rounded px-2 py-0.5">
                                {rule.reward_type === 'percentage_discount' ? `${rule.discount_value}%` : `₹${rule.discount_value}`} off
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500">{rule.total_codes} code{rule.total_codes !== 1 ? 's' : ''}</span>
                            {rule.codes.slice(0, 3).map(c => (
                              <span key={c} className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{c}</span>
                            ))}
                            {rule.codes.length > 3 && <span className="text-xs text-gray-400">+{rule.codes.length - 3} more</span>}
                          </div>
                          {rule.ends_at && (
                            <div className="text-xs text-gray-400 mt-0.5">Expires: {new Date(rule.ends_at).toLocaleDateString()}</div>
                          )}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Shopify picked confirmation banner */}
          {flow === 'shopify_imported' && shopifyPicked && !editOffer && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <span>✓ Discount imported from Shopify. Adjust details below if needed.</span>
              <button
                onClick={() => { setShopifyPicked(false); resetState(); setFlow('shopify_imported'); fetchShopifyDiscounts(); }}
                className="ml-auto text-xs underline text-green-600 flex-shrink-0"
              >
                Change
              </button>
            </div>
          )}

          {/* Hide the rest of the form until a Shopify rule is picked (for shopify_imported) */}
          {flow === 'shopify_imported' && !shopifyPicked && !editOffer ? null : (
            <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>
          )}

          {/* Title */}
          <Field label="Offer title *">
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. ₹200 off on ₹999+"
              className="input-base" />
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Optional description for members"
              className="input-base resize-none" />
          </Field>

          {/* Offer image — upload or paste URL */}
          <Field label="Offer / Brand image (optional)">
            <OfferImageUpload
              value={form.image_url}
              onChange={url => set('image_url', url)}
              clientId={clientId}
            />
          </Field>

          {/* Offer category */}
          <Field label="Offer category">
            <select value={form.offer_category} onChange={e => set('offer_category', e.target.value)} className="input-base">
              {OFFER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          {/* Offer priority + go-live date */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority (0 = normal)">
              <input type="number" min={0} value={form.offer_priority}
                onChange={e => set('offer_priority', e.target.value)}
                placeholder="0"
                className="input-base" />
            </Field>
            <Field label="Go-live date (optional)">
              <input type="date" value={form.starts_at}
                onChange={e => set('starts_at', e.target.value)}
                className="input-base" />
            </Field>
          </div>

          {/* Reward type */}
          <Field label="Discount type *">
            <select value={form.reward_type} onChange={e => set('reward_type', e.target.value)}
              className="input-base">
              {REWARD_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>

          {/* Discount value */}
          {form.reward_type !== 'free_item' && (
            <Field label={form.reward_type === 'percentage_discount' ? 'Discount percentage *' : 'Discount amount (₹) *'}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {form.reward_type === 'percentage_discount' ? '%' : '₹'}
                </span>
                <input type="number" min={1} max={form.reward_type === 'percentage_discount' ? 100 : undefined} value={form.discount_value}
                  onChange={e => set('discount_value', e.target.value)}
                  className="input-base" style={{ paddingLeft: '2rem' }} />
              </div>
            </Field>
          )}

          {/* Max cap — percentage only */}
          {form.reward_type === 'percentage_discount' && (
            <Field label="Max discount cap (₹) — optional">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input type="number" min={1} value={form.max_cap}
                  onChange={e => set('max_cap', e.target.value)}
                  placeholder="e.g. 500 (leave blank for no cap)"
                  className="input-base" style={{ paddingLeft: '2rem' }} />
              </div>
            </Field>
          )}

          {/* Min purchase */}
          <Field label="Minimum order value (₹)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
              <input type="number" min={0} value={form.min_purchase_amount}
                onChange={e => set('min_purchase_amount', e.target.value)}
                placeholder="Leave blank for no minimum"
                className="input-base" style={{ paddingLeft: '2rem' }} />
            </div>
          </Field>

          {/* Generic-specific */}
          {flow === 'generic' && (
            <Field label="Generic coupon code *">
              <input value={form.generic_coupon_code} onChange={e => set('generic_coupon_code', e.target.value.toUpperCase())}
                placeholder="e.g. SAVE10"
                className="input-base font-mono" />
            </Field>
          )}

          {/* Coupon type toggle (not for generic flow) */}
          {flow !== 'generic' && (
            <Field label="Code type">
              <div className="flex gap-3">
                {['unique', 'generic'].map(ct => (
                  <label key={ct} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="coupon_type" value={ct}
                      checked={form.coupon_type === ct}
                      onChange={() => set('coupon_type', ct)}
                      className="accent-gray-900" />
                    <span className="text-sm text-gray-700 capitalize">{ct} codes</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {/* Code generation count */}
          {flow === 'shopify_generated' && form.coupon_type === 'unique' && (
            <Field label="How many codes to generate">
              <input type="number" min={1} max={250} value={form.codes_count}
                onChange={e => set('codes_count', e.target.value)}
                className="input-base w-28" />
              <p className="text-xs text-gray-400 mt-1">Max 250 per batch — creates real Shopify discount codes</p>
            </Field>
          )}

          {/* Advanced Shopify generate options */}
          {flow === 'shopify_generated' && form.coupon_type === 'unique' && (
            <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Shopify Discount Settings</p>
              <Field label="Code prefix (optional)">
                <input value={form.shopify_prefix} onChange={e => set('shopify_prefix', e.target.value.toUpperCase())}
                  placeholder="e.g. LOYAL (default: first 4 chars of title)"
                  className="input-base font-mono" />
              </Field>
              <Field label="Uses per code">
                <select value={form.shopify_usage_limit} onChange={e => set('shopify_usage_limit', e.target.value)}
                  className="input-base">
                  <option value="1">1 use per code (single-use)</option>
                  <option value="5">5 uses per code</option>
                  <option value="10">10 uses per code</option>
                  <option value="0">Unlimited uses</option>
                </select>
              </Field>
              <Field label="Applies to">
                <select value={form.shopify_applies_to} onChange={e => set('shopify_applies_to', e.target.value as any)}
                  className="input-base">
                  <option value="all">All products</option>
                  <option value="specific_collections">Specific collections</option>
                  <option value="specific_products">Specific products</option>
                </select>
              </Field>
            </div>
          )}

          {/* Code import */}
          {flow === 'shopify_imported' && form.coupon_type === 'unique' && (
            <Field label="Paste codes (one per line) or upload CSV">
              <textarea value={form.code_paste} onChange={e => set('code_paste', e.target.value)}
                rows={5} placeholder={"SAVE10XYZ\nSAVE10ABC\n..."}
                className="input-base font-mono text-xs resize-none" />
              <div className="flex items-center gap-3 mt-2">
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileRead} className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="text-xs text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                  Upload CSV
                </button>
                {codesPreview && <span className="text-xs text-green-600 font-medium">{codesPreview}</span>}
              </div>
            </Field>
          )}

          {/* Generic code for non-generic flows */}
          {flow !== 'generic' && form.coupon_type === 'generic' && (
            <Field label="Generic coupon code *">
              <input value={form.generic_coupon_code} onChange={e => set('generic_coupon_code', e.target.value.toUpperCase())}
                placeholder="e.g. SAVE10"
                className="input-base font-mono" />
            </Field>
          )}

          {/* Expiry */}
          <Field label="Expiry date">
            <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)}
              className="input-base" />
          </Field>

          {/* Marketplace-only mandatory fields */}
          {mode === 'marketplace' && (
            <div className="border border-indigo-100 bg-indigo-50 rounded-xl p-4 space-y-4">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Marketplace Required Fields</p>
              <Field label="Redemption URL *">
                <input value={form.redemption_link} onChange={e => set('redemption_link', e.target.value)}
                  placeholder="https://yourbrand.com/checkout"
                  className="input-base" />
              </Field>
              <Field label="Terms & Conditions *">
                <textarea value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)}
                  rows={3} placeholder="e.g. Valid once per user. Cannot be combined with other offers."
                  className="input-base resize-none" />
              </Field>
              <Field label="Steps to Redeem *">
                <textarea value={form.steps_to_redeem} onChange={e => set('steps_to_redeem', e.target.value)}
                  rows={3} placeholder={"1. Click Redeem\n2. Copy the code\n3. Paste at checkout"}
                  className="input-base resize-none" />
              </Field>
            </div>
          )}
            </div>
          )}
        </div>
      )}

      {/* Global input styles injected inline */}
      <style>{`.input-base{width:100%;padding:8px 12px;font-size:13px;border:1px solid #d1d5db;border-radius:8px;outline:none;background:white;color:#111;font-family:inherit}.input-base:focus{border-color:#6b7280;box-shadow:0 0 0 2px rgba(0,0,0,0.08)}`}</style>
    </Drawer>
  );
}

// ─── Small field wrapper ──────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ─── Offer image upload (upload to Supabase Storage OR paste a URL) ────────────
function OfferImageUpload({ value, onChange, clientId }: { value: string; onChange: (url: string) => void; clientId: string }) {
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(!value); // start in URL mode when empty
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `offer-images/${clientId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('client-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('client-assets').getPublicUrl(path);
      onChange(pub.publicUrl);
      setUrlMode(false);
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-2">
      {/* Preview if we already have a URL */}
      {value && (
        <div className="relative inline-block">
          <img
            src={value}
            alt="offer preview"
            className="h-20 w-auto rounded-xl border border-gray-200 object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <button
            type="button"
            onClick={() => { onChange(''); setUrlMode(true); }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
          >✕</button>
        </div>
      )}

      {/* Upload drop zone */}
      {!value && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <div className="text-xs text-gray-500">Uploading…</div>
          ) : (
            <>
              <div className="text-2xl mb-1">🖼️</div>
              <div className="text-xs font-medium text-gray-600">Click or drag to upload</div>
              <div className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP · max 2 MB</div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {/* Paste URL toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setUrlMode(v => !v)}
          className="text-xs text-blue-600 hover:underline"
        >
          {urlMode ? 'Hide URL field' : 'Or paste image URL'}
        </button>
      </div>
      {urlMode && (
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://example.com/brand-logo.png"
          className="input-base text-xs"
        />
      )}
    </div>
  );
}
