import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Button } from '../../components/ui/Button';
import {
  Save, Building2, Mail, Palette, LogOut, User, MessageSquare,
  Webhook, Bell, Shield, Upload, Check, Eye, EyeOff,
  Image as ImageIcon, Globe, Phone,
  Award, AlertCircle, RefreshCw, ExternalLink, FileText,
  Plus, Trash2, Zap, Type, Sliders,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clientMenuItems } from './clientMenuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'profile' | 'appearance' | 'communications' | 'notifications' | 'security';

interface SocialLinks {
  instagram: string; twitter: string; facebook: string;
  linkedin: string;  youtube: string;  whatsapp: string;
  custom: string[];
}

interface BrandingSettings {
  secondary_color: string; font_heading: string; font_body: string;
  border_radius: string;   favicon_url: string;  social_links: SocialLinks;
  wallet_voucher_style?: 'classic' | 'detail' | 'chips' | 'ticket';
}

interface CommunicationSettings {
  provider: 'internal' | 'external'; webhook_url?: string;
  default_template: string; email_from?: string; email_from_name?: string;
}

interface NotificationSettings {
  new_member: boolean; points_earned: boolean; redemption_made: boolean;
  campaign_triggered: boolean; weekly_digest: boolean; digest_email: string;
}

interface ClientData {
  id: string; name: string; description: string; industry: string;
  website_url: string; support_email: string; timezone: string;
  logo_url: string; contact_email: string; contact_phone: string;
  welcome_message: string; primary_color: string;
  communication_settings: CommunicationSettings;
  branding_settings: BrandingSettings;
  notification_settings: NotificationSettings;
}

interface BrandAssoc {
  id: string; status: 'pending' | 'approved' | 'rejected';
  submitted_name: string; submitted_url: string | null;
  proof_notes: string | null; rejection_reason: string | null;
  brand_id: string | null; created_at: string;
}

interface VerificationForm {
  registered_name: string; gst_number: string;
  cin: string; pan: string; registered_address: string; additional_notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS = [
  { label: 'System Default', value: 'system-ui, -apple-system, sans-serif', key: '' },
  { label: 'Inter',    value: "'Inter', sans-serif",    key: 'Inter'    },
  { label: 'Poppins',  value: "'Poppins', sans-serif",  key: 'Poppins'  },
  { label: 'Roboto',   value: "'Roboto', sans-serif",   key: 'Roboto'   },
  { label: 'Montserrat', value: "'Montserrat', sans-serif", key: 'Montserrat' },
  { label: 'Open Sans', value: "'Open Sans', sans-serif", key: 'Open+Sans' },
  { label: 'Nunito',   value: "'Nunito', sans-serif",   key: 'Nunito'   },
];

// Keys must match the onboarding StepIndustry keys so the saved value loads correctly
const INDUSTRIES: { key: string; label: string }[] = [
  { key: 'fashion',       label: 'Fashion & Apparel'   },
  { key: 'food',          label: 'Food & Beverage'     },
  { key: 'beauty',        label: 'Beauty & Wellness'   },
  { key: 'electronics',   label: 'Electronics'         },
  { key: 'home',          label: 'Home & Decor'        },
  { key: 'sports',        label: 'Sports & Fitness'    },
  { key: 'travel',        label: 'Travel & Hospitality'},
  { key: 'entertainment', label: 'Entertainment'       },
  { key: 'health',        label: 'Healthcare'          },
  { key: 'luxury',        label: 'Luxury & Jewellery'  },
  { key: 'kids',          label: 'Kids & Baby'         },
  { key: 'ecommerce',     label: 'E-commerce'          },
  { key: 'retail',        label: 'Retail'              },
  { key: 'education',     label: 'Education'           },
  { key: 'financial',     label: 'Financial Services'  },
  { key: 'technology',    label: 'Technology'          },
  { key: 'realestate',    label: 'Real Estate'         },
  { key: 'other',         label: 'Other'               },
];

const TIMEZONES = [
  'Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Asia/Colombo',
  'Asia/Bangkok','Europe/London','Europe/Paris','America/New_York','America/Los_Angeles','UTC',
];

const RADIUS_OPTIONS = [
  { label: 'Sharp',   value: '0px'    },
  { label: 'Slight',  value: '4px'    },
  { label: 'Medium',  value: '8px'    },
  { label: 'Rounded', value: '12px'   },
  { label: 'Pill',    value: '9999px' },
];

const SOCIAL_CHANNELS: { key: keyof Omit<SocialLinks, 'custom'>; label: string; color: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram',         color: '#E1306C', placeholder: 'https://instagram.com/yourbrand' },
  { key: 'twitter',   label: 'Twitter / X',       color: '#1DA1F2', placeholder: 'https://x.com/yourbrand' },
  { key: 'facebook',  label: 'Facebook',           color: '#1877F2', placeholder: 'https://facebook.com/yourbrand' },
  { key: 'linkedin',  label: 'LinkedIn',           color: '#0A66C2', placeholder: 'https://linkedin.com/company/yourbrand' },
  { key: 'youtube',   label: 'YouTube',            color: '#FF0000', placeholder: 'https://youtube.com/@yourbrand' },
  { key: 'whatsapp',  label: 'WhatsApp Business', color: '#25D366', placeholder: 'https://wa.me/919876543210' },
];

const NOTIFICATION_EVENTS: { key: keyof NotificationSettings; label: string; desc: string }[] = [
  { key: 'new_member',         label: 'New member enrolled',       desc: 'When a customer joins a membership program'    },
  { key: 'points_earned',      label: 'Points earned',             desc: 'When a member earns points from a transaction' },
  { key: 'redemption_made',    label: 'Reward redeemed',           desc: 'When a member redeems a reward or voucher'     },
  { key: 'campaign_triggered', label: 'Campaign triggered',        desc: 'When an automated campaign fires'              },
  { key: 'weekly_digest',      label: 'Weekly performance digest', desc: 'Summary of loyalty activity every Monday'      },
];

const DEFAULT_SOCIAL: SocialLinks = { instagram:'', twitter:'', facebook:'', linkedin:'', youtube:'', whatsapp:'', custom:[] };

const DEFAULT_BRANDING: BrandingSettings = {
  secondary_color: '#8B5CF6', font_heading: "'Inter', sans-serif",
  font_body: "'Inter', sans-serif", border_radius: '8px',
  favicon_url: '', social_links: DEFAULT_SOCIAL,
};

const DEFAULT_COMM: CommunicationSettings = {
  provider: 'internal',
  default_template: 'Hi {name}! You\'ve been enrolled in {program} at {client}. Access your rewards here: {link} (valid for {validity})',
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  new_member:true, points_earned:false, redemption_made:true,
  campaign_triggered:true, weekly_digest:false, digest_email:'',
};

const EMPTY_VER: VerificationForm = {
  registered_name:'', gst_number:'',
  cin:'', pan:'', registered_address:'', additional_notes:'',
};

function parseProof(raw: string | null, name: string): VerificationForm {
  try { const p = JSON.parse(raw ?? ''); return { ...EMPTY_VER, registered_name: name, ...p }; }
  catch { return { ...EMPTY_VER, registered_name: name, additional_notes: raw ?? '' }; }
}

// GST: 15-char alphanumeric, PAN: 10-char (loose validation — just length check)
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

const inputCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors placeholder:text-gray-400';
const monoInput = inputCls + ' font-mono tracking-wider uppercase';

function FieldGroup({ label, hint, required, error, children }: {
  label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error  && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="pt-8 pb-5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function SaveBar({ saving, success, error, onSave, label = 'Save Changes' }: {
  saving:boolean; success:boolean; error:string|null; onSave:()=>void; label?:string;
}) {
  return (
    <div className="flex items-center justify-between pt-6 mt-2">
      <div className="h-5">
        {success && <span className="flex items-center gap-1.5 text-sm text-green-600"><Check className="w-4 h-4"/>Saved</span>}
        {error   && <span className="text-sm text-red-500">{error}</span>}
      </div>
      <Button onClick={onSave} disabled={saving} className="min-w-[130px]">
        <Save className="w-4 h-4 mr-2"/>{saving ? 'Saving…' : label}
      </Button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked:boolean; onChange:()=>void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}/>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Settings() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [loading, setLoading]     = useState(true);
  const [clientId, setClientId]   = useState<string|null>(null);

  const [orgSaving,  setOrgSaving]  = useState(false);
  const [orgSuccess, setOrgSuccess] = useState(false);
  const [orgError,   setOrgError]   = useState<string|null>(null);

  const [appSaving,  setAppSaving]  = useState(false);
  const [appSuccess, setAppSuccess] = useState(false);
  const [appError,   setAppError]   = useState<string|null>(null);

  const [commSaving,  setCommSaving]  = useState(false);
  const [commSuccess, setCommSuccess] = useState(false);
  const [commError,   setCommError]   = useState<string|null>(null);

  const [notifSaving,  setNotifSaving]  = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);
  const [notifError,   setNotifError]   = useState<string|null>(null);

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError,     setLogoError]     = useState<string|null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [pwData,      setPwData]     = useState({ newPw:'', confirm:'' });
  const [showPw,      setShowPw]     = useState(false);
  const [pwError,     setPwError]    = useState<string|null>(null);
  const [pwSuccess,   setPwSuccess]  = useState(false);
  const [changingPw,  setChangingPw] = useState(false);

  const [brandAssoc,   setBrandAssoc]   = useState<BrandAssoc|null>(null);
  const [brandSaving,  setBrandSaving]  = useState(false);
  const [brandSuccess, setBrandSuccess] = useState(false);
  const [brandError,   setBrandError]   = useState<string|null>(null);
  const [verForm,      setVerForm]      = useState<VerificationForm>(EMPTY_VER);
  const [verErrors,    setVerErrors]    = useState<Partial<Record<keyof VerificationForm, string>>>({});

  const [formData, setFormData] = useState<ClientData>({
    id:'', name:'', description:'', industry:'', website_url:'',
    support_email:'', timezone:'Asia/Kolkata', logo_url:'',
    contact_email:'', contact_phone:'', welcome_message:'',
    primary_color:'#3B82F6',
    communication_settings: DEFAULT_COMM,
    branding_settings: DEFAULT_BRANDING,
    notification_settings: DEFAULT_NOTIFICATIONS,
  });

  // ── Profile completeness ──────────────────────────────────────────────────
  const completeness = useMemo(() => {
    const items = [
      { label:'Organization name',  done: !!formData.name.trim() },
      { label:'Industry',          done: !!formData.industry },
      { label:'Website URL',       done: !!formData.website_url.trim() },
      { label:'Logo',              done: !!formData.logo_url.trim() },
      { label:'Contact email',     done: !!formData.contact_email.trim() },
      { label:'Contact phone',     done: !!formData.contact_phone.trim() },
      { label:'Description',       done: !!formData.description.trim() },
      { label:'Registered name',   done: !!verForm.registered_name.trim() },
      { label:'GST Number',        done: GST_RE.test(verForm.gst_number.trim()) },
      { label:'PAN Number',        done: PAN_RE.test(verForm.pan.trim()) },
    ];
    const done = items.filter(i => i.done).length;
    const pct  = Math.round((done / items.length) * 100);
    return { items, done, pct };
  }, [formData, verForm]);

  // ── Google Fonts ──────────────────────────────────────────────────────────
  useEffect(() => {
    const needed = [formData.branding_settings.font_heading, formData.branding_settings.font_body];
    const keys   = FONTS.filter(f => f.key && needed.includes(f.value)).map(f => f.key);
    if (!keys.length) return;
    const id = 'gf-settings';
    let link = document.getElementById(id) as HTMLLinkElement|null;
    if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = `https://fonts.googleapis.com/css2?${keys.map(k => `family=${k}:wght@400;500;600;700`).join('&')}&display=swap`;
  }, [formData.branding_settings.font_heading, formData.branding_settings.font_body]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const clientIdValue = profile?.client_id;
      if (!clientIdValue) return;
      setClientId(clientIdValue);

      const [clientRes, assocRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientIdValue).single(),
        supabase.from('client_brand_associations')
          .select('id,status,submitted_name,submitted_url,proof_notes,rejection_reason,brand_id,created_at')
          .eq('client_id', clientIdValue)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (clientRes.error) throw clientRes.error;
      const c = clientRes.data;
      const branding = { ...DEFAULT_BRANDING, ...(c.branding_settings || {}),
        social_links: { ...DEFAULT_SOCIAL, ...((c.branding_settings || {}).social_links || {}) } };

      setFormData({
        id: c.id, name: c.name, description: c.description || '',
        industry: c.industry || '', website_url: c.website_url || '',
        support_email: c.support_email || '', timezone: c.timezone || 'Asia/Kolkata',
        logo_url: c.logo_url || '', contact_email: c.contact_email,
        contact_phone: c.contact_phone || '', welcome_message: c.welcome_message || '',
        primary_color: c.primary_color || '#3B82F6',
        communication_settings: c.communication_settings || DEFAULT_COMM,
        branding_settings: branding,
        notification_settings: { ...DEFAULT_NOTIFICATIONS, ...(c.notification_settings || {}) },
      });

      const assoc = assocRes.data as BrandAssoc|null;
      setBrandAssoc(assoc);
      if (assoc) {
        setVerForm(parseProof(assoc.proof_notes, assoc.submitted_name));
      } else {
        setVerForm(v => ({ ...v, registered_name: c.name }));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ── Save helpers ──────────────────────────────────────────────────────────
  const withSave = async (
    setS: (b:boolean)=>void, setOk: (b:boolean)=>void, setErr: (s:string|null)=>void,
    fn: ()=>Promise<void>,
  ) => {
    setS(true); setOk(false); setErr(null);
    try { await fn(); setOk(true); setTimeout(() => setOk(false), 3000); }
    catch (e:any) { setErr(e.message || 'Save failed'); }
    finally { setS(false); }
  };

  const handleSaveOrg = () => withSave(setOrgSaving, setOrgSuccess, setOrgError, async () => {
    if (!clientId) return;
    const { error } = await supabase.from('clients').update({
      name: formData.name, description: formData.description || null,
      industry: formData.industry || null, website_url: formData.website_url || null,
      support_email: formData.support_email || null, timezone: formData.timezone,
      contact_email: formData.contact_email, contact_phone: formData.contact_phone || null,
      welcome_message: formData.welcome_message || null,
      branding_settings: formData.branding_settings,
      updated_at: new Date().toISOString(),
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
    if (!file.type.startsWith('image/')) { setLogoError('Must be an image'); return; }
    if (file.size > 5*1024*1024) { setLogoError('Max 5 MB'); return; }
    setLogoUploading(true); setLogoError(null);
    try {
      const ext  = file.name.split('.').pop() ?? 'png';
      const path = `logos/${clientId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, file, { upsert:true, contentType:file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      setFormData(p => ({ ...p, logo_url: publicUrl + '?t=' + Date.now() }));
    } catch (err:any) { setLogoError(err.message || 'Upload failed'); }
    finally { setLogoUploading(false); }
  };

  const handleBrandSubmit = async () => {
    if (!clientId) return;
    setBrandError(null);
    // Validate
    const errs: Partial<Record<keyof VerificationForm, string>> = {};
    if (!verForm.registered_name.trim()) errs.registered_name = 'Registered name is required';
    if (!verForm.gst_number.trim())      errs.gst_number = 'GST Number is required';
    else if (!GST_RE.test(verForm.gst_number.trim())) errs.gst_number = 'Invalid GST format (e.g. 22AAAAA0000A1Z5)';
    if (!verForm.pan.trim())             errs.pan = 'PAN is required';
    else if (!PAN_RE.test(verForm.pan.trim())) errs.pan = 'Invalid PAN format (e.g. ABCDE1234F)';
    setVerErrors(errs);
    if (Object.keys(errs).length) return;

    setBrandSaving(true);
    const proofJson = JSON.stringify({
      gst_number:         verForm.gst_number.trim(),
      cin:                verForm.cin.trim()                || undefined,
      pan:                verForm.pan.trim(),
      registered_address: verForm.registered_address.trim() || undefined,
      additional_notes:   verForm.additional_notes.trim()   || undefined,
    });
    const payload = {
      client_id:      clientId,
      submitted_name: verForm.registered_name.trim(),
      submitted_url:  formData.website_url.trim() || null,
      proof_notes:    proofJson,
      status:         'pending',
    };
    let result: any;
    if (brandAssoc?.status === 'rejected') {
      result = await supabase.from('client_brand_associations')
        .update({ ...payload, rejection_reason: null, reviewed_at: null })
        .eq('id', brandAssoc.id)
        .select('id,status,submitted_name,submitted_url,proof_notes,rejection_reason,brand_id,created_at')
        .single();
    } else {
      result = await supabase.from('client_brand_associations')
        .insert(payload)
        .select('id,status,submitted_name,submitted_url,proof_notes,rejection_reason,brand_id,created_at')
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
    if (pwData.newPw.length < 8) { setPwError('Minimum 8 characters'); return; }
    if (pwData.newPw !== pwData.confirm) { setPwError('Passwords do not match'); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwData.newPw });
      if (error) throw error;
      setPwSuccess(true); setPwData({ newPw:'', confirm:'' });
    } catch (err:any) { setPwError(err.message); }
    finally { setChangingPw(false); }
  };

  const setField    = (p: Partial<ClientData>)         => setFormData(d => ({ ...d, ...p }));
  const setBranding = (p: Partial<BrandingSettings>)   => setFormData(d => ({ ...d, branding_settings: { ...d.branding_settings, ...p } }));
  const setSocial   = (p: Partial<SocialLinks>)         => setFormData(d => ({
    ...d, branding_settings: { ...d.branding_settings, social_links: { ...d.branding_settings.social_links, ...p } },
  }));
  const setComm     = (p: Partial<CommunicationSettings>) => setFormData(d => ({ ...d, communication_settings: { ...d.communication_settings, ...p } }));
  const setNotif    = (p: Partial<NotificationSettings>)  => setFormData(d => ({ ...d, notification_settings: { ...d.notification_settings, ...p } }));
  const setVer      = (p: Partial<VerificationForm>)      => { setVerForm(v => ({ ...v, ...p })); setVerErrors(e => ({ ...e, ...Object.fromEntries(Object.keys(p).map(k => [k, undefined])) })); };

  // ── Sidebar nav ───────────────────────────────────────────────────────────
  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      id:'profile', label:'Profile & Brand', icon: <Building2 className="w-4 h-4"/>,
      badge: completeness.pct < 100
        ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${completeness.pct >= 70 ? 'bg-green-100 text-green-700' : completeness.pct >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{completeness.pct}%</span>
        : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓</span>,
    },
    { id:'appearance',     label:'Appearance',    icon:<Palette className="w-4 h-4"/>       },
    { id:'communications', label:'Communications',icon:<MessageSquare className="w-4 h-4"/> },
    { id:'notifications',  label:'Notifications', icon:<Bell className="w-4 h-4"/>          },
    { id:'security',       label:'Security',      icon:<Shield className="w-4 h-4"/>        },
  ];

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Settings">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"/>
            <p className="text-gray-400 text-sm">Loading settings…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Settings">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your organization profile, branding, and account preferences</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-52 flex-shrink-0">
            <nav className="space-y-0.5 sticky top-6">
              {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    activeTab === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}>
                  <span className="flex items-center gap-2.5">
                    <span className={activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                    {item.label}
                  </span>
                  {item.badge}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">

            {/* ══ PROFILE & BRAND ══════════════════════════════════════════ */}
            {activeTab === 'profile' && (
              <div>
                {/* Progress card */}
                <div className="mb-8 p-5 bg-white border border-gray-100 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Profile Completeness</p>
                      <p className="text-xs text-gray-400 mt-0.5">Complete your profile to unlock all platform features</p>
                    </div>
                    <span className={`text-2xl font-bold ${completeness.pct >= 70 ? 'text-green-600' : completeness.pct >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {completeness.pct}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${completeness.pct >= 70 ? 'bg-green-500' : completeness.pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${completeness.pct}%` }}
                    />
                  </div>
                  {/* Missing items */}
                  {completeness.pct < 100 && (
                    <div className="flex flex-wrap gap-1.5">
                      {completeness.items.filter(i => !i.done).map(i => (
                        <span key={i.label} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          {i.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Organization ── */}
                <SectionDivider label="Organization" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <FieldGroup label="Organization Name" required
                      hint="Your trading / display name — shown to members in campaigns and the loyalty portal">
                      <input type="text" value={formData.name} className={inputCls}
                        placeholder="e.g. MediBuddy (the name your customers know you by)"
                        onChange={e => setField({ name: e.target.value })}/>
                    </FieldGroup>
                  </div>
                  <FieldGroup label="Industry">
                    <select value={formData.industry} className={inputCls}
                      onChange={e => setField({ industry: e.target.value })}>
                      <option value="">Select industry…</option>
                      {INDUSTRIES.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
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
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"/>
                        <input type="url" value={formData.website_url} className={inputCls+' pl-9'}
                          placeholder="https://yourcompany.com"
                          onChange={e => setField({ website_url: e.target.value })}/>
                      </div>
                    </FieldGroup>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldGroup label="Description" hint="Brief overview shown to your members">
                      <textarea value={formData.description} rows={3} className={inputCls}
                        placeholder="What does your organization do?"
                        onChange={e => setField({ description: e.target.value })}/>
                    </FieldGroup>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldGroup label="Member Welcome Message" hint="Shown when a customer first opens the loyalty portal">
                      <textarea value={formData.welcome_message} rows={2} className={inputCls}
                        placeholder="Welcome to our loyalty program!"
                        onChange={e => setField({ welcome_message: e.target.value })}/>
                    </FieldGroup>
                  </div>
                </div>

                {/* ── Contact ── */}
                <SectionDivider label="Contact" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FieldGroup label="Primary Contact Email" required hint="Used for platform notifications and billing">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"/>
                      <input type="email" value={formData.contact_email} className={inputCls+' pl-9'}
                        placeholder="hello@company.com"
                        onChange={e => setField({ contact_email: e.target.value })}/>
                    </div>
                  </FieldGroup>
                  <FieldGroup label="Support Email" hint="Shown to members as the help contact">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"/>
                      <input type="email" value={formData.support_email} className={inputCls+' pl-9'}
                        placeholder="support@company.com"
                        onChange={e => setField({ support_email: e.target.value })}/>
                    </div>
                  </FieldGroup>
                  <FieldGroup label="Contact Phone">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"/>
                      <input type="tel" value={formData.contact_phone} className={inputCls+' pl-9'}
                        placeholder="+91 98765 43210"
                        onChange={e => setField({ contact_phone: e.target.value })}/>
                    </div>
                  </FieldGroup>
                </div>

                {/* ── Social Channels ── */}
                <SectionDivider label="Social Channels" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {SOCIAL_CHANNELS.map(ch => (
                    <FieldGroup key={ch.key} label={ch.label}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: ch.color }}/>
                        <input type="url"
                          value={formData.branding_settings.social_links[ch.key]}
                          onChange={e => setSocial({ [ch.key]: e.target.value })}
                          className={inputCls+' pl-8'}
                          placeholder={ch.placeholder}/>
                      </div>
                    </FieldGroup>
                  ))}
                </div>

                {/* Custom URLs */}
                <div className="mt-5 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Custom URLs</p>
                  {(formData.branding_settings.social_links.custom ?? []).map((url, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="url" value={url}
                        onChange={e => {
                          const next = [...(formData.branding_settings.social_links.custom ?? [])];
                          next[idx] = e.target.value;
                          setSocial({ custom: next });
                        }}
                        className={inputCls}
                        placeholder="https://linktr.ee/yourbrand"/>
                      <button type="button"
                        onClick={() => {
                          const next = (formData.branding_settings.social_links.custom ?? []).filter((_, i) => i !== idx);
                          setSocial({ custom: next });
                        }}
                        className="p-2.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => setSocial({ custom: [...(formData.branding_settings.social_links.custom ?? []), ''] })}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mt-1">
                    <Plus className="w-4 h-4"/> Add custom URL
                  </button>
                </div>

                <SaveBar saving={orgSaving} success={orgSuccess} error={orgError}
                  onSave={handleSaveOrg} label="Save Profile & Social"/>

                {/* ══ Brand Verification ════════════════════════════════════ */}
                <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-200">
                  <div className="flex items-start gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Award className="w-4 h-4 text-purple-600"/>
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Brand Verification</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Verify your legal entity to get the verified badge and access the Goself brand network
                      </p>
                    </div>
                  </div>

                  {/* Verification status banner */}
                  {brandAssoc && (
                    <div className={`flex items-start gap-3 rounded-xl border p-4 mb-6 ${
                      brandAssoc.status==='approved' ? 'bg-green-50 border-green-200' :
                      brandAssoc.status==='rejected' ? 'bg-red-50 border-red-200' :
                      'bg-amber-50 border-amber-200'
                    }`}>
                      {brandAssoc.status==='approved'
                        ? <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"/>
                        : brandAssoc.status==='rejected'
                        ? <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
                        : <RefreshCw className="w-4 h-4 text-amber-600 flex-shrink-0 mt-1" style={{ animation:'spin 3s linear infinite' }}/>}
                      <div>
                        <p className={`font-semibold text-sm ${
                          brandAssoc.status==='approved' ? 'text-green-800' :
                          brandAssoc.status==='rejected' ? 'text-red-700' : 'text-amber-800'}`}>
                          {brandAssoc.status==='approved' ? 'Brand verified — your offers carry the verified badge'
                           : brandAssoc.status==='rejected' ? 'Verification rejected — update details and re-submit'
                           : 'Under review — typically 1–2 business days'}
                        </p>
                        {brandAssoc.status==='rejected' && brandAssoc.rejection_reason && (
                          <p className="text-xs text-red-600 mt-1">Reason: {brandAssoc.rejection_reason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {brandSuccess && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-sm text-green-700">
                      <Check className="w-4 h-4 flex-shrink-0"/>
                      Submitted for verification. We'll respond within 1–2 business days.
                    </div>
                  )}
                  {brandError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 flex-shrink-0"/>{brandError}
                    </div>
                  )}

                  {/* Approved read-only view */}
                  {brandAssoc?.status === 'approved' ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                        <div><p className="text-gray-400 text-xs">Registered name</p><p className="font-medium text-gray-900 mt-0.5">{brandAssoc.submitted_name}</p></div>
                        {brandAssoc.submitted_url && (
                          <div><p className="text-gray-400 text-xs">Website</p>
                            <a href={brandAssoc.submitted_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5 font-medium">
                              {brandAssoc.submitted_url}<ExternalLink className="w-3 h-3"/>
                            </a>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 pt-1">To update verified details, contact support@goself.in</p>
                    </div>
                  ) : (
                    /* Verification form — show if not submitted or rejected */
                    (!brandAssoc || brandAssoc.status === 'rejected') && (
                      <div className="space-y-5">
                        {/* Directory name callout */}
                        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                          <Award className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-blue-800">
                              Your brand will appear in the Goself directory as:&nbsp;
                              <span className="font-bold">{formData.name || '—'}</span>
                            </p>
                            <p className="text-blue-600 text-xs mt-0.5">
                              The Registered Name below is only used for legal identity verification — it is never shown publicly.
                            </p>
                          </div>
                        </div>

                        {/* Entity details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="sm:col-span-2">
                            <FieldGroup label="Registered Name" required error={verErrors.registered_name}
                              hint="Legal entity name on your GST / MCA registration — may differ from your display name">
                              <input type="text" value={verForm.registered_name}
                                onChange={e => setVer({ registered_name: e.target.value })}
                                className={inputCls} placeholder="e.g. Seaturtle Private Limited"/>
                            </FieldGroup>
                          </div>
                        </div>

                        {/* Mandatory IDs */}
                        <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-4">
                          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5"/> Required for Verification
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FieldGroup label="GST Number" required error={verErrors.gst_number}
                              hint="15-character GSTIN">
                              <input type="text" value={verForm.gst_number}
                                onChange={e => setVer({ gst_number: e.target.value.toUpperCase() })}
                                maxLength={15} className={monoInput} placeholder="22AAAAA0000A1Z5"/>
                            </FieldGroup>
                            <FieldGroup label="PAN" required error={verErrors.pan}
                              hint="10-character Permanent Account Number">
                              <input type="text" value={verForm.pan}
                                onChange={e => setVer({ pan: e.target.value.toUpperCase() })}
                                maxLength={10} className={monoInput} placeholder="ABCDE1234F"/>
                            </FieldGroup>
                          </div>
                        </div>

                        {/* Optional IDs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <FieldGroup label="CIN / LLPIN" hint="Corporate Identity Number (optional)">
                            <input type="text" value={verForm.cin}
                              onChange={e => setVer({ cin: e.target.value.toUpperCase() })}
                              maxLength={21} className={monoInput} placeholder="U72200KA2019PTC123456"/>
                          </FieldGroup>
                          <FieldGroup label="Registered State / City" hint="Where entity is incorporated">
                            <input type="text" value={verForm.registered_address}
                              onChange={e => setVer({ registered_address: e.target.value })}
                              className={inputCls} placeholder="Bangalore, Karnataka"/>
                          </FieldGroup>
                          <div className="sm:col-span-2">
                            <FieldGroup label="Additional Proof / Notes"
                              hint="Shopify store URL, Amazon seller ID, social handles, trademark certificate, etc.">
                              <textarea value={verForm.additional_notes} rows={3}
                                onChange={e => setVer({ additional_notes: e.target.value })}
                                className={inputCls}
                                placeholder="e.g. Shopify store: acme.myshopify.com · Amazon seller ID: XXXXXX"/>
                            </FieldGroup>
                          </div>
                        </div>

                        {/* What happens next */}
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2.5">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">After Submission</p>
                          {[
                            'Our team verifies your entity against GST / PAN records',
                            'Your brand profile is created in the Goself brand directory',
                            'All offers you create carry the Verified Brand badge',
                          ].map((step, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                              <p className="text-xs text-gray-500">{step}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                          <Button onClick={handleBrandSubmit} disabled={brandSaving}
                            className="bg-purple-600 hover:bg-purple-700 text-white">
                            <FileText className="w-4 h-4 mr-2"/>
                            {brandSaving ? 'Submitting…' : brandAssoc?.status==='rejected' ? 'Re-submit for Verification' : 'Submit for Verification'}
                          </Button>
                          <p className="text-xs text-gray-400">GST and PAN are mandatory</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* ══ APPEARANCE ════════════════════════════════════════════════ */}
            {activeTab === 'appearance' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900">Appearance</h2>
                  <p className="text-sm text-gray-500 mt-1">Logo, colors, and typography for your member-facing portal</p>
                </div>

                {/* Logo */}
                <SectionDivider label="Logo & Favicon"/>
                <div className="flex items-start gap-5 mb-8">
                  <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
                    {formData.logo_url
                      ? <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain p-2"
                          onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
                      : <ImageIcon className="w-8 h-8 text-gray-300"/>}
                  </div>
                  <div className="flex-1 space-y-3">
                    <input type="file" ref={logoInputRef} accept="image/*" className="hidden"
                      onChange={e => { const f=e.target.files?.[0]; if(f) handleLogoUpload(f); }}/>
                    <Button type="button" variant="secondary" disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2"/>{logoUploading ? 'Uploading…' : 'Upload Logo'}
                    </Button>
                    <p className="text-xs text-gray-400">PNG, JPG, SVG or WebP · Max 5 MB · Recommended 300×300</p>
                    {logoError && <p className="text-xs text-red-500">{logoError}</p>}
                    <FieldGroup label="Logo URL">
                      <input type="url" value={formData.logo_url}
                        onChange={e => setField({ logo_url: e.target.value })}
                        className={inputCls} placeholder="https://cdn.example.com/logo.png"/>
                    </FieldGroup>
                    <FieldGroup label="Favicon URL" hint="32×32 or 64×64 .ico or .png shown in browser tab">
                      <input type="url" value={formData.branding_settings.favicon_url}
                        onChange={e => setBranding({ favicon_url: e.target.value })}
                        className={inputCls} placeholder="https://yourcompany.com/favicon.ico"/>
                    </FieldGroup>
                  </div>
                </div>

                {/* Colors */}
                <SectionDivider label="Brand Colors"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
                  <FieldGroup label="Primary Color">
                    <div className="flex gap-2 items-center">
                      <input type="color" value={formData.primary_color}
                        onChange={e => setField({ primary_color: e.target.value })}
                        className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0"/>
                      <input type="text" value={formData.primary_color}
                        onChange={e => setField({ primary_color: e.target.value })}
                        className={inputCls+' font-mono'} placeholder="#3B82F6"/>
                    </div>
                  </FieldGroup>
                  <FieldGroup label="Secondary / Accent Color">
                    <div className="flex gap-2 items-center">
                      <input type="color" value={formData.branding_settings.secondary_color}
                        onChange={e => setBranding({ secondary_color: e.target.value })}
                        className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0"/>
                      <input type="text" value={formData.branding_settings.secondary_color}
                        onChange={e => setBranding({ secondary_color: e.target.value })}
                        className={inputCls+' font-mono'} placeholder="#8B5CF6"/>
                    </div>
                  </FieldGroup>
                </div>
                <div className="rounded-xl p-5 text-white mb-8"
                  style={{ background:`linear-gradient(135deg, ${formData.primary_color} 0%, ${formData.branding_settings.secondary_color} 100%)` }}>
                  <p className="text-[10px] font-bold opacity-60 mb-2 uppercase tracking-widest">Color Preview</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 bg-white/20 rounded-lg text-xs font-medium">Primary Button</span>
                    <span className="px-3 py-1.5 bg-white/20 rounded-lg text-xs font-medium">Highlighted Badge</span>
                    <span className="px-3 py-1.5 border border-white/30 rounded-lg text-xs font-medium">Outline Style</span>
                  </div>
                </div>

                {/* Typography */}
                <SectionDivider label="Typography"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
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
                <div className="border border-gray-100 rounded-xl p-5 bg-gray-50/50 mb-8">
                  <p style={{ fontFamily:formData.branding_settings.font_heading, fontSize:'17px', fontWeight:700, color:'#111827', marginBottom:'6px' }}>
                    Earn rewards with every purchase
                  </p>
                  <p style={{ fontFamily:formData.branding_settings.font_body, fontSize:'13px', color:'#6B7280', lineHeight:1.6 }}>
                    Join our loyalty program and start earning points on every transaction.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="inline-block px-4 py-1.5 text-white text-xs font-semibold"
                      style={{ background:formData.primary_color, borderRadius:formData.branding_settings.border_radius }}>
                      Join Now
                    </span>
                    <span className="inline-block px-4 py-1.5 text-xs font-medium border"
                      style={{ borderColor:formData.primary_color, color:formData.primary_color, borderRadius:formData.branding_settings.border_radius }}>
                      Learn More
                    </span>
                  </div>
                </div>

                {/* Radius */}
                <SectionDivider label="Component Style"/>
                <div className="flex flex-wrap gap-3 mb-8">
                  {RADIUS_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setBranding({ border_radius: opt.value })}
                      className={`flex flex-col items-center gap-2 p-3.5 border-2 rounded-xl transition-all min-w-[80px] ${
                        formData.branding_settings.border_radius===opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                      <div className="w-12 h-7 bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600"
                        style={{ borderRadius:opt.value }}>Aa</div>
                      <span className="text-xs text-gray-600">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Wallet Voucher Style */}
                <SectionDivider label="Loyalty Widget — Wallet Style"/>
                <p className="text-sm text-gray-500 mb-4">
                  Choose how vouchers appear in your members' wallet. Takes effect immediately after saving.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {([
                    { value: 'classic', label: 'Classic',      desc: 'Simple rows with Copy button',          icon: '📋' },
                    { value: 'detail',  label: 'Detail View',  desc: 'Tap row to open full-screen detail',    icon: '🔍' },
                    { value: 'chips',   label: 'Action Chips', desc: 'Inline Steps / T&C / Redeem buttons',   icon: '💡' },
                    { value: 'ticket',  label: 'Ticket Card',  desc: 'Boarding-pass style with accent stripe',icon: '🎫' },
                  ] as const).map(opt => {
                    const current = formData.branding_settings.wallet_voucher_style ?? 'chips';
                    const isSelected = current === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBranding({ wallet_voucher_style: opt.value })}
                        className={`flex items-start gap-3 p-4 border-2 rounded-xl text-left transition-all ${
                          isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <span className="text-2xl mt-0.5 flex-shrink-0">{opt.icon}</span>
                        <div>
                          <div className={`text-sm font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
                            {opt.label}{opt.value === 'chips' && <span className="ml-1.5 text-xs font-normal text-gray-400">(default)</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <SaveBar saving={appSaving} success={appSuccess} error={appError} onSave={handleSaveAppearance}/>
              </div>
            )}

            {/* ══ COMMUNICATIONS ════════════════════════════════════════════ */}
            {activeTab === 'communications' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900">Communications</h2>
                  <p className="text-sm text-gray-500 mt-1">Choose how campaign messages reach your members</p>
                </div>

                <SectionDivider label="Delivery Provider"/>
                <div className="space-y-3 mb-6">
                  {([
                    { value:'internal' as const, title:'Goself Built-in', badge:'Recommended',
                      body:'Send emails and SMS through our infrastructure. Fully automated.' },
                    { value:'external' as const, title:'External Webhook',
                      body:'Use your own stack (Klaviyo, SendGrid, WhatsApp). We POST campaign data to your endpoint.' },
                  ]).map(opt => (
                    <label key={opt.value} className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      formData.communication_settings.provider===opt.value ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="provider" value={opt.value}
                        checked={formData.communication_settings.provider===opt.value}
                        onChange={() => setComm({ provider: opt.value })} className="mt-1 accent-blue-600"/>
                      <div>
                        <p className="font-medium text-gray-900 flex items-center gap-1.5 text-sm">
                          {opt.title}
                          {opt.value==='internal' && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">{opt.badge}</span>}
                          {opt.value==='external' && <Webhook className="w-3.5 h-3.5 text-gray-400"/>}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">{opt.body}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {formData.communication_settings.provider==='external' && (
                  <FieldGroup label="Webhook URL" required hint="We POST JSON with member details, campaign info, and redemption links on every trigger">
                    <div className="relative">
                      <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"/>
                      <input type="url" className={inputCls+' pl-9 font-mono text-xs'}
                        value={formData.communication_settings.webhook_url || ''}
                        onChange={e => setComm({ webhook_url: e.target.value })}
                        placeholder="https://hooks.example.com/campaign-events"/>
                    </div>
                  </FieldGroup>
                )}

                {formData.communication_settings.provider==='internal' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                    <FieldGroup label="From Email">
                      <input type="email" value={formData.communication_settings.email_from||''}
                        onChange={e => setComm({ email_from: e.target.value })}
                        className={inputCls} placeholder="noreply@yourcompany.com"/>
                    </FieldGroup>
                    <FieldGroup label="From Name">
                      <input type="text" value={formData.communication_settings.email_from_name||''}
                        onChange={e => setComm({ email_from_name: e.target.value })}
                        className={inputCls} placeholder="Your Company Rewards"/>
                    </FieldGroup>
                  </div>
                )}

                <SectionDivider label="Default Message Template"/>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono mb-4">
                  {['{name}','{client}','{program}','{link}','{validity}','{points}'].map(t => (
                    <span key={t} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-blue-700 font-semibold">{t}</span>
                  ))}
                </div>
                <textarea value={formData.communication_settings.default_template}
                  onChange={e => setComm({ default_template: e.target.value })}
                  rows={5} className={inputCls} placeholder="Hi {name}! Welcome to {program}…"/>

                <SaveBar saving={commSaving} success={commSuccess} error={commError} onSave={handleSaveComm}/>
              </div>
            )}

            {/* ══ NOTIFICATIONS ═════════════════════════════════════════════ */}
            {activeTab === 'notifications' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
                  <p className="text-sm text-gray-500 mt-1">Choose which events trigger email alerts to your team</p>
                </div>

                <div className="space-y-0 mb-6">
                  {NOTIFICATION_EVENTS.map((ev, idx) => (
                    <div key={ev.key} className={`flex items-center justify-between py-4 ${idx!==0 ? 'border-t border-gray-100' : ''}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ev.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{ev.desc}</p>
                      </div>
                      <Toggle checked={(formData.notification_settings as any)[ev.key]}
                        onChange={() => setNotif({ [ev.key]: !(formData.notification_settings as any)[ev.key] } as any)}/>
                    </div>
                  ))}
                </div>

                <SectionDivider label="Delivery Email"/>
                <FieldGroup label="Notification Email Address"
                  hint="Alerts and digests go here. Defaults to primary contact email if blank.">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"/>
                    <input type="email" value={formData.notification_settings.digest_email}
                      onChange={e => setNotif({ digest_email: e.target.value })}
                      className={inputCls+' pl-9'} placeholder="ops@yourcompany.com"/>
                  </div>
                </FieldGroup>

                <SaveBar saving={notifSaving} success={notifSuccess} error={notifError} onSave={handleSaveNotif}/>
              </div>
            )}

            {/* ══ SECURITY ══════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900">Security</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage your account credentials and session</p>
                </div>

                <SectionDivider label="Account"/>
                <div className="space-y-0 mb-10">
                  {[
                    { label:'Email address', value: profile?.email },
                    { label:'Full name',     value: profile?.full_name || '—' },
                    { label:'Role',          badge:'Client' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-500">{row.label}</span>
                      {row.badge
                        ? <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">{row.badge}</span>
                        : <span className="text-sm font-medium text-gray-900">{row.value}</span>}
                    </div>
                  ))}
                </div>

                <SectionDivider label="Change Password"/>
                <div className="max-w-sm space-y-4 mb-10">
                  <FieldGroup label="New Password">
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} value={pwData.newPw}
                        onChange={e => setPwData(p => ({ ...p, newPw: e.target.value }))}
                        className={inputCls+' pr-10'} placeholder="Minimum 8 characters"/>
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </FieldGroup>
                  {pwData.newPw && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[8,12,16,20].map((len,i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                            pwData.newPw.length>=len ? ['bg-red-400','bg-yellow-400','bg-blue-400','bg-green-500'][i] : 'bg-gray-200'
                          }`}/>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400">
                        {pwData.newPw.length<8?'Too short':pwData.newPw.length<12?'Weak':pwData.newPw.length<16?'Good':'Strong'}
                      </p>
                    </div>
                  )}
                  <FieldGroup label="Confirm Password">
                    <input type={showPw ? 'text' : 'password'} value={pwData.confirm}
                      onChange={e => setPwData(p => ({ ...p, confirm: e.target.value }))}
                      className={inputCls} placeholder="Re-enter password"/>
                  </FieldGroup>
                  {pwError   && <p className="text-sm text-red-600">{pwError}</p>}
                  {pwSuccess  && <p className="text-sm text-green-600 flex items-center gap-1.5"><Check className="w-4 h-4"/>Password updated</p>}
                  <Button onClick={handleChangePassword} disabled={changingPw||!pwData.newPw}>
                    <Shield className="w-4 h-4 mr-2"/>{changingPw ? 'Updating…' : 'Update Password'}
                  </Button>
                </div>

                <SectionDivider label="Session"/>
                <p className="text-sm text-gray-500 mb-4">Signing out will end your current session on all tabs.</p>
                <Button variant="danger"
                  onClick={async () => { if(confirm('Sign out?')) { await signOut(); navigate('/login'); } }}
                  className="bg-red-600 hover:bg-red-700 text-white">
                  <LogOut className="w-4 h-4 mr-2"/>Sign Out
                </Button>
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
