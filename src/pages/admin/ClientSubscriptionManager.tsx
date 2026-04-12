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
  FileText,
  Plus,
  Copy,
  ExternalLink,
  Zap,
  Download,
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
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; className: string; icon: JSX.Element }> = {
  trialing:  { label: 'Trialing',  className: 'bg-yellow-100 text-yellow-800',  icon: <Clock className="w-4 h-4" /> },
  active:    { label: 'Active',    className: 'bg-green-100 text-green-800',    icon: <CheckCircle className="w-4 h-4" /> },
  past_due:  { label: 'Past Due',  className: 'bg-orange-100 text-orange-800',  icon: <AlertCircle className="w-4 h-4" /> },
  suspended: { label: 'Suspended', className: 'bg-red-100 text-red-800',        icon: <XCircle className="w-4 h-4" /> },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700',      icon: <XCircle className="w-4 h-4" /> },
};

const INV_STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600' },
  sent:      { label: 'Sent',      cls: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Paid',      cls: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Overdue',   cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'subscription' | 'invoices'>('subscription');

  // Invoice creation form
  const [newInvAmount, setNewInvAmount] = useState('');
  const [newInvDueDate, setNewInvDueDate] = useState('');
  const [newInvNotes, setNewInvNotes] = useState('');
  const [creatingInv, setCreatingInv] = useState(false);
  const [showNewInvForm, setShowNewInvForm] = useState(false);

  // Razorpay payment link generation
  const [genLinkLoading, setGenLinkLoading] = useState<string | null>(null); // invoice id being processed
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      const [clientRes, plansRes, subRes, invRes] = await Promise.all([
        supabase.from('clients').select('id, name, contact_email').eq('id', clientId!).maybeSingle(),
        supabase.from('plans').select('*').eq('is_active', true).order('id'),
        supabase.from('client_subscriptions').select('*').eq('client_id', clientId!).maybeSingle(),
        supabase.from('invoices').select('*').eq('client_id', clientId!).order('invoice_date', { ascending: false }),
      ]);

      if (clientRes.data) setClientInfo(clientRes.data);

      const plansList = (plansRes.data || []).sort(
        (a: Plan, b: Plan) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id)
      );
      setPlans(plansList);
      setInvoices((invRes.data || []) as Invoice[]);

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

  // ── Invoice helpers ──────────────────────────────────────────────────────

  const handleCreateInvoice = async () => {
    if (!clientId || !newInvAmount) return;
    setCreatingInv(true);
    try {
      const due = newInvDueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase.from('invoices').insert({
        client_id: clientId,
        amount_inr: Number(newInvAmount),
        status: 'draft',
        billing_cycle: billingCycle,
        plan_id: planId,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: due,
        notes: newInvNotes || null,
      }).select().single();

      if (error) throw error;
      setInvoices(prev => [data as Invoice, ...prev]);
      setNewInvAmount('');
      setNewInvDueDate('');
      setNewInvNotes('');
      setShowNewInvForm(false);
    } catch (err: any) {
      alert(`Failed to create invoice: ${err.message}`);
    } finally {
      setCreatingInv(false);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId);
    if (!error) {
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'paid', paid_at: new Date().toISOString() } : inv));
    }
  };

  const handleGeneratePaymentLink = async (invoice: Invoice) => {
    if (!clientId) return;
    setGenLinkLoading(invoice.id);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lizgppzyyljqbmzdytia.supabase.co';
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/create-razorpay-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          client_id: clientId,
          amount: invoice.amount_inr,
          description: invoice.notes || `GoSelf Invoice ${invoice.invoice_number ?? ''}`,
          plan_id: invoice.plan_id,
          billing_cycle: invoice.billing_cycle,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Failed to generate link');

      const url: string = result.payment_link_url;
      setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, payment_link_url: url, status: 'sent' } : inv));
    } catch (err: any) {
      alert(`Failed to generate payment link: ${err.message}`);
    } finally {
      setGenLinkLoading(null);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

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

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(['subscription', 'invoices'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={{
                background: activeTab === tab ? '#fff' : 'transparent',
                color: activeTab === tab ? '#1a1a1a' : '#6b7280',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab === 'invoices' ? `Invoices (${invoices.length})` : 'Subscription'}
            </button>
          ))}
        </div>

        {/* ── Subscription tab ──────────────────────────────────────────── */}
        {activeTab === 'subscription' && (<>

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

        </>)} {/* end subscription tab */}

        {/* ── Invoices tab ──────────────────────────────────────────────── */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Invoices
              </h2>
              <button
                onClick={() => setShowNewInvForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New invoice
              </button>
            </div>

            {/* Create invoice form */}
            {showNewInvForm && (
              <Card padding="none">
                <div className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-800">New Draft Invoice</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹) *</label>
                      <input
                        type="number" min="1"
                        value={newInvAmount}
                        onChange={e => setNewInvAmount(e.target.value)}
                        placeholder="e.g. 4999"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Due date</label>
                      <input
                        type="date"
                        value={newInvDueDate}
                        onChange={e => setNewInvDueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <input
                      type="text"
                      value={newInvNotes}
                      onChange={e => setNewInvNotes(e.target.value)}
                      placeholder="e.g. Growth plan — January 2026"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateInvoice}
                      disabled={creatingInv || !newInvAmount}
                      className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creatingInv ? 'Creating…' : 'Create invoice'}
                    </button>
                    <button
                      onClick={() => setShowNewInvForm(false)}
                      className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Invoice list */}
            {invoices.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">
                No invoices yet. Click "New invoice" to create one.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Due</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoices.map(inv => {
                      const stCfg = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                      const isGenerating = genLinkLoading === inv.id;
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-medium text-gray-700">
                              {inv.invoice_number ?? '—'}
                            </span>
                            {inv.notes && <p className="text-xs text-gray-400 truncate max-w-[120px]">{inv.notes}</p>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            ₹{inv.amount_inr.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stCfg.cls}`}>
                              {stCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(inv.due_date)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end flex-wrap">
                              {inv.payment_link_url ? (
                                <>
                                  <button
                                    onClick={() => handleCopyLink(inv.payment_link_url!, inv.id)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                                    title="Copy payment link"
                                  >
                                    <Copy className="w-3 h-3" />
                                    {copiedId === inv.id ? 'Copied!' : 'Copy link'}
                                  </button>
                                  <a
                                    href={inv.payment_link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-violet-600 hover:bg-violet-50 transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Open
                                  </a>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleGeneratePaymentLink(inv)}
                                  disabled={isGenerating}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Zap className="w-3 h-3" />
                                  {isGenerating ? 'Generating…' : 'Payment link'}
                                </button>
                              )}
                              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleMarkPaid(inv.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Mark paid
                                </button>
                              )}
                              {inv.pdf_url && (
                                <a
                                  href={inv.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-gray-600"
                                  title="Download PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
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
        )}

      </div>
    </DashboardLayout>
  );
}
