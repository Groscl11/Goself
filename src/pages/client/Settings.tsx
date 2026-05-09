import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Button } from '../../components/ui/Button';
import {
  Save, Building2, Mail, Palette, LogOut, User, MessageSquare,
  Webhook, Bell, Shield, Upload, Check, Eye, EyeOff,
  Image as ImageIcon, Type, Sliders, Globe, Phone, Clock,
  Award, AlertCircle, RefreshCw, ExternalLink, FileText,
  ChevronRight, Info, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'organization' | 'appearance' | 'brand' | 'communications' | 'notifications' | 'security';

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

interface BrandAssoc {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_name: string;
  submitted_url: string | null;
  proof_notes: string | null;
  rejection_reason: string | null;
  brand_id: string | null;
  created_at: string;
}

interface VerificationForm {
  legal_name: string;
  website_url: string;
  gst_number: string;
  cin: string;
  pan: string;
  registered_address: string;
  additional_notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS = [
  { label: 'System Default',   value: 'system-ui, -apple-system, sans-serif', key: '' },
  { label: 'Inter',            value: "'Inter', sans-serif",            key: 'Inter' },
  { label: 'Poppins',          value: "'Poppins', sans-serif",          key: 'Poppins' },
  { label: 'Roboto',           value: "'Roboto', sans-serif",           key: 'Roboto' },
  { label: 'Montserrat',       value: "'Montserrat', sans-serif",       key: 'Montserrat' },
  { label: 'Open Sans',        value: "'Open Sans', sans-serif",        key: 'Open+Sans' },
  { label: 'Lato',             value: "'Lato', sans-serif",             key: 'Lato' },
  { label: 'Nunito',           value: "'Nunito', sans-serif",           key: 'Nunito' },
];

const INDUSTRIES = [
  'E-commerce', 'Retail', 'Healthcare', 'Education', 'Food & Beverage',
  'Travel & Hospitality', 'Financial Services', 'Technology', 'Fashion',
  'Beauty & Wellness', 'Sports & Fitness', 'Entertainment', 'Real Estate', 'Other',
];

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Colombo',
  'Asia/Karachi', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Hong_Kong',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'UTC',
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
    'Hi {name}! Congratulations on being enrolled in {program} at {client}! Click here to access your exclusive rewards: {link} (Valid for {validity})',
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

const EMPTY_VERIFICATION: VerificationForm = {
  legal_name: '',
  website_url: '',
  gst_number: '',
  cin: '',
  pan: '',
  registered_address: '',
  additional_notes: '',
};

function parseProofNotes(raw: string | null): VerificationForm {
  if (!raw) return EMPTY_VERIFICATION;
  try {
    const parsed = JSON.parse(raw);
    return { ...EMPTY_VERIFICATION, ...parsed };
  } catch {
    return { ...EMPTY_VERIFICATION, additional_notes: raw };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
  );
}

function FieldGroup({ label, hint, children, required }: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function SaveBar({
  saving, success, error, onSave,
}: { saving: boolean; success: boolean; error: string | null; onSave: () => void }) {
  return (
    <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100">
      <div className="h-5">
        {success && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <Check className="w-4 h-4" /> Changes saved
          </span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      <Button onClick={onSave} disabled={saving} className="min-w-[120px]">
        <Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Settings() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('organization');
  const [loading, setLoading]     = useState(true);
  const [clientId, setClientId]   = useState<string | null>(null);

  // Per-section save state
  const [orgSaving, setOrgSaving]     = useState(false);
  const [orgSuccess, setOrgSuccess]   = useState(false);
  const [orgError, setOrgError]       = useState<string | null>(null);

  const [appSaving, setAppSaving]     = useState(false);
  const [appSuccess, setAppSuccess]   = useState(false);
  const [appError, setAppError]       = useState<string | null>(null);

  const [commSaving, setCommSaving]   = useState(false);
  const [commSuccess, setCommSuccess] = useState(false);
  const [commError, setCommError]     = useState<string | null>(null);

  const [notifSaving, setNotifSaving]   = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);
  const [notifError, setNotifError]     = useState<string | null>(null);

  // Logo upload
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError]         = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Password
  const [pwData, setPwData]         = useState({ newPw: '', confirm: '' });
  const [showPw, setShowPw]         = useState(false);
  const [pwError, setPwError]       = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]   = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Brand / verification
  const [brandAssoc, setBrandAssoc]       = useState<BrandAssoc | null>(null);
  const [brandLoading, setBrandLoading]   = useState(false);
  const [brandSaving, setBrandSaving]     = useState(false);
  const [brandSuccess, setBrandSuccess]   = useState(false);
  const [brandError, setBrandError]       = useState<string | null>(null);
  const [verForm, setVerForm]             = useState<VerificationForm>(EMPTY_VERIFICATION);

  // Form data
  const [formData, setFormData] = useState<ClientData>({
    id: '', name: '', description: '', industry: '', website_url: '',
    support_email: '', timezone: 'Asia/Kolkata', logo_url: '',
    contact_email: '', contact_phone: '', welcome_message: '',
    primary_color: '#3B82F6',
    communication_settings: DEFAULT_COMM,
    branding_settings:      DEFAULT_BRANDING,
    notification_settings:  DEFAULT_NOTIFICATIONS,
  });

  // Google Fonts injection
  useEffect(() => {
    const needed = [formData.branding_settings.font_heading, formData.branding_settings.font_body];
    const keys = FONTS.filter(f => f.key && needed.includes(f.value)).map(f => f.key);
    if (!keys.length) return;
    const id = 'gf-settings-preview';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = `https://fonts.googleapis.com/css2?${keys.map(k => `family=${k}:wght@400;500;600;700`).join('&')}&display=swap`;
  }, [formData.branding_settings.font_heading, formData.branding_settings.font_body]);

  useEffect(() => { loadSettings(); }, []);

  // Load brand association when Brand tab opens
  useEffect(() => {
    if (activeTab !== 'brand' || !clientId) return;
    setBrandLoading(true);
    supabase
      .from('client_brand_associations')
      .select('id, status, submitted_name, submitted_url, proof_notes, rejection_reason, brand_id, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const assoc = data as BrandAssoc | null;
        setBrandAssoc(assoc);
        if (assoc) {
          const parsed = parseProofNotes(assoc.proof_notes);
          setVerForm({
            ...parsed,
            legal_name:  assoc.submitted_name,
            website_url: assoc.submitted_url ?? formData.website_url,
          });
        } else {
          setVerForm({
            ...EMPTY_VERIFICATION,
            legal_name:  formData.name,
            website_url: formData.website_url,
          });
        }
        setBrandLoading(false);
      });
  }, [activeTab, clientId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('client_id').eq('id', user.id).single();
      if (!prof?.client_id) return;
      setClientId(prof.client_id);
      const { data: client, error } = await supabase.from('clients').select('*').eq('id', prof.client_id).single();
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
        branding_settings:      { ...DEFAULT_BRANDING, ...((client as any).branding_settings || {}) },
        notification_settings:  { ...DEFAULT_NOTIFICATIONS, ...((client as any).notification_settings || {}) },
      });
    } catch (err) { console.error('Error loading settings:', err); }
    finally { setLoading(false); }
  };

  const withSave = async (
    setS: (b: boolean) => void,
    setOk: (b: boolean) => void,
    setErr: (s: string | null) => void,
    fn: () => Promise<void>,
  ) => {
    setS(true); setOk(false); setErr(null);
    try { await fn(); setOk(true); setTimeout(() => setOk(false), 3000); }
    catch (e: any) { setErr(e.message || 'Save failed'); }
    finally { setS(false); }
  };

  const handleSaveOrg = () => withSave(setOrgSaving, setOrgSuccess, setOrgError, async () => {
    if (!clientId) return;
    const { error } = await supabase.from('clients').update({
      name: formData.name, description: formData.description || null,
      industry: formData.industry || null, website_url: formData.website_url || null,
      support_email: formData.support_email || null, timezone: formData.timezone,
      contact_email: formData.contact_email, contact_phone: formData.contact_phone || null,
      welcome_message: formData.welcome_message || null, updated_at: new Date().toISOString(),
    }).eq('id', clientId);
    if (error) throw error;
  });

  const handleSaveAppearance = () => withSave(setAppSaving, setAppSuccess, setAppError, async () => {
    if (!clientId) return;
    const { error } = await supabase.from('clients').update({
      logo_url: formData.logo_url || null, primary_color: formData.primary_color,
      branding_settings: formData.branding_settings, updated_at: new Date().toISOString(),
    }).eq('id', clientId);
    if (error) throw error;
  });

  const handleSaveComm = () => withSave(setCommSaving, setCommSuccess, setCommError, async () => {
    if (!clientId) return;
    const { error } = await supabase.from('clients').update({
      communication_settings: formData.communication_settings, updated_at: new Date().toISOString(),
    }).eq('id', clientId);
    if (error) throw error;
  });

  const handleSaveNotif = () => withSave(setNotifSaving, setNotifSuccess, setNotifError, async () => {
    if (!clientId) return;
    const { error } = await supabase.from('clients').update({
      notification_settings: formData.notification_settings, updated_at: new Date().toISOString(),
    }).eq('id', clientId);
    if (error) throw error;
  });

  const handleLogoUpload = async (file: File) => {
    if (!clientId) return;
    if (!file.type.startsWith('image/')) { setLogoError('File must be an image'); return; }
    if (file.size > 5 * 1024 * 1024) { setLogoError('Image must be less than 5 MB'); return; }
    setLogoUploading(true); setLogoError(null);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `logos/${clientId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      setFormData(p => ({ ...p, logo_url: publicUrl + '?t=' + Date.now() }));
    } catch (err: any) { setLogoError(err.message || 'Upload failed'); }
    finally { setLogoUploading(false); }
  };

  const handleBrandSubmit = async () => {
    if (!clientId) return;
    setBrandError(null);
    if (!verForm.legal_name.trim()) { setBrandError('Legal / brand name is required'); return; }
    setBrandSaving(true);
    const proofJson = JSON.stringify({
      gst_number:         verForm.gst_number.trim() || undefined,
      cin:                verForm.cin.trim() || undefined,
      pan:                verForm.pan.trim() || undefined,
      registered_address: verForm.registered_address.trim() || undefined,
      additional_notes:   verForm.additional_notes.trim() || undefined,
    });
    const payload = {
      client_id:      clientId,
      submitted_name: verForm.legal_name.trim(),
      submitted_url:  verForm.website_url.trim() || null,
      proof_notes:    proofJson,
      status:         'pending',
    };
    let result: any;
    if (brandAssoc?.status === 'rejected') {
      result = await supabase.from('client_brand_associations')
        .update({ ...payload, rejection_reason: null, reviewed_at: null })
        .eq('id', brandAssoc.id)
        .select('id, status, submitted_name, submitted_url, proof_notes, rejection_reason, brand_id, created_at')
        .single();
    } else {
      result = await supabase.from('client_brand_associations')
        .insert(payload)
        .select('id, status, submitted_name, submitted_url, proof_notes, rejection_reason, brand_id, created_at')
        .single();
    }
    setBrandSaving(false);
    if (result.error) { setBrandError(result.error.message); return; }
    setBrandAssoc(result.data as BrandAssoc);
    setBrandSuccess(true);
    setTimeout(() => setBrandSuccess(false), 5000);
  };

  const handleChangePassword = async () => {
    setPwError(null); setPwSuccess(false);
    if (pwData.newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    if (pwData.newPw !== pwData.confirm) { setPwError('Passwords do not match'); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwData.newPw });
      if (error) throw error;
      setPwSuccess(true); setPwData({ newPw: '', confirm: '' });
    } catch (err: any) { setPwError(err.message || 'Failed to update password'); }
    finally { setChangingPw(false); }
  };

  const setField    = (patch: Partial<ClientData>) => setFormData(p => ({ ...p, ...patch }));
  const setBranding = (patch: Partial<BrandingSettings>) => setFormData(p => ({ ...p, branding_settings: { ...p.branding_settings, ...patch } }));
  const setComm     = (patch: Partial<CommunicationSettings>) => setFormData(p => ({ ...p, communication_settings: { ...p.communication_settings, ...patch } }));
  const setNotif    = (patch: Partial<NotificationSettings>) => setFormData(p => ({ ...p, notification_settings: { ...p.notification_settings, ...patch } }));
  const setVer      = (patch: Partial<VerificationForm>) => setVerForm(p => ({ ...p, ...patch }));

  const inputCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors placeholder:text-gray-400';
  const monoInput = inputCls + ' font-mono tracking-wider uppercase';

  // Sidebar nav items
  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'organization',   label: 'Organization',    icon: <Building2 className="w-4 h-4" /> },
    { id: 'appearance',     label: 'Appearance',      icon: <Palette className="w-4 h-4" /> },
    { id: 'brand',          label: 'Brand & Verify',  icon: <Award className="w-4 h-4" />,
      badge: brandAssoc?.status === 'pending' ? 'pending' : brandAssoc?.status === 'approved' ? 'verified' : brandAssoc?.status === 'rejected' ? 'action' : undefined },
    { id: 'communications', label: 'Communications',  icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'notifications',  label: 'Notifications',   icon: <Bell className="w-4 h-4" /> },
    { id: 'security',       label: 'Security',        icon: <Shield className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Settings">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <p className="text-gray-400 text-sm">Loading settings…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Settings">
      <div className="max-w-5xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your organization profile, branding, and account preferences</p>
        </div>

        <div className="flex gap-8">
          {/* ── Sidebar nav ── */}
          <aside className="w-52 flex-shrink-0">
            <nav className="space-y-0.5 sticky top-6">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      item.badge === 'verified' ? 'bg-green-100 text-green-700' :
                      item.badge === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.badge === 'verified' ? '✓' : item.badge === 'pending' ? '…' : '!'}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Content ── */}
          <div className="flex-1 min-w-0">

            {/* ══ ORGANIZATION ══════════════════════════════════════════════ */}
            {activeTab === 'organization' && (
              <div>
                <SectionHeader
                  title="Organization"
                  description="Your public-facing profile and contact details"
                />

                {/* Identity */}
                <div className="space-y-5 pb-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Identity</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2">
                      <FieldGroup label="Organization Name" required>
                        <input type="text" value={formData.name} className={inputCls}
                          placeholder="Your company name"
                          onChange={e => setField({ name: e.target.value })} />
                      </FieldGroup>
                    </div>
                    <FieldGroup label="Industry">
                      <select value={formData.industry} className={inputCls}
                        onChange={e => setField({ industry: e.target.value })}>
                        <option value="">Select industry…</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </FieldGroup>
                    <FieldGroup label="Timezone">
                      <select value={formData.timezone} className={inputCls}
                        onChange={e => setField({ timezone: e.target.value })}>
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </FieldGroup>
                    <div className="sm:col-span-2">
                      <FieldGroup label="Website URL">
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                          <input type="url" value={formData.website_url} className={inputCls + ' pl-9'}
                            placeholder="https://yourcompany.com"
                            onChange={e => setField({ website_url: e.target.value })} />
                        </div>
                      </FieldGroup>
                    </div>
                    <div className="sm:col-span-2">
                      <FieldGroup label="Description" hint="Brief overview shown to your members">
                        <textarea value={formData.description} rows={3} className={inputCls}
                          placeholder="What does your organization do?"
                          onChange={e => setField({ description: e.target.value })} />
                      </FieldGroup>
                    </div>
                    <div className="sm:col-span-2">
                      <FieldGroup label="Member Welcome Message" hint="Shown when a customer first accesses the loyalty portal">
                        <textarea value={formData.welcome_message} rows={2} className={inputCls}
                          placeholder="Welcome to our loyalty program! Earn points on every purchase."
                          onChange={e => setField({ welcome_message: e.target.value })} />
                      </FieldGroup>
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-5 py-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Contact</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FieldGroup label="Primary Contact Email" required hint="Used for platform notifications and billing">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input type="email" value={formData.contact_email} className={inputCls + ' pl-9'}
                          placeholder="hello@company.com"
                          onChange={e => setField({ contact_email: e.target.value })} />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="Support Email" hint="Shown to members as the help contact">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input type="email" value={formData.support_email} className={inputCls + ' pl-9'}
                          placeholder="support@company.com"
                          onChange={e => setField({ support_email: e.target.value })} />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="Contact Phone">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input type="tel" value={formData.contact_phone} className={inputCls + ' pl-9'}
                          placeholder="+91 98765 43210"
                          onChange={e => setField({ contact_phone: e.target.value })} />
                      </div>
                    </FieldGroup>
                  </div>
                </div>

                <SaveBar saving={orgSaving} success={orgSuccess} error={orgError} onSave={handleSaveOrg} />
              </div>
            )}

            {/* ══ APPEARANCE ════════════════════════════════════════════════ */}
            {activeTab === 'appearance' && (
              <div>
                <SectionHeader
                  title="Appearance"
                  description="Logo, colors, and typography for your member-facing portal"
                />

                {/* Logo */}
                <div className="space-y-5 pb-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Logo</h3>
                  <div className="flex items-start gap-5">
                    <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain p-2"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : <ImageIcon className="w-8 h-8 text-gray-300" />}
                    </div>
                    <div className="flex-1 space-y-3">
                      <input type="file" ref={logoInputRef} accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                      <Button type="button" variant="secondary" disabled={logoUploading}
                        onClick={() => logoInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        {logoUploading ? 'Uploading…' : 'Upload Logo'}
                      </Button>
                      <p className="text-xs text-gray-400">PNG, JPG, SVG or WebP · Max 5 MB · Recommended 300×300 px</p>
                      {logoError && <p className="text-xs text-red-500">{logoError}</p>}
                      <FieldGroup label="Or paste an image URL">
                        <input type="url" value={formData.logo_url}
                          onChange={e => setField({ logo_url: e.target.value })}
                          className={inputCls} placeholder="https://cdn.example.com/logo.png" />
                      </FieldGroup>
                      <FieldGroup label="Favicon URL" hint="32×32 or 64×64 .ico or .png">
                        <input type="url" value={formData.branding_settings.favicon_url}
                          onChange={e => setBranding({ favicon_url: e.target.value })}
                          className={inputCls} placeholder="https://yourcompany.com/favicon.ico" />
                      </FieldGroup>
                    </div>
                  </div>
                </div>

                {/* Colors */}
                <div className="space-y-5 py-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Brand Colors</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldGroup label="Primary Color">
                      <div className="flex gap-2 items-center">
                        <input type="color" value={formData.primary_color}
                          onChange={e => setField({ primary_color: e.target.value })}
                          className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                        <input type="text" value={formData.primary_color}
                          onChange={e => setField({ primary_color: e.target.value })}
                          className={inputCls + ' font-mono'} placeholder="#3B82F6" />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="Secondary / Accent Color">
                      <div className="flex gap-2 items-center">
                        <input type="color" value={formData.branding_settings.secondary_color}
                          onChange={e => setBranding({ secondary_color: e.target.value })}
                          className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                        <input type="text" value={formData.branding_settings.secondary_color}
                          onChange={e => setBranding({ secondary_color: e.target.value })}
                          className={inputCls + ' font-mono'} placeholder="#8B5CF6" />
                      </div>
                    </FieldGroup>
                  </div>
                  <div className="rounded-xl p-5 text-white"
                    style={{ background: `linear-gradient(135deg, ${formData.primary_color} 0%, ${formData.branding_settings.secondary_color} 100%)` }}>
                    <p className="text-xs font-semibold opacity-70 mb-2 uppercase tracking-widest">Preview</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium">Primary Button</span>
                      <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium">Highlighted Badge</span>
                      <span className="px-3 py-1.5 border border-white/30 rounded-lg text-xs font-medium">Outline Style</span>
                    </div>
                  </div>
                </div>

                {/* Typography */}
                <div className="space-y-5 py-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Typography</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FieldGroup label="Heading Font">
                      <select value={formData.branding_settings.font_heading}
                        onChange={e => setBranding({ font_heading: e.target.value })} className={inputCls}>
                        {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </FieldGroup>
                    <FieldGroup label="Body Font">
                      <select value={formData.branding_settings.font_body}
                        onChange={e => setBranding({ font_body: e.target.value })} className={inputCls}>
                        {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </FieldGroup>
                  </div>

                  {/* Font preview */}
                  <div className="border border-gray-100 rounded-xl p-5 bg-gray-50/50">
                    <p style={{ fontFamily: formData.branding_settings.font_heading, fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
                      Earn rewards with every purchase
                    </p>
                    <p style={{ fontFamily: formData.branding_settings.font_body, fontSize: '13px', color: '#6B7280', lineHeight: 1.6 }}>
                      Join our loyalty program and start earning points on every transaction.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <span className="inline-block px-4 py-1.5 text-white text-xs font-semibold"
                        style={{ background: formData.primary_color, borderRadius: formData.branding_settings.border_radius }}>
                        Join Now
                      </span>
                      <span className="inline-block px-4 py-1.5 text-xs font-medium border"
                        style={{ borderColor: formData.primary_color, color: formData.primary_color, borderRadius: formData.branding_settings.border_radius }}>
                        Learn More
                      </span>
                    </div>
                  </div>
                </div>

                {/* Border radius */}
                <div className="space-y-4 py-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Component Style</h3>
                  <p className="text-sm text-gray-500">Button & input corner radius</p>
                  <div className="flex flex-wrap gap-3">
                    {RADIUS_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setBranding({ border_radius: opt.value })}
                        className={`flex flex-col items-center gap-2 p-3.5 border-2 rounded-xl transition-all min-w-[80px] ${
                          formData.branding_settings.border_radius === opt.value
                            ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <div className="w-12 h-7 bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600"
                          style={{ borderRadius: opt.value }}>Aa</div>
                        <span className="text-xs text-gray-600">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <SaveBar saving={appSaving} success={appSuccess} error={appError} onSave={handleSaveAppearance} />
              </div>
            )}

            {/* ══ BRAND & VERIFICATION ══════════════════════════════════════ */}
            {activeTab === 'brand' && (
              <div>
                <SectionHeader
                  title="Brand & Verification"
                  description="Link and verify your brand with Goself to unlock the partner network and brand directory"
                />

                {brandLoading ? (
                  <div className="flex items-center justify-center min-h-48">
                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <>
                    {/* Status banner */}
                    {brandAssoc && (
                      <div className={`flex items-start gap-3 rounded-xl border p-4 mb-8 ${
                        brandAssoc.status === 'approved' ? 'bg-green-50 border-green-200' :
                        brandAssoc.status === 'rejected' ? 'bg-red-50 border-red-200' :
                        'bg-amber-50 border-amber-200'
                      }`}>
                        {brandAssoc.status === 'approved'
                          ? <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          : brandAssoc.status === 'rejected'
                          ? <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          : <RefreshCw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" style={{ animation: 'spin 3s linear infinite' }} />}
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${
                            brandAssoc.status === 'approved' ? 'text-green-800' :
                            brandAssoc.status === 'rejected' ? 'text-red-700' : 'text-amber-800'
                          }`}>
                            {brandAssoc.status === 'approved' ? 'Brand verified and linked'
                             : brandAssoc.status === 'rejected' ? 'Verification rejected — please re-submit'
                             : 'Verification under review — typically takes 1–2 business days'}
                          </p>
                          {brandAssoc.status === 'rejected' && brandAssoc.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1">
                              Reason: {brandAssoc.rejection_reason}
                            </p>
                          )}
                          {brandAssoc.status === 'approved' && (
                            <p className="text-xs text-green-700 mt-0.5">
                              Submitted as <strong>{brandAssoc.submitted_name}</strong>. Contact support to update brand details.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Form — show when no submission yet or rejected */}
                    {(!brandAssoc || brandAssoc.status === 'rejected') && (
                      <>
                        {brandSuccess && (
                          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-sm text-green-700">
                            <Check className="w-4 h-4 flex-shrink-0" />
                            Submission received. We'll review and respond within 1–2 business days.
                          </div>
                        )}
                        {brandError && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />{brandError}
                          </div>
                        )}

                        {/* Brand basics */}
                        <div className="space-y-5 pb-8 border-b border-gray-100">
                          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Brand Details</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="sm:col-span-2">
                              <FieldGroup
                                label="Legal / Trading Name"
                                required
                                hint="The registered name of your business — may differ from your display name"
                              >
                                <input type="text" value={verForm.legal_name}
                                  onChange={e => setVer({ legal_name: e.target.value })}
                                  className={inputCls} placeholder="Acme Online Pvt. Ltd." />
                              </FieldGroup>
                            </div>
                            <div className="sm:col-span-2">
                              <FieldGroup label="Brand Website" hint="Primary public-facing URL">
                                <div className="relative">
                                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                  <input type="url" value={verForm.website_url}
                                    onChange={e => setVer({ website_url: e.target.value })}
                                    className={inputCls + ' pl-9'} placeholder="https://acmecorp.com" />
                                </div>
                              </FieldGroup>
                            </div>
                          </div>
                        </div>

                        {/* Verification documents */}
                        <div className="space-y-5 py-8 border-b border-gray-100">
                          <div className="flex items-start gap-2">
                            <div>
                              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Verification Documents</h3>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Provide at least one identifier so our team can verify ownership quickly
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FieldGroup
                              label="GST Number"
                              hint="15-character GSTIN  e.g. 29ABCDE1234F1Z5"
                            >
                              <input
                                type="text"
                                value={verForm.gst_number}
                                onChange={e => setVer({ gst_number: e.target.value.toUpperCase() })}
                                maxLength={15}
                                className={monoInput}
                                placeholder="22AAAAA0000A1Z5"
                              />
                            </FieldGroup>
                            <FieldGroup
                              label="CIN / LLPIN"
                              hint="Company Identification Number"
                            >
                              <input
                                type="text"
                                value={verForm.cin}
                                onChange={e => setVer({ cin: e.target.value.toUpperCase() })}
                                maxLength={21}
                                className={monoInput}
                                placeholder="U72200KA2019PTC123456"
                              />
                            </FieldGroup>
                            <FieldGroup
                              label="PAN"
                              hint="10-character Permanent Account Number"
                            >
                              <input
                                type="text"
                                value={verForm.pan}
                                onChange={e => setVer({ pan: e.target.value.toUpperCase() })}
                                maxLength={10}
                                className={monoInput}
                                placeholder="ABCDE1234F"
                              />
                            </FieldGroup>
                            <FieldGroup
                              label="Registered State / City"
                              hint="Where the entity is incorporated"
                            >
                              <input
                                type="text"
                                value={verForm.registered_address}
                                onChange={e => setVer({ registered_address: e.target.value })}
                                className={inputCls}
                                placeholder="Bangalore, Karnataka"
                              />
                            </FieldGroup>
                          </div>

                          <FieldGroup
                            label="Additional Proof / Notes"
                            hint="Shopify store URL, trade name, social handles, or any supporting info"
                          >
                            <textarea
                              value={verForm.additional_notes}
                              onChange={e => setVer({ additional_notes: e.target.value })}
                              rows={3}
                              className={inputCls}
                              placeholder="e.g. Shopify store: acme.myshopify.com · Instagram: @acmecorp · Listed on Amazon seller ID XXXXXX"
                            />
                          </FieldGroup>

                          {/* What happens next */}
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2.5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What happens after submission</p>
                            {[
                              'Our team verifies your legal entity against the provided identifiers',
                              'Your brand profile is created in the Goself brand directory',
                              'Offers you create get the verified brand badge on the member portal',
                            ].map((step, i) => (
                              <div key={i} className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <p className="text-xs text-gray-600">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-6 flex items-center gap-4">
                          <Button onClick={handleBrandSubmit} disabled={brandSaving}>
                            <FileText className="w-4 h-4 mr-2" />
                            {brandSaving ? 'Submitting…' : brandAssoc?.status === 'rejected' ? 'Re-submit for Verification' : 'Submit for Verification'}
                          </Button>
                          {brandAssoc?.status !== 'rejected' && (
                            <p className="text-xs text-gray-400">
                              You can always update and re-submit if details change
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Approved state — show read-only summary */}
                    {brandAssoc?.status === 'approved' && (
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <Award className="w-4 h-4 text-green-600" /> Verified Brand Details
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">Legal name</span>
                            <p className="font-medium text-gray-900 mt-0.5">{brandAssoc.submitted_name}</p>
                          </div>
                          {brandAssoc.submitted_url && (
                            <div>
                              <span className="text-gray-400 text-xs">Website</span>
                              <a href={brandAssoc.submitted_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5 font-medium">
                                {brandAssoc.submitted_url} <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">To update verified brand details, contact support@goself.in</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ══ COMMUNICATIONS ════════════════════════════════════════════ */}
            {activeTab === 'communications' && (
              <div>
                <SectionHeader
                  title="Communications"
                  description="Choose how campaign messages reach your members"
                />

                <div className="space-y-6 pb-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Delivery Provider</h3>
                  <div className="space-y-3">
                    {([
                      { value: 'internal' as const, title: 'Goself Built-in',
                        body: 'Send emails and SMS through our infrastructure automatically when campaigns trigger.' },
                      { value: 'external' as const, title: 'External Webhook',
                        body: 'Use your own stack (Klaviyo, SendGrid, WhatsApp API). We POST campaign data to your endpoint.' },
                    ]).map(opt => (
                      <label key={opt.value} className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.communication_settings.provider === opt.value
                          ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input type="radio" name="provider" value={opt.value}
                          checked={formData.communication_settings.provider === opt.value}
                          onChange={() => setComm({ provider: opt.value })}
                          className="mt-1 accent-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900 flex items-center gap-1.5 text-sm">
                            {opt.title}
                            {opt.value === 'internal' && <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">Recommended</span>}
                            {opt.value === 'external' && <Webhook className="w-3.5 h-3.5 text-gray-400" />}
                          </p>
                          <p className="text-sm text-gray-500 mt-0.5">{opt.body}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {formData.communication_settings.provider === 'external' && (
                    <FieldGroup label="Webhook URL" required hint="We POST JSON with member details, campaign info, and personalized links on every trigger">
                      <div className="relative">
                        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input type="url" className={inputCls + ' pl-9 font-mono text-xs'}
                          value={formData.communication_settings.webhook_url || ''}
                          onChange={e => setComm({ webhook_url: e.target.value })}
                          placeholder="https://hooks.example.com/campaign-events" />
                      </div>
                    </FieldGroup>
                  )}

                  {formData.communication_settings.provider === 'internal' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <FieldGroup label="From Email">
                        <input type="email" value={formData.communication_settings.email_from || ''}
                          onChange={e => setComm({ email_from: e.target.value })}
                          className={inputCls} placeholder="noreply@yourcompany.com" />
                      </FieldGroup>
                      <FieldGroup label="From Name">
                        <input type="text" value={formData.communication_settings.email_from_name || ''}
                          onChange={e => setComm({ email_from_name: e.target.value })}
                          className={inputCls} placeholder="Your Company Rewards" />
                      </FieldGroup>
                    </div>
                  )}
                </div>

                <div className="space-y-5 py-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Default Message Template</h3>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono">
                    {['{name}', '{client}', '{program}', '{link}', '{validity}', '{points}'].map(t => (
                      <span key={t} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-blue-700 font-semibold">{t}</span>
                    ))}
                  </div>
                  <textarea value={formData.communication_settings.default_template}
                    onChange={e => setComm({ default_template: e.target.value })}
                    rows={5} className={inputCls} placeholder="Hi {name}! Welcome to {program}…" />
                </div>

                <SaveBar saving={commSaving} success={commSuccess} error={commError} onSave={handleSaveComm} />
              </div>
            )}

            {/* ══ NOTIFICATIONS ═════════════════════════════════════════════ */}
            {activeTab === 'notifications' && (
              <div>
                <SectionHeader
                  title="Notifications"
                  description="Choose which events trigger email alerts to your team"
                />

                <div className="space-y-0 pb-8 border-b border-gray-100">
                  {NOTIFICATION_EVENTS.map((ev, idx) => (
                    <div key={ev.key} className={`flex items-center justify-between py-4 ${idx !== 0 ? 'border-t border-gray-100' : ''}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ev.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{ev.desc}</p>
                      </div>
                      <Toggle
                        checked={(formData.notification_settings as any)[ev.key]}
                        onChange={() => setNotif({ [ev.key]: !(formData.notification_settings as any)[ev.key] } as any)}
                      />
                    </div>
                  ))}
                </div>

                <div className="py-8 border-b border-gray-100">
                  <FieldGroup
                    label="Notification Delivery Email"
                    hint="Alerts and digests go here. Defaults to your primary contact email if left blank."
                  >
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input type="email" value={formData.notification_settings.digest_email}
                        onChange={e => setNotif({ digest_email: e.target.value })}
                        className={inputCls + ' pl-9'} placeholder="ops@yourcompany.com" />
                    </div>
                  </FieldGroup>
                </div>

                <SaveBar saving={notifSaving} success={notifSuccess} error={notifError} onSave={handleSaveNotif} />
              </div>
            )}

            {/* ══ SECURITY ══════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <div>
                <SectionHeader
                  title="Security"
                  description="Manage your account credentials and session"
                />

                {/* Account info */}
                <div className="space-y-0 pb-8 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Account</h3>
                  {[
                    { label: 'Email address', value: profile?.email },
                    { label: 'Full name',     value: profile?.full_name || '—' },
                    { label: 'Role',          value: null, badge: 'Client' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-500">{row.label}</span>
                      {row.badge ? (
                        <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">{row.badge}</span>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{row.value}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Password */}
                <div className="py-8 border-b border-gray-100 space-y-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Change Password</h3>
                  <div className="max-w-sm space-y-4">
                    <FieldGroup label="New Password">
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} value={pwData.newPw}
                          onChange={e => setPwData(p => ({ ...p, newPw: e.target.value }))}
                          className={inputCls + ' pr-10'} placeholder="Minimum 8 characters" />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FieldGroup>

                    {pwData.newPw && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {[8, 12, 16, 20].map((len, i) => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                              pwData.newPw.length >= len
                                ? ['bg-red-400','bg-yellow-400','bg-blue-400','bg-green-500'][i]
                                : 'bg-gray-200'
                            }`} />
                          ))}
                        </div>
                        <p className="text-xs text-gray-400">
                          {pwData.newPw.length < 8  ? 'Too short' :
                           pwData.newPw.length < 12 ? 'Weak' :
                           pwData.newPw.length < 16 ? 'Good' : 'Strong'}
                        </p>
                      </div>
                    )}

                    <FieldGroup label="Confirm Password">
                      <input type={showPw ? 'text' : 'password'} value={pwData.confirm}
                        onChange={e => setPwData(p => ({ ...p, confirm: e.target.value }))}
                        className={inputCls} placeholder="Re-enter password" />
                    </FieldGroup>

                    {pwError   && <p className="text-sm text-red-600">{pwError}</p>}
                    {pwSuccess && <p className="text-sm text-green-600 flex items-center gap-1.5"><Check className="w-4 h-4" /> Password updated</p>}

                    <Button onClick={handleChangePassword} disabled={changingPw || !pwData.newPw}>
                      <Shield className="w-4 h-4 mr-2" />{changingPw ? 'Updating…' : 'Update Password'}
                    </Button>
                  </div>
                </div>

                {/* Sign out */}
                <div className="pt-8">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Session</h3>
                  <p className="text-sm text-gray-500 mb-4">Signing out will end your current session on all tabs.</p>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      if (confirm('Sign out of this session?')) { await signOut(); navigate('/login'); }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
