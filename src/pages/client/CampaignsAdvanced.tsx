import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Edit, Trash2, Play, Pause, Zap, Users, MapPin, TrendingUp, Shield, Gift, ChevronDown, ChevronUp, ChevronRight, Megaphone, Layers, Activity, Search, X, Tag, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';
import { RuleBuilder } from '../../components/RuleBuilder';
import { RewardPickerModal } from '../../components/RewardPickerModal';

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
  const [allRewards, setAllRewards] = useState<RewardPoolItem[]>([]);
  const [allBrands, setAllBrands] = useState<any[]>([]);
  const [selectedPool, setSelectedPool] = useState<RewardPoolItem[]>([]);
  const [showPoolPicker, setShowPoolPicker] = useState(false);

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
        .from('store_installations')
        .select('scopes')
        .eq('client_id', clientId)
        .eq('installation_status', 'active')
        .maybeSingle();

      if (data?.scopes) {
        setAvailableScopes(data.scopes);
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
        // Show ALL active rewards — display availability count so merchant knows inventory
        const filtered: RewardPoolItem[] = rewardsData
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
    <>
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
          <Button onClick={() => navigate('/client/campaigns-advanced/create')}>
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
                <Button onClick={() => navigate('/client/campaigns-advanced/create')}>
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
                        onClick={() => navigate(`/client/campaigns-advanced/edit/${rule.id}`)}
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

      </div>
    </DashboardLayout>
    </>
  );
}
