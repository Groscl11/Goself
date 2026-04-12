import { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  sort_order: number;
}

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

interface Invoice {
  id: string;
  invoice_number: string | null;
  amount_inr: number;
  status: InvoiceStatus;
  billing_cycle: string | null;
  plan_id: string | null;
  invoice_date: string;
  due_date: string | null;
  paid_at: string | null;
  payment_link_url: string | null;
  pdf_url: string | null;
  notes: string | null;
}

// ─── Feature matrix ───────────────────────────────────────────────────────────

const PLAN_ORDER = ['free', 'starter', 'growth', 'referral', 'network', 'enterprise'];

const INV_STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600' },
  sent:      { label: 'Sent',      cls: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Paid',      cls: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Overdue',   cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
};

const COMPARISON_FEATURES: { section: string; rows: { label: string; plans: Record<string, string | boolean> }[] }[] = [
  {
    section: 'Loyalty',
    rows: [
      { label: 'Points earn & redeem',  plans: { free: true,  starter: true,  growth: true,  referral: true,  network: true,  enterprise: true  } },
      { label: 'Member tiers',          plans: { free: false, starter: true,  growth: true,  referral: true,  network: true,  enterprise: true  } },
      { label: 'Member widget',         plans: { free: true,  starter: true,  growth: true,  referral: true,  network: true,  enterprise: true  } },
      { label: 'Product page points',   plans: { free: false, starter: true,  growth: true,  referral: true,  network: true,  enterprise: true  } },
    ],
  },
  {
    section: 'Campaigns',
    rows: [
      { label: 'Order value triggers',  plans: { free: false, starter: true,  growth: true,  referral: true,  network: true,  enterprise: true  } },
      { label: 'Advanced conditions',   plans: { free: false, starter: false, growth: true,  referral: true,  network: true,  enterprise: true  } },
      { label: 'Campaign analytics',    plans: { free: false, starter: false, growth: true,  referral: true,  network: true,  enterprise: true  } },
    ],
  },
  {
    section: 'Referral',
    rows: [
      { label: 'Referral links',        plans: { free: false, starter: false, growth: false, referral: true,  network: true,  enterprise: true  } },
      { label: 'Affiliate dashboard',   plans: { free: false, starter: false, growth: false, referral: true,  network: true,  enterprise: true  } },
    ],
  },
  {
    section: 'Network',
    rows: [
      { label: 'Cross-brand vouchers',  plans: { free: false, starter: false, growth: false, referral: false, network: true,  enterprise: true  } },
      { label: 'Brand marketplace',     plans: { free: false, starter: false, growth: false, referral: false, network: true,  enterprise: true  } },
    ],
  },
];

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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [showComparison, setShowComparison] = useState(false);
  const comparisonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.client_id) load();
  }, [profile?.client_id, session]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lizgppzyyljqbmzdytia.supabase.co';

      // Load plans + invoices in parallel with config
      const [plansRes, invoicesRes] = await Promise.all([
        supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
        profile?.client_id
          ? supabase.from('invoices').select('*').eq('client_id', profile.client_id).order('invoice_date', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const sortedPlans = ((plansRes.data || []) as Plan[]).sort(
        (a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id)
      );
      setPlans(sortedPlans);
      setInvoices((invoicesRes.data || []) as Invoice[]);

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
          const { data: subData } = await supabase
            .from('client_subscriptions')
            .select('*')
            .eq('client_id', profile.client_id)
            .maybeSingle();

          const planId = subData?.plan_id ?? 'free';

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
        if (subData?.billing_cycle) setBillingCycle(subData.billing_cycle);
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
          <div className="w-8 h-8 border-2 border-t-violet-600 border-gray-200 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const status = subscription?.status ?? 'active';
  const statusConfig = STATUS_CONFIG[status as SubscriptionStatus] ?? STATUS_CONFIG.active;
  const currentPlanId = subscription?.plan_id ?? 'free';
  const planName = config?.plan?.name ?? (plans.find(p => p.id === currentPlanId)?.name ?? 'Free');
  const enabledFeatures = new Set(config?.features ?? []);
  const enabledModules = new Set(config?.modules ?? []);

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Plan & Billing">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan &amp; Billing</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your plan, view invoices and upgrade</p>
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

        {/* ── Plan cards ─────────────────────────────────────────────────── */}
        {plans.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-base font-semibold text-gray-900">Available plans</h2>
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                {(['monthly', 'annual'] as const).map(cycle => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: billingCycle === cycle ? '#fff' : 'transparent',
                      color: billingCycle === cycle ? '#1a1a1a' : '#6b7280',
                      boxShadow: billingCycle === cycle ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {cycle === 'monthly' ? 'Monthly' : 'Annual (2 months free)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.filter(p => p.id !== 'enterprise').map(plan => {
                const isCurrent = plan.id === currentPlanId;
                const price = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;
                const isHigher = PLAN_ORDER.indexOf(plan.id) > PLAN_ORDER.indexOf(currentPlanId);
                const highlighted = plan.id === 'growth';

                return (
                  <div
                    key={plan.id}
                    className="relative rounded-2xl border p-5 flex flex-col"
                    style={{
                      borderColor: isCurrent ? '#7c3aed' : highlighted ? '#c4b5fd' : '#e5e7eb',
                      background: isCurrent ? 'rgba(124,58,237,0.04)' : highlighted ? 'rgba(196,181,253,0.04)' : '#fff',
                    }}
                  >
                    {highlighted && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wide whitespace-nowrap">
                        Most Popular
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wide whitespace-nowrap">
                        Current Plan
                      </div>
                    )}

                    <p className="font-bold text-gray-900 capitalize mb-0.5">{plan.name}</p>
                    <p className="text-xs text-gray-500 mb-4 min-h-[32px]">{plan.description}</p>

                    <div className="mb-5">
                      {price === 0 ? (
                        <span className="text-2xl font-bold text-gray-900">Free</span>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-gray-900">
                            ₹{(billingCycle === 'annual' ? Math.round(price / 12) : price).toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs text-gray-500"> /mo</span>
                          {billingCycle === 'annual' && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Billed ₹{price.toLocaleString('en-IN')}/yr
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => isHigher && handleUpgradeContact(plan.name)}
                      disabled={isCurrent || !isHigher}
                      className="mt-auto w-full py-2 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: isCurrent ? '#f3f4f6' : isHigher ? '#7c3aed' : '#f3f4f6',
                        color: isCurrent ? '#9ca3af' : isHigher ? '#fff' : '#9ca3af',
                        cursor: isCurrent || !isHigher ? 'default' : 'pointer',
                      }}
                    >
                      {isCurrent ? 'Current plan' : isHigher ? 'Upgrade' : 'Downgrade'}
                    </button>
                  </div>
                );
              })}

              {/* Enterprise card */}
              <div className="rounded-2xl border border-gray-200 bg-gray-900 p-5 flex flex-col">
                <p className="font-bold text-white mb-0.5">Enterprise</p>
                <p className="text-xs text-gray-400 mb-4 min-h-[32px]">Custom pricing for high-volume stores</p>
                <div className="text-2xl font-bold text-white mb-5">Custom</div>
                <button
                  onClick={() => handleUpgradeContact('Enterprise')}
                  className="mt-auto w-full py-2 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contact us
                </button>
              </div>
            </div>

            {/* Comparison toggle */}
            <div className="mt-4">
              <button
                onClick={() => {
                  setShowComparison(v => !v);
                  setTimeout(() => comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                }}
                className="flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showComparison ? 'Hide' : 'Show'} full feature comparison
              </button>

              {showComparison && (
                <div ref={comparisonRef} className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                  <table className="w-full text-sm border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left p-4 font-semibold text-gray-700 w-44">Feature</th>
                        {plans
                          .sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id))
                          .map(p => (
                            <th key={p.id} className="p-4 text-center font-semibold capitalize"
                              style={{ color: p.id === currentPlanId ? '#7c3aed' : '#374151' }}>
                              {p.name}{p.id === currentPlanId ? ' ✓' : ''}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_FEATURES.map(cat => (
                        <>
                          <tr key={cat.section} className="bg-gray-50">
                            <td colSpan={plans.length + 1}
                              className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
                              {cat.section}
                            </td>
                          </tr>
                          {cat.rows.map((row, ri) => (
                            <tr key={ri} className="border-t border-gray-50 hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-gray-600">{row.label}</td>
                              {plans
                                .sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id))
                                .map(p => (
                                  <td key={p.id} className="px-4 py-2.5 text-center">
                                    {row.plans[p.id] === true ? (
                                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                    ) : row.plans[p.id] === false ? (
                                      <span className="text-gray-200">—</span>
                                    ) : (
                                      <span className="text-xs text-gray-600">{row.plans[p.id]}</span>
                                    )}
                                  </td>
                                ))}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Invoice history ─────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            Invoice history
          </h2>

          {invoices.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">
              No invoices yet.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Invoice</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map(inv => {
                    const stCfg = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs text-gray-700 font-medium">
                            {inv.invoice_number ?? '—'}
                          </span>
                          {inv.notes && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[140px]">{inv.notes}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 text-xs">{fmt(inv.invoice_date)}</td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">
                          ₹{inv.amount_inr.toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${stCfg.cls}`}>
                            {stCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {inv.payment_link_url && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                              <a
                                href={inv.payment_link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                              >
                                Pay now
                              </a>
                            )}
                            {inv.pdf_url && (
                              <a
                                href={inv.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                PDF
                              </a>
                            )}
                            {!inv.payment_link_url && !inv.pdf_url && (
                              <span className="text-xs text-gray-300">—</span>
                            )}
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
