import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Save,
  Layers,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
type BillingCycle = 'monthly' | 'annual';
type PaymentMethod = 'manual' | 'razorpay' | 'shopify';

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_annual: number;
  is_active: boolean;
}

interface ClientSubscription {
  client_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  amount_inr: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  payment_method: PaymentMethod;
  notes: string | null;
}

interface ClientInfo {
  id: string;
  name: string;
  contact_email: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; className: string; icon: JSX.Element }> = {
  trialing:  { label: 'Trialing',  className: 'bg-yellow-100 text-yellow-800',  icon: <Clock className="w-4 h-4" /> },
  active:    { label: 'Active',    className: 'bg-green-100 text-green-800',    icon: <CheckCircle className="w-4 h-4" /> },
  past_due:  { label: 'Past Due',  className: 'bg-orange-100 text-orange-800',  icon: <AlertCircle className="w-4 h-4" /> },
  suspended: { label: 'Suspended', className: 'bg-red-100 text-red-800',        icon: <XCircle className="w-4 h-4" /> },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700',      icon: <XCircle className="w-4 h-4" /> },
};

const PLAN_ORDER = ['free', 'starter', 'growth', 'referral', 'network', 'enterprise'];

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientSubscriptionManager() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state (mirrors subscription fields)
  const [planId, setPlanId] = useState('free');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [amountInr, setAmountInr] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('manual');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (clientId) load();
  }, [clientId]);

  const load = async () => {
    setLoading(true);
    try {
      const [clientRes, plansRes, subRes] = await Promise.all([
        supabase.from('clients').select('id, name, contact_email').eq('id', clientId!).maybeSingle(),
        supabase.from('plans').select('*').eq('is_active', true).order('id'),
        supabase.from('client_subscriptions').select('*').eq('client_id', clientId!).maybeSingle(),
      ]);

      if (clientRes.data) setClientInfo(clientRes.data);

      const plansList = (plansRes.data || []).sort(
        (a: Plan, b: Plan) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id)
      );
      setPlans(plansList);

      if (subRes.data) {
        const sub = subRes.data as ClientSubscription;
        setSubscription(sub);
        setPlanId(sub.plan_id);
        setStatus(sub.status);
        setBillingCycle(sub.billing_cycle ?? 'monthly');
        setAmountInr(sub.amount_inr != null ? String(sub.amount_inr) : '');
        setTrialEndsAt(toDateInputValue(sub.trial_ends_at));
        setCurrentPeriodEnd(toDateInputValue(sub.current_period_end));
        setPaymentMethod(sub.payment_method ?? 'manual');
        setNotes(sub.notes ?? '');
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const payload: ClientSubscription = {
      client_id: clientId,
      plan_id: planId,
      status,
      billing_cycle: billingCycle,
      amount_inr: amountInr !== '' ? Number(amountInr) : null,
      trial_ends_at: trialEndsAt || null,
      current_period_end: currentPeriodEnd || null,
      payment_method: paymentMethod,
      notes: notes || null,
    };

    try {
      const { error } = await supabase
        .from('client_subscriptions')
        .upsert(payload, { onConflict: 'client_id' });

      if (error) throw error;
      setSubscription(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save subscription');
    } finally {
      setSaving(false);
    }
  };

  const handleSetTrial = () => {
    setStatus('trialing');
    // Default trial end: 14 days from now
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setTrialEndsAt(d.toISOString().slice(0, 10));
  };

  const handleSuspend = () => setStatus('suspended');
  const handleReactivate = () => setStatus('active');

  // Computed list price based on selected plan + billing cycle
  const selectedPlan = plans.find((p) => p.id === planId);
  const listPrice = selectedPlan
    ? billingCycle === 'annual'
      ? selectedPlan.price_annual
      : selectedPlan.price_monthly
    : null;

  if (loading) {
    return (
      <DashboardLayout menuItems={adminMenuItems} title="Client Subscription">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-gray-500">Loading subscription data…</div>
        </div>
      </DashboardLayout>
    );
  }

  const currentStatus = STATUS_CONFIG[status];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Client Subscription">
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/admin/clients/${clientId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Subscription Manager</h1>
            {clientInfo && (
              <p className="text-gray-500 text-sm mt-0.5">
                {clientInfo.name} · {clientInfo.contact_email}
              </p>
            )}
          </div>
          <Link to={`/admin/clients/${clientId}/features`}>
            <Button variant="secondary" size="sm">
              <Layers className="w-4 h-4 mr-2" />
              Feature Flags
            </Button>
          </Link>
        </div>

        {/* Current status banner */}
        {subscription && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
            status === 'active' ? 'bg-green-50 border-green-200' :
            status === 'trialing' ? 'bg-yellow-50 border-yellow-200' :
            status === 'past_due' ? 'bg-orange-50 border-orange-200' :
            'bg-red-50 border-red-200'
          }`}>
            {currentStatus.icon}
            <span className="text-sm font-medium">
              Current status: <span className="capitalize">{currentStatus.label}</span>
              {subscription.current_period_end && (
                <> · Period ends {new Date(subscription.current_period_end).toLocaleDateString()}</>
              )}
            </span>
          </div>
        )}

        {/* Main form */}
        <Card padding="none">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-500" />
              Plan & Billing
            </h2>
          </div>

          <div className="p-6 space-y-5">
            {/* Plan selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan</label>
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price_monthly}/mo · ₹{p.price_annual}/yr)
                    </option>
                  ))}
                  {plans.length === 0 && (
                    <>
                      {['free', 'starter', 'growth', 'referral', 'network', 'enterprise'].map((pid) => (
                        <option key={pid} value={pid}>{pid.charAt(0).toUpperCase() + pid.slice(1)}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Cycle</label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>

            {/* Status + custom amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {(Object.keys(STATUS_CONFIG) as SubscriptionStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Custom Amount (₹)
                  {listPrice != null && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">
                      List price: ₹{listPrice}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder={listPrice != null ? String(listPrice) : 'Enter amount'}
                  value={amountInr}
                  onChange={(e) => setAmountInr(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Trial Ends At
                  </span>
                </label>
                <input
                  type="date"
                  value={trialEndsAt}
                  onChange={(e) => setTrialEndsAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Current Period End
                  </span>
                </label>
                <input
                  type="date"
                  value={currentPeriodEnd}
                  onChange={(e) => setCurrentPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full sm:w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="manual">Manual</option>
                <option value="razorpay">Razorpay</option>
                <option value="shopify">Shopify</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Notes
                <span className="ml-1.5 text-xs text-gray-400 font-normal">(deal terms, discounts, etc.)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. 6mo deal at ₹3000 — agreed on 2026-01-10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Quick actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSetTrial}
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Set 14-day Trial
            </Button>
            {status !== 'suspended' ? (
              <Button variant="danger" size="sm" onClick={handleSuspend}>
                <XCircle className="w-4 h-4 mr-1.5" />
                Suspend
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleReactivate}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Reactivate
              </Button>
            )}
          </div>
        </Card>

        {/* Save bar */}
        <div className="flex items-center gap-4">
          <Button onClick={handleSave} isLoading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Save Subscription
          </Button>
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Saved successfully
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {saveError}
            </span>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
