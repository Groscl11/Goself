import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Lock,
  ArrowUpRight,
  Layers,
  Zap,
  GitBranch,
  Globe,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';

interface ClientConfig {
  plan: {
    id: string;
    name: string;
    price_monthly: number;
    price_annual: number;
  } | null;
  modules: string[];
  features: string[];
  locked_feature_hints: Record<string, string>;
}

interface Subscription {
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: 'monthly' | 'annual';
  amount_inr: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  payment_method: string;
  notes: string | null;
}

// ─── Feature matrix ───────────────────────────────────────────────────────────

interface FeatureDef { key: string; label: string }
const MODULES: { key: string; label: string; icon: JSX.Element; features: FeatureDef[] }[] = [
  {
    key: 'loyalty',
    label: 'Loyalty',
    icon: <Layers className="w-5 h-5" />,
    features: [
      { key: 'loyalty.points_earn',          label: 'Points Earn' },
      { key: 'loyalty.points_balance',       label: 'Points Balance' },
      { key: 'loyalty.tiers',                label: 'Tiers' },
      { key: 'loyalty.redemption',           label: 'Redemption' },
      { key: 'loyalty.product_page_points',  label: 'Product Page Points' },
      { key: 'loyalty.thankyou_page_points', label: 'Thank You Page Points' },
      { key: 'loyalty.member_widget',        label: 'Member Widget' },
    ],
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    icon: <Zap className="w-5 h-5" />,
    features: [
      { key: 'campaigns.order_value_trigger', label: 'Order Value Trigger' },
      { key: 'campaigns.auto_enrollment',     label: 'Auto Enrollment' },
      { key: 'campaigns.advanced_conditions', label: 'Advanced Conditions' },
      { key: 'campaigns.analytics',           label: 'Analytics' },
    ],
  },
  {
    key: 'referral',
    label: 'Referral',
    icon: <GitBranch className="w-5 h-5" />,
    features: [
      { key: 'referral.link_generation',     label: 'Link Generation' },
      { key: 'referral.tracking',            label: 'Tracking' },
      { key: 'referral.tiered_commissions',  label: 'Tiered Commissions' },
      { key: 'referral.affiliate_dashboard', label: 'Affiliate Dashboard' },
    ],
  },
  {
    key: 'network',
    label: 'Network',
    icon: <Globe className="w-5 h-5" />,
    features: [
      { key: 'network.cross_brand_vouchers', label: 'Cross-Brand Vouchers' },
      { key: 'network.brand_marketplace',   label: 'Brand Marketplace' },
      { key: 'network.analytics',           label: 'Analytics' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; className: string; icon: JSX.Element }> = {
  trialing:  { label: 'Trial',     className: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" /> },
  active:    { label: 'Active',    className: 'bg-green-100 text-green-800',   icon: <CheckCircle className="w-4 h-4" /> },
  past_due:  { label: 'Past Due',  className: 'bg-orange-100 text-orange-800', icon: <AlertCircle className="w-4 h-4" /> },
  suspended: { label: 'Suspended', className: 'bg-red-100 text-red-800',       icon: <XCircle className="w-4 h-4" /> },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700',     icon: <XCircle className="w-4 h-4" /> },
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanBilling() {
  const { session, profile } = useAuth();

  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.client_id) load();
  }, [profile?.client_id, session]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lizgppzyyljqbmzdytia.supabase.co';

      // Fetch config from edge function using the current session JWT
      const token = session?.access_token;
      const configRes = await fetch(`${supabaseUrl}/functions/v1/get-client-config`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data);
      } else {
        // Fallback: load from DB directly
        if (profile?.client_id) {
          const [planFeatRes, planModRes, subRes] = await Promise.all([
            supabase.from('plan_feature_entitlements').select('feature').eq('plan_id', 'free'),
            supabase.from('plan_module_entitlements').select('module').eq('plan_id', 'free'),
            supabase.from('client_subscriptions').select('*').eq('client_id', profile.client_id).maybeSingle(),
          ]);

          const planId = subRes.data?.plan_id ?? 'free';

          const [pf2, pm2, planData] = await Promise.all([
            supabase.from('plan_feature_entitlements').select('feature').eq('plan_id', planId),
            supabase.from('plan_module_entitlements').select('module').eq('plan_id', planId),
            supabase.from('plans').select('*').eq('id', planId).maybeSingle(),
          ]);

          const modules = (pm2.data || []).map((r: any) => r.module);
          const features = (pf2.data || []).map((r: any) => r.feature);

          setConfig({
            plan: planData.data || null,
            modules,
            features,
            locked_feature_hints: {},
          });
        }
      }

      // Always fetch subscription from DB for accurate display
      if (profile?.client_id) {
        const { data: subData } = await supabase
          .from('client_subscriptions')
          .select('*')
          .eq('client_id', profile.client_id)
          .maybeSingle();
        setSubscription(subData ?? null);
      }
    } catch (err: any) {
      console.error('Error loading billing info:', err);
      setError('Failed to load billing information. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeContact = (moduleName: string) => {
    const message = encodeURIComponent(
      `Hi! I'd like to upgrade my GoSelf plan to access the ${moduleName} module. My account: ${profile?.email}`
    );
    window.open(`https://wa.me/60123456789?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Plan & Billing">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-gray-500">Loading billing info…</div>
        </div>
      </DashboardLayout>
    );
  }

  const status = subscription?.status ?? 'active';
  const statusConfig = STATUS_CONFIG[status as SubscriptionStatus] ?? STATUS_CONFIG.active;
  const planName = config?.plan?.name ?? (subscription?.plan_id ?? 'Free');
  const enabledFeatures = new Set(config?.features ?? []);
  const enabledModules = new Set(config?.modules ?? []);

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Plan & Billing">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan &amp; Billing</h1>
          <p className="text-gray-500 text-sm mt-1">Your current subscription and feature access</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Current plan card */}
        <Card padding="none">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-gray-900 capitalize">{planName}</h2>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusConfig.className}`}>
                      {statusConfig.icon}
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {subscription?.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} billing
                    {subscription?.payment_method && subscription.payment_method !== 'manual' && (
                      <> · via {subscription.payment_method}</>
                    )}
                  </p>
                </div>
              </div>

              {/* Amount */}
              {subscription?.amount_inr != null && (
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold text-gray-900">
                    ₹{subscription.amount_inr.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    per {subscription.billing_cycle === 'annual' ? 'year' : 'month'}
                  </div>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {subscription?.trial_ends_at && status === 'trialing' && (
                <div className="bg-yellow-50 rounded-lg px-4 py-3">
                  <div className="text-xs text-yellow-700 mb-0.5">Trial ends</div>
                  <div className="text-sm font-semibold text-yellow-900">{fmt(subscription.trial_ends_at)}</div>
                </div>
              )}
              {subscription?.current_period_end && (
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <div className="text-xs text-gray-500 mb-0.5">Next renewal</div>
                  <div className="text-sm font-semibold text-gray-900">{fmt(subscription.current_period_end)}</div>
                </div>
              )}
              {subscription?.notes && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 col-span-2 sm:col-span-1">
                  <div className="text-xs text-blue-600 mb-0.5">Deal note</div>
                  <div className="text-sm text-blue-900 line-clamp-2">{subscription.notes}</div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Feature matrix */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Features &amp; Access</h2>
          <div className="space-y-4">
            {MODULES.map(({ key: modKey, label: modLabel, icon: modIcon, features }) => {
              const modEnabled = enabledModules.has(modKey);
              const enabledCount = features.filter((f) => enabledFeatures.has(f.key)).length;
              const isModuleLocked = !modEnabled && enabledCount === 0;

              return (
                <Card key={modKey} padding="none">
                  <div className={`flex items-center gap-3 px-6 py-4 rounded-t-lg ${
                    modEnabled ? 'bg-green-50 border-b border-green-100' : 'bg-gray-50 border-b border-gray-100'
                  }`}>
                    <span className={modEnabled ? 'text-green-600' : 'text-gray-400'}>{modIcon}</span>
                    <h3 className={`font-semibold ${modEnabled ? 'text-green-900' : 'text-gray-500'}`}>
                      {modLabel}
                    </h3>
                    {modEnabled ? (
                      <span className="ml-auto text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        Included
                      </span>
                    ) : (
                      <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        Not included
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-gray-50">
                    {features.map(({ key: featKey, label: featLabel }) => {
                      const featureEnabled = enabledFeatures.has(featKey);
                      const hint = config?.locked_feature_hints?.[featKey];

                      return (
                        <div key={featKey} className="flex items-center gap-4 px-6 py-3">
                          {featureEnabled ? (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <Lock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          )}
                          <span className={`text-sm flex-1 ${featureEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                            {featLabel}
                          </span>
                          {!featureEnabled && hint && (
                            <span className="text-xs text-blue-600 font-medium">{hint}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Upgrade CTA for locked modules */}
                  {isModuleLocked && (
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-100 rounded-b-lg flex items-center justify-between gap-4">
                      <p className="text-sm text-blue-700">
                        Unlock the <strong>{modLabel}</strong> module to access these features.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleUpgradeContact(modLabel)}
                        className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <MessageCircle className="w-4 h-4 mr-1.5" />
                        Talk to us
                        <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Upgrade CTA footer */}
        <Card>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Need more features?</h3>
              <p className="text-sm text-gray-500">
                Contact us to upgrade your plan or discuss a custom arrangement.
              </p>
            </div>
            <Button
              onClick={() => handleUpgradeContact('your plan')}
              className="flex-shrink-0"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Contact Sales
              <ArrowUpRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
