import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Settings2, Check, X, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlugPrefix = 'ref' | 'aff' | 'bg_ref' | 'bg_aff';

interface PartnerType {
  id: string;
  name: string;
  slug: string;
  color: string;
  default_utm_medium: string | null;
  default_utm_source_tpl: string | null;
  is_system_default: boolean;
  sort_order: number;
}

interface EditingType {
  id: string | null;
  name: string;
  color: string;
  default_utm_medium: string;
  default_utm_source_tpl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PREFIX_OPTIONS: { value: SlugPrefix; label: string; description: string }[] = [
  { value: 'ref',    label: 'ref=',    description: 'Generic referral — works everywhere' },
  { value: 'aff',   label: 'aff=',    description: 'Affiliate — may be blocked by ad blockers' },
  { value: 'bg_ref', label: 'bg_ref=', description: 'Branded referral — unique to your platform' },
  { value: 'bg_aff', label: 'bg_aff=', description: 'Branded affiliate — unique to your platform' },
];

const DEFAULT_MEDIUM_OPTIONS = [
  'influencer', 'affiliate', 'email', 'social', 'referral', 'cpc', 'organic', 'partner',
];

const SYSTEM_DEFAULTS: Omit<PartnerType, 'id' | 'is_system_default'>[] = [
  { name: 'Influencer',      slug: 'influencer',      color: '#ec4899', default_utm_medium: 'influencer', default_utm_source_tpl: '{{partner_name}}', sort_order: 0 },
  { name: 'Creator',         slug: 'creator',          color: '#f97316', default_utm_medium: 'influencer', default_utm_source_tpl: '{{partner_name}}', sort_order: 1 },
  { name: 'Brand',           slug: 'brand',            color: '#3b82f6', default_utm_medium: 'affiliate',  default_utm_source_tpl: '{{partner_name}}', sort_order: 2 },
  { name: 'Affiliate',       slug: 'affiliate',        color: '#8b5cf6', default_utm_medium: 'affiliate',  default_utm_source_tpl: '{{partner_name}}', sort_order: 3 },
  { name: 'Coupon Website',  slug: 'coupon-website',   color: '#10b981', default_utm_medium: 'affiliate',  default_utm_source_tpl: '{{partner_name}}', sort_order: 4 },
  { name: 'Partner',         slug: 'partner',          color: '#6366f1', default_utm_medium: 'partner',   default_utm_source_tpl: '{{partner_name}}', sort_order: 5 },
];

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AffiliateSettingsPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? '';

  const [types, setTypes] = useState<PartnerType[]>([]);
  const [slugPrefix, setSlugPrefix] = useState<SlugPrefix>('ref');
  const [autoFill, setAutoFill] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [editing, setEditing] = useState<EditingType | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [prefixSaving, setPrefixSaving] = useState(false);
  const [prefixSaved, setPrefixSaved] = useState(false);
  const [autoFillSaving, setAutoFillSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setPageError('');

    const [{ data: typesData, error: tErr }, { data: clientData }] = await Promise.all([
      supabase
        .from('affiliate_partner_types')
        .select('*')
        .eq('client_id', clientId)
        .order('sort_order'),
      supabase
        .from('clients')
        .select('utm_slug_prefix, affiliate_settings')
        .eq('id', clientId)
        .maybeSingle(),
    ]);

    if (tErr) { setPageError(tErr.message); setLoading(false); return; }

    let resolved = typesData as PartnerType[] ?? [];

    // Seed defaults if none exist
    if (resolved.length === 0) {
      const seeds = SYSTEM_DEFAULTS.map(d => ({
        client_id: clientId,
        name: d.name,
        slug: d.slug,
        color: d.color,
        default_utm_medium: d.default_utm_medium,
        default_utm_source_tpl: d.default_utm_source_tpl,
        is_system_default: true,
        sort_order: d.sort_order,
      }));
      const { data: seeded, error: seedErr } = await supabase
        .from('affiliate_partner_types')
        .insert(seeds)
        .select('*');
      if (!seedErr && seeded) resolved = seeded as PartnerType[];
    }

    setTypes(resolved);

    if (clientData) {
      const cd = clientData as { utm_slug_prefix?: string; affiliate_settings?: Record<string, unknown> };
      if (cd.utm_slug_prefix) setSlugPrefix(cd.utm_slug_prefix as SlugPrefix);
      if (cd.affiliate_settings && typeof cd.affiliate_settings.auto_fill_utm === 'boolean') {
        setAutoFill(cd.affiliate_settings.auto_fill_utm as boolean);
      }
    }

    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  function startNew() {
    setEditing({ id: null, name: '', color: '#6366f1', default_utm_medium: 'affiliate', default_utm_source_tpl: '{{partner_name}}' });
    setSaveError('');
  }

  function startEdit(t: PartnerType) {
    setEditing({ id: t.id, name: t.name, color: t.color, default_utm_medium: t.default_utm_medium ?? '', default_utm_source_tpl: t.default_utm_source_tpl ?? '' });
    setSaveError('');
  }

  async function handleSaveType() {
    if (!editing) return;
    if (!editing.name.trim()) { setSaveError('Name is required.'); return; }
    setSaving(true);
    setSaveError('');
    const slug = slugify(editing.name);

    try {
      if (editing.id) {
        const { error } = await supabase
          .from('affiliate_partner_types')
          .update({
            name: editing.name.trim(),
            slug,
            color: editing.color,
            default_utm_medium: editing.default_utm_medium || null,
            default_utm_source_tpl: editing.default_utm_source_tpl || null,
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('affiliate_partner_types')
          .insert({
            client_id: clientId,
            name: editing.name.trim(),
            slug,
            color: editing.color,
            default_utm_medium: editing.default_utm_medium || null,
            default_utm_source_tpl: editing.default_utm_source_tpl || null,
            is_system_default: false,
            sort_order: types.length,
          });
        if (error) throw error;
      }
      setEditing(null);
      await loadData();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteType(id: string) {
    if (!window.confirm('Delete this partner type? Partners using it will be unlinked.')) return;
    setDeletingId(id);
    await supabase.from('affiliate_partner_types').delete().eq('id', id);
    setDeletingId(null);
    await loadData();
  }

  async function handleSavePrefix(prefix: SlugPrefix) {
    setPrefixSaving(true);
    await supabase.from('clients').update({ utm_slug_prefix: prefix }).eq('id', clientId);
    setSlugPrefix(prefix);
    setPrefixSaving(false);
    setPrefixSaved(true);
    setTimeout(() => setPrefixSaved(false), 2000);
  }

  async function handleToggleAutoFill(val: boolean) {
    setAutoFill(val);
    setAutoFillSaving(true);
    await supabase
      .from('clients')
      .update({ affiliate_settings: { auto_fill_utm: val } })
      .eq('id', clientId);
    setAutoFillSaving(false);
  }

  return (
    <DashboardLayout menuItems={clientMenuItems}>
      <div className="p-6 max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Affiliate Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure attribution tracking and partner types for your affiliate program
          </p>
        </div>

        {pageError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{pageError}</p>
        )}

        {/* Attribution Param Prefix */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Attribution Param Prefix</h2>
            {prefixSaved && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
          </div>
          <p className="text-xs text-gray-500">
            Choose the URL parameter name used for tracking. Applied to all new links — existing links keep their original prefix.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PREFIX_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSavePrefix(opt.value)}
                disabled={prefixSaving}
                className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  slugPrefix === opt.value
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}>
                <span className="font-mono font-semibold block">{opt.label}</span>
                <span className="text-xs text-gray-400 mt-0.5 block">{opt.description}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Auto-fill UTM toggle */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Auto-fill UTM Fields</h2>
              <p className="text-xs text-gray-500 mt-1">
                When building a link, selecting a partner auto-fills <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">utm_source</code> and <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">utm_medium</code> from the partner's type defaults below.
              </p>
            </div>
            <button
              onClick={() => handleToggleAutoFill(!autoFill)}
              disabled={autoFillSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoFill ? 'bg-indigo-600' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoFill ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>

        {/* Partner Types */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Partner Types</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Each type sets default UTM medium + source when building links
              </p>
            </div>
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
              <Plus className="w-3.5 h-3.5" />
              Add type
            </button>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {types.map(t => (
                <div key={t.id} className="px-6 py-3 flex items-center gap-4">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">
                      medium: <span className="font-mono">{t.default_utm_medium ?? '—'}</span>
                      {t.default_utm_source_tpl && (
                        <> · source: <span className="font-mono">{t.default_utm_source_tpl}</span></>
                      )}
                    </p>
                  </div>
                  {t.is_system_default && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">default</span>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteType(t.id)}
                      disabled={deletingId === t.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {types.length === 0 && (
                <p className="px-6 py-8 text-sm text-gray-400 text-center">No partner types yet — click "Add type" to create one.</p>
              )}
            </div>
          )}
        </section>

        {/* Edit/Add drawer */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {editing.id ? 'Edit partner type' : 'New partner type'}
                </h3>
                <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{saveError}</p>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    value={editing.name}
                    onChange={e => setEditing(v => v ? { ...v, name: e.target.value } : v)}
                    placeholder="e.g. Mega Influencer"
                    className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Default UTM Medium</label>
                    <select
                      value={editing.default_utm_medium}
                      onChange={e => setEditing(v => v ? { ...v, default_utm_medium: e.target.value } : v)}
                      className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">None</option>
                      {DEFAULT_MEDIUM_OPTIONS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editing.color}
                        onChange={e => setEditing(v => v ? { ...v, color: e.target.value } : v)}
                        className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-gray-500">{editing.color}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    UTM Source Template
                  </label>
                  <input
                    value={editing.default_utm_source_tpl}
                    onChange={e => setEditing(v => v ? { ...v, default_utm_source_tpl: e.target.value } : v)}
                    placeholder="{{partner_name}}"
                    className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <p className="text-xs text-gray-400 mt-1">Use <code className="font-mono bg-gray-100 px-1 rounded">{'{{partner_name}}'}</code> to insert partner name dynamically.</p>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleSaveType}
                  disabled={saving}
                  className="flex-1 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-1.5">
                  {saving ? 'Saving…' : <><Save className="w-3.5 h-3.5" /> Save</>}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
