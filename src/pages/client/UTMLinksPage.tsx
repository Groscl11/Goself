import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Link2, Plus, X, Copy, Check, Trash2, Search, MousePointer,
  Scissors, ExternalLink, Settings2, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerType = 'influencer' | 'creator' | 'brand' | 'other';
type SlugPrefix = 'ref' | 'aff' | 'bg_ref' | 'bg_aff';

interface Partner {
  id: string;
  name: string;
  partner_type: PartnerType;
}

interface AffiliateCampaign {
  id: string;
  name: string;
  slug: string;
  scope: 'global' | 'partner';
  status: string;
  default_utm_campaign: string | null;
}

interface UTMLink {
  id: string;
  client_id: string;
  partner_id: string | null;
  slug: string | null;               // short link path — nullable, on-demand
  attribution_param_name: string;    // e.g. 'bg_ref'
  attribution_param_value: string | null; // e.g. 'ss_x7k2m9'
  destination_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  attribution_window_days: number;
  clicks: number;
  created_at: string;
  partner?: { name: string; partner_type: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-purple-500 to-indigo-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-red-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-lime-500 to-green-600',
];

function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_BADGE: Record<string, string> = {
  influencer: 'bg-pink-100 text-pink-700',
  creator:    'bg-orange-100 text-orange-700',
  brand:      'bg-blue-100 text-blue-700',
  other:      'bg-gray-100 text-gray-600',
};

const PREFIX_OPTIONS: { value: SlugPrefix; label: string; description: string }[] = [
  { value: 'ref',    label: 'ref=',    description: 'Generic referral — works everywhere' },
  { value: 'aff',   label: 'aff=',    description: 'Affiliate — may be blocked by ad blockers' },
  { value: 'bg_ref', label: 'bg_ref=', description: 'Branded referral — unique to your platform' },
  { value: 'bg_aff', label: 'bg_aff=', description: 'Branded affiliate — unique to your platform' },
];

function nanoId(len = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function computeAttributionValue(): string {
  return nanoId(8);
}

function buildAttributionUrl(
  destUrl: string,
  paramName: string,
  paramValue: string,
  source: string,
  medium: string,
  campaign: string,
  content: string,
  term: string,
): string {
  if (!destUrl) return '';
  const params: string[] = [];
  if (paramValue) params.push(`${paramName}=${encodeURIComponent(paramValue)}`);
  if (source)   params.push(`utm_source=${encodeURIComponent(source)}`);
  if (medium)   params.push(`utm_medium=${encodeURIComponent(medium)}`);
  if (campaign) params.push(`utm_campaign=${encodeURIComponent(campaign)}`);
  if (content)  params.push(`utm_content=${encodeURIComponent(content)}`);
  if (term)     params.push(`utm_term=${encodeURIComponent(term)}`);
  const sep = destUrl.includes('?') ? '&' : '?';
  return params.length > 0 ? `${destUrl}${sep}${params.join('&')}` : destUrl;
}

const SHORT_BASE = 'https://go.goself.app/s';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UTMLinksPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? '';

  const [links, setLinks] = useState<UTMLink[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [campaigns, setCampaigns] = useState<AffiliateCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Client-level prefix setting
  const [slugPrefix, setSlugPrefix] = useState<SlugPrefix>('ref');
  const [showPrefixSettings, setShowPrefixSettings] = useState(false);
  const [savingPrefix, setSavingPrefix] = useState(false);

  // Builder form state
  const [destUrl, setDestUrl] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [affiliateCampaignId, setAffiliateCampaignId] = useState('');
  const [campaign, setCampaign] = useState('');
  const [medium, setMedium] = useState('');
  const [attrWindow, setAttrWindow] = useState(30);
  const [content, setContent] = useState('');
  const [term, setTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [defaultDestUrl, setDefaultDestUrl] = useState('');
  const [utmSourceInput, setUtmSourceInput] = useState('');

  // Per-link state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shorteningId, setShorteningId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setPageError('');
    const [{ data: partnersData, error: pErr }, { data: linksData, error: lErr }, { data: clientData }, { data: campaignsData }] =
      await Promise.all([
        supabase
          .from('affiliate_partners')
          .select('id, name, partner_type')
          .eq('client_id', clientId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('attribution_utm_links')
          .select('*, partner:affiliate_partners(name, partner_type)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('utm_slug_prefix, website_url')
          .eq('id', clientId)
          .maybeSingle(),
        supabase
          .from('affiliate_campaigns')
          .select('id, name, slug, scope, status, default_utm_campaign')
          .eq('client_id', clientId)
          .eq('status', 'active')
          .order('name'),
      ]);
    if (pErr) setPageError(pErr.message);
    if (lErr) setPageError(lErr.message);
    setPartners((partnersData as Partner[]) ?? []);
    setLinks((linksData as UTMLink[]) ?? []);
    setCampaigns((campaignsData as AffiliateCampaign[]) ?? []);
    if (clientData) {
      if ((clientData as any).utm_slug_prefix) setSlugPrefix((clientData as any).utm_slug_prefix as SlugPrefix);
      if ((clientData as any).website_url) setDefaultDestUrl((clientData as any).website_url);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedPartner = useMemo(
    () => partners.find(p => p.id === partnerId) ?? null,
    [partners, partnerId],
  );

  // Auto-fill utm_source from partner name; user can override
  useEffect(() => {
    setUtmSourceInput(
      selectedPartner ? selectedPartner.name.toLowerCase().replace(/\s+/g, '-') : ''
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartner?.id]);

  // Pre-fill destination URL with store URL on first load
  useEffect(() => {
    if (defaultDestUrl && !destUrl) setDestUrl(defaultDestUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDestUrl]);

  // Attribution value preview (regenerates on partner/campaign change for display only)
  const previewAttrValue = useMemo(
    () => computeAttributionValue(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPartner?.id],
  );

  const previewAttrUrl = useMemo(
    () => buildAttributionUrl(destUrl, slugPrefix, previewAttrValue, utmSourceInput, medium, campaign, content, term),
    [destUrl, slugPrefix, previewAttrValue, utmSourceInput, medium, campaign, content, term],
  );

  async function handleSavePrefix(prefix: SlugPrefix) {
    setSavingPrefix(true);
    await supabase.from('clients').update({ utm_slug_prefix: prefix }).eq('id', clientId);
    setSlugPrefix(prefix);
    setSavingPrefix(false);
    setShowPrefixSettings(false);
  }

  async function handleSave() {
    if (!destUrl.trim()) { setSaveError('Destination URL is required.'); return; }
    if (!partnerId && !campaign.trim()) { setSaveError('Select a partner or enter a campaign name.'); return; }

    setSaving(true);
    setSaveError('');

    try {
      // Generate a unique attribution param value
      const existingValues = links.map(l => l.attribution_param_value).filter(Boolean) as string[];
      let attrValue: string;
      let suffix = 0;
      do {
        const base = computeAttributionValue();
        attrValue = suffix === 0 ? base : `${base}-${suffix}`;
        suffix++;
      } while (existingValues.includes(attrValue));

      const { error: e } = await supabase.from('attribution_utm_links').insert({
        client_id: clientId,
        partner_id: partnerId || null,
        campaign_id: affiliateCampaignId || null,
        slug: null,                       // short link generated on demand
        attribution_param_name: slugPrefix,
        attribution_param_value: attrValue,
        destination_url: destUrl.trim(),
        utm_source: utmSourceInput || null,
        utm_medium: medium || null,
        utm_campaign: campaign || null,
        utm_content: content || null,
        utm_term: term || null,
        attribution_window_days: attrWindow,
        clicks: 0,
      });
      if (e) throw e;

      setDestUrl(defaultDestUrl); setPartnerId(''); setAffiliateCampaignId(''); setCampaign(''); setMedium('');
      setAttrWindow(30); setContent(''); setTerm(''); setUtmSourceInput('');
      await loadData();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save link.');
    } finally {
      setSaving(false);
    }
  }

  async function handleShortenLink(link: UTMLink) {
    setShorteningId(link.id);
    try {
      // Generate a unique short slug
      let shortSlug: string;
      let attempt = 0;
      while (true) {
        shortSlug = nanoId(attempt < 3 ? 6 : 8);
        const { data: existing } = await supabase
          .from('attribution_utm_links')
          .select('id')
          .eq('slug', shortSlug)
          .maybeSingle();
        if (!existing) break;
        attempt++;
      }
      const { error } = await supabase
        .from('attribution_utm_links')
        .update({ slug: shortSlug! })
        .eq('id', link.id);
      if (!error) loadData();
    } finally {
      setShorteningId(null);
    }
  }

  async function handleDelete(link: UTMLink) {
    if (!window.confirm(`Delete this link? This cannot be undone.`)) return;
    const { error: e } = await supabase.from('attribution_utm_links').delete().eq('id', link.id);
    if (!e) loadData();
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const filteredLinks = useMemo(() => {
    if (!search) return links;
    const q = search.toLowerCase();
    return links.filter(
      l =>
        (l.attribution_param_value ?? '').toLowerCase().includes(q) ||
        (l.utm_campaign ?? '').toLowerCase().includes(q) ||
        (l.partner?.name ?? '').toLowerCase().includes(q) ||
        (l.slug ?? '').toLowerCase().includes(q),
    );
  }, [links, search]);

  return (
    <DashboardLayout menuItems={clientMenuItems}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">UTM Links</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Generate trackable links for partners — every click is logged before redirecting
            </p>
          </div>
          {/* Prefix settings */}
          <div className="relative">
            <button
              onClick={() => setShowPrefixSettings(s => !s)}
              className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 text-gray-600">
              <Settings2 className="w-4 h-4" />
              Param: <code className="font-mono text-gray-900">{slugPrefix}=</code>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showPrefixSettings && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Attribution Param Prefix</p>
                  <p className="text-xs text-gray-500">Applied to all new links. Existing links keep their original prefix.</p>
                  <div className="space-y-1.5 mt-2">
                    {PREFIX_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleSavePrefix(opt.value)}
                        disabled={savingPrefix}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          slugPrefix === opt.value
                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                            : 'hover:bg-gray-50 border border-transparent text-gray-700'
                        }`}>
                        <span className="font-mono font-medium">{opt.label}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{opt.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Default destination URL */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Default Destination URL</p>
                  <p className="text-xs text-gray-500 mb-2">Pre-fills the URL field for every new link.</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={defaultDestUrl}
                      onChange={e => setDefaultDestUrl(e.target.value)}
                      placeholder="https://yourstore.com"
                      className="flex-1 border border-gray-300 rounded-lg text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={async () => {
                        await supabase.from('clients').update({ website_url: defaultDestUrl || null }).eq('id', clientId);
                        if (!destUrl) setDestUrl(defaultDestUrl);
                      }}
                      className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-800">
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {pageError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{pageError}</p>
        )}

        {/* Builder Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Link Builder</h2>
          <div className="space-y-4">

            {/* Destination URL */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Destination URL *</label>
              <input
                value={destUrl}
                onChange={e => setDestUrl(e.target.value)}
                placeholder="https://yourstore.com/products/..."
                className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {/* Partner + Affiliate Campaign */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Partner</label>
                <select
                  value={partnerId}
                  onChange={e => setPartnerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">No partner (direct)</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Affiliate Campaign</label>
                <select
                  value={affiliateCampaignId}
                  onChange={e => {
                    const id = e.target.value;
                    setAffiliateCampaignId(id);
                    if (id) {
                      const c = campaigns.find(c => c.id === id);
                      if (c?.default_utm_campaign) setCampaign(c.default_utm_campaign);
                      else if (c) setCampaign(c.slug);
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">No campaign</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* UTM Source + Campaign Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UTM Source <span className="text-gray-400 font-normal">(utm_source)</span></label>
                <input
                  value={utmSourceInput}
                  onChange={e => setUtmSourceInput(e.target.value)}
                  placeholder="e.g. meta, newsletter"
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Campaign Name <span className="text-gray-400 font-normal">(utm_campaign)</span></label>
                <input
                  value={campaign}
                  onChange={e => setCampaign(e.target.value)}
                  placeholder="e.g. summer24"
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {/* Medium + Window */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Medium</label>
                <select
                  value={medium}
                  onChange={e => setMedium(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Select medium…</option>
                  {['influencer', 'affiliate', 'email', 'cpc', 'social', 'referral', 'organic'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Attribution Window</label>
                <select
                  value={attrWindow}
                  onChange={e => setAttrWindow(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            </div>

            {/* UTM Content + Term */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  UTM Content <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="e.g. hero-banner"
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  UTM Term <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                  placeholder="e.g. keyword"
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {/* Preview */}
            {destUrl && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Preview</p>

                {/* Attribution URL — primary */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-600 font-medium">Attribution URL</p>
                    <span className="text-xs text-gray-400">Share directly — no redirect needed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-800 truncate">
                      {previewAttrUrl}
                    </code>
                    <button
                      onClick={() => handleCopy(previewAttrUrl, 'preview-attr')}
                      className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0">
                      {copiedId === 'preview-attr' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Attribution param: <code className="font-mono text-indigo-600">{slugPrefix}=<span className="opacity-60">{previewAttrValue}</span></code>
                    {' '}— auto-generated unique value, locked on save
                  </p>
                </div>

                {/* Short link — secondary note */}
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-500">
                    <Scissors className="w-3 h-3 inline mr-1 text-gray-400" />
                    Short link (<code className="font-mono">go.goself.app/s/…</code>) can be generated after saving — use it for Instagram bios, WhatsApp, or anywhere a long URL looks messy.
                  </p>
                </div>
              </div>
            )}

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-gray-900 text-white text-sm rounded-xl px-5 py-2 hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
                {saving ? 'Saving…' : <><Plus className="w-4 h-4" /> Save Link</>}
              </button>
            </div>
          </div>
        </div>

        {/* Saved Links */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">
              Saved Links
              {!loading && <span className="ml-2 text-xs font-normal text-gray-400">{links.length} total</span>}
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search links…"
                className="border border-gray-200 rounded-lg text-sm pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-16">
              <Link2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No UTM links yet</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? 'Try a different search' : 'Use the builder above to create your first trackable link'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Partner', 'Attribution Param', 'Source', 'Medium', 'Campaign', 'Short Link', 'Clicks', 'Created', 'Actions'].map(h => (
                      <th
                        key={h}
                        className="text-left text-xs text-gray-500 uppercase tracking-wide px-4 py-3 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLinks.map(link => {
                    const paramName = link.attribution_param_name || 'ref';
                    const paramValue = link.attribution_param_value;
                    const attrUrl = paramValue
                      ? buildAttributionUrl(
                          link.destination_url, paramName, paramValue,
                          link.utm_source ?? '', link.utm_medium ?? '',
                          link.utm_campaign ?? '', link.utm_content ?? '', link.utm_term ?? '',
                        )
                      : link.destination_url;
                    const shortUrl = link.slug ? `${SHORT_BASE}/${link.slug}` : null;

                    return (
                      <tr key={link.id} className="hover:bg-gray-50">

                        {/* Partner */}
                        <td className="px-4 py-3">
                          {link.partner ? (
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarGradient(link.partner.name)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                                {initials(link.partner.name)}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-900">{link.partner.name}</p>
                                <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${TYPE_BADGE[link.partner.partner_type]}`}>
                                  {link.partner.partner_type}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Attribution Param */}
                        <td className="px-4 py-3">
                          {paramValue ? (
                            <div className="flex items-center gap-1.5">
                              <code className="font-mono text-xs text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                                {paramName}=<span className="text-indigo-600">{paramValue}</span>
                              </code>
                              <button
                                onClick={() => handleCopy(attrUrl, `attr-${link.id}`)}
                                className="text-gray-400 hover:text-gray-700 flex-shrink-0"
                                title="Copy attribution URL">
                                {copiedId === `attr-${link.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-green-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Legacy link</span>
                          )}
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3 text-gray-600 text-xs">{link.utm_source ?? '—'}</td>

                        {/* Medium */}
                        <td className="px-4 py-3 text-xs">
                          {link.utm_medium ? (
                            <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">{link.utm_medium}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Campaign */}
                        <td className="px-4 py-3 text-gray-700 text-xs">{link.utm_campaign ?? '—'}</td>

                        {/* Short Link */}
                        <td className="px-4 py-3">
                          {shortUrl ? (
                            <div className="flex items-center gap-1.5">
                              <code className="font-mono text-xs text-gray-700">/s/{link.slug}</code>
                              <button
                                onClick={() => handleCopy(shortUrl, `short-${link.id}`)}
                                className="text-gray-400 hover:text-gray-700"
                                title="Copy short link">
                                {copiedId === `short-${link.id}` ? (
                                  <Check className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleShortenLink(link)}
                              disabled={shorteningId === link.id}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50">
                              <Scissors className="w-3 h-3" />
                              {shorteningId === link.id ? 'Generating…' : 'Shorten'}
                            </button>
                          )}
                        </td>

                        {/* Clicks */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-700">
                            <MousePointer className="w-3 h-3 text-gray-400" />
                            <span className="text-xs">{link.clicks.toLocaleString('en-IN')}</span>
                          </div>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(link.created_at)}</td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <a
                              href={link.destination_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
                              title="Open destination">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleDelete(link)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                              title="Delete link">
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      </div>

      {/* Close prefix dropdown on outside click */}
      {showPrefixSettings && (
        <div className="fixed inset-0 z-10" onClick={() => setShowPrefixSettings(false)} />
      )}
    </DashboardLayout>
  );
}
