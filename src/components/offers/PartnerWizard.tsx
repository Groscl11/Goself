import React, { useEffect, useRef, useState } from 'react';
import { Drawer } from './Drawers';
import { supabase } from '../../lib/supabase';
import { uploadOfferCodesDirect } from '../../lib/offerCodes';
import { AccessType, PARTNER_CATEGORIES } from '../../types/offers';

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

export function PartnerWizard({ open, onClose, clientId, shopDomain, editTarget, onCreated }: PartnerWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    // Step 1
    partner_name: '',
    category: 'Food & Drink',
    steps_to_redeem: '',
    redemption_link: '',
    terms_conditions: '',
    // Step 2
    coupon_type: 'unique',
    generic_coupon_code: '',
    valid_until: '',
    // Step 3
    points_cost: '500',
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
    setForm({
      partner_name: '', category: 'Food & Drink', terms_conditions: '',
      steps_to_redeem: '', redemption_link: '',
      coupon_type: 'unique', generic_coupon_code: '', valid_until: '',
      points_cost: '500', max_per_member: '1', access_type: 'points_redemption',
    });
  }

  useEffect(() => {
    if (!open) return;
    if (!editTarget?.offer) return;
    const offer = editTarget.offer;
    const dist = editTarget.distribution;
    setForm({
      partner_name: (offer.title ?? '').split(' — ')[0] || '',
      category: offer.tags?.[0] || 'Food & Drink',
      steps_to_redeem: offer.steps_to_redeem ?? offer.description ?? '',
      redemption_link: offer.redemption_link ?? '',
      terms_conditions: offer.terms_conditions ?? '',
      coupon_type: offer.coupon_type ?? 'unique',
      generic_coupon_code: offer.generic_coupon_code ?? '',
      valid_until: offer.valid_until ? String(offer.valid_until).slice(0, 10) : '',
      points_cost: dist?.points_cost != null ? String(dist.points_cost) : '500',
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
      if (!form.partner_name.trim()) { setError('Partner name is required'); return false; }
    }
    if (step === 2) {
      if (!editTarget && form.coupon_type === 'unique' && parsedCodes.length === 0) {
        setError('Please upload or paste at least one code'); return false;
      }
      if (form.coupon_type === 'generic' && !form.generic_coupon_code.trim()) {
        setError('Generic code is required'); return false;
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

      const rewardPayload = {
        title: `${form.partner_name} — ${form.category}`,
        description: form.steps_to_redeem || null,
        redemption_link: form.redemption_link || null,
        terms_conditions: form.terms_conditions || null,
        offer_type: 'partner_voucher',
        code_source: 'csv_uploaded',
        coupon_type: form.coupon_type,
        generic_coupon_code: form.coupon_type === 'generic' ? form.generic_coupon_code.trim() : null,
        tracking_type: 'manual',
        reward_type: 'other',
        currency: 'INR',
        is_marketplace_listed: false,
        is_active: true,
        status: 'active',
        owner_client_id: clientId,
        client_id: clientId,
        valid_until: form.valid_until || null,
        tags: [form.category],
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

      // 2. Upload unique codes
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

      // 3. Insert offer_distributions
      if (offerId) {
        if (isEdit) {
          const { error: distUpdateErr } = await (supabase as any)
            .from('offer_distributions')
            .update({
              access_type: form.access_type,
              points_cost: showPoints ? Number(form.points_cost) : null,
              max_per_member: Number(form.max_per_member) || 1,
            })
            .eq('offer_id', offerId)
            .eq('distributing_client_id', clientId)
            .eq('is_active', true);
          if (distUpdateErr) throw distUpdateErr;
        } else {
          await (supabase as any).from('offer_distributions').insert({
            offer_id: offerId,
            distributing_client_id: clientId,
            access_type: form.access_type,
            points_cost: showPoints ? Number(form.points_cost) : null,
            max_per_member: Number(form.max_per_member) || 1,
            is_active: true,
          });
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

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Add partner voucher"
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
            {loading ? 'Saving...' : step === 3 ? 'Add Partner Voucher' : 'Next →'}
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
          <Field label="Partner / brand name *">
            <input value={form.partner_name} onChange={e => set('partner_name', e.target.value)}
              placeholder="e.g. CafeZ, Nike, BookMyShow"
              className="input-base" />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={e => set('category', e.target.value)} className="input-base">
              {PARTNER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Steps to Redeem">
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

      {/* Step 2 — Upload codes */}
      {step === 2 && (
        <div className="space-y-4">
          <Field label="Code type">
            <div className="flex gap-4">
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
                    <button onClick={() => { setParsedCodes([]); }}
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
            <Field label="Generic code *">
              <input value={form.generic_coupon_code} onChange={e => set('generic_coupon_code', e.target.value.toUpperCase())}
                placeholder="e.g. CAFEZ20"
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
              <div><span className="text-gray-500">Partner:</span> {form.partner_name}</div>
              <div><span className="text-gray-500">Category:</span> {form.category}</div>
              {form.redemption_link && <div><span className="text-gray-500">Redemption URL:</span> {form.redemption_link}</div>}
              <div><span className="text-gray-500">Codes:</span>{' '}
                {form.coupon_type === 'generic'
                  ? `Generic (${form.generic_coupon_code || '—'})`
                  : `${parsedCodes.length} unique codes`}
              </div>
              <div><span className="text-gray-500">Access:</span>{' '}
                {form.access_type === 'points_redemption' ? `${form.points_cost} pts to redeem`
                  : form.access_type === 'campaign_reward' ? 'Campaign only (free)'
                  : `${form.points_cost} pts or free via campaign`}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-base{width:100%;padding:8px 12px;font-size:13px;border:1px solid #d1d5db;border-radius:8px;outline:none;background:white;color:#111;font-family:inherit}.input-base:focus{border-color:#6b7280;box-shadow:0 0 0 2px rgba(0,0,0,0.08)}`}</style>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}
