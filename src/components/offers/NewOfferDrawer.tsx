import React, { useEffect, useRef, useState } from 'react';
import { Drawer } from './Drawers';
import { supabase } from '../../lib/supabase';
import { uploadOfferCodesDirect } from '../../lib/offerCodes';
import { CodeSource, RewardType } from '../../types/offers';

type Flow = 'shopify_generated' | 'shopify_imported' | 'generic';

interface NewOfferDrawerProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  shopDomain: string;
  onCreated: () => void;
  mode?: 'store' | 'marketplace';
}

const REWARD_TYPES: { value: RewardType; label: string }[] = [
  { value: 'flat_discount',        label: 'Flat discount (₹ off)' },
  { value: 'percentage_discount',  label: 'Percentage discount (% off)' },
  { value: 'free_item',            label: 'Free item' },
];

export function NewOfferDrawer({ open, onClose, clientId, shopDomain, onCreated, mode = 'store', editOffer }: NewOfferDrawerProps & { editOffer?: import('../../types/offers').Offer | null }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    reward_type: 'flat_discount' as RewardType,
    discount_value: '',
    min_purchase_amount: '',
    coupon_type: 'unique',
    generic_coupon_code: '',
    codes_count: '10',
    code_paste: '',
    valid_until: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Pre-populate form when editing an existing offer
  useEffect(() => {
    if (editOffer && open) {
      const isGeneric = editOffer.coupon_type === 'generic';
      setFlow(isGeneric ? 'generic' : 'shopify_imported');
      setForm({
        title: editOffer.title ?? '',
        description: editOffer.description ?? '',
        reward_type: editOffer.reward_type as RewardType,
        discount_value: editOffer.discount_value != null ? String(editOffer.discount_value) : '',
        min_purchase_amount: editOffer.min_purchase_amount != null ? String(editOffer.min_purchase_amount) : '',
        coupon_type: editOffer.coupon_type,
        generic_coupon_code: editOffer.generic_coupon_code ?? '',
        codes_count: '10',
        code_paste: '',
        valid_until: editOffer.valid_until ? editOffer.valid_until.slice(0, 10) : '',
      });
    } else if (!open) {
      resetState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOffer, open]);

  function resetState() {
    setFlow(null); setLoading(false); setError(''); setSuccess('');
    setParsedCodes([]);
    setForm({
      title: '', description: '', reward_type: 'flat_discount', discount_value: '',
      min_purchase_amount: '', coupon_type: 'unique', generic_coupon_code: '',
      codes_count: '10', code_paste: '', valid_until: '',
    });
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
        code_source: codeSource,
        coupon_type: resolvedCouponType,
        generic_coupon_code: resolvedCouponType === 'generic' ? form.generic_coupon_code.trim() || null : null,
        tracking_type: 'automatic',
        reward_type: form.reward_type,
        discount_value: form.discount_value ? Number(form.discount_value) : null,
        min_purchase_amount: form.min_purchase_amount ? Number(form.min_purchase_amount) : 0,
        valid_until: form.valid_until || null,
      };

      if (editOffer) {
        // ── UPDATE existing offer ──────────────────────────────────────────
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
      const { data: reward, error: rwErr } = await supabase
        .from('rewards')
        .insert({
          ...rewardPayload,
          currency: 'INR',
          is_active: true,
          status: 'active',
          owner_client_id: clientId,
          client_id: clientId,
          redeems_at_shop_domain: mode === 'marketplace' ? null : shopDomain,
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
          // Generate simple codes client-side (actual Shopify sync happens via sync-discount-to-shopify)
          const count = Math.min(Number(form.codes_count) || 10, 100);
          for (let i = 0; i < count; i++) {
            codes.push(`${form.title.replace(/\s+/g,'').toUpperCase().slice(0,4)}${Math.random().toString(36).substring(2,8).toUpperCase()}`);
          }
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

      // 3. Insert offer_distributions placeholder
      await supabase.from('offer_distributions').insert({
        offer_id: offerId,
        distributing_client_id: clientId,
        access_type: 'points_redemption',
        points_cost: null,
        max_per_member: 1,
        is_active: true,
      });

      setSuccess('Offer created. Set a points cost in the Distribution & Points tab.');
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
            <button onClick={handleSubmit} disabled={loading}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 ml-auto">
              {loading ? (editOffer ? 'Saving...' : 'Creating...') : (editOffer ? 'Save Changes' : 'Create Offer')}
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
              desc: 'Paste or upload codes already created in your Shopify admin',
              icon: '📥',
            },
            {
              id: 'generic' as Flow,
              label: 'Generic code',
              desc: 'One code that all members share (e.g. SAVE10)',
              icon: '🏷️',
            },
          ].map(opt => (
            <button key={opt.id} onClick={() => setFlow(opt.id)}
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
                <input type="number" min={1} value={form.discount_value}
                  onChange={e => set('discount_value', e.target.value)}
                  className="input-base pl-8" />
              </div>
            </Field>
          )}

          {/* Min purchase */}
          <Field label="Minimum order value (₹)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
              <input type="number" min={0} value={form.min_purchase_amount}
                onChange={e => set('min_purchase_amount', e.target.value)}
                placeholder="0 (no minimum)"
                className="input-base pl-8" />
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
              <input type="number" min={1} max={100} value={form.codes_count}
                onChange={e => set('codes_count', e.target.value)}
                className="input-base w-28" />
              <p className="text-xs text-gray-400 mt-1">Max 100 per batch</p>
            </Field>
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
