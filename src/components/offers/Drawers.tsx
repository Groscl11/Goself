import React, { useEffect, useRef } from 'react';

// ─── Base Drawer ─────────────────────────────────────────────────────────────
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, width = 'max-w-lg', children, footer }: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel — slides in from right */}
      <div className={`relative ml-auto h-full ${width} w-full bg-white shadow-xl flex flex-col`}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Adopt Offer Modal (inline confirm, not full drawer) ─────────────────────
interface AdoptModalProps {
  open: boolean;
  onClose: () => void;
  offer: { id: string; title: string; issuer_name?: string } | null;
  onConfirm: (config: { access_type: string; points_cost: number; max_per_member: number }) => void;
  loading?: boolean;
  error?: string;
}

export function AdoptModal({ open, onClose, offer, onConfirm, loading, error }: AdoptModalProps) {
  const [accessType, setAccessType] = React.useState<string>('points_redemption');
  const [pointsCost, setPointsCost] = React.useState<number>(500);
  const [maxPerMember, setMaxPerMember] = React.useState<number>(1);

  if (!open || !offer) return null;

  const showPoints = accessType === 'points_redemption' || accessType === 'both';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 rounded-full mb-5">
          <div className="h-1 bg-gray-900 rounded-full" style={{ width: '60%' }} />
        </div>

        <h2 className="text-base font-semibold text-gray-900 mb-1">Add to your store</h2>
        <p className="text-xs text-gray-500 mb-5">
          {offer.title}{offer.issuer_name ? ` · By ${offer.issuer_name}` : ''}
        </p>

        {/* Access type */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            How can members get this?
          </label>
          <div className="space-y-2">
            {[
              { value: 'points_redemption', label: 'By redeeming loyalty points' },
              { value: 'campaign_reward',   label: 'Via campaigns only (free, no points)' },
              { value: 'both',             label: 'Both points and campaigns' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="access_type"
                  value={opt.value}
                  checked={accessType === opt.value}
                  onChange={() => setAccessType(opt.value)}
                  className="accent-gray-900"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Points cost */}
        {showPoints && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Points cost for your members
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={pointsCost}
                onChange={e => setPointsCost(Number(e.target.value))}
                className="w-28 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
              <span className="text-xs text-gray-500">points from your loyalty program</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              You set this — the offer issuer does not define the points cost.
            </p>
          </div>
        )}

        {/* Max per member */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Max per member
          </label>
          <input
            type="number"
            min={1}
            value={maxPerMember}
            onChange={e => setMaxPerMember(Number(e.target.value))}
            className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ access_type: accessType, points_cost: pointsCost, max_per_member: maxPerMember })}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
          >
            {loading ? 'Adding...' : 'Add to My Store'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Manage Codes Drawer ──────────────────────────────────────────────────────
import { supabase } from '../../lib/supabase';
import { uploadOfferCodesDirect } from '../../lib/offerCodes';
import { OfferCode } from '../../types/offers';

interface ManageCodesDrawerProps {
  open: boolean;
  onClose: () => void;
  offer: { id: string; title: string; coupon_type: string; available_codes: number; total_codes_uploaded: number } | null;
  clientId: string;
  shopDomain: string;
}

export function ManageCodesDrawer({ open, onClose, offer, clientId, shopDomain }: ManageCodesDrawerProps) {
  const [codes, setCodes] = React.useState<OfferCode[]>([]);
  const [stats, setStats] = React.useState({ total: 0, available: 0, assigned: 0, redeemed: 0 });
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<string>('all');
  const [uploading, setUploading] = React.useState(false);
  const [uploadResult, setUploadResult] = React.useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    link.download = 'offer-codes-sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!open || !offer) return;
    fetchCodes();
  }, [open, offer, filter]);

  async function fetchCodes() {
    if (!offer) return;
    setLoading(true);
    let q = supabase
      .from('offer_codes')
      .select('*')
      .eq('offer_id', offer.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setCodes(data ?? []);

    const [totalRes, availableRes, assignedRes, redeemedRes] = await Promise.all([
      supabase.from('offer_codes').select('id', { count: 'exact', head: true }).eq('offer_id', offer.id),
      supabase.from('offer_codes').select('id', { count: 'exact', head: true }).eq('offer_id', offer.id).eq('status', 'available'),
      supabase.from('offer_codes').select('id', { count: 'exact', head: true }).eq('offer_id', offer.id).eq('status', 'assigned'),
      supabase.from('offer_codes').select('id', { count: 'exact', head: true }).eq('offer_id', offer.id).eq('status', 'redeemed'),
    ]);

    setStats({
      total: totalRes.count ?? 0,
      available: availableRes.count ?? 0,
      assigned: assignedRes.count ?? 0,
      redeemed: redeemedRes.count ?? 0,
    });
    setLoading(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !offer) return;
    setUploading(true);
    setUploadResult(null);
    const text = await file.text();
    const codes = parseCodesFromCsvText(text);
    if (codes.length === 0) { setUploadResult('No codes found in file'); setUploading(false); return; }
    if (codes.length > 1000) { setUploadResult('Max 1000 codes per upload'); setUploading(false); return; }

    try {
      const result = await uploadOfferCodesDirect({
        supabase,
        offerId: offer.id,
        codes,
      });

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadResult(`✓ ${result.inserted} codes uploaded. ${result.skipped_duplicates} duplicates skipped.`);
      fetchCodes();
    } catch (err: any) {
      setUploadResult(`Error: ${err.message}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const statusColors: Record<string, string> = {
    available: 'bg-green-50 text-green-700',
    assigned:  'bg-blue-50 text-blue-700',
    redeemed:  'bg-gray-100 text-gray-600',
    expired:   'bg-red-50 text-red-600',
    revoked:   'bg-red-50 text-red-600',
  };

  if (!open || !offer) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Code pool — ${offer.title}`}
      subtitle={`${stats.available} available · ${stats.total} total`}
      width="max-w-2xl"
      footer={
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
          >
            {uploading ? 'Uploading...' : 'Upload More Codes'}
          </button>
          <button
            onClick={downloadSampleCsv}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Download sample CSV
          </button>
          {uploadResult && (
            <span className={`text-xs ${uploadResult.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
              {uploadResult}
            </span>
          )}
        </div>
      }
    >
      <div className="mb-3 text-xs text-gray-500">
        Accepted file formats: <code>.csv</code>, <code>.txt</code>. One code per line or first CSV column. Headers supported: <code>code</code>, <code>coupon_code</code>.
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total',     value: stats.total },
          { label: 'Available', value: stats.available },
          { label: 'Assigned',  value: stats.assigned },
          { label: 'Redeemed',  value: stats.redeemed },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-lg font-semibold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {['all', 'available', 'assigned', 'redeemed', 'expired'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize
              ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Code table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : codes.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">No codes found</p>
      ) : (
        <div className="space-y-1">
          {codes.map(code => (
            <div key={code.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
              <code className="text-xs font-mono text-gray-700 flex-1 truncate">
                {code.code ?? '(generic)'}
              </code>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[code.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {code.status}
              </span>
              {code.expires_at && (
                <span className="text-xs text-gray-400">
                  Exp {new Date(code.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
