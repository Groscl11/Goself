import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Lock,
  Layers,
  Zap,
  GitBranch,
  Globe,
  FileText,
  Download,
} from 'lucide-react';
import { supabase, supabaseUrl } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

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

const INV_STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600' },
  sent:      { label: 'Sent',      cls: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Paid',      cls: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Overdue',   cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
};

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.client_id) load();
  }, [profile?.client_id, session]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const invoicesRes = profile?.client_id
        ? await supabase.from('invoices').select('*').eq('client_id', profile.client_id).order('invoice_date', { ascending: false })
        : { data: [] };
      setInvoices((invoicesRes.data || []) as Invoice[]);

      // Fetch config from edge function using the current session JWT
      const token = session?.access_token;
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 8000);
      let configRes: Response | null = null;
      try {
        configRes = await fetch(`${supabaseUrl}/functions/v1/get-client-config`, {
          signal: abort.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch {
        // timed out or network error — fall through to DB fallback
      } finally {
        clearTimeout(timeout);
      }

      if (configRes?.ok) {
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
      }
    } catch (err: any) {
      console.error('Error loading billing info:', err);
      setError('Failed to load billing information. Please refresh.');
    } finally {
      setLoading(false);
    }
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
  const planName = config?.plan?.name ?? 'Free';
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

                </Card>
              );
            })}
          </div>
        </div>

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
