import { useState, useEffect, useCallback } from 'react';
import { Plus, X, ChevronLeft, Users, Link2, Save, Trash2, Calendar, Pause, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignScope = 'global' | 'partner';
type CampaignStatus = 'active' | 'paused' | 'ended';

interface Campaign {
  id: string;
  name: string;
  slug: string;
  scope: CampaignScope;
  partner_id: string | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  default_utm_campaign: string | null;
  description: string | null;
  created_at: string;
  partner?: { name: string } | null;
  campaign_partners?: { count: number }[];
  attribution_utm_links?: { count: number }[];
  affiliate_code_assignments?: { count: number }[];
}

interface Partner {
  id: string;
  name: string;
}

interface CampaignPartner {
  id: string;
  partner_id: string;
  attribution_param_value: string | null;
  utm_source_override: string | null;
  status: string;
  partner?: { name: string; slug: string | null } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SCOPE_BADGE: Record<CampaignScope, string> = {
  global: 'bg-indigo-100 text-indigo-700',
  partner: 'bg-gray-100 text-gray-600',
};

const STATUS_BADGE: Record<CampaignStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  ended: 'bg-gray-100 text-gray-500',
};

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ─── New Campaign Form ────────────────────────────────────────────────────────

interface NewCampaignFormProps {
  partners: Partner[];
  onSave: () => void;
  onCancel: () => void;
  clientId: string;
}

function NewCampaignForm({ partners, onSave, onCancel, clientId }: NewCampaignFormProps) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<CampaignScope>('global');
  const [partnerId, setPartnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Campaign name is required.'); return; }
    if (scope === 'partner' && !partnerId) { setError('Select a partner for a partner-level campaign.'); return; }
    setSaving(true);
    setError('');
    const slug = slugify(name);
    const { error: e } = await supabase.from('affiliate_campaigns').insert({
      client_id: clientId,
      name: name.trim(),
      slug,
      scope,
      partner_id: scope === 'partner' ? partnerId : null,
      start_date: startDate || null,
      end_date: endDate || null,
      description: description || null,
      default_utm_campaign: slug,
    });
    setSaving(false);
    if (e) { setError(e.message); return; }
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">New campaign</h3>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Campaign Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Diwali 2026"
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {name && (
              <p className="text-xs text-gray-400 mt-1">
                Slug: <code className="font-mono bg-gray-100 px-1 rounded">{slugify(name)}</code>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Scope</label>
            <div className="flex gap-2">
              {(['global', 'partner'] as CampaignScope[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setScope(s); if (s === 'global') setPartnerId(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm border ${scope === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {s === 'global' ? '🌐 Global' : '👤 Partner'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {scope === 'global' ? 'Shared across multiple partners — assign them below after creating.' : 'Belongs to one partner — shows up in their detail view.'}
            </p>
          </div>

          {scope === 'partner' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Partner *</label>
              <select
                value={partnerId}
                onChange={e => setPartnerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select partner…</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes about this campaign"
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-1.5">
            {saving ? 'Saving…' : <><Save className="w-3.5 h-3.5" /> Create</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Detail ──────────────────────────────────────────────────────────

interface CampaignDetailProps {
  campaign: Campaign;
  partners: Partner[];
  clientId: string;
  onBack: () => void;
  onUpdated: () => void;
}

function CampaignDetail({ campaign, partners, clientId, onBack, onUpdated }: CampaignDetailProps) {
  const [assignedPartners, setAssignedPartners] = useState<CampaignPartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [addingPartnerId, setAddingPartnerId] = useState('');
  const [addingError, setAddingError] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [statusSaving, setStatusSaving] = useState(false);

  const loadPartners = useCallback(async () => {
    setLoadingPartners(true);
    const { data } = await supabase
      .from('campaign_partners')
      .select('*, partner:affiliate_partners(name, slug)')
      .eq('campaign_id', campaign.id)
      .order('created_at');
    setAssignedPartners((data as CampaignPartner[]) ?? []);
    setLoadingPartners(false);
  }, [campaign.id]);

  useEffect(() => { loadPartners(); }, [loadPartners]);

  const unassignedPartners = partners.filter(
    p => !assignedPartners.some(ap => ap.partner_id === p.id)
  );

  async function handleAddPartner() {
    if (!addingPartnerId) return;
    setAddingSaving(true);
    setAddingError('');
    const p = partners.find(x => x.id === addingPartnerId);
    const attrValue = p ? `${slugify(p.name)}_${slugify(campaign.slug)}` : null;
    const { error } = await supabase.from('campaign_partners').insert({
      campaign_id: campaign.id,
      partner_id: addingPartnerId,
      attribution_param_value: attrValue,
      status: 'active',
    });
    setAddingSaving(false);
    if (error) { setAddingError(error.message); return; }
    setAddingPartnerId('');
    await loadPartners();
  }

  async function handleRemovePartner(id: string) {
    setRemovingId(id);
    await supabase.from('campaign_partners').delete().eq('id', id);
    setRemovingId(null);
    await loadPartners();
  }

  async function handleStatusChange(newStatus: CampaignStatus) {
    setStatusSaving(true);
    await supabase.from('affiliate_campaigns').update({ status: newStatus }).eq('id', campaign.id);
    setStatus(newStatus);
    setStatusSaving(false);
    onUpdated();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    await supabase.from('affiliate_campaigns').delete().eq('id', campaign.id);
    onBack();
    onUpdated();
  }

  return (
    <div className="space-y-6">
      {/* Sub-header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{campaign.name}</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SCOPE_BADGE[campaign.scope]}`}>
              {campaign.scope}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[status]}`}>
              {status}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">/{campaign.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'active' ? (
            <button onClick={() => handleStatusChange('paused')} disabled={statusSaving}
              className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              <Pause className="w-3 h-3" /> Pause
            </button>
          ) : status === 'paused' ? (
            <button onClick={() => handleStatusChange('active')} disabled={statusSaving}
              className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              <Play className="w-3 h-3" /> Activate
            </button>
          ) : null}
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>

      {/* Info row */}
      <div className="flex gap-4 text-xs text-gray-500">
        {campaign.start_date && (
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(campaign.start_date)}</span>
        )}
        {campaign.end_date && <span>→ {fmtDate(campaign.end_date)}</span>}
        {campaign.description && <span className="text-gray-400">{campaign.description}</span>}
      </div>

      {/* Assigned Partners (global campaigns only) */}
      {campaign.scope === 'global' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              Partners in this campaign
            </h3>
          </div>

          {loadingPartners ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div>
              {assignedPartners.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {assignedPartners.map(ap => (
                    <div key={ap.id} className="px-6 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{ap.partner?.name}</p>
                        {ap.attribution_param_value && (
                          <code className="text-xs text-gray-400 font-mono">{ap.attribution_param_value}</code>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ap.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {ap.status}
                      </span>
                      <button
                        onClick={() => handleRemovePartner(ap.id)}
                        disabled={removingId === ap.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-6 py-6 text-sm text-gray-400 text-center">No partners assigned yet.</p>
              )}

              {unassignedPartners.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
                  <select
                    value={addingPartnerId}
                    onChange={e => setAddingPartnerId(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="">Add a partner…</option>
                    {unassignedPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button
                    onClick={handleAddPartner}
                    disabled={!addingPartnerId || addingSaving}
                    className="flex items-center gap-1.5 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                    <Plus className="w-3.5 h-3.5" />
                    {addingSaving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              )}
              {addingError && <p className="px-6 pb-3 text-xs text-red-600">{addingError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Quick links to filter in UTM/coupons pages */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <p className="text-sm font-medium text-indigo-800 mb-2">Track under this campaign</p>
        <p className="text-xs text-indigo-600">
          When building UTM links or assigning coupon codes, select <strong>campaign: {campaign.name}</strong> to group them here. The attribution value will be <code className="font-mono bg-white/60 px-1 rounded">partner-name_{campaign.slug}</code>.
        </p>
        <div className="flex gap-2 mt-3">
          <a href="/client/attribution/utm" className="flex items-center gap-1.5 text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
            <Link2 className="w-3 h-3" /> UTM Links
          </a>
          <a href="/client/attribution/coupons" className="flex items-center gap-1.5 text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
            Coupon Codes
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AffiliateCampaignsPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? '';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'partner'>('all');

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setPageError('');
    const [{ data: cData, error: cErr }, { data: pData }] = await Promise.all([
      supabase
        .from('affiliate_campaigns')
        .select('*, partner:affiliate_partners(name)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('affiliate_partners')
        .select('id, name')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('name'),
    ]);
    if (cErr) setPageError(cErr.message);
    setCampaigns((cData as Campaign[]) ?? []);
    setPartners((pData as Partner[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = campaigns.filter(c => scopeFilter === 'all' ? true : c.scope === scopeFilter);

  if (selected) {
    return (
      <DashboardLayout menuItems={clientMenuItems}>
        <div className="p-6 max-w-4xl mx-auto">
          <CampaignDetail
            campaign={selected}
            partners={partners}
            clientId={clientId}
            onBack={() => setSelected(null)}
            onUpdated={loadData}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Group affiliate links and codes under campaigns for clean tracking
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            <Plus className="w-4 h-4" />
            New campaign
          </button>
        </div>

        {pageError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{pageError}</p>
        )}

        {/* Scope filter tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {(['all', 'global', 'partner'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScopeFilter(s)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                scopeFilter === s
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {s === 'all' ? 'All' : s === 'global' ? '🌐 Global' : '👤 Partner'}
            </button>
          ))}
        </div>

        {/* Campaign list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p className="text-sm text-gray-500">No campaigns yet.</p>
            <button onClick={() => setShowNew(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
              Create your first campaign →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SCOPE_BADGE[c.scope]}`}>
                      {c.scope}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono">/{c.slug}</p>
                  {c.scope === 'partner' && c.partner && (
                    <p className="text-xs text-gray-400 mt-0.5">Partner: {c.partner.name}</p>
                  )}
                  {c.description && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{c.description}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                  {c.start_date && (
                    <p className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(c.start_date)}</p>
                  )}
                  <p className="mt-1">{fmtDate(c.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {showNew && (
          <NewCampaignForm
            partners={partners}
            clientId={clientId}
            onSave={async () => { setShowNew(false); await loadData(); }}
            onCancel={() => setShowNew(false)}
          />
        )}

      </div>
    </DashboardLayout>
  );
}
