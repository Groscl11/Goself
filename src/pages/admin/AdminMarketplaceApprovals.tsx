/**
 * AdminMarketplaceApprovals
 *
 * Two sub-tabs:
 *  1. New Submissions — approve/reject marketplace offer submissions
 *  2. Edit Requests   — approve/reject edit requests on already-approved offers
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, Search, CheckCircle, XCircle, Clock,
  Building2, X, Check, AlertCircle, ChevronRight, Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Offer, RewardsEditRequest } from '../../types/offers';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';
type SubTab = 'submissions' | 'edits';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusBadgeCls(s: string) {
  return ({
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    pending:  'bg-yellow-100 text-yellow-700',
  } as Record<string, string>)[s] ?? 'bg-gray-100 text-gray-600';
}

function StatusIcon({ s }: { s: string }) {
  if (s === 'approved') return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
  if (s === 'rejected')  return <XCircle    className="w-3.5 h-3.5 text-red-500" />;
  return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
}

function fmt(dt: string | null | undefined) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── FieldDiff — side-by-side comparison ─────────────────────────────────────

function FieldDiff({ label, current, proposed }: { label: string; current: any; proposed: any }) {
  if (proposed === undefined) return null;
  const curStr  = current  == null ? '—' : String(current);
  const propStr = proposed == null ? '—' : String(proposed);
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-red-800 whitespace-pre-wrap break-words">
          <p className="text-[10px] text-red-400 font-medium mb-1">CURRENT</p>
          {curStr}
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-green-800 whitespace-pre-wrap break-words">
          <p className="text-[10px] text-green-500 font-medium mb-1">PROPOSED</p>
          {propStr}
        </div>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AdminMarketplaceApprovals() {
  const [subTab, setSubTab] = useState<SubTab>('submissions');

  // ── Submissions state ────────────────────────────────────────────────────────
  const [offers, setOffers]           = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [subSearch, setSubSearch]     = useState('');
  const [subFilter, setSubFilter]     = useState<FilterStatus>('pending');

  // Reviewing submission
  const [reviewOffer, setReviewOffer]   = useState<Offer | null>(null);
  const [offerAction, setOfferAction]   = useState<'approve' | 'reject' | null>(null);
  const [offerReason, setOfferReason]   = useState('');
  const [offerSaving, setOfferSaving]   = useState(false);
  const [offerError, setOfferError]     = useState<string | null>(null);

  // ── Edit requests state ───────────────────────────────────────────────────────
  const [editReqs, setEditReqs]         = useState<RewardsEditRequest[]>([]);
  const [editLoading, setEditLoading]   = useState(true);
  const [editSearch, setEditSearch]     = useState('');
  const [editFilter, setEditFilter]     = useState<FilterStatus>('pending');

  // Reviewing edit request
  const [reviewEdit, setReviewEdit]     = useState<RewardsEditRequest | null>(null);
  const [editAction, setEditAction]     = useState<'approve' | 'reject' | null>(null);
  const [editReason, setEditReason]     = useState('');
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);

  useEffect(() => { fetchOffers(); fetchEditRequests(); }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  async function fetchOffers() {
    setOffersLoading(true);
    const { data, error } = await supabase
      .from('rewards')
      .select(`
        id, reward_id, title, description, offer_type, offer_category,
        coupon_type, generic_coupon_code, reward_type, discount_value,
        redemption_link, terms_conditions, steps_to_redeem,
        available_codes, valid_until, status,
        marketplace_status, marketplace_rejection_reason, marketplace_submitted_at,
        owner_client:clients!owner_client_id(id, name, logo_url)
      `)
      .eq('offer_type', 'marketplace_offer')
      .order('marketplace_submitted_at', { ascending: false, nullsFirst: false });
    if (error) console.error('[AdminMarketplaceApprovals] fetchOffers error:', error);
    setOffers((data ?? []) as unknown as Offer[]);
    setOffersLoading(false);
  }

  async function fetchEditRequests() {
    setEditLoading(true);
    const { data, error } = await supabase
      .from('rewards_edit_requests')
      .select(`
        id, reward_id, requesting_client_id, proposed_changes,
        status, rejection_reason, reviewed_at, created_at, updated_at,
        reward:rewards(id, title, reward_id, description, terms_conditions, discount_value,
          generic_coupon_code, redemption_link, valid_until, steps_to_redeem),
        requesting_client:clients(name, logo_url)
      `)
      .order('created_at', { ascending: false });
    if (error) console.error('[AdminMarketplaceApprovals] fetchEditRequests error:', error);
    setEditReqs((data ?? []) as unknown as RewardsEditRequest[]);
    setEditLoading(false);
  }

  // ── Counts ───────────────────────────────────────────────────────────────────

  const offerCounts = useMemo(() => ({
    all:      offers.length,
    // null marketplace_status means not yet reviewed — treat as pending
    pending:  offers.filter(o => { const ms = (o as any).marketplace_status; return ms === 'pending' || ms == null; }).length,
    approved: offers.filter(o => (o as any).marketplace_status === 'approved').length,
    rejected: offers.filter(o => (o as any).marketplace_status === 'rejected').length,
  }), [offers]);

  const editCounts = useMemo(() => ({
    all:      editReqs.length,
    pending:  editReqs.filter(r => r.status === 'pending').length,
    approved: editReqs.filter(r => r.status === 'approved').length,
    rejected: editReqs.filter(r => r.status === 'rejected').length,
  }), [editReqs]);

  // ── Filtered lists ────────────────────────────────────────────────────────────

  const filteredOffers = useMemo(() => offers.filter(o => {
    const ms = (o as any).marketplace_status;
    // null marketplace_status = not yet reviewed, treat as pending
    const effectiveStatus = ms ?? 'pending';
    if (subFilter !== 'all' && effectiveStatus !== subFilter) return false;
    const q = subSearch.toLowerCase();
    if (q) {
      return (
        o.title.toLowerCase().includes(q) ||
        ((o as any).reward_id ?? '').toLowerCase().includes(q) ||
        ((o.owner_client as any)?.name ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [offers, subFilter, subSearch]);

  const filteredEdits = useMemo(() => editReqs.filter(r => {
    if (editFilter !== 'all' && r.status !== editFilter) return false;
    const q = editSearch.toLowerCase();
    if (q) {
      return (
        (r.reward?.title ?? '').toLowerCase().includes(q) ||
        (r.requesting_client?.name ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [editReqs, editFilter, editSearch]);

  // ── Approve / reject submission ───────────────────────────────────────────────

  async function handleApproveOffer() {
    if (!reviewOffer) return;
    setOfferSaving(true); setOfferError(null);
    const { error } = await supabase
      .from('rewards')
      .update({
        marketplace_status: 'approved',
        marketplace_rejection_reason: null,
        marketplace_reviewed_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', reviewOffer.id);
    setOfferSaving(false);
    if (error) { setOfferError(error.message); return; }
    closeOfferReview();
    fetchOffers();
  }

  async function handleRejectOffer() {
    if (!reviewOffer) return;
    if (!offerReason.trim()) { setOfferError('Please provide a rejection reason'); return; }
    setOfferSaving(true); setOfferError(null);
    const { error } = await supabase
      .from('rewards')
      .update({
        marketplace_status: 'rejected',
        marketplace_rejection_reason: offerReason.trim(),
        marketplace_reviewed_at: new Date().toISOString(),
        status: 'draft',
      })
      .eq('id', reviewOffer.id);
    setOfferSaving(false);
    if (error) { setOfferError(error.message); return; }
    closeOfferReview();
    fetchOffers();
  }

  function openOfferReview(offer: Offer, act: 'approve' | 'reject') {
    setReviewOffer(offer); setOfferAction(act);
    setOfferReason(''); setOfferError(null);
  }
  function closeOfferReview() { setReviewOffer(null); setOfferAction(null); }

  // ── Approve / reject edit request ────────────────────────────────────────────

  async function handleApproveEdit() {
    if (!reviewEdit) return;
    setEditSaving(true); setEditError(null);
    // Merge proposed_changes into the live rewards row
    const { error: rwErr } = await supabase
      .from('rewards')
      .update(reviewEdit.proposed_changes)
      .eq('id', reviewEdit.reward_id);
    if (rwErr) { setEditError(rwErr.message); setEditSaving(false); return; }
    // Mark request approved
    const { error: reqErr } = await supabase
      .from('rewards_edit_requests')
      .update({
        status: 'approved',
        rejection_reason: null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewEdit.id);
    setEditSaving(false);
    if (reqErr) { setEditError(reqErr.message); return; }
    closeEditReview();
    fetchEditRequests();
    fetchOffers(); // refresh offer list too since live row changed
  }

  async function handleRejectEdit() {
    if (!reviewEdit) return;
    if (!editReason.trim()) { setEditError('Please provide a rejection reason'); return; }
    setEditSaving(true); setEditError(null);
    const { error } = await supabase
      .from('rewards_edit_requests')
      .update({
        status: 'rejected',
        rejection_reason: editReason.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewEdit.id);
    setEditSaving(false);
    if (error) { setEditError(error.message); return; }
    closeEditReview();
    fetchEditRequests();
  }

  function openEditReview(req: RewardsEditRequest, act: 'approve' | 'reject') {
    setReviewEdit(req); setEditAction(act);
    setEditReason(''); setEditError(null);
  }
  function closeEditReview() { setReviewEdit(null); setEditAction(null); }

  // ── Stat cards ────────────────────────────────────────────────────────────────

  const statCards = (counts: typeof offerCounts, filter: FilterStatus, setFilter: (f: FilterStatus) => void) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {([
        { label: 'Total',    value: 'all',      count: counts.all,      color: 'text-gray-800',   bg: 'bg-gray-50'   },
        { label: 'Pending',  value: 'pending',  count: counts.pending,  color: 'text-yellow-700', bg: 'bg-yellow-50' },
        { label: 'Approved', value: 'approved', count: counts.approved, color: 'text-green-700',  bg: 'bg-green-50'  },
        { label: 'Rejected', value: 'rejected', count: counts.rejected, color: 'text-red-700',    bg: 'bg-red-50'    },
      ] as { label: string; value: FilterStatus; count: number; color: string; bg: string }[]).map(s => (
        <button key={s.value} onClick={() => setFilter(s.value)}
          className={`${s.bg} rounded-xl p-4 text-left border-2 transition-all ${filter === s.value ? 'border-blue-400 shadow-sm' : 'border-transparent hover:border-gray-200'}`}>
          <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
          <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
        </button>
      ))}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Marketplace Approvals">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve marketplace offer submissions and edit requests</p>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {([
            { id: 'submissions' as SubTab, label: 'New Submissions', badge: offerCounts.pending },
            { id: 'edits'       as SubTab, label: 'Edit Requests',   badge: editCounts.pending },
          ]).map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                ${subTab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
              {t.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── SUB-TAB 1: New Submissions ───────────────────────────────────── */}
        {subTab === 'submissions' && (
          <div>
            {statCards(offerCounts, subFilter, setSubFilter)}
            <Card>
              <div className="p-4 border-b border-gray-100">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input type="text" value={subSearch} onChange={e => setSubSearch(e.target.value)}
                    placeholder="Search by title, reward ID or client…"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>

              {offersLoading ? (
                <div className="flex items-center justify-center min-h-60 text-gray-400 text-sm">Loading…</div>
              ) : filteredOffers.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-60 gap-3">
                  <ShieldCheck className="w-12 h-12 text-gray-200" />
                  <p className="text-sm text-gray-400">No submissions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Reward ID</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Title</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Owner</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Submitted</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 w-48"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredOffers.map(offer => {
                        const ms = (offer as any).marketplace_status as string;
                        return (
                          <tr key={offer.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-gray-500">{(offer as any).reward_id || '—'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 max-w-[200px] truncate">{offer.title}</p>
                              {offer.description && (
                                <p className="text-xs text-gray-400 truncate max-w-[200px]">{offer.description}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {(offer.owner_client as any)?.logo_url ? (
                                  <img src={(offer.owner_client as any).logo_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-3 h-3 text-gray-400" />
                                  </div>
                                )}
                                <span className="text-sm text-gray-700 truncate max-w-[120px]">
                                  {(offer.owner_client as any)?.name ?? '—'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 capitalize">
                              {((offer as any).offer_category ?? '—').replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 capitalize">{offer.coupon_type}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {fmt((offer as any).marketplace_submitted_at)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeCls(ms)}`}>
                                <StatusIcon s={ms} /> {ms}
                              </span>
                              {ms === 'rejected' && (offer as any).marketplace_rejection_reason && (
                                <p className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate" title={(offer as any).marketplace_rejection_reason}>
                                  {(offer as any).marketplace_rejection_reason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2 justify-end">
                                {ms === 'pending' && (
                                  <>
                                    <button onClick={() => openOfferReview(offer, 'approve')}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">
                                      <Check className="w-3 h-3" /> Approve
                                    </button>
                                    <button onClick={() => openOfferReview(offer, 'reject')}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200">
                                      <X className="w-3 h-3" /> Reject
                                    </button>
                                  </>
                                )}
                                {ms === 'approved' && (
                                  <button onClick={() => openOfferReview(offer, 'reject')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200">
                                    <X className="w-3 h-3" /> Revoke
                                  </button>
                                )}
                                {ms === 'rejected' && (
                                  <button onClick={() => openOfferReview(offer, 'approve')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">
                                    <Check className="w-3 h-3" /> Approve
                                  </button>
                                )}
                                <button onClick={() => openOfferReview(offer, ms === 'pending' ? 'approve' : 'reject')}
                                  title="View details"
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200">
                                  <Eye className="w-3 h-3" />
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
            </Card>
          </div>
        )}

        {/* ── SUB-TAB 2: Edit Requests ─────────────────────────────────────── */}
        {subTab === 'edits' && (
          <div>
            {statCards(editCounts, editFilter, setEditFilter)}
            <Card>
              <div className="p-4 border-b border-gray-100">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input type="text" value={editSearch} onChange={e => setEditSearch(e.target.value)}
                    placeholder="Search by offer title or client…"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>

              {editLoading ? (
                <div className="flex items-center justify-center min-h-60 text-gray-400 text-sm">Loading…</div>
              ) : filteredEdits.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-60 gap-3">
                  <ShieldCheck className="w-12 h-12 text-gray-200" />
                  <p className="text-sm text-gray-400">No edit requests found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Offer</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Requester</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Fields Changed</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Submitted</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 w-48"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredEdits.map(req => (
                        <tr key={req.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 max-w-[180px] truncate">
                              {req.reward?.title ?? '—'}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {(req.reward as any)?.reward_id ?? ''}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {req.requesting_client?.logo_url ? (
                                <img src={req.requesting_client.logo_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-3 h-3 text-gray-400" />
                                </div>
                              )}
                              <span className="text-sm text-gray-700 truncate max-w-[120px]">
                                {req.requesting_client?.name ?? '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {Object.keys(req.proposed_changes).map(k => (
                                <span key={k} className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded">
                                  {k.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{fmt(req.created_at)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeCls(req.status)}`}>
                              <StatusIcon s={req.status} /> {req.status}
                            </span>
                            {req.status === 'rejected' && req.rejection_reason && (
                              <p className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate" title={req.rejection_reason}>
                                {req.rejection_reason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
                              {req.status === 'pending' && (
                                <>
                                  <button onClick={() => openEditReview(req, 'approve')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">
                                    <Check className="w-3 h-3" /> Approve
                                  </button>
                                  <button onClick={() => openEditReview(req, 'reject')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200">
                                    <X className="w-3 h-3" /> Reject
                                  </button>
                                </>
                              )}
                              <button onClick={() => openEditReview(req, req.status === 'pending' ? 'approve' : 'reject')}
                                title="View diff"
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200">
                                <Eye className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* ── Submission Review Drawer ───────────────────────────────────────── */}
      {reviewOffer && offerAction && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {offerAction === 'approve'
                  ? <CheckCircle className="w-5 h-5 text-green-600" />
                  : <XCircle    className="w-5 h-5 text-red-500" />}
                <h2 className="font-semibold text-gray-900">
                  {offerAction === 'approve' ? 'Approve Offer' : 'Reject Offer'}
                </h2>
              </div>
              <button onClick={closeOfferReview} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Offer details */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Title</span>
                  <span className="font-semibold text-gray-900">{reviewOffer.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Owner</span>
                  <span className="text-gray-800">{(reviewOffer.owner_client as any)?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="text-gray-800 capitalize">
                    {((reviewOffer as any).offer_category ?? '—').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Coupon type</span>
                  <span className="text-gray-800 capitalize">{reviewOffer.coupon_type}</span>
                </div>
                {reviewOffer.discount_value != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-gray-800">
                      {reviewOffer.reward_type === 'percentage_discount'
                        ? `${reviewOffer.discount_value}% off`
                        : `₹${reviewOffer.discount_value} off`}
                    </span>
                  </div>
                )}
                {reviewOffer.valid_until && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valid until</span>
                    <span className="text-gray-800">{fmt(reviewOffer.valid_until)}</span>
                  </div>
                )}
              </div>

              {reviewOffer.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reviewOffer.description}</p>
                </div>
              )}

              {reviewOffer.terms_conditions && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Terms</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reviewOffer.terms_conditions}</p>
                </div>
              )}

              {reviewOffer.steps_to_redeem && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Steps to Redeem</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reviewOffer.steps_to_redeem}</p>
                </div>
              )}

              {reviewOffer.redemption_link && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Redemption URL</p>
                  <a href={reviewOffer.redemption_link} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all">
                    {reviewOffer.redemption_link}
                  </a>
                </div>
              )}

              {offerError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {offerError}
                </div>
              )}

              {offerAction === 'approve' && (
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={closeOfferReview} className="flex-1">Cancel</Button>
                  <Button onClick={handleApproveOffer} disabled={offerSaving}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                    <Check className="w-4 h-4 mr-1.5" />
                    {offerSaving ? 'Approving…' : 'Approve & Publish'}
                  </Button>
                </div>
              )}

              {offerAction === 'reject' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Rejection reason <span className="text-red-500">*</span>
                    </label>
                    <textarea value={offerReason} onChange={e => setOfferReason(e.target.value)} rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none"
                      placeholder="e.g. Incomplete terms — please add expiry and usage restrictions" />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={closeOfferReview} className="flex-1">Cancel</Button>
                    <Button onClick={handleRejectOffer} disabled={offerSaving}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                      <XCircle className="w-4 h-4 mr-1.5" />
                      {offerSaving ? 'Rejecting…' : 'Reject'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Request Review Drawer ─────────────────────────────────────── */}
      {reviewEdit && editAction && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {editAction === 'approve'
                  ? <CheckCircle className="w-5 h-5 text-green-600" />
                  : <XCircle    className="w-5 h-5 text-red-500" />}
                <h2 className="font-semibold text-gray-900">
                  {editAction === 'approve' ? 'Approve Edit Request' : 'Reject Edit Request'}
                </h2>
              </div>
              <button onClick={closeEditReview} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Meta */}
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Offer</span>
                  <span className="font-semibold text-gray-900">{reviewEdit.reward?.title ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Requester</span>
                  <span className="text-gray-800">{reviewEdit.requesting_client?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fields changed</span>
                  <span className="text-gray-800">{Object.keys(reviewEdit.proposed_changes).length}</span>
                </div>
              </div>

              {/* Before / after diff */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Proposed Changes</p>
                <FieldDiff label="Title"
                  current={reviewEdit.reward?.title}
                  proposed={reviewEdit.proposed_changes.title} />
                <FieldDiff label="Description"
                  current={reviewEdit.reward?.description}
                  proposed={reviewEdit.proposed_changes.description} />
                <FieldDiff label="Terms & Conditions"
                  current={reviewEdit.reward?.terms_conditions}
                  proposed={reviewEdit.proposed_changes.terms_conditions} />
                <FieldDiff label="Steps to Redeem"
                  current={(reviewEdit.reward as any)?.steps_to_redeem}
                  proposed={reviewEdit.proposed_changes.steps_to_redeem} />
                <FieldDiff label="Discount Value"
                  current={reviewEdit.reward?.discount_value}
                  proposed={reviewEdit.proposed_changes.discount_value} />
                <FieldDiff label="Generic Coupon Code"
                  current={reviewEdit.reward?.generic_coupon_code}
                  proposed={reviewEdit.proposed_changes.generic_coupon_code} />
                <FieldDiff label="Redemption URL"
                  current={reviewEdit.reward?.redemption_link}
                  proposed={reviewEdit.proposed_changes.redemption_link} />
                <FieldDiff label="Valid Until"
                  current={reviewEdit.reward?.valid_until}
                  proposed={reviewEdit.proposed_changes.valid_until} />
                {/* Show any remaining fields not explicitly listed */}
                {Object.keys(reviewEdit.proposed_changes)
                  .filter(k => !['title','description','terms_conditions','steps_to_redeem','discount_value','generic_coupon_code','redemption_link','valid_until'].includes(k))
                  .map(k => (
                    <FieldDiff key={k} label={k.replace(/_/g, ' ')}
                      current={(reviewEdit.reward as any)?.[k]}
                      proposed={reviewEdit.proposed_changes[k]} />
                  ))
                }
              </div>

              {editError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {editError}
                </div>
              )}

              {editAction === 'approve' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    Approving will immediately update the live offer row. All adopters of this offer will see the updated content.
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={closeEditReview} className="flex-1">Cancel</Button>
                    <Button onClick={handleApproveEdit} disabled={editSaving}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      <Check className="w-4 h-4 mr-1.5" />
                      {editSaving ? 'Applying…' : 'Approve & Apply Changes'}
                    </Button>
                  </div>
                </div>
              )}

              {editAction === 'reject' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Rejection reason <span className="text-red-500">*</span>
                    </label>
                    <textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none"
                      placeholder="e.g. New terms reduce the discount — adopters expect 20% off" />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={closeEditReview} className="flex-1">Cancel</Button>
                    <Button onClick={handleRejectEdit} disabled={editSaving}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                      <XCircle className="w-4 h-4 mr-1.5" />
                      {editSaving ? 'Rejecting…' : 'Reject Edit'}
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
