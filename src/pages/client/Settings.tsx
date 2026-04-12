import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Save, Building2, Mail, Palette, LogOut, User, MessageSquare,
  Webhook, Info, Bell, Lock, Upload, Check, Eye, EyeOff,
  Image as ImageIcon, Type, Sliders, Globe, Phone, Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'organization' | 'branding' | 'communications' | 'notifications' | 'security';

interface CommunicationSettings {
  provider: 'internal' | 'external';
  webhook_url?: string;
  default_template: string;
  email_from?: string;
  email_from_name?: string;
}

interface BrandingSettings {
  secondary_color: string;
  font_heading: string;
  font_body: string;
  border_radius: string;
  favicon_url: string;
}

interface NotificationSettings {
  new_member: boolean;
  points_earned: boolean;
  redemption_made: boolean;
  campaign_triggered: boolean;
  weekly_digest: boolean;
  digest_email: string;
}

interface ClientData {
  id: string;
  name: string;
  description: string;
  industry: string;
  website_url: string;
  support_email: string;
  timezone: string;
  logo_url: string;
  contact_email: string;
  contact_phone: string;
  welcome_message: string;
  primary_color: string;
  communication_settings: CommunicationSettings;
  branding_settings: BrandingSettings;
  notification_settings: NotificationSettings;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'organization',   label: 'Organization',   icon: <Building2 className="w-4 h-4" /> },
  { id: 'branding',       label: 'Branding',       icon: <Palette className="w-4 h-4" /> },
  { id: 'communications', label: 'Communications', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'notifications',  label: 'Notifications',  icon: <Bell className="w-4 h-4" /> },
  { id: 'security',       label: 'Security',       icon: <Lock className="w-4 h-4" /> },
];

const FONTS = [
  { label: 'System Default',   value: 'system-ui, -apple-system, sans-serif', key: '' },
  { label: 'Inter',            value: "'Inter', sans-serif",            key: 'Inter' },
  { label: 'Poppins',          value: "'Poppins', sans-serif",          key: 'Poppins' },
  { label: 'Roboto',           value: "'Roboto', sans-serif",           key: 'Roboto' },
  { label: 'Montserrat',       value: "'Montserrat', sans-serif",       key: 'Montserrat' },
  { label: 'Open Sans',        value: "'Open Sans', sans-serif",        key: 'Open+Sans' },
  { label: 'Lato',             value: "'Lato', sans-serif",             key: 'Lato' },
  { label: 'Nunito',           value: "'Nunito', sans-serif",           key: 'Nunito' },
  { label: 'Raleway',          value: "'Raleway', sans-serif",          key: 'Raleway' },
  { label: 'Playfair Display', value: "'Playfair Display', serif",      key: 'Playfair+Display' },
];

const INDUSTRIES = [
  'E-commerce', 'Retail', 'Healthcare', 'Education', 'Food & Beverage',
  'Travel & Hospitality', 'Financial Services', 'Technology', 'Fashion',
  'Beauty & Wellness', 'Sports & Fitness', 'Entertainment', 'Real Estate', 'Other',
];

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Colombo',
  'Asia/Karachi', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Hong_Kong',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

const RADIUS_OPTIONS = [
  { label: 'Sharp',   value: '0px' },
  { label: 'Slight',  value: '4px' },
  { label: 'Medium',  value: '8px' },
  { label: 'Rounded', value: '12px' },
  { label: 'Pill',    value: '9999px' },
];

const NOTIFICATION_EVENTS: { key: keyof NotificationSettings; label: string; desc: string }[] = [
  { key: 'new_member',         label: 'New member enrolled',       desc: 'When a customer joins a membership program' },
  { key: 'points_earned',      label: 'Points earned',             desc: 'When a member earns points from a transaction' },
  { key: 'redemption_made',    label: 'Reward redeemed',           desc: 'When a member redeems a reward or voucher' },
  { key: 'campaign_triggered', label: 'Campaign triggered',        desc: 'When an automated campaign fires' },
  { key: 'weekly_digest',      label: 'Weekly performance digest', desc: 'Summary of loyalty activity every Monday' },
];

const DEFAULT_COMM: CommunicationSettings = {
  provider: 'internal',
  default_template:
    'Hi {name}! Congratulations on being enrolled in {program} at {client}! Click here to access your exclusive rewards and benefits: {link} (This link is valid for {validity})',
};

const DEFAULT_BRANDING: BrandingSettings = {
  secondary_color: '#8B5CF6',
  font_heading: "'Inter', sans-serif",
  font_body:    "'Inter', sans-serif",
  border_radius: '8px',
  favicon_url: '',
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  new_member:         true,
  points_earned:      false,
  redemption_made:    true,
  campaign_triggered: true,
  weekly_digest:      false,
  digest_email:       '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Settings() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const [activeTab, setActiveTab]     = useState<TabId>('organization');
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [clientId, setClientId]       = useState<string | null>(null);

  const [logoUploading, setLogoUploading]       = useState(false);
  const [logoUploadError, setLogoUploadError]   = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [pwData, setPwData]         = useState({ newPw: '', confirm: '' });
  const [showPw, setShowPw]         = useState(false);
  const [pwError, setPwError]       = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]   = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const [formData, setFormData] = useState<ClientData>({
    id: '', name: '', description: '', industry: '', website_url: '',
    support_email: '', timezone: 'Asia/Kolkata', logo_url: '',
    contact_email: '', contact_phone: '', welcome_message: '',
    primary_color: '#3B82F6',
    communication_settings: DEFAULT_COMM,
    branding_settings:      DEFAULT_BRANDING,
    notification_settings:  DEFAULT_NOTIFICATIONS,
  });

  // Inject Google Fonts for preview
  useEffect(() => {
    const needed = [formData.branding_settings.font_heading, formData.branding_settings.font_body];
    const keys = FONTS.filter(f => f.key && needed.includes(f.value)).map(f => f.key);
    if (!keys.length) return;
    const id = 'gf-settings-preview';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${keys.map(k => `family=${k}:wght@400;500;600;700`).join('&')}&display=swap`;
  }, [formData.branding_settings.font_heading, formData.branding_settings.font_body]);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from('profiles').select('client_id').eq('id', user.id).single();
      if (!prof?.client_id) return;
      setClientId(prof.client_id);

      const { data: client, error } = await supabase
        .from('clients').select('*').eq('id', prof.client_id).single();
      if (error) throw error;
      if (!client) return;

      setFormData({
        id:            client.id,
        name:          client.name,
        description:   client.description || '',
        industry:      (client as any).industry || '',
        website_url:   (client as any).website_url || '',
        support_email: (client as any).support_email || '',
        timezone:      (client as any).timezone || 'Asia/Kolkata',
        logo_url:      client.logo_url || '',
        contact_email: client.contact_email,
        contact_phone: client.contact_phone || '',
        welcome_message: (client as any).welcome_message || '',
        primary_color: client.primary_color || '#3B82F6',
        communication_settings: (client as any).communication_settings || DEFAULT_COMM,
        branding_settings:      { ...DEFAULT_BRANDING,      ...((client as any).branding_settings || {}) },
        notification_settings:  { ...DEFAULT_NOTIFICATIONS, ...((client as any).notification_settings || {}) },
      });
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!clientId) return;
    if (!file.type.startsWith('image/')) { setLogoUploadError('File must be an image'); return; }
    if (file.size > 5 * 1024 * 1024)    { setLogoUploadError('Image must be less than 5 MB'); return; }
    try {
      setLogoUploading(true); setLogoUploadError(null);
      const ext  = file.name.split('.').pop() ?? 'png';
      const path = `logos/${clientId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('media').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      setFormData(p => ({ ...p, logo_url: publicUrl + '?t=' + Date.now() }));
    } catch (err: any) {
      setLogoUploadError(err.message || 'Upload failed. Please paste an image URL instead.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async () => {
    if (!clientId) return;
    try {
      setSaving(true); setSaveError(null); setSaveSuccess(false);
      const { error } = await supabase.from('clients').update({
        name:          formData.name,
        description:   formData.description || null,
        industry:      formData.industry || null,
        website_url:   formData.website_url || null,
        support_email: formData.support_email || null,
        timezone:      formData.timezone,
        logo_url:      formData.logo_url || null,
        primary_color: formData.primary_color,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone || null,
        welcome_message:        formData.welcome_message || null,
        communication_settings: formData.communication_settings,
        branding_settings:      formData.branding_settings,
        notification_settings:  formData.notification_settings,
        updated_at: new Date().toISOString(),
      }).eq('id', clientId);
      if (error) throw error;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError(null); setPwSuccess(false);
    if (pwData.newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    if (pwData.newPw !== pwData.confirm) { setPwError('Passwords do not match'); return; }
    try {
      setChangingPw(true);
      const { error } = await supabase.auth.updateUser({ password: pwData.newPw });
      if (error) throw error;
      setPwSuccess(true);
      setPwData({ newPw: '', confirm: '' });
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password');
    } finally {
      setChangingPw(false);
    }
  };

  const inputCls    = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white';
  const setBranding = (patch: Partial<BrandingSettings>) =>
    setFormData(p => ({ ...p, branding_settings: { ...p.branding_settings, ...patch } }));
  const setComm     = (patch: Partial<CommunicationSettings>) =>
    setFormData(p => ({ ...p, communication_settings: { ...p.communication_settings, ...patch } }));
  const setNotif    = (patch: Partial<NotificationSettings>) =>
    setFormData(p => ({ ...p, notification_settings: { ...p.notification_settings, ...patch } }));
  const setField    = (patch: Partial<ClientData>) => setFormData(p => ({ ...p, ...patch }));

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Settings">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <p className="text-gray-500 text-sm">Loading settings…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Settings">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your organization profile, branding, integrations, and account security
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Save bar */}
        {activeTab !== 'security' && (
          <div className="flex items-center justify-between mb-5">
            <div className="h-5">
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-sm text-green-600">
                  <Check className="w-4 h-4" /> Changes saved
                </span>
              )}
              {saveError && <span className="text-sm text-red-600">{saveError}</span>}
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        )}

        {/* ── ORGANIZATION ── */}
        {activeTab === 'organization' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" /> Organization Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={formData.name} required className={inputCls}
                    placeholder="My Company" onChange={e => setField({ name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea value={formData.description} rows={3} className={inputCls}
                    placeholder="Brief description of your organization…"
                    onChange={e => setField({ description: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
                    <select value={formData.industry} className={inputCls}
                      onChange={e => setField({ industry: e.target.value })}>
                      <option value="">Select industry…</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <Clock className="w-4 h-4 inline mr-1 text-gray-400" />Timezone
                    </label>
                    <select value={formData.timezone} className={inputCls}
                      onChange={e => setField({ timezone: e.target.value })}>
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Globe className="w-4 h-4 inline mr-1 text-gray-400" />Website URL
                  </label>
                  <input type="url" value={formData.website_url} className={inputCls}
                    placeholder="https://yourcompany.com"
                    onChange={e => setField({ website_url: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Welcome Message</label>
                  <textarea value={formData.welcome_message} rows={2} className={inputCls}
                    placeholder="Welcome to our loyalty program! Earn points on every purchase."
                    onChange={e => setField({ welcome_message: e.target.value })} />
                  <p className="text-xs text-gray-500 mt-1">Shown to members when they first access the member portal</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Primary Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input type="email" value={formData.contact_email} required className={inputCls}
                      placeholder="hello@company.com"
                      onChange={e => setField({ contact_email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Support Email</label>
                    <input type="email" value={formData.support_email} className={inputCls}
                      placeholder="support@company.com"
                      onChange={e => setField({ support_email: e.target.value })} />
                    <p className="text-xs text-gray-500 mt-1">Shown to members as the help contact</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Phone className="w-4 h-4 inline mr-1 text-gray-400" />Contact Phone
                  </label>
                  <input type="tel" value={formData.contact_phone} className={inputCls}
                    placeholder="+91 98765 43210"
                    onChange={e => setField({ contact_phone: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── BRANDING ── */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" /> Logo & Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organization Logo</label>
                  <div className="flex items-start gap-5">
                    <div className="w-28 h-28 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Logo"
                          className="w-full h-full object-contain p-2"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <input type="file" ref={logoInputRef} accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                      <Button type="button" variant="secondary" disabled={logoUploading}
                        onClick={() => logoInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        {logoUploading ? 'Uploading…' : 'Upload from Device'}
                      </Button>
                      <p className="text-xs text-gray-500">PNG, JPG, SVG or WebP · Max 5 MB · Recommended 300×300 px</p>
                      {logoUploadError && <p className="text-xs text-red-500">{logoUploadError}</p>}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Or paste an image URL</label>
                        <input type="url" value={formData.logo_url}
                          onChange={e => setField({ logo_url: e.target.value })}
                          className={inputCls} placeholder="https://cdn.example.com/logo.png" />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Favicon URL</label>
                  <input type="url" value={formData.branding_settings.favicon_url}
                    onChange={e => setBranding({ favicon_url: e.target.value })}
                    className={inputCls} placeholder="https://yourcompany.com/favicon.ico" />
                  <p className="text-xs text-gray-500 mt-1">Shown in the browser tab (32×32 or 64×64 .ico or .png)</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" /> Brand Colors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={formData.primary_color}
                        onChange={e => setField({ primary_color: e.target.value })}
                        className="h-10 w-12 rounded-lg border border-gray-300 cursor-pointer p-0.5 flex-shrink-0" />
                      <input type="text" value={formData.primary_color}
                        onChange={e => setField({ primary_color: e.target.value })}
                        className={inputCls + ' font-mono'} placeholder="#3B82F6" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Secondary / Accent Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={formData.branding_settings.secondary_color}
                        onChange={e => setBranding({ secondary_color: e.target.value })}
                        className="h-10 w-12 rounded-lg border border-gray-300 cursor-pointer p-0.5 flex-shrink-0" />
                      <input type="text" value={formData.branding_settings.secondary_color}
                        onChange={e => setBranding({ secondary_color: e.target.value })}
                        className={inputCls + ' font-mono'} placeholder="#8B5CF6" />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl p-5 text-white"
                  style={{ background: `linear-gradient(135deg, ${formData.primary_color} 0%, ${formData.branding_settings.secondary_color} 100%)` }}>
                  <p className="font-semibold text-sm mb-3">Color Gradient Preview</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">Primary Button</span>
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">Highlighted Badge</span>
                    <span className="px-3 py-1 border border-white/40 rounded-full text-xs font-medium">Outline Style</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Applied to member portals, loyalty widgets, campaign emails, and redemption pages</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Type className="w-5 h-5" /> Typography</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Heading Font</label>
                    <select value={formData.branding_settings.font_heading}
                      onChange={e => setBranding({ font_heading: e.target.value })} className={inputCls}>
                      {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Font</label>
                    <select value={formData.branding_settings.font_body}
                      onChange={e => setBranding({ font_body: e.target.value })} className={inputCls}>
                      {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                  <h3 style={{ fontFamily: formData.branding_settings.font_heading, fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>
                    Earn rewards with every purchase
                  </h3>
                  <p style={{ fontFamily: formData.branding_settings.font_body, fontSize: '13px', color: '#6B7280', lineHeight: 1.6 }}>
                    Join our loyalty program and start earning points on every transaction. Redeem your points for exclusive rewards, discounts, and partner benefits.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span className="inline-block px-4 py-1.5 text-white text-xs font-semibold"
                      style={{ background: formData.primary_color, borderRadius: formData.branding_settings.border_radius, fontFamily: formData.branding_settings.font_body }}>
                      Join Now
                    </span>
                    <span className="inline-block px-4 py-1.5 text-xs font-medium border"
                      style={{ borderColor: formData.primary_color, color: formData.primary_color, borderRadius: formData.branding_settings.border_radius, fontFamily: formData.branding_settings.font_body }}>
                      Learn More
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sliders className="w-5 h-5" /> Component Style</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="block text-sm font-medium text-gray-700 mb-3">Button & Input Corner Radius</label>
                <div className="flex flex-wrap gap-3">
                  {RADIUS_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setBranding({ border_radius: opt.value })}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all min-w-[88px] ${
                        formData.branding_settings.border_radius === opt.value
                          ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                      <div className="w-14 h-8 bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700"
                        style={{ borderRadius: opt.value }}>Aa</div>
                      <span className="text-xs text-gray-600">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">Applied to buttons, inputs, modals, and cards in the member-facing portal</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── COMMUNICATIONS ── */}
        {activeTab === 'communications' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Communication Provider</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  {([
                    { value: 'internal' as const, title: 'Internal (Recommended)', body: 'Use our built-in system to send emails and SMS to members automatically when campaigns trigger.' },
                    { value: 'external' as const, title: 'External Webhook', body: 'Use your existing tools (e.g. Klaviyo, SendGrid, WhatsApp API). We POST campaign data to your endpoint.' },
                  ]).map(opt => (
                    <label key={opt.value}
                      className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${
                        formData.communication_settings.provider === opt.value ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'
                      }`}>
                      <input type="radio" name="provider" value={opt.value}
                        checked={formData.communication_settings.provider === opt.value}
                        onChange={() => setComm({ provider: opt.value })} className="mt-1 accent-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900 flex items-center gap-1.5">
                          {opt.title}
                          {opt.value === 'external' && <Webhook className="w-4 h-4 text-gray-400" />}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">{opt.body}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {formData.communication_settings.provider === 'external' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Webhook URL <span className="text-red-500">*</span>
                    </label>
                    <input type="url" className={inputCls + ' font-mono text-xs'}
                      value={formData.communication_settings.webhook_url || ''}
                      onChange={e => setComm({ webhook_url: e.target.value })}
                      placeholder="https://hooks.example.com/campaign-events" />
                    <p className="text-xs text-gray-500 mt-1">
                      We will POST JSON with member details, campaign info, and personalized redemption links on every trigger.
                    </p>
                  </div>
                )}

                {formData.communication_settings.provider === 'internal' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">From Email</label>
                      <input type="email" value={formData.communication_settings.email_from || ''}
                        onChange={e => setComm({ email_from: e.target.value })}
                        className={inputCls} placeholder="noreply@yourcompany.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">From Name</label>
                      <input type="text" value={formData.communication_settings.email_from_name || ''}
                        onChange={e => setComm({ email_from_name: e.target.value })}
                        className={inputCls} placeholder="Your Company Rewards" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="w-5 h-5" /> Default Message Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Available Placeholders</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs">
                    {([
                      ['{name}',     "Member's full name"],
                      ['{client}',   'Your organization'],
                      ['{program}',  'Program name'],
                      ['{link}',     'Redemption link'],
                      ['{validity}', 'Link validity'],
                      ['{points}',   'Points earned'],
                    ] as const).map(([token, desc]) => (
                      <div key={token} className="flex gap-2">
                        <span className="font-bold text-blue-700">{token}</span>
                        <span className="text-blue-600">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <textarea value={formData.communication_settings.default_template}
                  onChange={e => setComm({ default_template: e.target.value })}
                  rows={6} className={inputCls} placeholder="Hi {name}! Welcome to {program}…" />
                <p className="text-xs text-gray-500">
                  Default for all campaign communications. Can be overridden per individual campaign.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Email Alert Preferences</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-gray-100">
                {NOTIFICATION_EVENTS.map(ev => (
                  <div key={ev.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ev.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ev.desc}</p>
                    </div>
                    <button type="button"
                      onClick={() => setNotif({ [ev.key]: !(formData.notification_settings as any)[ev.key] } as any)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-4 ${
                        (formData.notification_settings as any)[ev.key] ? 'bg-blue-600' : 'bg-gray-200'
                      }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        (formData.notification_settings as any)[ev.key] ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Notification Delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notification Email Address</label>
                <input type="email" value={formData.notification_settings.digest_email}
                  onChange={e => setNotif({ digest_email: e.target.value })}
                  className={inputCls} placeholder="ops@yourcompany.com" />
                <p className="text-xs text-gray-500 mt-1">
                  Real-time event alerts and weekly digests will be sent to this address.
                  Defaults to primary contact email if left blank.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── SECURITY ── */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Account Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Signed in as</span>
                    <span className="text-sm font-medium text-gray-900">{profile?.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Account role</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">Client</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-gray-600">Full name</span>
                    <span className="text-sm font-medium text-gray-900">{profile?.full_name || '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" /> Change Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={pwData.newPw}
                      onChange={e => setPwData(p => ({ ...p, newPw: e.target.value }))}
                      className={inputCls + ' pr-10'} placeholder="Minimum 8 characters" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <input type={showPw ? 'text' : 'password'} value={pwData.confirm}
                    onChange={e => setPwData(p => ({ ...p, confirm: e.target.value }))}
                    className={inputCls} placeholder="Re-enter new password" />
                </div>

                {pwData.newPw && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[8, 12, 16, 20].map((len, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                          pwData.newPw.length >= len
                            ? ['bg-red-400','bg-yellow-400','bg-blue-400','bg-green-500'][i]
                            : 'bg-gray-200'
                        }`} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {pwData.newPw.length < 8  ? 'Too short' :
                       pwData.newPw.length < 12 ? 'Weak — add more characters' :
                       pwData.newPw.length < 16 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}

                {pwError   && <p className="text-sm text-red-600">{pwError}</p>}
                {pwSuccess && <p className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> Password updated successfully</p>}

                <Button onClick={handleChangePassword} disabled={changingPw || !pwData.newPw}>
                  <Lock className="w-4 h-4 mr-2" />{changingPw ? 'Updating…' : 'Update Password'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <LogOut className="w-5 h-5" /> Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">You will be signed out of this session on all tabs.</p>
                <Button variant="danger"
                  onClick={async () => {
                    if (confirm('Are you sure you want to sign out?')) {
                      await signOut(); navigate('/login');
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white">
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
