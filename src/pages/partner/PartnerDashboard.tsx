import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2, LogOut, Tag, Link2, ShoppingBag, TrendingUp,
  Copy, Check, AlertCircle, ExternalLink, ChevronDown,
} from 'lucide-react';
import { supabase, supabaseUrl } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientInfo { name: string; logo_url: string | null; primary_color: string }
interface PartnerInfo { id: string; name: string; partner_type: string }
interface Stats { orders: number; revenue: number; total_clicks: number; active_codes: number }
interface CodeAssignment {
  id: string; code: string; discount_description: string | null;
  status: string; assigned_at: string; code_source: string;
}
interface UTMLink {
  id: string; slug: string; destination_url: string;
  utm_campaign: string | null; utm_medium: string | null; clicks: number;
}
interface AttributedOrder {
  order_id: string; total_price: number; processed_at: string; matched_code: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const DAYS_OPTIONS = [7, 30, 90] as const;

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PartnerDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [codes, setCodes] = useState<CodeAssignment[]>([]);
  const [utmLinks, setUtmLinks] = useState<UTMLink[]>([]);
  const [orders, setOrders] = useState<AttributedOrder[]>([]);
  const [showOrders, setShowOrders] = useState(false);

  const accent = client?.primary_color || '#6366f1';

  const loadStats = useCallback(async (periodDays: number) => {
    setLoading(true);
    setError('');
    try {
      // Handle magic link redirect: #access_token=... is in the URL hash
      // supabase-js detects this automatically, but we give it a moment to process
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Wait for the auth state change event (magic link processing)
        await new Promise<void>(resolve => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            if (s) { subscription.unsubscribe(); resolve(); }
          });
          // Fallback timeout — if no event in 3s, give up
          setTimeout(() => { subscription.unsubscribe(); resolve(); }, 3000);
        });
        const refreshed = await supabase.auth.getSession();
        session = refreshed.data.session;
      }
      if (!session) { navigate(`/partner/${slug}`, { replace: true }); return; }

      const res = await fetch(`${supabaseUrl}/functions/v1/get-partner-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ client_slug: slug, days: periodDays }),
      });

      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { throw new Error(`Server error ${res.status}`); }

      if (!res.ok) {
        if (res.status === 403) {
          // Email not in affiliate_partners for this client
          await supabase.auth.signOut();
          navigate(`/partner/${slug}?denied=1`, { replace: true });
          return;
        }
        throw new Error(data.error || `Error ${res.status}`);
      }

      setClient(data.client);
      setPartner(data.partner);
      setStats(data.stats);
      setCodes(data.code_assignments ?? []);
      setUtmLinks(data.utm_links ?? []);
      setOrders(data.attributed_orders ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => { loadStats(days); }, [days, loadStats]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate(`/partner/${slug}`, { replace: true });
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading && !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={() => navigate(`/partner/${slug}`)} className="text-sm text-indigo-500 hover:underline">
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {client?.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-8 object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + '20' }}>
                <Building2 className="h-4 w-4" style={{ color: accent }} />
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Partner Portal</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{client?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {partner && (
              <span className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
                Hi, <span className="font-medium text-gray-700 dark:text-gray-300">{partner.name}</span>
              </span>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error banner (soft refresh error) */}
        {error && client && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Period selector + title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Your Performance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {partner?.partner_type && (
                <span className="capitalize mr-1">{partner.partner_type}</span>
              )}
              · Updated just now
            </p>
          </div>

          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  days === d
                    ? 'text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                style={days === d ? { backgroundColor: accent } : undefined}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Revenue', value: stats ? fmt(stats.revenue) : '—', icon: TrendingUp, sub: `Last ${days} days` },
            { label: 'Orders', value: stats?.orders ?? '—', icon: ShoppingBag, sub: `Last ${days} days` },
            { label: 'Active Codes', value: stats?.active_codes ?? '—', icon: Tag, sub: 'All time' },
            { label: 'Link Clicks', value: stats?.total_clicks ?? '—', icon: Link2, sub: 'All time' },
          ].map(({ label, value, icon: Icon, sub }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + '15' }}>
                  <Icon className="h-4 w-4" style={{ color: accent }} />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {loading ? <span className="inline-block h-7 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /> : value}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Coupon codes */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Your Coupon Codes</h2>
            <span className="ml-auto text-xs text-gray-400">{codes.length} code{codes.length !== 1 ? 's' : ''}</span>
          </div>

          {codes.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No coupon codes assigned yet. Contact {client?.name} to get your codes.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {codes.map(c => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{c.code}</span>
                      <CopyButton text={c.code} />
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        c.status === 'active'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    {c.discount_description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.discount_description}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {new Date(c.assigned_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* UTM links */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Your Tracking Links</h2>
            <span className="ml-auto text-xs text-gray-400">{utmLinks.length} link{utmLinks.length !== 1 ? 's' : ''}</span>
          </div>

          {utmLinks.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No tracking links assigned yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {utmLinks.map(l => {
                const shortUrl = `https://go.goself.app/s/${l.slug}`;
                return (
                  <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {l.utm_campaign || l.slug}
                        </span>
                        <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <CopyButton text={shortUrl} />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">{shortUrl}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{l.clicks.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">clicks</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Attributed orders */}
        {orders.length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowOrders(v => !v)}
              className="w-full px-5 py-4 flex items-center gap-2 text-left"
            >
              <ShoppingBag className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                Attributed Orders ({orders.length})
              </h2>
              <ChevronDown className={`ml-auto h-4 w-4 text-gray-400 transition-transform ${showOrders ? 'rotate-180' : ''}`} />
            </button>

            {showOrders && (
              <div className="border-t border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 dark:text-gray-400 px-5 py-2 border-b border-gray-100 dark:border-gray-700">
                  <span>Order</span>
                  <span>Code used</span>
                  <span className="text-right">Revenue</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                  {orders.map(o => (
                    <div key={o.order_id} className="grid grid-cols-3 px-5 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">#{o.order_id}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(o.processed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-gray-600 dark:text-gray-300 self-center">{o.matched_code}</span>
                      <span className="text-right font-semibold text-gray-900 dark:text-white tabular-nums self-center">
                        {fmt(o.total_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-4">
          Powered by <span className="font-medium">Goself</span> · Attribution is based on discount code usage in the last {days} days
        </p>
      </main>
    </div>
  );
}
