import React, { useEffect, useRef, useState } from 'react';
import { Drawer } from './Drawers';
import { supabase } from '../../lib/supabase';
import { uploadOfferCodesDirect } from '../../lib/offerCodes';
import { AccessType } from '../../types/offers';
import { OFFER_CATEGORIES } from './NewOfferDrawer';
import { PartnerPickerField } from './PartnerPickerField';

interface PartnerWizardProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  shopDomain: string;
  editTarget?: { offer: any; distribution: any } | null;
  onCreated: () => void;
}

type Step = 1 | 2 | 3;

const STEP_LABELS = ['Partner details', 'Upload codes', 'Distribution config'];

const REWARD_TYPES = [
  { value: 'flat_discount',       label: 'Flat discount',       hint: 'Fixed amount off (e.g. ₹100 off)' },
  { value: 'percentage_discount', label: 'Percentage discount', hint: 'Percent off order total (e.g. 20% off)' },
  { value: 'free_item',           label: 'Free item',           hint: 'Complimentary product or service' },
];

export function PartnerWizard({ open, onClose, clientId, shopDomain, editTarget, onCreated }: PartnerWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [partnerId, setPartnerId] = useState<string | null>(null);

  const [form, setForm] = useState({
    // Step 1
    title: '',
    description: '',
    offer_category: 'other',
    reward_type: 'flat_discount',
    discount_value: '',
    max_discount_value: '',
    min_purchase_amount: '',
    image_url: '',
    banner_url: '',
    steps_to_redeem: '',
    redemption_link: '',
    terms_conditions: '',
    // Step 2
    coupon_type: 'unique',        // 'unique' = CSV upload, 'generic' = manual fixed code
    generic_coupon_code: '',
    valid_until: '',
    // Step 3
    points_cost: '',
    max_per_member: '1',
    access_type: 'points_redemption' as AccessType,
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function parseCodesFromCsvText(text: string): string[] {
    const rows = text
      .split(/\r?\n/)
      .map(r => r.trim())
      .filter(Boolean);
    if (!rows.length) return [];

    const firstRowCols = rows[0].split(',').map(c => c.trim().toLowerCase());
    const hasHeader = firstRowCols.includes('code') || firstRowCols.includes('coupon_code');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows
      .map(r => r.split(',')[0]?.trim())
      .filter((v): v is string => Boolean(v));
  }

  function downloadSampleCsv() {
    const csv = ['code', 'SAVE100A', 'SAVE100B', 'SAVE100C'].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'partner-voucher-codes-sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep(1); setLoading(false); setError(''); setSuccess('');
    setParsedCodes([]);
    setPartnerId(null);
    setForm({
      title: '', description: '', offer_category: 'other',
      reward_type: 'flat_discount', discount_value: '', max_discount_value: '', min_purchase_amount: '',
      image_url: '',
      banner_url: '',
      steps_to_redeem: '', redemption_link: '', terms_conditions: '',
      coupon_type: 'unique', generic_coupon_code: '', valid_until: '',
      points_cost: '', max_per_member: '1', access_type: 'points_redemption',
    });
  }

  useEffect(() => {
    if (!open) return;
    if (!editTarget?.offer) return;
    const offer = editTarget.offer;
    const dist = editTarget.distribution;
    setPartnerId(offer.partner_id ?? null);
    setForm({
      title: offer.title ?? '',
      description: offer.description ?? '',
      offer_category: offer.offer_category || 'other',
      reward_type: offer.reward_type ?? 'flat_discount',
      discount_value: offer.discount_value != null ? String(offer.discount_value) : '',
      max_discount_value: offer.max_discount_value != null ? String(offer.max_discount_value) : '',
      min_purchase_amount: offer.min_purchase_amount != null ? String(offer.min_purchase_amount) : '',
      image_url: offer.image_url ?? '',
      banner_url: offer.banner_url ?? '',
      steps_to_redeem: offer.steps_to_redeem ?? '',
      redemption_link: offer.redemption_link ?? '',
      terms_conditions: offer.terms_conditions ?? '',
      coupon_type: offer.coupon_type ?? 'unique',
      generic_coupon_code: offer.generic_coupon_code ?? '',
      valid_until: offer.valid_until ? String(offer.valid_until).slice(0, 10) : '',
      points_cost: dist?.points_cost != null ? String(dist.points_cost) : '',
      max_per_member: dist?.max_per_member != null ? String(dist.max_per_member) : '1',
      access_type: dist?.access_type ?? 'points_redemption',
    });
  }, [open, editTarget]);

  function handleClose() { reset(); onClose(); }

  function handleFileRead(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const codes = parseCodesFromCsvText(text);
      setParsedCodes(codes.slice(0, 1000));
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  function validateStep(): boolean {
    setError('');
    if (step === 1) {
      if (!partnerId) { setError('Please select a partner for this voucher'); return false; }
      if (!form.title.trim()) { setError('Offer title is required'); return false; }
      if (!form.image_url.trim()) { setError('Partner logo image is required'); return false; }
    }
    if (step === 2) {
      if (form.reward_type !== 'free_item') {
        if (!form.discount_value) { setError('Discount value is required'); return false; }
        const dv = Number(form.discount_value);
        if (dv <= 0) { setError('Discount value must be greater than 0'); return false; }
        if (form.reward_type === 'percentage_discount' && dv > 100) {
          setError('Percentage discount cannot exceed 100%'); return false;
        }
      }
      if (!editTarget && form.coupon_type === 'unique' && parsedCodes.length === 0) {
        setError('Please upload at least one code via CSV'); return false;
      }
      if (form.coupon_type === 'generic') {
        const code = form.generic_coupon_code.trim();
        if (!code) { setError('Coupon code is required'); return false; }
        if (/\s/.test(code)) { setError('Coupon code must not contain spaces'); return false; }
        if (!/^[A-Z0-9_-]+$/i.test(code)) { setError('Coupon code may only contain letters, numbers, hyphens and underscores'); return false; }
      }
    }
    if (step === 3) {
      const showPoints = form.access_type !== 'campaign_reward';
      if (showPoints && (!form.points_cost || Number(form.points_cost) < 1)) {
        setError('Points cost must be at least 1'); return false;
      }
    }
    return true;
  }

  async function handleNext() {
    if (!validateStep()) return;
    if (step < 3) { setStep((step + 1) as Step); return; }
    // Step 3 → submit
    setLoading(true);
    try {
      const showPoints = form.access_type !== 'campaign_reward';
      const isEdit = Boolean(editTarget?.offer?.id);
      let offerId = editTarget?.offer?.id as string | undefined;

      // Both generic (fixed shared code) and unique (CSV-uploaded) use 'csv_uploaded' as
      // that is the only non-Shopify CodeSource value in the type. A future 'manual' variant
      // can be added to CodeSource when needed.
      const codeSource: 'csv_uploaded' = 'csv_uploaded';

      const rewardPayload: Record<string, any> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        banner_url: form.banner_url.trim() || null,
        redemption_link: form.redemption_link || null,
        terms_conditions: form.terms_conditions || null,
        steps_to_redeem: form.steps_to_redeem || null,
        offer_type: 'partner_voucher',
        offer_category: form.offer_category || 'other',
        code_source: codeSource,
        coupon_type: form.coupon_type,
        generic_coupon_code: form.coupon_type === 'generic' ? form.generic_coupon_code.trim() : null,
        reward_type: form.reward_type,
        discount_value: form.discount_value ? Number(form.discount_value) : null,
        max_discount_value: (form.reward_type === 'percentage_discount' && form.max_discount_value)
          ? Number(form.max_discount_value) : null,
        min_purchase_amount: form.min_purchase_amount ? Number(form.min_purchase_amount) : null,
        status: 'active',
        client_id: clientId,
        owner_client_id: clientId,
        partner_id: partnerId || null,
        valid_until: form.valid_until || null,
        // tags intentionally omitted — not written to DB
      };

      if (isEdit && offerId) {
        const { error: updateErr } = await (supabase as any)
          .from('rewards')
          .update(rewardPayload)
          .eq('id', offerId);
        if (updateErr) throw updateErr;
      } else {
        const { data: reward, error: rwErr } = await (supabase as any)
          .from('rewards')
          .insert(rewardPayload)
          .select('id')
          .single();
        if (rwErr) throw rwErr;
        offerId = reward.id;
      }

      // 2. Upload unique codes (CSV path)
      if (offerId && form.coupon_type === 'unique' && parsedCodes.length > 0) {
        const uploadResult = await uploadOfferCodesDirect({
          supabase,
          offerId,
          codes: parsedCodes,
          expiresAt: form.valid_until || null,
        });
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Failed to upload codes');
        }
      }

      // 3. Insert / update offer_distributions
      if (offerId) {
        const distributionPayload = {
          access_type: form.access_type,
          points_cost: showPoints ? Number(form.points_cost) : null,
          max_per_member: Number(form.max_per_member) || 1,
          is_active: false, // off by default — client enables via Widget Rewards tab
        };

        const { data: existingDistributions, error: existingDistErr } = await (supabase as any)
          .from('offer_distributions')
          .select('id, is_active, created_at, updated_at')
          .eq('offer_id', offerId)
          .eq('distributing_client_id', clientId)
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false });

        if (existingDistErr) throw existingDistErr;

        const latestDistribution = existingDistributions?.[0] ?? null;

        if (latestDistribution) {
          const { error: distUpdateErr } = await (supabase as any)
            .from('offer_distributions')
            .update(distributionPayload)
            .eq('id', latestDistribution.id);
          if (distUpdateErr) throw distUpdateErr;

          const duplicateActiveIds = (existingDistributions ?? [])
            .filter((d: { id: string; is_active: boolean }) => d.id !== latestDistribution.id && d.is_active)
            .map((d: { id: string }) => d.id);

          if (duplicateActiveIds.length > 0) {
            const { error: deactivateDupesErr } = await (supabase as any)
              .from('offer_distributions')
              .update({ is_active: false })
              .in('id', duplicateActiveIds);
            if (deactivateDupesErr) throw deactivateDupesErr;
          }
        } else {
          const { error: distInsertErr } = await (supabase as any).from('offer_distributions').insert({
            offer_id: offerId,
            distributing_client_id: clientId,
            ...distributionPayload,
          });
          if (distInsertErr) throw distInsertErr;
        }
      }

      setSuccess(isEdit ? 'Partner voucher updated successfully!' : 'Partner voucher added successfully!');
      setTimeout(() => { onCreated(); handleClose(); }, 1500);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    }
    setLoading(false);
  }

  const showPoints = form.access_type !== 'campaign_reward';
  const isPercentage = form.reward_type === 'percentage_discount';

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={editTarget ? 'Edit partner voucher' : 'Add partner voucher'}
      subtitle={`Step ${step} of 3 — ${STEP_LABELS[step - 1]}`}
      footer={
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button onClick={() => setStep((step - 1) as Step)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              ← Back
            </button>
          )}
          <button onClick={handleNext} disabled={loading}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 ml-auto transition-colors">
            {loading ? 'Saving...' : step === 3 ? (editTarget ? 'Update Partner Voucher' : 'Add Partner Voucher') : 'Next →'}
          </button>
        </div>
      }
    >
      {/* Progress bar */}
      <div className="flex gap-1.5 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-1 rounded-full transition-colors
            ${s <= step ? 'bg-gray-900' : 'bg-gray-200'}`} />
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      {/* Step 1 — Partner details */}
      {step === 1 && (
        <div className="space-y-4">
          <Field label="Select existing partner (optional)">
            <PartnerPickerField
              value={partnerId}
              clientId={clientId}
              onChange={pid => setPartnerId(pid)}
            />
            <p className="text-[11px] text-gray-400 mt-1">Leave blank to create ad-hoc — or pick from your partner list to link the voucher to a known partner.</p>
          </Field>

          <Field label="Offer title *">
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Flat ₹100 off at CafeZ, 20% off Nike footwear"
              className="input-base" />
          </Field>

          <Field label="Description">
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Brief description of the offer shown to members..."
              className="input-base resize-none" />
          </Field>

          <Field label="Category">
            <select value={form.offer_category} onChange={e => set('offer_category', e.target.value)} className="input-base">
              {OFFER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          {/* Reward type + discount fields */}
          <Field label="Reward type">
            <div className="space-y-2">
              {REWARD_TYPES.map(rt => (
                <label key={rt.value} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <input type="radio" name="reward_type" value={rt.value}
                    checked={form.reward_type === rt.value}
                    onChange={() => set('reward_type', rt.value)}
                    className="accent-gray-900 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{rt.label}</div>
                    <div className="text-xs text-gray-500">{rt.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={isPercentage ? 'Discount %' : 'Discount value (₹)'}>
              <input type="number" min={0} value={form.discount_value}
                onChange={e => set('discount_value', e.target.value)}
                placeholder={isPercentage ? 'e.g. 20' : 'e.g. 100'}
                className="input-base" />
            </Field>
            {isPercentage && (
              <Field label="Max discount cap (₹)">
                <input type="number" min={0} value={form.max_discount_value}
                  onChange={e => set('max_discount_value', e.target.value)}
                  placeholder="e.g. 500"
                  className="input-base" />
              </Field>
            )}
            <Field label="Min purchase amount (₹)">
              <input type="number" min={0} value={form.min_purchase_amount}
                onChange={e => set('min_purchase_amount', e.target.value)}
                placeholder="e.g. 299 (0 = no min)"
                className="input-base" />
            </Field>
          </div>

          <Field label="Partner logo image" hint="Recommended: 400×400 px square, PNG or WebP, transparent background">
            <OfferImageUpload
              value={form.image_url}
              onChange={url => set('image_url', url)}
              clientId={clientId}
              icon="🏷️"
              uploadLabel="Click or drag to upload partner logo"
              dimensionHint="400×400 px · PNG or WebP · max 2 MB"
              folder="offer-images"
            />
          </Field>

          <Field label="Reward banner (optional)" hint="Wide promotional banner shown in redemption screens · 1200×400 px recommended">
            <OfferImageUpload
              value={form.banner_url}
              onChange={url => set('banner_url', url)}
              clientId={clientId}
              icon="🎨"
              uploadLabel="Click or drag to upload reward banner"
              dimensionHint="1200×400 px · PNG, JPG, WebP · max 4 MB"
              previewClass="h-24 w-full max-w-sm"
              folder="offer-banners"
            />
          </Field>

          <Field label="Steps to redeem">
            <textarea value={form.steps_to_redeem} onChange={e => set('steps_to_redeem', e.target.value)}
              rows={3} placeholder="1) Visit store 2) Add item 3) Apply voucher..."
              className="input-base resize-none" />
          </Field>
          <Field label="Redemption URL">
            <input value={form.redemption_link} onChange={e => set('redemption_link', e.target.value)}
              placeholder="https://partner.example.com/redeem"
              className="input-base" />
          </Field>
          <Field label="Terms & conditions">
            <textarea value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)}
              rows={3} placeholder="Applicable terms, validity info, restrictions..."
              className="input-base resize-none" />
          </Field>
        </div>
      )}

      {/* Step 2 — Code source */}
      {step === 2 && (
        <div className="space-y-4">
          <Field label="How are codes provided?">
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <input type="radio" name="coupon_type" value="unique"
                  checked={form.coupon_type === 'unique'}
                  onChange={() => set('coupon_type', 'unique')}
                  className="accent-gray-900 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-800">CSV upload — unique codes</div>
                  <div className="text-xs text-gray-500">Each member gets a different one-time code from your CSV file</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <input type="radio" name="coupon_type" value="generic"
                  checked={form.coupon_type === 'generic'}
                  onChange={() => set('coupon_type', 'generic')}
                  className="accent-gray-900 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-800">Manual code — fixed / shared code</div>
                  <div className="text-xs text-gray-500">All members receive the same code (e.g. PARTNER20)</div>
                </div>
              </label>
            </div>
          </Field>

          {form.coupon_type === 'unique' ? (
            <Field label="Upload codes CSV">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors">
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileRead} className="hidden" />
                {parsedCodes.length > 0 ? (
                  <div>
                    <div className="text-2xl font-semibold text-gray-900 mb-1">{parsedCodes.length}</div>
                    <div className="text-sm text-green-600 font-medium mb-3">codes ready to upload</div>
                    <div className="text-xs text-gray-400 mb-3 max-h-24 overflow-y-auto font-mono">
                      {parsedCodes.slice(0, 5).join(', ')}{parsedCodes.length > 5 ? ` ... +${parsedCodes.length - 5} more` : ''}
                    </div>
                    <button onClick={() => setParsedCodes([])}
                      className="text-xs text-red-500 hover:text-red-700 mr-3">
                      Clear
                    </button>
                    <button onClick={() => fileRef.current?.click()}
                      className="text-xs text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                      Replace file
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="text-2xl mb-2">📄</div>
                    <p className="text-sm text-gray-500 mb-3">
                      One code per line or CSV first column. Accepted headers: <code>code</code>, <code>coupon_code</code>.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => fileRef.current?.click()}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Upload CSV or TXT
                      </button>
                      <button onClick={downloadSampleCsv}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Download sample CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Field>
          ) : (
            <Field label="Enter the fixed code *">
              <input value={form.generic_coupon_code} onChange={e => set('generic_coupon_code', e.target.value.toUpperCase())}
                placeholder="e.g. PARTNER20"
                className="input-base font-mono" />
              <p className="text-xs text-gray-400 mt-1">All members will receive the same code</p>
            </Field>
          )}

          <Field label="Expiry date">
            <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)}
              className="input-base" />
          </Field>
        </div>
      )}

      {/* Step 3 — Distribution config */}
      {step === 3 && (
        <div className="space-y-4">
          <Field label="How can members get this?">
            <div className="space-y-2">
              {[
                { value: 'points_redemption', label: 'By redeeming loyalty points' },
                { value: 'campaign_reward',   label: 'Via campaigns only (free, no points)' },
                { value: 'both',             label: 'Both — points or free via campaign' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <input type="radio" name="access_type" value={opt.value}
                    checked={form.access_type === opt.value}
                    onChange={() => set('access_type', opt.value as AccessType)}
                    className="accent-gray-900" />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </Field>

          {showPoints && (
            <Field label="Points cost for your members *">
              <div className="flex items-center gap-3">
                <input type="number" min={1} value={form.points_cost}
                  onChange={e => set('points_cost', e.target.value)}
                  className="input-base w-28" />
                <span className="text-xs text-gray-500">points from your loyalty program</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                You set this — only your members are charged these points.
              </p>
            </Field>
          )}

          <Field label="Max claims per member">
            <input type="number" min={1} value={form.max_per_member}
              onChange={e => set('max_per_member', e.target.value)}
              className="input-base w-24" />
          </Field>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</p>
            <div className="text-sm text-gray-700 space-y-1">
              <div><span className="text-gray-500">Title:</span> {form.title}</div>
              <div><span className="text-gray-500">Category:</span> {OFFER_CATEGORIES.find(c => c.value === form.offer_category)?.label ?? form.offer_category}</div>
              <div><span className="text-gray-500">Reward type:</span> {REWARD_TYPES.find(r => r.value === form.reward_type)?.label ?? form.reward_type}
                {form.discount_value ? ` · ${isPercentage ? form.discount_value + '%' : '₹' + form.discount_value}` : ''}
                {isPercentage && form.max_discount_value ? ` (max ₹${form.max_discount_value})` : ''}
                {form.min_purchase_amount ? ` · min ₹${form.min_purchase_amount}` : ''}
              </div>
              {form.redemption_link && <div><span className="text-gray-500">Redemption URL:</span> {form.redemption_link}</div>}
              <div><span className="text-gray-500">Codes:</span>{' '}
                {form.coupon_type === 'generic'
                  ? `Fixed code (${form.generic_coupon_code || '—'})`
                  : `${parsedCodes.length} unique codes (CSV)`}
              </div>
              <div><span className="text-gray-500">Access:</span>{' '}
                {form.access_type === 'points_redemption' ? `${form.points_cost || 'Not set'} pts to redeem`
                  : form.access_type === 'campaign_reward' ? 'Campaign only (free)'
                  : `${form.points_cost || 'Not set'} pts or free via campaign`}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-base{width:100%;padding:8px 12px;font-size:13px;border:1px solid #d1d5db;border-radius:8px;outline:none;background:white;color:#111;font-family:inherit}.input-base:focus{border-color:#6b7280;box-shadow:0 0 0 2px rgba(0,0,0,0.08)}`}</style>
    </Drawer>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function OfferImageUpload({
  value, onChange, clientId,
  icon = '🖼️',
  uploadLabel = 'Click or drag to upload',
  dimensionHint = 'PNG, JPG, WebP · max 2 MB',
  previewClass = 'h-20 w-auto',
  folder = 'offer-images',
}: {
  value: string;
  onChange: (url: string) => void;
  clientId: string;
  icon?: string;
  uploadLabel?: string;
  dimensionHint?: string;
  previewClass?: string;
  folder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(!value);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${folder}/${clientId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('client-assets').upload(path, file, { upsert: true, contentType: file.type });
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
      {value && (
        <div className="relative inline-block">
          <img src={value} alt="preview" className={`${previewClass} rounded-xl border border-gray-200 object-cover`}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <button type="button" onClick={() => { onChange(''); setUrlMode(true); }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">✕</button>
        </div>
      )}
      {!value && (
        <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}>
          {uploading ? <div className="text-xs text-gray-500">Uploading…</div> : (
            <>
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-xs font-medium text-gray-600">{uploadLabel}</div>
              <div className="text-xs text-gray-400 mt-0.5">{dimensionHint}</div>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setUrlMode(v => !v)} className="text-xs text-blue-600 hover:underline">
          {urlMode ? 'Hide URL field' : 'Or paste image URL'}
        </button>
      </div>
      {urlMode && (
        <input type="url" value={value} onChange={e => onChange(e.target.value)}
          placeholder="https://example.com/image.png" className="input-base text-xs" />
      )}
    </div>
  );
}
