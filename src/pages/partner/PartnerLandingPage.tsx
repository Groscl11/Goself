import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PortalSectionRenderer, PortalSection, defaultSections } from '../../components/affiliate/PortalSections';

interface ClientData {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  affiliate_settings: { portal?: { sections?: PortalSection[]; applicationsEnabled?: boolean; customCss?: string } } | null;
  branding_settings: { secondary_color?: string; border_radius?: string; font_heading?: string; font_body?: string } | null;
}

export default function PartnerLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('clients')
      .select('id, name, logo_url, primary_color, affiliate_settings, branding_settings')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err || !data) { setError('Affiliate portal not found.'); return; }
        setClient(data as ClientData);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const accent = client.primary_color || '#6366f1';
  const portal = client.affiliate_settings?.portal;
  const sections = portal?.sections?.length ? portal.sections : defaultSections();
  const applicationsEnabled = portal?.applicationsEnabled ?? true;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {portal?.customCss && <style>{portal.customCss}</style>}
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-8 object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + '20' }}>
              <Building2 className="h-4 w-4" style={{ color: accent }} />
            </div>
          )}
          <span className="font-semibold text-gray-900 dark:text-white">{client.name}</span>
        </div>
        <button
          onClick={() => navigate(`/partner/${slug}`)}
          className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
        >
          Log in
        </button>
      </header>

      {sections.map(section => (
        <PortalSectionRenderer
          key={section.id}
          section={section}
          theme={{
            primaryColor: accent,
            secondaryColor: client.branding_settings?.secondary_color,
            borderRadius: client.branding_settings?.border_radius,
            fontHeading: client.branding_settings?.font_heading,
            fontBody: client.branding_settings?.font_body,
            logoUrl: client.logo_url,
            clientName: client.name,
          }}
          showApply={applicationsEnabled}
          onApply={() => setApplyModalOpen(true)}
          onLogin={() => navigate(`/partner/${slug}`)}
        />
      ))}

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 py-6">
        Powered by <span className="font-medium">Goself</span>
      </p>

      {applyModalOpen && (
        <ApplyModal clientId={client.id} accent={accent} onClose={() => setApplyModalOpen(false)} />
      )}
    </div>
  );
}

function ApplyModal({ clientId, accent, onClose }: { clientId: string; accent: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { error: err } = await supabase.from('affiliate_applications').insert({
      client_id: clientId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (err) { setError('Could not submit your application. Please try again.'); return; }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {done ? 'Application received' : 'Become an affiliate'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: accent }} />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Thanks, {name.split(' ')[0]}! We've received your application and will be in touch by email.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{error}</p>}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                required value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
              <input
                required type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tell us about your audience <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3} value={message} onChange={e => setMessage(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="w-full py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
