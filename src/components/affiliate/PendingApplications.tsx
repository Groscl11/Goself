import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Check, X, Mail, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  created_at: string;
}

export function PendingApplications({
  clientId, defaultPartnerType, onApproved,
}: { clientId: string; defaultPartnerType: string; onApproved?: () => void }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('affiliate_applications')
      .select('id, name, email, phone, message, created_at')
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setApplications((data as Application[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(app: Application) {
    setProcessingId(app.id);
    setErrorById(prev => { const next = { ...prev }; delete next[app.id]; return next; });

    const { data: partner, error: insertErr } = await supabase
      .from('affiliate_partners')
      .insert({
        client_id: clientId,
        name: app.name,
        email: app.email,
        phone: app.phone,
        partner_type: defaultPartnerType,
        status: 'active',
        notes: app.message ? `Applied via portal: ${app.message}` : 'Applied via portal',
      })
      .select('id')
      .single();

    if (insertErr || !partner) {
      setErrorById(prev => ({ ...prev, [app.id]: insertErr?.message || 'Failed to create partner.' }));
      setProcessingId(null);
      return;
    }

    const { error: updateErr } = await supabase
      .from('affiliate_applications')
      .update({ status: 'approved', partner_id: partner.id, reviewed_at: new Date().toISOString() })
      .eq('id', app.id);

    if (updateErr) {
      setErrorById(prev => ({ ...prev, [app.id]: updateErr.message }));
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    onApproved?.();
    load();
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    setErrorById(prev => { const next = { ...prev }; delete next[id]; return next; });
    const { error } = await supabase
      .from('affiliate_applications')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setErrorById(prev => ({ ...prev, [id]: error.message }));
      setProcessingId(null);
      return;
    }
    setProcessingId(null);
    load();
  }

  if (loading || applications.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <UserPlus className="h-4 w-4 text-amber-700" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            {applications.length} pending affiliate application{applications.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span className="text-xs font-medium text-amber-700">{expanded ? 'Hide' : 'Review'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-amber-100 border-t border-amber-200">
          {applications.map(app => (
            <div key={app.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{app.name}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {app.email}
                </p>
                {app.message && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{app.message}</p>}
                {errorById[app.id] && (
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" /> {errorById[app.id]}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleApprove(app)}
                  disabled={processingId === app.id}
                  className="flex items-center gap-1 text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={() => handleReject(app.id)}
                  disabled={processingId === app.id}
                  className="flex items-center gap-1 text-xs border border-gray-200 text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  <X className="w-3.5 h-3.5" /> Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
