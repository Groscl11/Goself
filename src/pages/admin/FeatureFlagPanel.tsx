import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Layers,
  Zap,
  Users,
  GitBranch,
  Globe,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  CreditCard,
  Lock,
  Unlock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';

// ─── Config ────────────────────────────────────────────────────────────────────

type ModuleKey = 'loyalty' | 'campaigns' | 'referral' | 'network';
type SourceType = 'manual' | 'trial' | 'compensation' | 'internal';

interface FeatureDef {
  key: string;
  label: string;
}

const MODULES: { key: ModuleKey; label: string; icon: JSX.Element; features: FeatureDef[] }[] = [
  {
    key: 'loyalty',
    label: 'Loyalty',
    icon: <Layers className="w-5 h-5 text-blue-500" />,
    features: [
      { key: 'loyalty.points_earn',             label: 'Points Earn' },
      { key: 'loyalty.points_balance',          label: 'Points Balance' },
      { key: 'loyalty.tiers',                   label: 'Tiers' },
      { key: 'loyalty.redemption',              label: 'Redemption' },
      { key: 'loyalty.product_page_points',     label: 'Product Page Points' },
      { key: 'loyalty.thankyou_page_points',    label: 'Thank You Page Points' },
      { key: 'loyalty.member_widget',           label: 'Member Widget' },
    ],
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    icon: <Zap className="w-5 h-5 text-yellow-500" />,
    features: [
      { key: 'campaigns.order_value_trigger',   label: 'Order Value Trigger' },
      { key: 'campaigns.auto_enrollment',       label: 'Auto Enrollment' },
      { key: 'campaigns.advanced_conditions',   label: 'Advanced Conditions' },
      { key: 'campaigns.analytics',             label: 'Analytics' },
    ],
  },
  {
    key: 'referral',
    label: 'Referral',
    icon: <GitBranch className="w-5 h-5 text-purple-500" />,
    features: [
      { key: 'referral.link_generation',        label: 'Link Generation' },
      { key: 'referral.tracking',               label: 'Tracking' },
      { key: 'referral.tiered_commissions',     label: 'Tiered Commissions' },
      { key: 'referral.affiliate_dashboard',    label: 'Affiliate Dashboard' },
    ],
  },
  {
    key: 'network',
    label: 'Network',
    icon: <Globe className="w-5 h-5 text-green-500" />,
    features: [
      { key: 'network.cross_brand_vouchers',    label: 'Cross-Brand Vouchers' },
      { key: 'network.brand_marketplace',       label: 'Brand Marketplace' },
      { key: 'network.analytics',               label: 'Analytics' },
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanEntitlement {
  feature: string;
  plan_id: string;
}

interface FeatureFlagRow {
  client_id: string;
  module: string;
  feature: string;
  is_enabled: boolean;
  source: SourceType;
  expires_at: string | null;
  notes: string | null;
}

// Local draft state per feature
interface FeatureDraft {
  enabled: boolean;       // current override state (or derived from plan)
  hasOverride: boolean;   // whether a row exists in client_feature_flags
  planEnabled: boolean;   // whether the feature is covered by the client's current plan
  source: SourceType;
  expiresAt: string;
  notes: string;
  dirty: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeatureFlagPanel() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [clientName, setClientName] = useState('');
  const [currentPlanId, setCurrentPlanId] = useState<string>('free');
  const [planEntitlements, setPlanEntitlements] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, FeatureDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (clientId) load();
  }, [clientId]);

  const load = async () => {
    setLoading(true);
    try {
      const [clientRes, subRes, flagsRes] = await Promise.all([
        supabase.from('clients').select('id, name').eq('id', clientId!).maybeSingle(),
        supabase.from('client_subscriptions').select('plan_id').eq('client_id', clientId!).maybeSingle(),
        supabase.from('client_feature_flags').select('*').eq('client_id', clientId!),
      ]);

      if (clientRes.data) setClientName(clientRes.data.name);

      const planId = subRes.data?.plan_id ?? 'free';
      setCurrentPlanId(planId);

      // Fetch plan + module entitlements for the client's plan
      const [planFeatRes, planModRes] = await Promise.all([
        supabase.from('plan_feature_entitlements').select('feature').eq('plan_id', planId),
        supabase.from('plan_module_entitlements').select('module').eq('plan_id', planId),
      ]);

      // All features from plan_feature_entitlements
      const planFeatureSet = new Set<string>((planFeatRes.data || []).map((r: any) => r.feature));

      // All features for in-plan modules (from MODULES constant)
      const planModuleSet = new Set<string>((planModRes.data || []).map((r: any) => r.module));
      MODULES.forEach(({ key, features }) => {
        if (planModuleSet.has(key)) {
          features.forEach((f) => planFeatureSet.add(f.key));
        }
      });
      setPlanEntitlements(planFeatureSet);

      // Build overrides lookup
      const overrideMap = new Map<string, FeatureFlagRow>();
      (flagsRes.data || []).forEach((row: FeatureFlagRow) => {
        overrideMap.set(row.feature, row);
      });

      // Build drafts for every feature
      const initialDrafts: Record<string, FeatureDraft> = {};
      MODULES.forEach(({ features }) => {
        features.forEach(({ key }) => {
          const override = overrideMap.get(key);
          const planEnabled = planFeatureSet.has(key);
          initialDrafts[key] = {
            enabled: override ? override.is_enabled : planEnabled,
            hasOverride: !!override,
            planEnabled,
            source: override?.source ?? 'manual',
            expiresAt: override?.expires_at?.slice(0, 10) ?? '',
            notes: override?.notes ?? '',
            dirty: false,
          };
        });
      });
      setDrafts(initialDrafts);
    } catch (err) {
      console.error('Error loading feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = useCallback(
    (featureKey: string, patch: Partial<FeatureDraft>) => {
      setDrafts((prev) => ({
        ...prev,
        [featureKey]: { ...prev[featureKey], ...patch, dirty: true },
      }));
    },
    []
  );

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const dirtyFeatures = Object.entries(drafts).filter(([, d]) => d.dirty);
    if (dirtyFeatures.length === 0) {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return;
    }

    try {
      // Separate upserts from deletes
      // Delete: feature was overridden, now toggle OFF and plan already covers it → remove override
      // Upsert: everything else that was changed
      const toDelete: string[] = [];
      const toUpsert: FeatureFlagRow[] = [];

      dirtyFeatures.forEach(([featureKey, d]) => {
        const mod = MODULES.find((m) => m.features.some((f) => f.key === featureKey))?.key ?? '';

        if (!d.enabled && d.planEnabled) {
          // Turning off a plan-covered feature that had an override → delete override
          toDelete.push(featureKey);
        } else if (d.enabled !== d.planEnabled || d.hasOverride) {
          // Explicit override needed
          toUpsert.push({
            client_id: clientId,
            module: mod,
            feature: featureKey,
            is_enabled: d.enabled,
            source: d.source,
            expires_at: d.expiresAt || null,
            notes: d.notes || null,
          });
        }
      });

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('client_feature_flags')
          .delete()
          .eq('client_id', clientId)
          .in('feature', toDelete);
        if (error) throw error;
      }

      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('client_feature_flags')
          .upsert(toUpsert, { onConflict: 'client_id,feature' });
        if (error) throw error;
      }

      // Mark all as clean
      setDrafts((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => { next[k] = { ...next[k], dirty: false }; });
        return next;
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save feature flags');
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount = Object.values(drafts).filter((d) => d.dirty).length;

  if (loading) {
    return (
      <DashboardLayout menuItems={adminMenuItems} title="Feature Flags">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-gray-500">Loading feature flags…</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Feature Flags">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/admin/clients/${clientId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Feature Flag Overrides</h1>
            {clientName && (
              <p className="text-gray-500 text-sm mt-0.5">
                {clientName} · Plan: <span className="font-medium capitalize">{currentPlanId}</span>
              </p>
            )}
          </div>
          <Link to={`/admin/clients/${clientId}/subscription`}>
            <Button variant="secondary" size="sm">
              <CreditCard className="w-4 h-4 mr-2" />
              Subscription
            </Button>
          </Link>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Enabled by plan</span>
          <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-gray-400" /> Not in plan</span>
          <span className="flex items-center gap-1.5"><Unlock className="w-3.5 h-3.5 text-blue-500" /> Override ON</span>
          <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-red-400" /> Override OFF</span>
        </div>

        {/* Module sections */}
        {MODULES.map(({ key: modKey, label: modLabel, icon: modIcon, features }) => (
          <Card key={modKey} padding="none">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
              {modIcon}
              <h2 className="font-semibold text-gray-900">{modLabel}</h2>
              <span className="ml-auto text-xs text-gray-400">
                {features.filter((f) => drafts[f.key]?.enabled).length}/{features.length} enabled
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {features.map(({ key: featKey, label: featLabel }) => {
                const d = drafts[featKey];
                if (!d) return null;
                const isOverridden = d.hasOverride || d.dirty;

                return (
                  <div
                    key={featKey}
                    className={`px-6 py-4 transition-colors ${d.dirty ? 'bg-blue-50/40' : ''}`}
                  >
                    {/* Row top */}
                    <div className="flex items-center gap-4">
                      {/* Plan indicator */}
                      <div className="w-5 flex-shrink-0">
                        {d.planEnabled ? (
                          <CheckCircle className="w-4 h-4 text-green-500" title="Included in plan" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300" title="Not in plan" />
                        )}
                      </div>

                      {/* Feature name */}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{featLabel}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{featKey}</div>
                      </div>

                      {/* Enabled toggle */}
                      <button
                        onClick={() => updateDraft(featKey, { enabled: !d.enabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          d.enabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                        title={d.enabled ? 'Click to disable' : 'Click to enable'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            d.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>

                      {/* Override badge */}
                      {isOverridden && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          d.enabled ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {d.enabled ? <><Unlock className="w-3 h-3 inline mr-0.5" />Override ON</> : <><Lock className="w-3 h-3 inline mr-0.5" />Override OFF</>}
                        </span>
                      )}
                    </div>

                    {/* Expanded options (shown when there's an override or dirty) */}
                    {(d.enabled !== d.planEnabled || d.dirty || d.hasOverride) && (
                      <div className="mt-3 ml-9 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Source</label>
                          <select
                            value={d.source}
                            onChange={(e) => updateDraft(featKey, { source: e.target.value as SourceType })}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="manual">Manual</option>
                            <option value="trial">Trial</option>
                            <option value="compensation">Compensation</option>
                            <option value="internal">Internal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Expires At</label>
                          <input
                            type="date"
                            value={d.expiresAt}
                            onChange={(e) => updateDraft(featKey, { expiresAt: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Notes</label>
                          <input
                            type="text"
                            value={d.notes}
                            onChange={(e) => updateDraft(featKey, { notes: e.target.value })}
                            placeholder="Optional note…"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}

        {/* Save bar */}
        <div className="flex items-center gap-4 pb-8">
          <Button onClick={handleSave} isLoading={saving} disabled={dirtyCount === 0 && !saving}>
            <Save className="w-4 h-4 mr-2" />
            Save{dirtyCount > 0 ? ` (${dirtyCount} change${dirtyCount !== 1 ? 's' : ''})` : ''}
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
