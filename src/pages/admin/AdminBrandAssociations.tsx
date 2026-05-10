/**
 * AdminBrandAssociations
 *
 * Lists all client brand-claim submissions. Admins can:
 *  - See pending / approved / rejected claims
 *  - Approve a claim: optionally link to an existing brand or create a new one
 *  - Reject a claim with a reason
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Award, Search, CheckCircle, XCircle, Clock, Building2,
  ExternalLink, ChevronDown, X, Check, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Association {
  id: string;
  client_id: string;
  brand_id: string | null;
  submitted_name: string;
  submitted_url: string | null;
  proof_notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  client: { name: string; logo_url: string | null } | null;
  brand: { name: string; logo_url: string | null } | null;
}

interface BrandOption {
  id: string;
  name: string;
  logo_url: string | null;
  status: string;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

// ─── Component ─────────────────────────────────────────────────────────────────

export function AdminBrandAssociations() {
  const [rows, setRows]             = useState<Association[]>([]);
  const [brands, setBrands]         = useState<BrandOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Review drawer state
  const [reviewing, setReviewing]   = useState<Association | null>(null);
  const [action, setAction]         = useState<'approve' | 'reject' | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [brandSearch, setBrandSearch]         = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving]         = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [assocRes, brandsRes] = await Promise.all([
      supabase
        .from('client_brand_associations')
        .select(`
          id, client_id, brand_id, submitted_name, submitted_url,
          proof_notes, status, rejection_reason, reviewed_at, created_at,
          client:clients(name, logo_url),
          brand:brands(name, logo_url)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('brands')
        .select('id, name, logo_url, status')
        .in('status', ['approved', 'pending'])
        .order('name'),
    ]);
    setRows((assocRes.data ?? []) as Association[]);
    setBrands((brandsRes.data ?? []) as BrandOption[]);
    setLoading(false);
  };

  // Counts for stat cards
  const counts = useMemo(() => ({
    all:      rows.length,
    pending:  rows.filter(r => r.status === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    rejected: rows.filter(r => r.status === 'rejected').length,
  }), [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    const q = search.toLowerCase();
    if (q) {
      return (
        r.submitted_name.toLowerCase().includes(q) ||
        (r.client?.name ?? '').toLowerCase().includes(q) ||
        (r.submitted_url ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [rows, filterStatus, search]);

  const filteredBrands = useMemo(() =>
    brands.filter(b => !brandSearch || b.name.toLowerCase().includes(brandSearch.toLowerCase())),
    [brands, brandSearch]
  );

  function openReview(row: Association, act: 'approve' | 'reject') {
    setReviewing(row);
    setAction(act);
    setSelectedBrandId(row.brand_id ?? '');
    // Pre-fill search with trading name so admin immediately sees the matching brand
    setBrandSearch(row.client?.name ?? '');
    setRejectionReason('');
    setDrawerError(null);
  }

  function closeReview() {
    setReviewing(null);
    setAction(null);
    setDrawerError(null);
  }

  async function handleApprove() {
    if (!reviewing) return;
    setDrawerError(null);

    let brandId = selectedBrandId || null;

    // If no existing brand chosen, create a new brand.
    // brands.name = trading/display name (clients.name e.g. "Zouk")
    // The legal entity name (e.g. "Seaturtle Private Limited") is preserved in
    // client_brand_associations.submitted_name as the verification audit trail.
    if (!brandId) {
      const tradingName = reviewing.client?.name ?? reviewing.submitted_name;
      const { data: newBrand, error: bErr } = await supabase
        .from('brands')
        .insert({
          name:        tradingName,
          website_url: reviewing.submitted_url || null,
          description: reviewing.submitted_name !== tradingName
            ? `Legal entity: ${reviewing.submitted_name}`
            : null,
          status:      'approved',
        })
        .select('id')
        .single();
      if (bErr) { setDrawerError(bErr.message); return; }
      brandId = newBrand!.id;
      setBrands(prev => [...prev, { id: brandId!, name: tradingName, logo_url: null, status: 'approved' }]);
    } else {
      // Ensure chosen brand is approved
      await supabase.from('brands').update({ status: 'approved' }).eq('id', brandId);
    }

    setSaving(true);
    const { error } = await supabase
      .from('client_brand_associations')
      .update({
        status: 'approved',
        brand_id: brandId,
        rejection_reason: null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewing.id);

    if (!error) {
      // Update clients.brand_id for quick reference
      await supabase.from('clients').update({ brand_id: brandId }).eq('id', reviewing.client_id);
    }

    setSaving(false);
    if (error) { setDrawerError(error.message); return; }
    closeReview();
    fetchData();
  }

  async function handleReject() {
    if (!reviewing) return;
    if (!rejectionReason.trim()) { setDrawerError('Please provide a rejection reason'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('client_brand_associations')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewing.id);
    setSaving(false);
    if (error) { setDrawerError(error.message); return; }
    closeReview();
    fetchData();
  }

  const statusBadge = (s: string) => ({
    approved: 'bg-green-100 text-green-700',
    rejected:  'bg-red-100 text-red-700',
    pending:   'bg-yellow-100 text-yellow-700',
  } as Record<string, string>)[s] ?? 'bg-gray-100 text-gray-600';

  const statusIcon = (s: string) => {
    if (s === 'approved') return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    if (s === 'rejected')  return <XCircle    className="w-3.5 h-3.5 text-red-500" />;
    return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
  };

  const statCards: { label: string; count: number; value: FilterStatus; color: string; bg: string }[] = [
    { label: 'Total',    count: counts.all,      value: 'all',      color: 'text-gray-800',  bg: 'bg-gray-50'   },
    { label: 'Pending',  count: counts.pending,  value: 'pending',  color: 'text-yellow-700', bg: 'bg-yellow-50' },
    { label: 'Approved', count: counts.approved, value: 'approved', color: 'text-green-700',  bg: 'bg-green-50'  },
    { label: 'Rejected', count: counts.rejected, value: 'rejected', color: 'text-red-700',    bg: 'bg-red-50'    },
  ];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Brand Claims">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Brand Claims</h1>
            <p className="text-gray-600 mt-1">Review and approve client brand association requests</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`${s.bg} rounded-xl p-4 text-left transition-all border-2 ${filterStatus === s.value ? 'border-blue-400 shadow-sm' : 'border-transparent hover:border-gray-200'}`}
            >
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>

        <Card>
          {/* Search */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by client or brand name…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-60 text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-60 gap-3">
              <Award className="w-12 h-12 text-gray-200" />
              <p className="text-sm text-gray-400">No brand claims found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Trading Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Legal Entity</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Website</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Proof Notes</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Linked Brand</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Submitted</th>
                    <th className="px-4 py-3 w-40"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.client?.logo_url ? (
                            <img src={row.client.logo_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                          )}
                          <span className="font-medium text-gray-900 truncate max-w-[140px]">{row.client?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.submitted_name}</td>
                      <td className="px-4 py-3">
                        {row.submitted_url ? (
                          <a href={row.submitted_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline text-xs max-w-[160px] truncate">
                            {row.submitted_url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px]">
                        {row.proof_notes ? (
                          <span className="line-clamp-2">{row.proof_notes}</span>
                        ) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge(row.status)}`}>
                          {statusIcon(row.status)} {row.status}
                        </span>
                        {row.status === 'rejected' && row.rejection_reason && (
                          <p className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate" title={row.rejection_reason}>
                            {row.rejection_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.brand ? (
                          <div className="flex items-center gap-1.5">
                            {row.brand.logo_url && <img src={row.brand.logo_url} alt="" className="w-5 h-5 rounded object-cover" />}
                            <span className="text-xs text-gray-700 font-medium">{row.brand.name}</span>
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        {row.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => openReview(row, 'approve')}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => openReview(row, 'reject')}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        )}
                        {row.status === 'approved' && (
                          <button
                            onClick={() => openReview(row, 'reject')}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors ml-auto"
                          >
                            <X className="w-3 h-3" /> Revoke
                          </button>
                        )}
                        {row.status === 'rejected' && (
                          <button
                            onClick={() => openReview(row, 'approve')}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors ml-auto"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Review Drawer ──────────────────────────────────────────────────────── */}
      {reviewing && action && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {action === 'approve'
                  ? <CheckCircle className="w-5 h-5 text-green-600" />
                  : <XCircle className="w-5 h-5 text-red-500" />}
                <h2 className="font-semibold text-gray-900">
                  {action === 'approve' ? 'Approve Brand Claim' : 'Reject Brand Claim'}
                </h2>
              </div>
              <button onClick={closeReview} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Submission details */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Trading / Brand name</span>
                  <span className="font-semibold text-gray-900">{reviewing.client?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Legal entity name</span>
                  <span className="font-medium text-gray-900">{reviewing.submitted_name}</span>
                </div>
                {reviewing.submitted_url && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 flex-shrink-0">Website</span>
                    <a href={reviewing.submitted_url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-right truncate flex items-center gap-0.5">
                      {reviewing.submitted_url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
                {reviewing.proof_notes && (
                  <div>
                    <span className="text-gray-500">Proof notes</span>
                    <p className="text-gray-800 mt-1 text-xs whitespace-pre-wrap">{reviewing.proof_notes}</p>
                  </div>
                )}
              </div>

              {drawerError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {drawerError}
                </div>
              )}

              {/* APPROVE flow */}
              {action === 'approve' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Link to existing brand <span className="text-gray-400 font-normal">(optional — leave blank to create new)</span>
                    </label>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          value={brandSearch}
                          onChange={e => setBrandSearch(e.target.value)}
                          placeholder="Search brands…"
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400"
                        />
                      </div>
                      <div className="max-h-44 overflow-y-auto">
                        {/* "None" option — create new */}
                        <button
                          type="button"
                          onClick={() => setSelectedBrandId('')}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${!selectedBrandId ? 'bg-blue-50' : ''}`}
                        >
                          <div className="w-6 h-6 rounded border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-gray-400">+</span>
                          </div>
                          <span className="text-gray-500 italic">Create new brand from submission</span>
                          {!selectedBrandId && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
                        </button>
                        {filteredBrands.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBrandId(b.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${selectedBrandId === b.id ? 'bg-blue-50' : ''}`}
                          >
                            {b.logo_url ? (
                              <img src={b.logo_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-gray-500">{b.name[0]?.toUpperCase()}</span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">{b.name}</p>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${b.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                              {b.status}
                            </span>
                            {selectedBrandId === b.id && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    {!selectedBrandId && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        A new brand named "<strong>{reviewing.submitted_name}</strong>" will be created and set to approved.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={closeReview} className="flex-1">Cancel</Button>
                    <Button onClick={handleApprove} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      <Check className="w-4 h-4 mr-1.5" />
                      {saving ? 'Approving…' : 'Approve'}
                    </Button>
                  </div>
                </div>
              )}

              {/* REJECT flow */}
              {action === 'reject' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Rejection reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none"
                      placeholder="e.g. Could not verify brand ownership — please provide GST or incorporation certificate"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={closeReview} className="flex-1">Cancel</Button>
                    <Button
                      onClick={handleReject}
                      disabled={saving}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      {saving ? 'Rejecting…' : 'Reject Claim'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
