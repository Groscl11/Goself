import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Edit, Trash2, Mail, MessageSquare, MessageCircle, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface Template {
  id: string;
  name: string;
  template_type: string;
  subject: string | null;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

export function MessageTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    template_type: 'email' as 'sms' | 'email' | 'whatsapp',
    subject: '',
    body: '',
  });

  useEffect(() => {
    loadClientId();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadTemplates();
    }
  }, [clientId]);

  const loadClientId = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const templateData = {
        client_id: clientId,
        name: formData.name,
        template_type: formData.template_type,
        subject: formData.template_type === 'email' ? formData.subject : null,
        body: formData.body,
        variables: ['name', 'link', 'program', 'client'],
        is_active: true,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('message_templates')
          .update({ ...templateData, updated_at: new Date().toISOString() })
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('message_templates').insert([templateData]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingTemplate(null);
      setFormData({ name: '', template_type: 'email', subject: '', body: '' });
      loadTemplates();
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      template_type: template.template_type as 'sms' | 'email' | 'whatsapp',
      subject: template.subject || '',
      body: template.body,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase.from('message_templates').delete().eq('id', id);

      if (error) throw error;
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template.');
    }
  };

  const insertVariable = (variable: string) => {
    setFormData({
      ...formData,
      body: formData.body + `{${variable}}`,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-5 h-5" />;
      case 'sms':
        return <MessageSquare className="w-5 h-5" />;
      case 'whatsapp':
        return <MessageCircle className="w-5 h-5" />;
      default:
        return <Mail className="w-5 h-5" />;
    }
  };

  const defaultTemplates = {
    email: {
      name: 'Membership Enrollment Email',
      subject: 'Welcome to {program} - Your Exclusive Benefits Await!',
      body: `Hi {name},

Welcome to {program}!

We're excited to have you join our exclusive membership program. Click the link below to activate your membership and start enjoying your benefits:

{link}

As a member, you'll get access to:
- Exclusive rewards and discounts
- Special offers from partner brands
- Priority access to new products

If you have any questions, feel free to reach out to our support team.

Best regards,
The {client} Team`,
    },
    sms: {
      name: 'Membership SMS',
      subject: '',
      body: 'Hi {name}! Welcome to {program}. Activate your membership: {link}',
    },
    whatsapp: {
      name: 'WhatsApp Invitation',
      subject: '',
      body: `Hello {name}! 👋

Welcome to *{program}*!

Tap here to activate your membership and unlock exclusive rewards: {link}

Thanks for joining us!
- {client} Team`,
    },
  };

  const useDefaultTemplate = () => {
    const template = defaultTemplates[formData.template_type];
    setFormData({
      ...formData,
      name: template.name,
      subject: template.subject,
      body: template.body,
    });
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Message Templates">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Message Templates</h1>
            <p className="text-gray-600 mt-2">
              Create and manage templates for SMS, Email, and WhatsApp campaigns
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No templates yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Create your first message template to start sending campaigns
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          template.template_type === 'email'
                            ? 'bg-blue-100 text-blue-600'
                            : template.template_type === 'sms'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-purple-100 text-purple-600'
                        }`}
                      >
                        {getTypeIcon(template.template_type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        <p className="text-xs text-gray-500 capitalize">
                          {template.template_type}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        template.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {template.subject && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Subject:</p>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {template.subject}
                      </p>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Body:</p>
                    <p className="text-sm text-gray-700 line-clamp-3">{template.body}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(template)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowForm(false);
            setEditingTemplate(null);
            setFormData({ name: '', template_type: 'email', subject: '', body: '' });
          }}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingTemplate ? 'Edit' : 'Create'} Message Template
              </h2>
              <p className="text-gray-600 mt-2">
                Create reusable templates with variables for personalization
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Welcome Email Template"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Message Type *
                  </label>
                  <select
                    required
                    value={formData.template_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        template_type: e.target.value as 'sms' | 'email' | 'whatsapp',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
              </div>

              <Button type="button" variant="secondary" size="sm" onClick={useDefaultTemplate}>
                <Copy className="w-4 h-4 mr-2" />
                Use Default Template
              </Button>

              {formData.template_type === 'email' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Subject *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Welcome to Our Membership Program!"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message Body *
                </label>
                <textarea
                  required
                  rows={formData.template_type === 'sms' ? 4 : 12}
                  placeholder="Type your message here. Use variables like {name}, {link}, {program}, {client}"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.template_type === 'sms' && formData.body.length > 160 && (
                    <span className="text-orange-600 font-medium">
                      Warning: SMS is {formData.body.length} characters (160 max recommended)
                    </span>
                  )}
                  {formData.template_type === 'sms' && formData.body.length <= 160 && (
                    <span>{formData.body.length}/160 characters</span>
                  )}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  Available Variables:
                </p>
                <div className="flex flex-wrap gap-2">
                  {['name', 'link', 'program', 'client'].map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => insertVariable(variable)}
                      className="px-3 py-1 bg-white border border-blue-300 rounded text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      {`{${variable}}`}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Click to insert variables into your message
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingTemplate ? 'Update' : 'Create'} Template
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTemplate(null);
                    setFormData({ name: '', template_type: 'email', subject: '', body: '' });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
