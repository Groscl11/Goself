import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Save, Building2, Mail, Phone, Palette, LogOut, User, MessageSquare, Webhook, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';

interface CommunicationSettings {
  provider: 'internal' | 'external';
  webhook_url?: string;
  default_template: string;
  email_from?: string;
  email_from_name?: string;
}

interface ClientSettings {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  primary_color: string;
  contact_email: string;
  contact_phone: string;
  communication_settings: CommunicationSettings;
}

export function Settings() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientSettings>({
    id: '',
    name: '',
    description: '',
    logo_url: '',
    primary_color: '#3B82F6',
    contact_email: '',
    contact_phone: '',
    communication_settings: {
      provider: 'internal',
      default_template: 'Hi {name}! Congratulations on being enrolled in {program} at {client}! Click here to access your exclusive rewards and benefits: {link} (This link is valid for {validity})',
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (!profile?.client_id) return;

      setClientId(profile.client_id);

      const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', profile.client_id)
        .single();

      if (error) throw error;

      if (client) {
        setFormData({
          id: client.id,
          name: client.name,
          description: client.description || '',
          logo_url: client.logo_url || '',
          primary_color: client.primary_color || '#3B82F6',
          contact_email: client.contact_email,
          contact_phone: client.contact_phone || '',
          communication_settings: client.communication_settings || {
            provider: 'internal',
            default_template: 'Hi {name}! Congratulations on being enrolled in {program} at {client}! Click here to access your exclusive rewards and benefits: {link} (This link is valid for {validity})',
          },
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      alert('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      alert('Client ID not found');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('clients')
        .update({
          name: formData.name,
          description: formData.description,
          logo_url: formData.logo_url || null,
          primary_color: formData.primary_color,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone || null,
          communication_settings: formData.communication_settings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (error) throw error;

      alert('Settings updated successfully');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ClientSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCommSettingChange = (field: keyof CommunicationSettings, value: any) => {
    setFormData((prev) => ({
      ...prev,
      communication_settings: {
        ...prev.communication_settings,
        [field]: value,
      },
    }));
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Settings">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your organization settings</p>
        </div>

        {loading ? (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading settings...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Organization Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="My Company"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of your organization..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => handleChange('logo_url', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com/logo.png"
                  />
                  {formData.logo_url && (
                    <div className="mt-3">
                      <img
                        src={formData.logo_url}
                        alt="Organization logo"
                        className="h-16 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleChange('contact_email', e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="contact@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => handleChange('contact_phone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Branding
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => handleChange('primary_color', e.target.value)}
                      className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primary_color}
                      onChange={(e) => handleChange('primary_color', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                      placeholder="#3B82F6"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This color will be used in member-facing portals and communications
                  </p>
                  <div
                    className="mt-3 p-4 rounded-lg text-white font-semibold"
                    style={{ backgroundColor: formData.primary_color }}
                  >
                    Preview: This is your brand color
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Communication Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Communication Provider
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" style={{
                      borderColor: formData.communication_settings.provider === 'internal' ? formData.primary_color : '#D1D5DB'
                    }}>
                      <input
                        type="radio"
                        name="provider"
                        value="internal"
                        checked={formData.communication_settings.provider === 'internal'}
                        onChange={(e) => handleCommSettingChange('provider', e.target.value as 'internal')}
                        className="mt-1"
                        style={{ accentColor: formData.primary_color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Internal (Recommended)</div>
                        <p className="text-sm text-gray-600 mt-1">
                          Use our built-in communication system to send emails and SMS to members automatically when campaigns trigger.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" style={{
                      borderColor: formData.communication_settings.provider === 'external' ? formData.primary_color : '#D1D5DB'
                    }}>
                      <input
                        type="radio"
                        name="provider"
                        value="external"
                        checked={formData.communication_settings.provider === 'external'}
                        onChange={(e) => handleCommSettingChange('provider', e.target.value as 'external')}
                        className="mt-1"
                        style={{ accentColor: formData.primary_color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          External Webhook
                          <Webhook className="w-4 h-4" />
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Use your existing communication tools. We'll send campaign data to your webhook endpoint.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {formData.communication_settings.provider === 'external' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={formData.communication_settings.webhook_url || ''}
                      onChange={(e) => handleCommSettingChange('webhook_url', e.target.value)}
                      required={formData.communication_settings.provider === 'external'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="https://your-domain.com/webhook/campaign"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      We'll POST campaign enrollment data to this URL including member details and personalized links.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Message Template
                  </label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-800">
                        <p className="font-medium mb-1">Available Placeholders:</p>
                        <div className="space-y-0.5 font-mono">
                          <div><span className="font-semibold">{'{name}'}</span> - Member's name</div>
                          <div><span className="font-semibold">{'{client}'}</span> - Your organization name</div>
                          <div><span className="font-semibold">{'{program}'}</span> - Membership program name</div>
                          <div><span className="font-semibold">{'{link}'}</span> - Personalized redemption link</div>
                          <div><span className="font-semibold">{'{validity}'}</span> - Link validity period</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <textarea
                    value={formData.communication_settings.default_template}
                    onChange={(e) => handleCommSettingChange('default_template', e.target.value)}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Hi {name}! Welcome to {program}..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This template will be used for campaign communications. You can override it per campaign.
                  </p>
                </div>

                {formData.communication_settings.provider === 'internal' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={formData.communication_settings.email_from || ''}
                        onChange={(e) => handleCommSettingChange('email_from', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="noreply@yourdomain.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.communication_settings.email_from_name || ''}
                        onChange={(e) => handleCommSettingChange('email_from_name', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your Company Name"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}

        <Card className="mt-6 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <User className="w-5 h-5" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Signed in as</p>
                <p className="font-medium text-gray-900">{profile?.email}</p>
              </div>
              <Button
                variant="danger"
                onClick={async () => {
                  if (confirm('Are you sure you want to sign out?')) {
                    await signOut();
                    navigate('/login');
                  }
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
