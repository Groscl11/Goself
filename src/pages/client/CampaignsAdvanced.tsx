import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Edit, Trash2, Play, Pause, Zap, Users, MapPin, TrendingUp, Shield, Gift, ChevronDown, ChevronUp, Megaphone, Layers, Activity, Search, X, Tag, Clock, Image } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';
import { RuleBuilder } from '../../components/RuleBuilder';

interface CampaignRule {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  program_id: string | null;
  trigger_type: string;
  trigger_conditions: any;
  eligibility_conditions: any;
  location_conditions: any;
  attribution_conditions: any;
  exclusion_rules: any;
  reward_action: any;
  guardrails: any;
  rule_version: number;
  rule_mode: 'membership' | 'standalone';
  reward_selection_mode: 'choice' | 'fixed';
  min_rewards_choice: number;
  max_rewards_choice: number;
  link_expiry_hours: number;
  is_active: boolean;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  max_enrollments: number | null;
  current_enrollments: number;
  required_scopes: string[];
  membership_programs: { name: string } | null;
}

interface RewardPoolItem {
  id: string;
  title: string;
  description: string;
  value_description: string;
  image_url: string | null;
  category: string;
  coupon_type: 'generic' | 'unique';
  status: string;
  expiry_date: string | null;
  available_vouchers: number;
  brand: { id: string; name: string; logo_url: string | null } | null;
}

interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  type: 'custom' | 'smart';
}

// Ensure conditions from DB are always an array with valid id fields
function normalizeConditions(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any, i: number) => ({
    id: c.id || `cond_${Date.now()}_${i}`,
    type: c.type || '',
    operator: c.operator || '',
    value: c.value ?? '',
  }));
}

export function CampaignsAdvanced() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<CampaignRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CampaignRule | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [programs, setPrograms] = useState<any[]>([]);

  // Reward pool state
  const [poolSearch, setPoolSearch] = useState('');
  const [poolFilterBrand, setPoolFilterBrand] = useState('');
  const [poolFilterType, setPoolFilterType] = useState('');
  const [poolFilterCoupon, setPoolFilterCoupon] = useState('');
  const [allRewards, setAllRewards] = useState<RewardPoolItem[]>([]);
  const [allBrands, setAllBrands] = useState<any[]>([]);
  const [selectedPool, setSelectedPool] = useState<RewardPoolItem[]>([]);

  // Collection search state
  const [collectionQuery, setCollectionQuery] = useState('');
  const [collectionResults, setCollectionResults] = useState<ShopifyCollection[]>([]);
  const [collectionSearching, setCollectionSearching] = useState(false);
  const collectionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [availableScopes, setAvailableScopes] = useState<string[]>([
    'read_orders',
    'read_customers',
    'read_products',
    'read_discounts',
  ]);

  const [expandedSections, setExpandedSections] = useState({
    triggers: true,
    eligibility: false,
    location: false,
    attribution: false,
    exclusions: false,
    reward: false,
    guardrails: false,
  });

  const [formData, setFormData] = useState({
    rule_mode: 'membership' as 'membership' | 'standalone',
    program_id: '',
    name: '',
    description: '',
    rule_version: 2,
    // Standalone-specific
    reward_selection_mode: 'choice' as 'choice' | 'fixed',
    min_rewards_choice: 1,
    max_rewards_choice: 1,
    link_expiry_hours: 72,
    // Conditions
    trigger_conditions: [] as any[],
    eligibility_conditions: [] as any[],
    location_conditions: [] as any[],
    attribution_conditions: [] as any[],
    exclusion_rules: {
      exclude_refunded: true,
      exclude_cancelled: true,
      exclude_test_orders: true,
    },
    reward_action: {
      reward_type: 'auto',
      allocation_timing: 'instant',
      claim_method: 'auto',
      expiry_days: 90,
    },
    guardrails: {
      max_rewards_per_customer: '',
      max_rewards_total: '',
      budget_cap: '',
    },
    priority: 0,
    start_date: '',
    end_date: '',
    max_enrollments: '',
    is_active: true,
  });

  useEffect(() => {
    loadClientId();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadData();
      loadShopifyScopes();
      loadAvailableRewards();
    }
  }, [clientId]);

  const loadClientId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (profile?.client_id) {
        setClientId(profile.client_id);
      }
    } catch (error) {
      console.error('Error loading client ID:', error);
    }
  };

  const loadShopifyScopes = async () => {
    try {
      const { data } = await supabase
        .from('integration_configs')
        .select('shopify_scopes')
        .eq('client_id', clientId)
        .eq('platform', 'shopify')
        .eq('status', 'connected')
        .maybeSingle();

      if (data?.shopify_scopes) {
        setAvailableScopes(data.shopify_scopes);
      }
    } catch (error) {
      console.error('Error loading scopes:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, programsRes] = await Promise.all([
        supabase
          .from('campaign_rules')
          .select('*, membership_programs(name)')
          .eq('client_id', clientId)
          .order('priority', { ascending: false }),
        supabase
          .from('membership_programs')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('name')
      ]);

      if (rulesRes.data) setRules(rulesRes.data);
      if (programsRes.data) setPrograms(programsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableRewards = async () => {
    try {
      // Load brands for filter dropdown
      const { data: brandsData } = await supabase
        .from('brands')
        .select('id, name')
        .eq('status', 'approved')
        .order('name');
      if (brandsData) setAllBrands(brandsData);

      // Load active rewards with available vouchers
      const { data: rewardsData } = await supabase
        .from('rewards')
        .select(`
          id, title, description, value_description, image_url, category,
          coupon_type, status, expiry_date,
          brands ( id, name, logo_url ),
          vouchers ( id, status )
        `)
        .eq('status', 'active')
        .or('expiry_date.is.null,expiry_date.gt.' + new Date().toISOString());

      if (rewardsData) {
        // Only keep rewards that have at least one available voucher
        const filtered: RewardPoolItem[] = rewardsData
          .filter((r: any) =>
            (r.vouchers || []).some((v: any) => v.status === 'available')
          )
          .map((r: any) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            value_description: r.value_description,
            image_url: r.image_url,
            category: r.category,
            coupon_type: r.coupon_type || 'unique',
            status: r.status,
            expiry_date: r.expiry_date,
            available_vouchers: (r.vouchers || []).filter((v: any) => v.status === 'available').length,
            brand: r.brands ? { id: r.brands.id, name: r.brands.name, logo_url: r.brands.logo_url } : null,
          }));
        setAllRewards(filtered);
      }
    } catch (error) {
      console.error('Error loading rewards:', error);
    }
  };

  const searchCollections = useCallback(async (query: string) => {
    if (!query.trim()) { setCollectionResults([]); return; }
    setCollectionSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-shopify-collections', {
        body: { query },
      });
      if (!error && data?.collections) setCollectionResults(data.collections);
    } catch (e) {
      console.error('Collection search error:', e);
    } finally {
      setCollectionSearching(false);
    }
  }, []);

  const handleCollectionQueryChange = (value: string) => {
    setCollectionQuery(value);
    if (collectionDebounce.current) clearTimeout(collectionDebounce.current);
    collectionDebounce.current = setTimeout(() => searchCollections(value), 400);
  };

  const addCollectionCondition = (col: ShopifyCollection) => {
    const newCond = {
      id: `cond_${Date.now()}`,
      type: 'collection_contains',
      operator: 'contains',
      value: col.id,
      label: col.title,
    };
    setFormData(prev => ({ ...prev, trigger_conditions: [...prev.trigger_conditions, newCond] }));
    setCollectionQuery('');
    setCollectionResults([]);
  };

  const togglePoolReward = (reward: RewardPoolItem) => {
    setSelectedPool(prev =>
      prev.some(r => r.id === reward.id)
        ? prev.filter(r => r.id !== reward.id)
        : [...prev, reward]
    );
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const triggerConditionTypes = [
    {
      value: 'collection_contains',
      label: 'Collection in Order',
      operators: [{ value: 'contains', label: 'Contains' }],
      inputType: 'text' as const,
      hint: 'Shopify collection ID (use collection search)',
      requiredScope: 'read_products',
    },
    {
      value: 'order_value_gte',
      label: 'Order Value ≥',
      operators: [{ value: 'gte', label: '≥' }],
      inputType: 'number' as const,
      hint: 'Minimum order value',
      requiredScope: 'read_orders',
    },
    {
      value: 'order_value_between',
      label: 'Order Value Between',
      operators: [{ value: 'between', label: 'Between' }],
      inputType: 'text' as const,
      hint: 'Format: min,max (e.g., 100,500)',
      requiredScope: 'read_orders',
    },
    {
      value: 'order_item_count',
      label: 'Order Item Count',
      operators: [
        { value: 'gte', label: '≥' },
        { value: 'eq', label: '=' },
        { value: 'lte', label: '≤' },
      ],
      inputType: 'number' as const,
      requiredScope: 'read_orders',
    },
    {
      value: 'specific_product',
      label: 'Specific Product in Cart',
      operators: [
        { value: 'contains', label: 'Contains' },
        { value: 'not_contains', label: 'Does Not Contain' },
      ],
      inputType: 'text' as const,
      hint: 'Product ID or handle',
      requiredScope: 'read_products',
    },
    {
      value: 'product_collection',
      label: 'Product from Collection',
      operators: [
        { value: 'in', label: 'In Collection' },
        { value: 'not_in', label: 'Not In Collection' },
      ],
      inputType: 'text' as const,
      hint: 'Collection ID or handle',
      requiredScope: 'read_products',
    },
    {
      value: 'coupon_code',
      label: 'Coupon Code',
      operators: [
        { value: 'exact', label: 'Exact Match' },
        { value: 'starts_with', label: 'Starts With' },
        { value: 'contains', label: 'Contains' },
      ],
      inputType: 'text' as const,
      requiredScope: 'read_discounts',
    },
    {
      value: 'payment_method',
      label: 'Payment Method',
      operators: [{ value: 'eq', label: 'Is' }],
      inputType: 'select' as const,
      options: [
        { value: 'prepaid', label: 'Prepaid' },
        { value: 'cod', label: 'Cash on Delivery' },
      ],
      requiredScope: 'read_orders',
    },
  ];

  const eligibilityConditionTypes = [
    {
      value: 'customer_type',
      label: 'Customer Type',
      operators: [{ value: 'eq', label: 'Is' }],
      inputType: 'select' as const,
      options: [
        { value: 'new', label: 'First-Time Customer' },
        { value: 'returning', label: 'Returning Customer' },
      ],
      requiredScope: 'read_customers',
    },
    {
      value: 'order_number',
      label: 'Order Number (Nth Order)',
      operators: [{ value: 'eq', label: 'Exactly' }],
      inputType: 'number' as const,
      hint: 'E.g., 2 for second order',
      requiredScope: 'read_customers',
    },
    {
      value: 'lifetime_orders',
      label: 'Lifetime Order Count',
      operators: [
        { value: 'gte', label: '≥' },
        { value: 'lte', label: '≤' },
      ],
      inputType: 'number' as const,
      requiredScope: 'read_customers',
    },
    {
      value: 'lifetime_spend',
      label: 'Lifetime Spend',
      operators: [
        { value: 'gte', label: '≥' },
        { value: 'lte', label: '≤' },
      ],
      inputType: 'number' as const,
      requiredScope: 'read_customers',
    },
    {
      value: 'customer_tags',
      label: 'Customer Tags',
      operators: [
        { value: 'has', label: 'Has Tag' },
        { value: 'not_has', label: 'Does Not Have Tag' },
      ],
      inputType: 'text' as const,
      requiredScope: 'read_customers',
    },
  ];

  const locationConditionTypes = [
    {
      value: 'shipping_pincode',
      label: 'Shipping Pincode/ZIP',
      operators: [
        { value: 'exact', label: 'Exact Match' },
        { value: 'starts_with', label: 'Starts With' },
        { value: 'in_list', label: 'In List' },
      ],
      inputType: 'text' as const,
      hint: 'Comma-separated for list',
      requiredScope: 'read_orders',
    },
    {
      value: 'shipping_city',
      label: 'Shipping City',
      operators: [
        { value: 'exact', label: 'Exact Match' },
        { value: 'in_list', label: 'In List' },
      ],
      inputType: 'text' as const,
      hint: 'Comma-separated for list',
      requiredScope: 'read_orders',
    },
    {
      value: 'shipping_state',
      label: 'Shipping State/Province',
      operators: [
        { value: 'exact', label: 'Exact Match' },
        { value: 'in_list', label: 'In List' },
      ],
      inputType: 'text' as const,
      requiredScope: 'read_orders',
    },
    {
      value: 'shipping_country',
      label: 'Shipping Country',
      operators: [
        { value: 'exact', label: 'Exact Match' },
        { value: 'in_list', label: 'In List' },
      ],
      inputType: 'text' as const,
      hint: 'Country code (e.g., US, IN)',
      requiredScope: 'read_orders',
    },
  ];

  const attributionConditionTypes = [
    {
      value: 'utm_source',
      label: 'UTM Source',
      operators: [
        { value: 'exact', label: 'Exact Match' },
        { value: 'contains', label: 'Contains' },
      ],
      inputType: 'text' as const,
      requiredScope: 'read_orders',
    },
    {
      value: 'utm_medium',
      label: 'UTM Medium',
      operators: [
        { value: 'exact', label: 'Exact Match' },
        { value: 'contains', label: 'Contains' },
      ],
      inputType: 'text' as const,
      requiredScope: 'read_orders',
    },
    {
      value: 'utm_campaign',
      label: 'UTM Campaign',
      operators: [
        { value: 'exact', label: 'Exact Match' },
        { value: 'contains', label: 'Contains' },
      ],
      inputType: 'text' as const,
      requiredScope: 'read_orders',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (formData.rule_mode === 'standalone' && selectedPool.length === 0) {
      alert('Please add at least one reward to the campaign pool.');
      return;
    }
    if (formData.rule_mode === 'membership' && !formData.program_id) {
      alert('Please select a membership program.');
      return;
    }

    try {
      const ruleData = {
        client_id: clientId,
        program_id: formData.rule_mode === 'membership' ? formData.program_id : null,
        name: formData.name,
        description: formData.description || null,
        trigger_type: 'advanced',
        rule_version: 2,
        rule_mode: formData.rule_mode,
        reward_selection_mode: formData.reward_selection_mode,
        min_rewards_choice: formData.min_rewards_choice,
        max_rewards_choice: formData.max_rewards_choice,
        link_expiry_hours: formData.link_expiry_hours,
        trigger_conditions: formData.trigger_conditions,
        eligibility_conditions: formData.eligibility_conditions,
        location_conditions: formData.location_conditions,
        attribution_conditions: formData.attribution_conditions,
        exclusion_rules: formData.exclusion_rules,
        reward_action: formData.reward_action,
        guardrails: formData.guardrails,
        priority: formData.priority,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        max_enrollments: formData.max_enrollments ? parseInt(formData.max_enrollments) : null,
        is_active: formData.is_active,
        required_scopes: ['read_orders', 'read_customers'],
      };

      let ruleId: string;

      if (editingRule) {
        const { error } = await supabase
          .from('campaign_rules')
          .update(ruleData)
          .eq('id', editingRule.id);
        if (error) throw error;
        ruleId = editingRule.id;
      } else {
        const { data: newRule, error } = await supabase
          .from('campaign_rules')
          .insert([ruleData])
          .select('id')
          .single();
        if (error) throw error;
        ruleId = newRule.id;
      }

      // Sync reward pool for standalone campaigns
      if (formData.rule_mode === 'standalone') {
        // Delete existing pool entries first
        await supabase.from('campaign_reward_pools').delete().eq('campaign_rule_id', ruleId);
        // Re-insert selected pool
        if (selectedPool.length > 0) {
          const poolRows = selectedPool.map((r, i) => ({
            campaign_rule_id: ruleId,
            reward_id: r.id,
            sort_order: i,
          }));
          const { error: poolError } = await supabase.from('campaign_reward_pools').insert(poolRows);
          if (poolError) throw poolError;
        }
      }

      setShowModal(false);
      setEditingRule(null);
      resetForm();
      loadData();
      alert('Campaign rule saved successfully');
    } catch (error: any) {
      console.error('Error saving campaign rule:', error);
      alert(error.message || 'Failed to save campaign rule');
    }
  };

  const resetForm = () => {
    setFormData({
      rule_mode: 'membership',
      program_id: '',
      name: '',
      description: '',
      rule_version: 2,
      reward_selection_mode: 'choice',
      min_rewards_choice: 1,
      max_rewards_choice: 1,
      link_expiry_hours: 72,
      trigger_conditions: [],
      eligibility_conditions: [],
      location_conditions: [],
      attribution_conditions: [],
      exclusion_rules: {
        exclude_refunded: true,
        exclude_cancelled: true,
        exclude_test_orders: true,
      },
      reward_action: {
        reward_type: 'auto',
        allocation_timing: 'instant',
        claim_method: 'auto',
        expiry_days: 90,
      },
      guardrails: {
        max_rewards_per_customer: '',
        max_rewards_total: '',
        budget_cap: '',
      },
      priority: 0,
      start_date: '',
      end_date: '',
      max_enrollments: '',
      is_active: true,
    });
    setSelectedPool([]);
    setPoolSearch('');
    setPoolFilterBrand('');
    setPoolFilterType('');
    setPoolFilterCoupon('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign rule?')) return;

    try {
      const { error } = await supabase
        .from('campaign_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('campaign_rules')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Reward Campaigns">
      <div className="space-y-6">
        {/* Tab bar */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1">
            <button
              onClick={() => navigate('/client/campaigns')}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              <Megaphone className="w-4 h-4" />
              Campaign Rules
            </button>
            <button
              onClick={() => navigate('/client/campaigns-advanced')}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600"
            >
              <Layers className="w-4 h-4" />
              Advanced Rules
            </button>
            <button
              onClick={() => navigate('/client/campaign-logs')}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              <Activity className="w-4 h-4" />
              Trigger Logs
            </button>
          </nav>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Advanced Campaign Rules</h1>
            <p className="text-gray-600 mt-1">Create sophisticated, condition-based campaign rules with full Shopify integration</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Advanced Rule
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading campaign rules...</p>
              </div>
            </CardContent>
          </Card>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaign Rules Yet</h3>
                <p className="text-gray-600 mb-4">Create your first advanced campaign rule to automate rewards</p>
                <Button onClick={() => setShowModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {(rule.rule_mode === 'standalone') ? (
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                            Standalone
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                            v{rule.rule_version}
                          </span>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {rule.rule_mode === 'standalone' ? (
                          <>
                            <span className="flex items-center gap-1">
                              <Gift className="w-3 h-3" />
                              Customer picks {rule.min_rewards_choice}–{rule.max_rewards_choice} reward(s)
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Link expires {rule.link_expiry_hours}h
                            </span>
                          </>
                        ) : (
                          <span>Program: {rule.membership_programs?.name ?? '—'}</span>
                        )}
                        <span>Priority: {rule.priority}</span>
                        <span>Enrollments: {rule.current_enrollments}{rule.max_enrollments ? ` / ${rule.max_enrollments}` : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingRule(rule);
                          setFormData({
                            rule_mode: rule.rule_mode || 'membership',
                            program_id: rule.program_id || '',
                            name: rule.name,
                            description: rule.description || '',
                            rule_version: rule.rule_version,
                            reward_selection_mode: rule.reward_selection_mode || 'choice',
                            min_rewards_choice: rule.min_rewards_choice ?? 1,
                            max_rewards_choice: rule.max_rewards_choice ?? 1,
                            link_expiry_hours: rule.link_expiry_hours ?? 72,
                            trigger_conditions: normalizeConditions(rule.trigger_conditions),
                            eligibility_conditions: normalizeConditions(rule.eligibility_conditions),
                            location_conditions: normalizeConditions(rule.location_conditions),
                            attribution_conditions: normalizeConditions(rule.attribution_conditions),
                            exclusion_rules: rule.exclusion_rules || {
                              exclude_refunded: true,
                              exclude_cancelled: true,
                              exclude_test_orders: true,
                            },
                            reward_action: rule.reward_action || {
                              reward_type: 'auto',
                              allocation_timing: 'instant',
                              claim_method: 'auto',
                              expiry_days: 90,
                            },
                            guardrails: rule.guardrails || {
                              max_rewards_per_customer: '',
                              max_rewards_total: '',
                              budget_cap: '',
                            },
                            priority: rule.priority,
                            start_date: rule.start_date || '',
                            end_date: rule.end_date || '',
                            max_enrollments: rule.max_enrollments?.toString() || '',
                            is_active: rule.is_active,
                          });
                          // Load existing reward pool for standalone campaigns
                          if ((rule.rule_mode || 'membership') === 'standalone') {
                            supabase
                              .from('campaign_reward_pools')
                              .select('reward_id, sort_order')
                              .eq('campaign_rule_id', rule.id)
                              .order('sort_order')
                              .then(({ data }) => {
                                if (data) {
                                  const poolIds = data.map(r => r.reward_id);
                                  setSelectedPool(allRewards.filter(r => poolIds.includes(r.id)));
                                }
                              });
                          } else {
                            setSelectedPool([]);
                          }
                          setShowModal(true);
                        }}
                        className="p-2 hover:bg-blue-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(rule.id, rule.is_active)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title={rule.is_active ? 'Pause' : 'Activate'}
                      >
                        {rule.is_active ? (
                          <Pause className="w-4 h-4 text-gray-600" />
                        ) : (
                          <Play className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingRule ? 'Edit Campaign Rule' : 'Create Advanced Campaign Rule'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">

                {/* ── Campaign Mode Toggle ─────────────────────────────── */}
                {!editingRule && (
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setFormData(prev => ({ ...prev, rule_mode: 'membership' })); setSelectedPool([]); }}
                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        formData.rule_mode === 'membership'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Membership Campaign
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, rule_mode: 'standalone' }))}
                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        formData.rule_mode === 'standalone'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      Standalone Campaign
                    </button>
                  </div>
                )}
                {editingRule && (
                  <div className={`rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2 ${
                    formData.rule_mode === 'standalone' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {formData.rule_mode === 'standalone' ? <Zap className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    {formData.rule_mode === 'standalone' ? 'Standalone Campaign' : 'Membership Campaign'}
                  </div>
                )}

                {/* ── Name + Program/Expiry ─────────────────────────────── */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., Premium Customer Reward"
                    />
                  </div>

                  {formData.rule_mode === 'membership' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Membership Program <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.program_id}
                        onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}
                        required={formData.rule_mode === 'membership'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select program...</option>
                        {programs.map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link Expiry <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={8760}
                          value={formData.link_expiry_hours}
                          onChange={(e) => setFormData({ ...formData, link_expiry_hours: parseInt(e.target.value) || 72 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                        <span className="text-sm text-gray-500 whitespace-nowrap">hours after trigger</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Standalone: Reward Selection Mode ─────────────────── */}
                {formData.rule_mode === 'standalone' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                      <Gift className="w-4 h-4" /> Reward Selection Settings
                    </h3>

                    {/* Mode toggle */}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, reward_selection_mode: 'choice' }))}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          formData.reward_selection_mode === 'choice'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Customer Picks N Rewards
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, reward_selection_mode: 'fixed' }))}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          formData.reward_selection_mode === 'fixed'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Auto-Give All Rewards
                      </button>
                    </div>

                    {formData.reward_selection_mode === 'choice' && (
                      <div className="flex items-center gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Min Picks</label>
                          <input
                            type="number" min={1}
                            value={formData.min_rewards_choice}
                            onChange={(e) => setFormData(prev => ({ ...prev, min_rewards_choice: parseInt(e.target.value) || 1 }))}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <span className="text-gray-400 mt-4">to</span>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Max Picks</label>
                          <input
                            type="number" min={formData.min_rewards_choice}
                            value={formData.max_rewards_choice}
                            onChange={(e) => setFormData(prev => ({ ...prev, max_rewards_choice: Math.max(prev.min_rewards_choice, parseInt(e.target.value) || 1) }))}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <span className="text-xs text-gray-500 mt-4">reward(s) from the pool below</span>
                      </div>
                    )}

                    {/* Reward Pool Picker */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reward Pool <span className="text-red-500">*</span>
                        {selectedPool.length > 0 && (
                          <span className="ml-2 text-purple-600 font-normal">({selectedPool.length} selected)</span>
                        )}
                      </label>

                      {/* Filters */}
                      <div className="flex gap-2 mb-3 flex-wrap">
                        <div className="relative flex-1 min-w-40">
                          <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search rewards..."
                            value={poolSearch}
                            onChange={(e) => setPoolSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <select
                          value={poolFilterBrand}
                          onChange={(e) => setPoolFilterBrand(e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">All Brands</option>
                          {allBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select
                          value={poolFilterType}
                          onChange={(e) => setPoolFilterType(e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">All Types</option>
                          <option value="discount">Discount</option>
                          <option value="cashback">Cashback</option>
                          <option value="gift">Gift</option>
                          <option value="general">General</option>
                        </select>
                        <select
                          value={poolFilterCoupon}
                          onChange={(e) => setPoolFilterCoupon(e.target.value)}
                          className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">Any Coupon</option>
                          <option value="generic">Generic Code</option>
                          <option value="unique">Unique Codes</option>
                        </select>
                      </div>

                      {/* Reward Grid */}
                      <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {allRewards
                          .filter(r => {
                            const matchSearch = !poolSearch || r.title.toLowerCase().includes(poolSearch.toLowerCase()) || r.brand?.name.toLowerCase().includes(poolSearch.toLowerCase());
                            const matchBrand = !poolFilterBrand || r.brand?.id === poolFilterBrand;
                            const matchType = !poolFilterType || r.category === poolFilterType;
                            const matchCoupon = !poolFilterCoupon || r.coupon_type === poolFilterCoupon;
                            return matchSearch && matchBrand && matchType && matchCoupon;
                          })
                          .map(reward => {
                            const isSelected = selectedPool.some(r => r.id === reward.id);
                            return (
                              <div
                                key={reward.id}
                                onClick={() => togglePoolReward(reward)}
                                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-purple-50' : ''}`}
                              >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                  {isSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="currentColor"><path d="M1 4l2.5 2.5L9 1"/></svg>}
                                </div>
                                {reward.image_url ? (
                                  <img src={reward.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <Image className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{reward.title}</p>
                                  <p className="text-xs text-gray-500">{reward.brand?.name ?? 'No Brand'} · {reward.value_description}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${reward.coupon_type === 'generic' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                    {reward.coupon_type}
                                  </span>
                                  <span className="text-xs text-gray-400">{reward.available_vouchers} avail.</span>
                                </div>
                              </div>
                            );
                          })}
                        {allRewards.filter(r => {
                          const matchSearch = !poolSearch || r.title.toLowerCase().includes(poolSearch.toLowerCase()) || r.brand?.name.toLowerCase().includes(poolSearch.toLowerCase());
                          const matchBrand = !poolFilterBrand || r.brand?.id === poolFilterBrand;
                          const matchType = !poolFilterType || r.category === poolFilterType;
                          const matchCoupon = !poolFilterCoupon || r.coupon_type === poolFilterCoupon;
                          return matchSearch && matchBrand && matchType && matchCoupon;
                        }).length === 0 && (
                          <div className="p-4 text-sm text-gray-500 text-center">No active rewards with available vouchers found.</div>
                        )}
                      </div>

                      {/* Selected pool chips */}
                      {selectedPool.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {selectedPool.map(r => (
                            <span key={r.id} className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                              {r.title}
                              <button type="button" onClick={() => togglePoolReward(r)} className="hover:text-purple-900">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Collection Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-purple-600" />
                        Collection-level Trigger (optional)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Type a collection name to search your Shopify store. Selected collections will be added as trigger conditions.</p>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search Shopify collections..."
                          value={collectionQuery}
                          onChange={(e) => handleCollectionQueryChange(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        {collectionSearching && (
                          <div className="absolute right-2 top-2.5 w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                      {collectionResults.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto shadow-sm">
                          {collectionResults.map(col => (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => addCollectionCondition(col)}
                              className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm flex items-center justify-between"
                            >
                              <span>{col.title}</span>
                              <span className="text-xs text-gray-400">{col.type} · {col.handle}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Brief description of this rule..."
                  />
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => toggleSection('triggers')}
                    className="flex items-center justify-between w-full mb-4"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Trigger Conditions</h3>
                      <span className="text-xs text-gray-500">(Order & Cart)</span>
                    </div>
                    {expandedSections.triggers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.triggers && (
                    <RuleBuilder
                      conditions={formData.trigger_conditions}
                      onChange={(conditions) => setFormData({ ...formData, trigger_conditions: conditions })}
                      conditionTypes={triggerConditionTypes}
                      availableScopes={availableScopes}
                    />
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => toggleSection('eligibility')}
                    className="flex items-center justify-between w-full mb-4"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Eligibility Conditions</h3>
                      <span className="text-xs text-gray-500">(Customer-based)</span>
                    </div>
                    {expandedSections.eligibility ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.eligibility && (
                    <RuleBuilder
                      conditions={formData.eligibility_conditions}
                      onChange={(conditions) => setFormData({ ...formData, eligibility_conditions: conditions })}
                      conditionTypes={eligibilityConditionTypes}
                      availableScopes={availableScopes}
                    />
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => toggleSection('location')}
                    className="flex items-center justify-between w-full mb-4"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-red-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Location Conditions</h3>
                      <span className="text-xs text-gray-500">(Geographic Targeting)</span>
                    </div>
                    {expandedSections.location ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.location && (
                    <RuleBuilder
                      conditions={formData.location_conditions}
                      onChange={(conditions) => setFormData({ ...formData, location_conditions: conditions })}
                      conditionTypes={locationConditionTypes}
                      availableScopes={availableScopes}
                    />
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => toggleSection('attribution')}
                    className="flex items-center justify-between w-full mb-4"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Attribution Conditions</h3>
                      <span className="text-xs text-gray-500">(UTM Parameters)</span>
                    </div>
                    {expandedSections.attribution ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.attribution && (
                    <RuleBuilder
                      conditions={formData.attribution_conditions}
                      onChange={(conditions) => setFormData({ ...formData, attribution_conditions: conditions })}
                      conditionTypes={attributionConditionTypes}
                      availableScopes={availableScopes}
                    />
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => toggleSection('exclusions')}
                    className="flex items-center justify-between w-full mb-4"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-orange-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Exclusion Rules</h3>
                    </div>
                    {expandedSections.exclusions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.exclusions && (
                    <div className="space-y-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.exclusion_rules.exclude_refunded}
                          onChange={(e) => setFormData({
                            ...formData,
                            exclusion_rules: { ...formData.exclusion_rules, exclude_refunded: e.target.checked }
                          })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Exclude Refunded Orders</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.exclusion_rules.exclude_cancelled}
                          onChange={(e) => setFormData({
                            ...formData,
                            exclusion_rules: { ...formData.exclusion_rules, exclude_cancelled: e.target.checked }
                          })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Exclude Cancelled Orders</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.exclusion_rules.exclude_test_orders}
                          onChange={(e) => setFormData({
                            ...formData,
                            exclusion_rules: { ...formData.exclusion_rules, exclude_test_orders: e.target.checked }
                          })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Exclude Test/Staff Orders</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => toggleSection('reward')}
                    className="flex items-center justify-between w-full mb-4"
                  >
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-pink-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Reward Action</h3>
                    </div>
                    {expandedSections.reward ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.reward && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Allocation Timing
                        </label>
                        <select
                          value={formData.reward_action.allocation_timing}
                          onChange={(e) => setFormData({
                            ...formData,
                            reward_action: { ...formData.reward_action, allocation_timing: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="instant">Instant</option>
                          <option value="delayed">Delayed (After Fulfillment)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Claim Method
                        </label>
                        <select
                          value={formData.reward_action.claim_method}
                          onChange={(e) => setFormData({
                            ...formData,
                            reward_action: { ...formData.reward_action, claim_method: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="auto">Auto-Allocate</option>
                          <option value="click">Click to Claim</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reward Expiry (days)
                        </label>
                        <input
                          type="number"
                          value={formData.reward_action.expiry_days}
                          onChange={(e) => setFormData({
                            ...formData,
                            reward_action: { ...formData.reward_action, expiry_days: parseInt(e.target.value) }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => toggleSection('guardrails')}
                    className="flex items-center justify-between w-full mb-4"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-gray-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Guardrails & Limits</h3>
                    </div>
                    {expandedSections.guardrails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.guardrails && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Rewards Per Customer
                        </label>
                        <input
                          type="number"
                          value={formData.guardrails.max_rewards_per_customer}
                          onChange={(e) => setFormData({
                            ...formData,
                            guardrails: { ...formData.guardrails, max_rewards_per_customer: e.target.value }
                          })}
                          placeholder="Unlimited"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Total Rewards
                        </label>
                        <input
                          type="number"
                          value={formData.guardrails.max_rewards_total}
                          onChange={(e) => setFormData({
                            ...formData,
                            guardrails: { ...formData.guardrails, max_rewards_total: e.target.value }
                          })}
                          placeholder="Unlimited"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Budget Cap
                        </label>
                        <input
                          type="number"
                          value={formData.guardrails.budget_cap}
                          onChange={(e) => setFormData({
                            ...formData,
                            guardrails: { ...formData.guardrails, budget_cap: e.target.value }
                          })}
                          placeholder="Unlimited"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Activate Rule Immediately</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <Button type="button" variant="outline" onClick={() => {
                    setShowModal(false);
                    setEditingRule(null);
                    resetForm();
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingRule ? 'Update Rule' : 'Create Rule'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
