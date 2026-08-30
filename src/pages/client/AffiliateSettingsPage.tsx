import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Settings2, Check, X, Pencil, ExternalLink, Copy, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Layout } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import {
  PortalSection, SectionType, PortalTheme, SECTION_LABELS, defaultSections, defaultContentFor,
  PortalSectionRenderer, HeroContent, BenefitsContent, HowItWorksContent, FaqContent, FinalCtaContent, HeroVariant,
} from '../../components/affiliate/PortalSections';

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


const SYSTEM_DEFAULTS: Omit<PartnerType, 'id' | 'is_system_default'>[] = [
  { name: 'Influencer',      slug: 'influencer',      color: '#ec4899', default_utm_medium: 'influencer',     default_utm_source_tpl: '{{partner_name}}', sort_order: 0 },
  { name: 'Creator',         slug: 'creator',          color: '#f97316', default_utm_medium: 'creator',        default_utm_source_tpl: '{{partner_name}}', sort_order: 1 },
  { name: 'Brand',           slug: 'brand',            color: '#3b82f6', default_utm_medium: 'brand',          default_utm_source_tpl: '{{partner_name}}', sort_order: 2 },
  { name: 'Affiliate',       slug: 'affiliate',        color: '#8b5cf6', default_utm_medium: 'affiliate',      default_utm_source_tpl: '{{partner_name}}', sort_order: 3 },
  { name: 'Coupon Website',  slug: 'coupon-website',   color: '#10b981', default_utm_medium: 'coupon_website', default_utm_source_tpl: '{{partner_name}}', sort_order: 4 },
  { name: 'Partner',         slug: 'partner',          color: '#6366f1', default_utm_medium: 'partner',        default_utm_source_tpl: '{{partner_name}}', sort_order: 5 },
];

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mediumSlugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const COLOR_PALETTE = [
  '#ec4899', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#64748b',
];

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

const fieldCls = 'w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900';
const labelCls = 'block text-xs font-medium text-gray-700 mb-1';

function SectionEditorFields({ section, onChange }: { section: PortalSection; onChange: (content: PortalSection['content']) => void }) {
  switch (section.type) {
    case 'hero': {
      const c = section.content as HeroContent;
      const variant: HeroVariant = c.variant ?? 'centered';
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Layout</label>
            <div className="grid grid-cols-2 gap-2">
              {(['centered', 'split'] as HeroVariant[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ ...c, variant: v })}
                  className={`text-left px-3 py-2 rounded-lg border text-xs font-medium ${
                    variant === v ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {v === 'centered' ? 'Centered stack' : 'Split spotlight'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Eyebrow tag</label>
            <input className={fieldCls} value={c.eyebrow} onChange={e => onChange({ ...c, eyebrow: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Headline</label>
            <input className={fieldCls} value={c.headline} onChange={e => onChange({ ...c, headline: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Subheadline</label>
            <textarea rows={2} className={fieldCls} value={c.subheadline} onChange={e => onChange({ ...c, subheadline: e.target.value })} />
          </div>
          {variant === 'split' && (
            <div>
              <label className={labelCls}>Image URL <span className="text-gray-400 font-normal">(optional — falls back to a gradient panel)</span></label>
              <input className={fieldCls} value={c.imageUrl ?? ''} onChange={e => onChange({ ...c, imageUrl: e.target.value })} placeholder="https://…" />
            </div>
          )}
        </div>
      );
    }
    case 'benefits': {
      const c = section.content as BenefitsContent;
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input className={fieldCls} value={c.title} onChange={e => onChange({ ...c, title: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Benefits (one per line)</label>
            <textarea
              rows={4} className={fieldCls} value={c.items.join('\n')}
              onChange={e => onChange({ ...c, items: e.target.value.split('\n').filter(Boolean) })}
            />
          </div>
        </div>
      );
    }
    case 'how_it_works': {
      const c = section.content as HowItWorksContent;
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input className={fieldCls} value={c.title} onChange={e => onChange({ ...c, title: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Steps (one per line)</label>
            <textarea
              rows={4} className={fieldCls} value={c.steps.join('\n')}
              onChange={e => onChange({ ...c, steps: e.target.value.split('\n').filter(Boolean) })}
            />
          </div>
        </div>
      );
    }
    case 'faq': {
      const c = section.content as FaqContent;
      const asText = c.items.map(i => `${i.q} | ${i.a}`).join('\n');
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input className={fieldCls} value={c.title} onChange={e => onChange({ ...c, title: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Questions (one per line, format: Question | Answer)</label>
            <textarea
              rows={4} className={fieldCls} value={asText}
              onChange={e => onChange({
                ...c,
                items: e.target.value.split('\n').filter(Boolean).map(line => {
                  const [q, ...rest] = line.split('|');
                  return { q: (q ?? '').trim(), a: rest.join('|').trim() };
                }),
              })}
            />
          </div>
        </div>
      );
    }
    case 'final_cta': {
      const c = section.content as FinalCtaContent;
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Headline</label>
            <input className={fieldCls} value={c.headline} onChange={e => onChange({ ...c, headline: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Subtext</label>
            <input className={fieldCls} value={c.subtext} onChange={e => onChange({ ...c, subtext: e.target.value })} />
          </div>
        </div>
      );
    }
  }
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

  // Affiliate portal builder
  const [clientSlug, setClientSlug] = useState('');
  const [rawAffiliateSettings, setRawAffiliateSettings] = useState<Record<string, unknown>>({});
  const [sections, setSections] = useState<PortalSection[]>([]);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalSaved, setPortalSaved] = useState(false);
  const [portalLinkCopied, setPortalLinkCopied] = useState(false);
  const [portalTheme, setPortalTheme] = useState<PortalTheme>({ primaryColor: '#6366f1', logoUrl: null, clientName: '' });

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
        .select('utm_slug_prefix, affiliate_settings, slug, primary_color, logo_url, name, branding_settings')
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
      const cd = clientData as {
        utm_slug_prefix?: string; affiliate_settings?: Record<string, unknown>; slug?: string;
        primary_color?: string; logo_url?: string | null; name?: string;
        branding_settings?: { secondary_color?: string; border_radius?: string; font_heading?: string; font_body?: string };
      };
      if (cd.utm_slug_prefix) setSlugPrefix(cd.utm_slug_prefix as SlugPrefix);
      if (cd.slug) setClientSlug(cd.slug);
      const bs = cd.branding_settings ?? {};
      setPortalTheme({
        primaryColor: cd.primary_color || '#6366f1',
        secondaryColor: bs.secondary_color,
        borderRadius: bs.border_radius,
        fontHeading: bs.font_heading,
        fontBody: bs.font_body,
        logoUrl: cd.logo_url ?? null,
        clientName: cd.name ?? '',
      });
      const settings = cd.affiliate_settings ?? {};
      setRawAffiliateSettings(settings);
      if (typeof settings.auto_fill_utm === 'boolean') {
        setAutoFill(settings.auto_fill_utm as boolean);
      }
      const portal = settings.portal as { sections?: PortalSection[] } | undefined;
      setSections(portal?.sections?.length ? portal.sections : defaultSections());
    }

    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  function startNew() {
    setEditing({ id: null, name: '', color: COLOR_PALETTE[0], default_utm_medium: '', default_utm_source_tpl: '{{partner_name}}' });
    setSaveError('');
  }

  function startEdit(t: PartnerType) {
    setEditing({ id: t.id, name: t.name, color: t.color, default_utm_medium: t.default_utm_medium ?? '', default_utm_source_tpl: t.default_utm_source_tpl ?? '' });
    setSaveError('');
  }

  async function handleSaveType() {
    if (!editing) return;
    if (!editing.name.trim()) { setSaveError('Name is required.'); return; }
    const slug = slugify(editing.name);
    const medium = mediumSlugify(editing.name);
    if (!medium) { setSaveError('Name must contain at least one letter or number.'); return; }

    const duplicate = types.find(t => t.id !== editing.id && mediumSlugify(t.default_utm_medium ?? '') === medium);
    if (duplicate) {
      setSaveError(`UTM medium "${medium}" is already used by "${duplicate.name}". Choose a different name.`);
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      if (editing.id) {
        const { error } = await supabase
          .from('affiliate_partner_types')
          .update({
            name: editing.name.trim(),
            slug,
            color: editing.color,
            default_utm_medium: medium,
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
            default_utm_medium: medium,
            default_utm_source_tpl: '{{partner_name}}',
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
    const next = { ...rawAffiliateSettings, auto_fill_utm: val };
    await supabase.from('clients').update({ affiliate_settings: next }).eq('id', clientId);
    setRawAffiliateSettings(next);
    setAutoFillSaving(false);
  }

  // ── Affiliate portal builder ──────────────────────────────────────────────

  function addSection(type: SectionType) {
    const newSection: PortalSection = {
      id: `${type}-${Date.now()}`,
      type,
      visible: true,
      content: defaultContentFor(type),
    };
    setSections(s => [...s, newSection]);
    setExpandedSectionId(newSection.id);
    setAddMenuOpen(false);
  }

  function removeSection(id: string) {
    if (!window.confirm('Remove this section from the portal page?')) return;
    setSections(s => s.filter(sec => sec.id !== id));
  }

  function toggleSectionVisible(id: string) {
    setSections(s => s.map(sec => sec.id === id ? { ...sec, visible: !sec.visible } : sec));
  }

  function moveSection(id: string, direction: -1 | 1) {
    setSections(s => {
      const idx = s.findIndex(sec => sec.id === id);
      const swapWith = idx + direction;
      if (idx === -1 || swapWith < 0 || swapWith >= s.length) return s;
      const next = [...s];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  function reorderSection(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    setSections(s => {
      const from = s.findIndex(sec => sec.id === draggedId);
      const to = s.findIndex(sec => sec.id === targetId);
      if (from === -1 || to === -1) return s;
      const next = [...s];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function updateSectionContent(id: string, content: PortalSection['content']) {
    setSections(s => s.map(sec => sec.id === id ? { ...sec, content } : sec));
  }

  async function handleSavePortal() {
    setPortalSaving(true);
    const next = { ...rawAffiliateSettings, portal: { sections } };
    const { error } = await supabase.from('clients').update({ affiliate_settings: next }).eq('id', clientId);
    setPortalSaving(false);
    if (!error) {
      setRawAffiliateSettings(next);
      setPortalSaved(true);
      setTimeout(() => setPortalSaved(false), 2000);
    }
  }

  function copyPortalLink() {
    const url = `${window.location.origin}/partner/${clientSlug}/landing`;
    navigator.clipboard.writeText(url);
    setPortalLinkCopied(true);
    setTimeout(() => setPortalLinkCopied(false), 2000);
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
                      medium:{' '}
                      <button
                        onClick={() => startEdit(t)}
                        className="font-mono text-indigo-600 hover:underline focus:outline-none"
                        title="Click to edit">
                        {t.default_utm_medium ?? '—'}
                      </button>
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

        {/* Affiliate Portal builder */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Layout className="w-4 h-4 text-gray-500" />
                Affiliate Portal
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Customize the public landing page prospective affiliates see before applying
              </p>
            </div>
            <div className="flex items-center gap-2">
              {portalSaved && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
              <button
                onClick={copyPortalLink}
                disabled={!clientSlug}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                <Copy className="w-3.5 h-3.5" />
                {portalLinkCopied ? 'Copied' : 'Copy link'}
              </button>
              {clientSlug && (
                <a
                  href={`/partner/${clientSlug}/landing`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View live
                </a>
              )}
              <button
                onClick={handleSavePortal}
                disabled={portalSaving}
                className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" />
                {portalSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
            {/* Sections manager */}
            <div className="p-4 space-y-2">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => setDraggedSectionId(section.id)}
                  onDragEnd={() => { setDraggedSectionId(null); setDragOverSectionId(null); }}
                  onDragOver={e => { e.preventDefault(); if (draggedSectionId && draggedSectionId !== section.id) setDragOverSectionId(section.id); }}
                  onDragLeave={() => setDragOverSectionId(id => id === section.id ? null : id)}
                  onDrop={e => {
                    e.preventDefault();
                    if (draggedSectionId) reorderSection(draggedSectionId, section.id);
                    setDraggedSectionId(null);
                    setDragOverSectionId(null);
                  }}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    dragOverSectionId === section.id ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-200'
                  } ${draggedSectionId === section.id ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <button
                      onClick={() => setExpandedSectionId(id => id === section.id ? null : section.id)}
                      className="flex-1 text-left text-sm font-medium text-gray-800 flex items-center gap-1.5 min-w-0">
                      {SECTION_LABELS[section.type]}
                      {!section.visible && <span className="text-[10px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded flex-shrink-0">hidden</span>}
                    </button>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button onClick={() => moveSection(section.id, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveSection(section.id, 1)} disabled={idx === sections.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleSectionVisible(section.id)} className="p-1 text-gray-400 hover:text-gray-700">
                        {section.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setExpandedSectionId(id => id === section.id ? null : section.id)}
                        className="p-1 text-gray-400 hover:text-gray-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeSection(section.id)} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {expandedSectionId === section.id && (
                    <div className="p-3 border-t border-gray-100">
                      <SectionEditorFields section={section} onChange={content => updateSectionContent(section.id, content)} />
                    </div>
                  )}
                </div>
              ))}

              <div className="relative">
                <button
                  onClick={() => setAddMenuOpen(o => !o)}
                  className="w-full flex items-center justify-center gap-1.5 text-sm border border-dashed border-gray-300 text-gray-500 px-3 py-2.5 rounded-lg hover:bg-gray-50">
                  <Plus className="w-3.5 h-3.5" />
                  Add section
                </button>
                {addMenuOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    {(Object.keys(SECTION_LABELS) as SectionType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => addSection(type)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        {SECTION_LABELS[type]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live preview */}
            <div className="bg-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">Live preview</p>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-h-[600px] overflow-y-auto">
                {sections.map(section => (
                  <PortalSectionRenderer
                    key={section.id}
                    section={section}
                    theme={portalTheme}
                  />
                ))}
              </div>
            </div>
          </div>
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

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Default UTM Medium</label>
                  <div className="w-full border border-gray-200 bg-gray-50 rounded-lg text-sm px-3 py-2 font-mono text-gray-600">
                    {mediumSlugify(editing.name) || <span className="text-gray-400 font-sans">derived from name…</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Auto-generated from the name, must be unique per type.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditing(v => v ? { ...v, color: c } : v)}
                        title={c}
                        className={`w-7 h-7 rounded-full border-2 ${editing.color === c ? 'border-gray-900' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label
                      title="Custom color"
                      className={`relative w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center overflow-hidden ${
                        !COLOR_PALETTE.includes(editing.color) ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: !COLOR_PALETTE.includes(editing.color) ? editing.color : '#fff' }}>
                      {COLOR_PALETTE.includes(editing.color) && <Plus className="w-3.5 h-3.5 text-gray-400" />}
                      <input
                        type="color"
                        value={editing.color}
                        onChange={e => setEditing(v => v ? { ...v, color: e.target.value } : v)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                  <span className="text-xs font-mono text-gray-400 mt-1 block">{editing.color}</span>
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
