import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Sparkles,
  Copy,
  Check,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Code,
  TrendingUp,
  X,
  BookOpen,
  Smartphone,
  ShoppingCart,
  Package,
  Megaphone,
  Gift
} from 'lucide-react';
import { clientMenuItems } from './clientMenuItems';

interface WidgetConfig {
  id: string;
  widget_id: string;
  widget_type: string;
  name: string;
  description: string;
  is_active: boolean;
  view_count: number;
  click_count: number;
  conversion_count: number;
  config: any;
  styles: any;
  content: any;
  created_at: string;
}

interface WidgetType {
  type: string;
  name: string;
  description: string;
  icon: any;
  supportsExtension: boolean;
  supportsScript: boolean;
}

const widgetTypes: WidgetType[] = [
  {
    type: 'thank-you',
    name: 'Thank You Card',
    description: 'Display rewards on order confirmation page',
    icon: Gift,
    supportsExtension: true,
    supportsScript: true,
  },
  {
    type: 'order-status',
    name: 'Order Status Rewards',
    description: 'Show rewards on order status page',
    icon: Package,
    supportsExtension: true,
    supportsScript: false,
  },
  {
    type: 'cart',
    name: 'Cart Rewards',
    description: 'Display rewards in shopping cart',
    icon: ShoppingCart,
    supportsExtension: true,
    supportsScript: false,
  },
  {
    type: 'floating',
    name: 'Floating Widget',
    description: 'Floating button for quick rewards access',
    icon: Smartphone,
    supportsExtension: true,
    supportsScript: true,
  },
  {
    type: 'announcement',
    name: 'Announcement Bar',
    description: 'Top banner for rewards messaging',
    icon: Megaphone,
    supportsExtension: true,
    supportsScript: false,
  },
];

export function ShopifyWidgets() {
  const { profile } = useAuth();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState<WidgetConfig | null>(null);
  const [installMethod, setInstallMethod] = useState<'extension' | 'script'>('extension');

  const [formData, setFormData] = useState({
    widget_id: '',
    widget_type: 'thank-you',
    name: '',
    description: '',
    title: 'Congratulations! You earned rewards!',
    subtitle: 'Click below to claim your rewards',
    description_text: 'Thank you for your purchase!',
    buttonText: 'View My Rewards',
    primaryColor: '#2563eb',
    secondaryColor: '#10b981',
  });

  useEffect(() => {
    if (profile?.client_id) {
      fetchWidgets();
    }
  }, [profile]);

  const fetchWidgets = async () => {
    if (!profile?.client_id) return;

    try {
      const { data, error } = await supabase
        .from('widget_configurations')
        .select('*')
        .eq('client_id', profile.client_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWidgets(data || []);
    } catch (error) {
      console.error('Error fetching widgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.client_id) return;

    const widgetData = {
      client_id: profile.client_id,
      widget_id: formData.widget_id,
      widget_type: formData.widget_type,
      name: formData.name,
      description: formData.description,
      is_active: true,
      content: {
        title: formData.title,
        subtitle: formData.subtitle,
        description: formData.description_text,
        buttonText: formData.buttonText,
      },
      styles: {
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
      },
      config: {},
    };

    try {
      if (editingWidget) {
        const { error } = await supabase
          .from('widget_configurations')
          .update(widgetData)
          .eq('id', editingWidget.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('widget_configurations')
          .insert([widgetData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingWidget(null);
      resetForm();
      fetchWidgets();
    } catch (error: any) {
      console.error('Error saving widget:', error);
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      widget_id: '',
      widget_type: 'thank-you',
      name: '',
      description: '',
      title: 'Congratulations! You earned rewards!',
      subtitle: 'Click below to claim your rewards',
      description_text: 'Thank you for your purchase!',
      buttonText: 'View My Rewards',
      primaryColor: '#2563eb',
      secondaryColor: '#10b981',
    });
  };

  const handleEdit = (widget: WidgetConfig) => {
    setEditingWidget(widget);
    setFormData({
      widget_id: widget.widget_id,
      widget_type: widget.widget_type,
      name: widget.name,
      description: widget.description || '',
      title: widget.content?.title || '',
      subtitle: widget.content?.subtitle || '',
      description_text: widget.content?.description || '',
      buttonText: widget.content?.buttonText || '',
      primaryColor: widget.styles?.primaryColor || '#2563eb',
      secondaryColor: widget.styles?.secondaryColor || '#10b981',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this widget?')) return;

    try {
      const { error } = await supabase
        .from('widget_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchWidgets();
    } catch (error) {
      console.error('Error deleting widget:', error);
    }
  };

  const toggleActive = async (widget: WidgetConfig) => {
    try {
      const { error } = await supabase
        .from('widget_configurations')
        .update({ is_active: !widget.is_active })
        .eq('id', widget.id);

      if (error) throw error;
      fetchWidgets();
    } catch (error) {
      console.error('Error toggling widget:', error);
    }
  };

  const copyWidgetId = (widgetId: string) => {
    navigator.clipboard.writeText(widgetId);
    setCopiedId(widgetId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyScript = (script: string, widgetId: string) => {
    navigator.clipboard.writeText(script);
    setCopiedScript(widgetId);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const getWidgetType = (type: string) => {
    return widgetTypes.find(w => w.type === type);
  };

  const getConversionRate = (widget: WidgetConfig) => {
    if (widget.view_count === 0) return 0;
    return ((widget.click_count / widget.view_count) * 100).toFixed(2);
  };

  const generateScript = (widget: WidgetConfig) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (widget.widget_type === 'thank-you') {
      return `<!-- RewardHub Thank You Card -->
<script>
(function() {
  const API_URL = '${supabaseUrl}/functions/v1/get-order-rewards';
  const API_KEY = '${supabaseKey}';
  const WIDGET_ID = '${widget.widget_id}';

  if (!window.Shopify?.checkout?.order_id) return;

  fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + API_KEY
    },
    body: JSON.stringify({
      widget_id: WIDGET_ID,
      order_id: Shopify.checkout.order_id,
      shop_domain: Shopify.shop
    })
  })
  .then(r => r.json())
  .then(data => {
    if (!data.has_rewards) return;

    const card = document.createElement('div');
    card.innerHTML = \`
      <div style="background: linear-gradient(135deg, ${widget.styles?.primaryColor || '#2563eb'} 0%, ${widget.styles?.secondaryColor || '#10b981'} 100%); color: white; padding: 24px; border-radius: 12px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="background: white; color: ${widget.styles?.primaryColor || '#2563eb'}; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">🎁</div>
          <div style="flex: 1;">
            <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">${widget.content?.title || 'Congratulations!'}</h3>
            <p style="margin: 0; opacity: 0.9; font-size: 14px;">${widget.content?.description || 'You earned rewards!'}</p>
          </div>
        </div>
        \${data.redemption_link ? '<a href="' + data.redemption_link + '" style="display: inline-block; background: white; color: ${widget.styles?.primaryColor || '#2563eb'}; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 12px;">${widget.content?.buttonText || 'View Rewards'}</a>' : ''}
      </div>
    \`;

    const main = document.querySelector('.main__content, main');
    if (main) main.insertBefore(card, main.firstChild);
  });
})();
</script>`;
    }

    if (widget.widget_type === 'floating') {
      return `<!-- RewardHub Floating Widget -->
<script>
(function() {
  const btn = document.createElement('div');
  btn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; background: linear-gradient(135deg, ${widget.styles?.primaryColor || '#2563eb'}, ${widget.styles?.secondaryColor || '#10b981'}); border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 9999;';
  btn.innerHTML = '<svg width="28" height="28" fill="white" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>';
  btn.onclick = () => window.location.href = '/pages/rewards';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(btn));
  } else {
    document.body.appendChild(btn);
  }
})();
</script>`;
    }

    return '';
  };

  const getExtensionInstructions = (widget: WidgetConfig) => {
    const instructions: Record<string, string[]> = {
      'thank-you': [
        'Go to Settings → Checkout in Shopify admin',
        'Click "Customize" next to your checkout profile',
        'Navigate to "Order Status Page"',
        'Click "Add block" and select "Rewards Thank You Card"',
        `Enter Widget ID: ${widget.widget_id}`,
        'Click "Save"'
      ],
      'order-status': [
        'Go to Settings → Checkout in Shopify admin',
        'Click "Customize" next to your checkout profile',
        'Navigate to "Order Status Page"',
        'Click "Add block" and select "Order Status Rewards"',
        `Enter Widget ID: ${widget.widget_id}`,
        'Click "Save"'
      ],
      'cart': [
        'Go to Online Store → Themes in Shopify admin',
        'Click "Customize"',
        'Navigate to "Cart" page or drawer',
        'Click "Add block" and select "Rewards Cart Widget"',
        `Enter Widget ID: ${widget.widget_id}`,
        'Click "Save"'
      ],
      'floating': [
        'Go to Online Store → Themes in Shopify admin',
        'Click "Customize"',
        'Click "App embeds" (bottom of left sidebar)',
        'Find "Engage Universal" and toggle ON',
        `Enter Widget ID: ${widget.widget_id}`,
        'Configure position and options',
        'Click "Save"'
      ],
      'announcement': [
        'Go to Online Store → Themes in Shopify admin',
        'Click "Customize"',
        'Navigate to "Header" section',
        'Click "Add block" and select "Rewards Announcement"',
        `Enter Widget ID: ${widget.widget_id}`,
        'Customize message and CTA',
        'Click "Save"'
      ],
    };

    return instructions[widget.widget_type] || [];
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Client Portal">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading widgets...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Client Portal">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shopify Widgets</h1>
            <p className="mt-1 text-gray-600">
              Display rewards across your Shopify store - via extensions or script
            </p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Create Widget
          </Button>
        </div>

        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <strong className="block mb-1">Two Installation Methods:</strong>
              <ul className="space-y-1 ml-4 list-disc">
                <li><strong>Extension (Recommended):</strong> Native Shopify integration, no code editing</li>
                <li><strong>Script:</strong> Quick setup, paste code into theme</li>
              </ul>
            </div>
          </div>
        </Card>

        {widgets.length === 0 ? (
          <Card className="text-center py-12">
            <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No widgets yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first widget to start displaying rewards on your Shopify store
            </p>
            <Button onClick={() => setShowModal(true)}>Create Your First Widget</Button>
          </Card>
        ) : (
          <div className="grid gap-6">
            {widgets.map((widget) => {
              const widgetType = getWidgetType(widget.widget_type);
              const Icon = widgetType?.icon || Gift;

              return (
                <Card key={widget.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Icon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{widget.name}</h3>
                          {widget.is_active ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                              Inactive
                            </span>
                          )}
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                            {widgetType?.name}
                          </span>
                        </div>

                        {widget.description && (
                          <p className="text-sm text-gray-600 mb-3">{widget.description}</p>
                        )}

                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xs font-medium text-gray-500">Widget ID:</span>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            {widget.widget_id}
                          </code>
                          <button
                            onClick={() => copyWidgetId(widget.widget_id)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copy Widget ID"
                          >
                            {copiedId === widget.widget_id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            <span>{widget.view_count.toLocaleString()} views</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            <span>{widget.click_count.toLocaleString()} clicks</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-blue-600">
                              {getConversionRate(widget)}% CTR
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(widget)}
                        className={`p-2 rounded-lg ${
                          widget.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        title={widget.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {widget.is_active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleEdit(widget)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(widget.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <h4 className="font-medium text-gray-900 text-sm">Installation Methods</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {widgetType?.supportsExtension && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setShowInstallModal(widget);
                            setInstallMethod('extension');
                          }}
                          className="flex items-center justify-center gap-2"
                        >
                          <BookOpen className="w-4 h-4" />
                          Extension Setup
                        </Button>
                      )}
                      {widgetType?.supportsScript && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setShowInstallModal(widget);
                            setInstallMethod('script');
                          }}
                          className="flex items-center justify-center gap-2"
                        >
                          <Code className="w-4 h-4" />
                          Script Code
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingWidget ? 'Edit Widget' : 'Create New Widget'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingWidget(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Widget ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.widget_id}
                      onChange={(e) => setFormData({ ...formData, widget_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="thank-you-v1"
                      disabled={!!editingWidget}
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique ID (lowercase, hyphens)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Widget Type *
                    </label>
                    <select
                      required
                      value={formData.widget_type}
                      onChange={(e) => setFormData({ ...formData, widget_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {widgetTypes.map((type) => (
                        <option key={type.type} value={type.type}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Summer Thank You Widget"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Internal description for your team"
                  />
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Content</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Congratulations! You've earned rewards!"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
                      <input
                        type="text"
                        value={formData.subtitle}
                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Click below to claim your rewards"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={formData.description_text}
                        onChange={(e) => setFormData({ ...formData, description_text: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        rows={3}
                        placeholder="Thank you for your purchase!"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Button Text</label>
                      <input
                        type="text"
                        value={formData.buttonText}
                        onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="View My Rewards"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Styling</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.secondaryColor}
                          onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                          className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.secondaryColor}
                          onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false);
                      setEditingWidget(null);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingWidget ? 'Update Widget' : 'Create Widget'}
                  </Button>
                </div>
              </form>
              </Card>
            </div>
          </div>
        )}

        {/* Installation Modal */}
        {showInstallModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {installMethod === 'extension' ? 'Extension Setup' : 'Script Installation'}
                </h2>
                <button
                  onClick={() => setShowInstallModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {installMethod === 'extension' ? (
                <div className="space-y-6">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-semibold text-green-900 mb-2">Recommended Method</h3>
                    <p className="text-sm text-green-800">
                      Native Shopify integration. No code editing required. Managed through Shopify admin.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Installation Steps:</h3>
                    <ol className="space-y-3">
                      {getExtensionInstructions(showInstallModal).map((step, index) => (
                        <li key={index} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <span className="text-gray-700 pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Widget ID</h4>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-white px-3 py-2 rounded font-mono flex-1">
                        {showInstallModal.widget_id}
                      </code>
                      <Button
                        size="sm"
                        onClick={() => copyWidgetId(showInstallModal.widget_id)}
                      >
                        {copiedId === showInstallModal.widget_id ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-semibold text-yellow-900 mb-2">Quick Setup</h3>
                    <p className="text-sm text-yellow-800">
                      Paste this script into your theme. Requires basic code editing.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Installation Steps:</h3>
                    <ol className="space-y-3 text-sm text-gray-700">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">1</span>
                        <span>Go to <strong>Online Store → Themes → Actions → Edit code</strong></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">2</span>
                        <span>Open <strong>Layout → theme.liquid</strong></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">3</span>
                        <span>Scroll to bottom, just before <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">4</span>
                        <span>Paste the script below</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">5</span>
                        <span>Click <strong>Save</strong></span>
                      </li>
                    </ol>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">Script Code:</h3>
                      <Button
                        size="sm"
                        onClick={() => copyScript(generateScript(showInstallModal), showInstallModal.id)}
                      >
                        {copiedScript === showInstallModal.id ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy Script
                          </>
                        )}
                      </Button>
                    </div>

                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      <code>{generateScript(showInstallModal)}</code>
                    </pre>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Notes:</h4>
                    <ul className="space-y-1 text-sm text-blue-800">
                      <li>• Script is pre-configured with your Widget ID</li>
                      <li>• Test on development theme first</li>
                      <li>• Make sure widget is active (toggle in list above)</li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button
                  variant="secondary"
                  onClick={() => setShowInstallModal(null)}
                >
                  Close
                </Button>
              </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
