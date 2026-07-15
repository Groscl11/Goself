import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Link2, Plus, X, Copy, Check, Trash2, Search, MousePointer,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerType = 'influencer' | 'creator' | 'brand' | 'other';

interface Partner {
  id: string;
  name: string;
  partner_type: PartnerType;
}

interface UTMLink {
  id: string;
  client_id: string;
  partner_id: string | null;
  slug: string;
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
  creator: 'bg-orange-100 text-orange-700',
  brand: 'bg-blue-100 text-blue-700',
  other: 'bg-gray-100 text-gray-600',
};

function buildUtmUrl(destUrl: string, source: string, medium: string, campaign: string, content: string, term: string, slug: string): string {
  if (!destUrl) return '';
  const params: string[] = [];
  if (source) params.push(`utm_source=${encodeURIComponent(source)}`);
  if (medium) params.push(`utm_medium=${encodeURIComponent(medium)}`);
  if (campaign) params.push(`utm_campaign=${encodeURIComponent(campaign)}`);
  if (content) params.push(`utm_content=${encodeURIComponent(content)}`);
  if (term) params.push(`utm_term=${encodeURIComponent(term)}`);
  if (slug) params.push(`ref=ATT-${encodeURIComponent(slug)}`);
  const separator = destUrl.includes('?') ? '&' : '?';
  return params.length > 0 ? `${destUrl}${separator}${params.join('&')}` : destUrl;
}

function computeSlug(partnerName: string, campaign: string): string {
  const prefix = partnerName
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  const suffix = campaign
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);
  if (!prefix && !suffix) return '';
  if (!suffix) return prefix;
  if (!prefix) return suffix;
  return `${prefix}-${suffix}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UTMLinksPage() {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? '';

  const [links, setLinks] = useState<UTMLink[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Builder form state
  const [destUrl, setDestUrl] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [campaign, setCampaign] = useState('');
  const [medium, setMedium] = useState('');
  const [slug, setSlug] = useState('');
  const [attrWindow, setAttrWindow] = useState(30);
  const [content, setContent] = useState('');
  const [term, setTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setPageError('');
    const [{ data: partnersData, error: pErr }, { data: linksData, error: lErr }] =
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
      ]);
    if (pErr) setPageError(pErr.message);
    if (lErr) setPageError(lErr.message);
    setPartners((partnersData as Partner[]) ?? []);
    setLinks((linksData as UTMLink[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived values
  const selectedPartner = useMemo(
    () => partners.find(p => p.id === partnerId) ?? null,
    [partners, partnerId]
  );

  const utmSource = useMemo(() => {
    if (selectedPartner) return selectedPartner.name.toLowerCase().replace(/\s+/g, '-');
    return 'direct';
  }, [selectedPartner]);

  const computedSlug = useMemo(
    () => computeSlug(selectedPartner?.name ?? '', campaign),
    [selectedPartner, campaign]
  );

  const finalSlugDisplay = slug || computedSlug || 'your-slug';
  const shortLink = `https://go.goself.app/s/${finalSlugDisplay}`;
  const fullUtmUrl = useMemo(
    () => buildUtmUrl(destUrl, utmSource, medium, campaign, content, term, finalSlugDisplay),
    [destUrl, utmSource, medium, campaign, content, term, finalSlugDisplay]
  );

  async function handleSave() {
    if (!destUrl.trim()) { setSaveError('Destination URL is required.'); return; }
    if (!partnerId && !campaign.trim()) { setSaveError('Select a partner or enter a campaign name.'); return; }

    setSaving(true);
    setSaveError('');

    try {
      let finalSlug = slug.trim() || computedSlug;
      if (!finalSlug) finalSlug = `link-${Date.now()}`;

      // Ensure uniqueness
      let candidate = finalSlug;
      let suffix = 2;
      while (true) {
        const { data: existing } = await supabase
          .from('attribution_utm_links')
          .select('id')
          .eq('client_id', clientId)
          .eq('slug', candidate)
          .maybeSingle();
        if (!existing) break;
        candidate = `${finalSlug}-${suffix}`;
        suffix++;
      }

      const { error: e } = await supabase.from('attribution_utm_links').insert({
        client_id: clientId,
        partner_id: partnerId || null,
        slug: candidate,
        destination_url: destUrl.trim(),
        utm_source: utmSource || null,
        utm_medium: medium || null,
        utm_campaign: campaign || null,
        utm_content: content || null,
        utm_term: term || null,
        attribution_window_days: attrWindow,
        clicks: 0,
      });
      if (e) throw e;

      // Reset form
      setDestUrl('');
      setPartnerId('');
      setCampaign('');
      setMedium('');
      setSlug('');
      setAttrWindow(30);
      setContent('');
      setTerm('');
      await loadData();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save link.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(link: UTMLink) {
    if (!window.confirm(`Delete link /s/${link.slug}? This cannot be undone.`)) return;
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
        l.slug.toLowerCase().includes(q) ||
        (l.utm_campaign ?? '').toLowerCase().includes(q) ||
        (l.partner?.name ?? '').toLowerCase().includes(q)
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
        </div>

        {pageError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{pageError}</p>
        )}

        {/* Builder Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Link Builder</h2>

          <div className="space-y-4">
            {/* Row 1: Destination URL */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Destination URL *
              </label>
              <input
                value={destUrl}
                onChange={e => setDestUrl(e.target.value)}
                placeholder="https://yourstore.com/products/..."
                className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {/* Row 2: Partner + Campaign */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Partner</label>
                <select
                  value={partnerId}
                  onChange={e => setPartnerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">No partner (direct)</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Campaign Name
                </label>
                <input
                  value={campaign}
                  onChange={e => setCampaign(e.target.value)}
                  placeholder="e.g. summer24"
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {/* Row 3: Medium + Window + Slug */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Medium</label>
                <select
                  value={medium}
                  onChange={e => setMedium(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Select medium…</option>
                  {['influencer', 'affiliate', 'email', 'cpc', 'social', 'referral', 'organic'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Attribution Window
                </label>
                <select
                  value={attrWindow}
                  onChange={e => setAttrWindow(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Custom Slug{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  value={slug}
                  onChange={e => setSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                  placeholder={computedSlug || 'auto-generated'}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {/* Row 4: Content + Term */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  UTM Content{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
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
                  UTM Term{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
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
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Preview
                </p>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Short Link</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-800 truncate">
                      {shortLink}
                    </code>
                    <button
                      onClick={() => handleCopy(shortLink, 'preview-short')}
                      className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0"
                    >
                      {copiedId === 'preview-short' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Full UTM URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-800 truncate">
                      {fullUtmUrl}
                    </code>
                    <button
                      onClick={() => handleCopy(fullUtmUrl, 'preview-full')}
                      className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0"
                    >
                      {copiedId === 'preview-full' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
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
                className="bg-gray-900 text-white text-sm rounded-xl px-5 py-2 hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  'Saving…'
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Save Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Saved Links */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">
              Saved Links
              {!loading && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {links.length} total
                </span>
              )}
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
                    {['Short Link', 'Partner', 'Campaign', 'Medium', 'Clicks', 'Created', 'Actions'].map(h => (
                      <th
                        key={h}
                        className="text-left text-xs text-gray-500 uppercase tracking-wide px-4 py-3 font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLinks.map(link => {
                    const linkShort = `https://go.goself.app/s/${link.slug}`;
                    const linkFull = buildUtmUrl(
                      link.destination_url,
                      link.utm_source ?? '',
                      link.utm_medium ?? '',
                      link.utm_campaign ?? '',
                      link.utm_content ?? '',
                      link.utm_term ?? '',
                      link.slug
                    );
                    return (
                      <tr key={link.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <code className="font-mono text-xs text-gray-800">
                              /s/{link.slug}
                            </code>
                            <button
                              onClick={() => handleCopy(linkShort, `short-${link.id}`)}
                              className="text-gray-400 hover:text-gray-700 flex-shrink-0"
                              title="Copy short link"
                            >
                              {copiedId === `short-${link.id}` ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {link.partner ? (
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarGradient(link.partner.name)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
                              >
                                {initials(link.partner.name)}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-900">
                                  {link.partner.name}
                                </p>
                                <span
                                  className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${TYPE_BADGE[link.partner.partner_type]}`}
                                >
                                  {link.partner.partner_type}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-xs">
                          {link.utm_campaign ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {link.utm_medium ? (
                            <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                              {link.utm_medium}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-700">
                            <MousePointer className="w-3 h-3 text-gray-400" />
                            <span className="text-xs">{link.clicks.toLocaleString('en-IN')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {fmtDate(link.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopy(linkFull, `full-${link.id}`)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
                              title="Copy full UTM URL"
                            >
                              {copiedId === `full-${link.id}` ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(link)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                              title="Delete link"
                            >
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
    </DashboardLayout>
  );
}
