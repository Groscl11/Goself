import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import {
  Users, Coins, Megaphone, GitBranch, Tag, ArrowRight,
  Link as LinkIcon, Copy, CheckCircle, Cog, BarChart3,
  CheckCircle2, XCircle, Puzzle, RefreshCw,
} from 'lucide-react';
import { supabase, supabaseUrl } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';
import { OnboardingModal } from '../../components/onboarding/OnboardingModal';
import { SetupGuide } from '../../components/onboarding/SetupGuide';
import { useShopifySession } from '../../hooks/useShopifySession';

interface DashboardStats {
  totalMembers: number;
  activeCampaigns: number;
  activeOffers: number;
  totalReferrals: number;
}

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  registration_enabled: boolean;
  onboarding_completed: boolean;
  setup_guide_dismissed: boolean;
  onboarding_goals: string[];
  logo_url: string;
  primary_color: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  industry: string;
}

export function ClientDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  useShopifySession();
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeCampaigns: 0,
    activeOffers: 0,
    totalReferrals: 0,
  });
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [widgetPlacements, setWidgetPlacements] = useState<{
    connected: boolean | null;
    placed: string[];
    theme_name?: string | null;
    scope_missing?: boolean;
    loadingWidgets: boolean;
  }>({ connected: null, placed: [], loadingWidgets: false });

  useEffect(() => {
    if (profile?.client_id) {
      loadClientInfo();
      loadStats();
      loadWidgetPlacements();
    }
  }, [profile]);

  const loadWidgetPlacements = async () => {
    setWidgetPlacements((p) => ({ ...p, loadingWidgets: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 10000);
      let res: Response | null = null;
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/get-widget-placements`, {
          signal: abort.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // timeout or network error
      } finally {
        clearTimeout(timeout);
      }
      if (res?.ok) {
        const data = await res.json();
        setWidgetPlacements({
          connected: data.connected ?? false,
          placed: data.placed ?? [],
          theme_name: data.theme_name ?? null,
          scope_missing: data.scope_missing ?? false,
          loadingWidgets: false,
        });
      } else {
        setWidgetPlacements((p) => ({ ...p, loadingWidgets: false }));
      }
    } catch {
      setWidgetPlacements((p) => ({ ...p, loadingWidgets: false }));
    }
  };

  const loadClientInfo = async () => {
    if (!profile?.client_id) return;
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, slug, registration_enabled, onboarding_completed, setup_guide_dismissed, onboarding_goals, logo_url, primary_color, contact_email, contact_phone, website_url, industry')
        .eq('id', profile.client_id)
        .maybeSingle();
      if (data) {
        setClientInfo(data);
        // Show onboarding popup if not yet completed — stays on dashboard, no redirect.
        if (!data.onboarding_completed) {
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      console.error('Error loading client info:', error);
    }
  };

  const loadStats = async () => {
    if (!profile?.client_id) return;
    try {
      const [members, campaigns, offers] = await Promise.all([
        supabase
          .from('member_users')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.client_id),
        supabase
          .from('campaign_rules')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', profile.client_id)
          .eq('is_active', true),
        supabase
          .from('rewards')
          .select('id', { count: 'exact', head: true })
          .eq('owner_client_id', profile.client_id),
      ]);

      // Referrals require the loyalty program id first
      let totalReferrals = 0;
      try {
        const { data: program } = await supabase
          .from('loyalty_programs')
          .select('id')
          .eq('client_id', profile.client_id)
          .eq('is_active', true)
          .maybeSingle();
        if (program) {
          const { count } = await supabase
            .from('member_referrals')
            .select('id', { count: 'exact', head: true })
            .eq('loyalty_program_id', program.id);
          totalReferrals = count || 0;
        }
      } catch {
        // referral table may not be populated yet
      }

      setStats({
        totalMembers: members.count || 0,
        activeCampaigns: campaigns.count || 0,
        activeOffers: offers.count || 0,
        totalReferrals,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const APP_PUBLIC_URL = 'https://app.goself.in';

  const copyRegistrationLink = async () => {
    if (!clientInfo) return;
    const registrationUrl = `${APP_PUBLIC_URL}/join/${clientInfo.slug}`;
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const statCards = [
    { label: 'Total Members', value: stats.totalMembers, icon: <Users className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Active Campaigns', value: stats.activeCampaigns, icon: <Megaphone className="w-5 h-5 text-violet-600" />, bg: 'bg-violet-50', color: 'text-violet-600' },
    { label: 'Total Offers', value: stats.activeOffers, icon: <Tag className="w-5 h-5 text-orange-600" />, bg: 'bg-orange-50', color: 'text-orange-600' },
    { label: 'Total Referrals', value: stats.totalReferrals, icon: <GitBranch className="w-5 h-5 text-green-600" />, bg: 'bg-green-50', color: 'text-green-600' },
  ];

  const moduleCards = [
    {
      title: 'Loyalty',
      description: 'Manage points, tiers, and member earning rules. Build a lasting relationship with every purchase.',
      icon: <Coins className="w-6 h-6 text-blue-600" />,
      iconBg: 'bg-blue-50',
      metrics: [
        { label: 'Members', value: loading ? '…' : stats.totalMembers },
      ],
      primaryAction: { label: 'View Members', path: '/client/members' },
      secondaryAction: { label: 'Earn Rules', path: '/client/loyalty-config' },
      accent: 'border-l-blue-500',
    },
    {
      title: 'Referral',
      description: 'Track referral codes, reward successful conversions, and grow your member base organically.',
      icon: <GitBranch className="w-6 h-6 text-green-600" />,
      iconBg: 'bg-green-50',
      metrics: [
        { label: 'Referrals', value: loading ? '…' : stats.totalReferrals },
      ],
      primaryAction: { label: 'Track Referrals', path: '/client/referral-tracking' },
      secondaryAction: { label: 'Reward Links', path: '/client/tokenized-links' },
      accent: 'border-l-green-500',
    },
    {
      title: 'Rewards & Offers',
      description: 'Create campaigns, publish offers, connect brand partners, and distribute rewards at scale.',
      icon: <Tag className="w-6 h-6 text-orange-600" />,
      iconBg: 'bg-orange-50',
      metrics: [
        { label: 'Active Campaigns', value: loading ? '…' : stats.activeCampaigns },
        { label: 'Offers', value: loading ? '…' : stats.activeOffers },
      ],
      primaryAction: { label: 'View Campaigns', path: '/client/campaigns' },
      secondaryAction: { label: 'Browse Offers', path: '/client/offers' },
      accent: 'border-l-orange-500',
    },
  ];

  // Storefront widgets — placed in Online Store theme, auto-detected via theme asset scan
  const STOREFRONT_BLOCKS = [
    { slug: 'loyalty-widget',                  name: 'Loyalty Rewards Widget',        desc: 'Floating sidebar with points balance, tiers & rewards' },
    { slug: 'loyalty-page',                    name: 'Loyalty Landing Page',          desc: 'Full-page loyalty hub embedded in your storefront' },
    { slug: 'cart-points',                     name: 'Cart Points Banner',             desc: 'Shows points to be earned on the cart page' },
    { slug: 'cart-drawer-points',              name: 'Cart Drawer Points',             desc: 'Points preview inside the cart drawer / slide-out' },
    { slug: 'product-points',                  name: 'Product Points Banner',          desc: 'Points earned shown on each product page' },
    { slug: 'collection-points',               name: 'Collection Points Banner',       desc: 'Points preview on collection / category pages' },
    { slug: 'pre-purchase-homepage-hero',      name: 'PPR – Homepage Hero',            desc: 'Pre-purchase rewards banner in the homepage hero' },
    { slug: 'pre-purchase-sticky-banner',      name: 'PPR – Sticky Banner',            desc: 'Sticky top/bottom rewards announcement bar' },
    { slug: 'pre-purchase-collection-banner',  name: 'PPR – Collection Banner',        desc: 'Pre-purchase rewards callout on collection pages' },
    { slug: 'pre-purchase-product-strip',      name: 'PPR – Product Strip',            desc: 'Inline rewards strip on product pages' },
    { slug: 'refer-a-friend',                  name: 'Refer a Friend',                 desc: 'Referral widget for sharing codes & tracking rewards' },
  ];

  // Checkout widgets — placed via Shopify Checkout Editor (Thank You / Order Status page)
  // Shopify does not expose checkout extension placement via Admin API; status cannot be auto-detected.
  const CHECKOUT_BLOCKS = [
    { handle: 'campaign-reward-banner',    name: 'Post Purchase Rewards',           desc: 'Promotes a campaign reward on the Thank You & Order Status pages' },
    { handle: 'instant-thankyou-widget',   name: 'Instant Post-Purchase Rewards',   desc: 'Instant reward claim widget shown after order confirmation' },
    { handle: 'order-status-rewards',      name: 'Loyalty Points On Order',         desc: 'Shows points earned from the current order on confirmation page' },
    { handle: 'referral-widget',           name: 'Referral Widget',                 desc: 'Lets customers share their referral link right after checkout' },
  ];

  const quickActions = [
    { label: 'Configure Earn Rules', desc: 'Set up how members earn points', icon: <Cog className="w-5 h-5" />, path: '/client/loyalty-config', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
    { label: 'Create Campaign', desc: 'Launch a new reward campaign', icon: <Megaphone className="w-5 h-5" />, path: '/client/campaigns', color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
    { label: 'Create Offer', desc: 'Add a discount or partner voucher', icon: <Tag className="w-5 h-5" />, path: '/client/offers', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
    { label: 'View Reports', desc: 'Analyse member and campaign data', icon: <BarChart3 className="w-5 h-5" />, path: '/client/reports', color: 'text-gray-700 bg-gray-100 hover:bg-gray-200' },
  ];

  return (
    <DashboardLayout menuItems={clientMenuItems} title="GoSelf">
      {/* Onboarding popup — shown only when onboarding_completed = false */}
      {showOnboarding && clientInfo && (
        <OnboardingModal
          clientId={clientInfo.id}
          initialData={{
            name: clientInfo.name || '',
            logo_url: clientInfo.logo_url || '',
            primary_color: clientInfo.primary_color || '#7c3aed',
            contact_email: clientInfo.contact_email || profile?.email || '',
            contact_phone: clientInfo.contact_phone || '',
            website_url: clientInfo.website_url || '',
            industry: clientInfo.industry || '',
            onboarding_goals: clientInfo.onboarding_goals || [],
          }}
          onComplete={() => {
            setShowOnboarding(false);
            setClientInfo((prev) => prev ? { ...prev, onboarding_completed: true } : prev);
          }}
        />
      )}
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {clientInfo?.name ? `${clientInfo.name}` : 'Dashboard'}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{today}</p>
          </div>
        </div>

        {/* ── Setup guide — shown until dismissed or all steps done ── */}
        {clientInfo && !clientInfo.setup_guide_dismissed && (
          <SetupGuide
            clientId={clientInfo.id}
            brandProfileDone={clientInfo.onboarding_completed}
            onDismiss={() => setClientInfo((prev) => prev ? { ...prev, setup_guide_dismissed: true } : prev)}
          />
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? <span className="inline-block w-8 h-5 bg-gray-100 rounded animate-pulse" /> : stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── 3 Module cards ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {moduleCards.map((mod) => (
              <div
                key={mod.title}
                className={`bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col border-l-4 ${mod.accent}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${mod.iconBg}`}>{mod.icon}</div>
                  <h3 className="font-semibold text-gray-900">{mod.title}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{mod.description}</p>

                {/* Metrics */}
                <div className="flex gap-4 mb-4">
                  {mod.metrics.map((m) => (
                    <div key={m.label}>
                      <p className="text-xs text-gray-400">{m.label}</p>
                      <p className="text-lg font-bold text-gray-900">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => navigate(mod.primaryAction.path)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {mod.primaryAction.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => navigate(mod.secondaryAction.path)}
                    className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {mod.secondaryAction.label}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick Actions + Registration Link ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-700">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="p-3 rounded-xl text-left transition-colors border border-transparent hover:border-gray-100 hover:shadow-sm"
                >
                  <div className={`inline-flex p-2 rounded-lg mb-2 ${action.color}`}>
                    {action.icon}
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-tight">{action.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {clientInfo?.registration_enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <LinkIcon className="w-4 h-4" />
                  Member Registration Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-500">
                  Share this link so customers can register and join your loyalty program.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs text-gray-700 truncate">
                    {APP_PUBLIC_URL}/join/{clientInfo.slug}
                  </div>
                  <button
                    onClick={copyRegistrationLink}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
                  >
                    {copiedLink ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Members who join through this link are automatically linked to your account.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Plugin Widgets ── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Plugin Widgets</h2>
          </div>

          {/* ── Storefront widgets (auto-detected) ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Storefront Widgets</p>
                {widgetPlacements.theme_name && (
                  <p className="text-xs text-gray-400 mt-0.5">Theme: {widgetPlacements.theme_name}</p>
                )}
              </div>
              <button
                onClick={loadWidgetPlacements}
                disabled={widgetPlacements.loadingWidgets}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${widgetPlacements.loadingWidgets ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {widgetPlacements.connected === false ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                <Puzzle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700">No Shopify store connected. Install the Loyalty by Goself app to see widget placement status.</p>
              </div>
            ) : widgetPlacements.scope_missing ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Puzzle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Permission update required</p>
                  <p className="text-sm text-blue-700 mt-1">The app needs a new "read themes" permission to detect widget placements. Please reinstall or re-authorize the Loyalty by Goself app in your Shopify store.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {STOREFRONT_BLOCKS.map((block) => {
                  const isPlaced = widgetPlacements.placed.includes(block.slug);
                  const isLoading = widgetPlacements.loadingWidgets || widgetPlacements.connected === null;
                  return (
                    <div
                      key={block.slug}
                      className={`bg-white border rounded-xl p-4 flex items-start gap-3 shadow-sm ${
                        isLoading ? 'opacity-60' : ''
                      } ${isPlaced ? 'border-green-200' : 'border-gray-100'}`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${isPlaced ? 'text-green-500' : 'text-gray-300'}`}>
                        {isLoading ? (
                          <div className="w-5 h-5 rounded-full bg-gray-100 animate-pulse" />
                        ) : isPlaced ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{block.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{block.desc}</p>
                        {!isLoading && (
                          <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isPlaced ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {isPlaced ? 'Active in theme' : 'Not placed'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Checkout widgets (placed via Shopify Checkout Editor) ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Checkout Widgets</p>
                <p className="text-xs text-gray-400 mt-0.5">Placed via Shopify Checkout Editor → Thank You / Order Status</p>
              </div>
              {clientInfo?.slug && (
                <a
                  href="https://admin.shopify.com/store/settings/checkout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Open Checkout Editor
                  <ArrowRight className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CHECKOUT_BLOCKS.map((block) => (
                <div
                  key={block.handle}
                  className="bg-white border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-sm"
                >
                  <div className="mt-0.5 flex-shrink-0 text-blue-400">
                    <Puzzle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-tight">{block.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{block.desc}</p>
                    <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      Managed in Shopify
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
