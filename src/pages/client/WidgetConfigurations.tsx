import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Copy, Check, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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

export default function WidgetConfigurations() {
  const { profile } = useAuth();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    widget_id: '',
    widget_type: 'thank-you',
    name: '',
    description: '',
    title: '',
    subtitle: '',
    description_text: '',
    buttonText: '',
    primaryColor: '#2563eb',
    secondaryColor: '#10b981',
    showRewards: true,
  });

  useEffect(() => {
    fetchWidgets();
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
      config: {
        showRewards: formData.showRewards,
      },
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
      title: '',
      subtitle: '',
      description_text: '',
      buttonText: '',
      primaryColor: '#2563eb',
      secondaryColor: '#10b981',
      showRewards: true,
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
      showRewards: widget.config?.showRewards !== false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this widget configuration?')) return;

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

  const getConversionRate = (widget: WidgetConfig) => {
    if (widget.view_count === 0) return 0;
    return ((widget.click_count / widget.view_count) * 100).toFixed(2);
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Widget Configurations">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Widget Configurations</h1>
            <p className="text-gray-600 mt-1">
              Manage your Shopify extension widgets. Configure once, deploy anywhere.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingWidget(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            New Widget
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading widgets...</p>
          </div>
        ) : widgets.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-4">No widget configurations yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first widget
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{widget.name}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {widget.widget_type}
                      </span>
                      {widget.is_active ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          Inactive
                        </span>
                      )}
                    </div>

                    {widget.description && (
                      <p className="text-gray-600 text-sm mb-3">{widget.description}</p>
                    )}

                    <div className="flex items-center gap-2 mb-4">
                      <code className="text-sm bg-gray-100 px-3 py-1 rounded font-mono">
                        {widget.widget_id}
                      </code>
                      <button
                        onClick={() => copyWidgetId(widget.widget_id)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy Widget ID"
                      >
                        {copiedId === widget.widget_id ? (
                          <Check className="w-4 h-4 text-green-600" />
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
                      <Edit className="w-5 h-5" />
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
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingWidget ? 'Edit Widget Configuration' : 'New Widget Configuration'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Widget ID *
                  </label>
                  <input
                    type="text"
                    value={formData.widget_id}
                    onChange={(e) => setFormData({ ...formData, widget_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="thank-you-v1"
                    required
                    disabled={!!editingWidget}
                  />
                  <p className="text-xs text-gray-500 mt-1">Unique ID (lowercase, hyphens only)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Widget Type *
                  </label>
                  <select
                    value={formData.widget_type}
                    onChange={(e) => setFormData({ ...formData, widget_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="thank-you">Thank You Page</option>
                    <option value="order-status">Order Status</option>
                    <option value="cart">Cart</option>
                    <option value="product">Product</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Summer Rewards Widget"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Congratulations! You've earned rewards!"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Click below to claim your rewards"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description Text
                    </label>
                    <textarea
                      value={formData.description_text}
                      onChange={(e) => setFormData({ ...formData, description_text: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={3}
                      placeholder="Thank you for your purchase! You've qualified for exclusive rewards."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Button Text
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Color
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Color
                    </label>
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

              <div className="flex justify-end gap-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingWidget(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingWidget ? 'Update Widget' : 'Create Widget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
