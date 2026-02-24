import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Gift, Copy, Check, ExternalLink, Calendar, Users } from 'lucide-react';
import { clientMenuItems } from './clientMenuItems';

interface RedemptionLink {
  id: string;
  client_id: string;
  program_id: string;
  unique_code: string;
  redemption_url: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  program: {
    name: string;
  };
}

export function TokenizedLinks() {
  const { profile } = useAuth();
  const [links, setLinks] = useState<RedemptionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (profile?.client_id) {
      loadLinks();
    }
  }, [profile?.client_id]);

  async function loadLinks() {
    if (!profile?.client_id) return;

    try {
      const { data, error } = await supabase
        .from('redemption_links')
        .select(`
          *,
          program:membership_programs!redemption_links_program_id_fkey (
            name
          )
        `)
        .eq('client_id', profile.client_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLinks = (data || []).map(link => ({
        ...link,
        program: {
          name: link.program?.name || 'Unknown Program'
        }
      }));

      setLinks(formattedLinks);
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setLoading(false);
    }
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Client Portal">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading tokenized links...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Tokenized Links</h1>
            <p className="mt-1 text-gray-600">Secure reward redemption links for your members</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Gift className="w-4 h-4 mr-2" />
            Create Link
          </Button>
        </div>

        {links.length === 0 ? (
          <Card className="text-center py-12">
            <Gift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No tokenized links yet</h3>
            <p className="text-gray-600 mb-6">Create secure links to distribute rewards to your members</p>
            <Button onClick={() => setShowCreateForm(true)}>
              Create Your First Link
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <Card key={link.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{link.program.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">Code: {link.unique_code}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {link.is_active ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Uses:</span>
                    <span className="font-semibold text-gray-900">
                      {link.uses_count}
                      {link.max_uses ? ` / ${link.max_uses}` : ' / ∞'}
                    </span>
                  </div>
                  {link.expires_at && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Expires:</span>
                      <span className="font-semibold text-gray-900">{formatDate(link.expires_at)}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Created:</span>
                    <span className="font-semibold text-gray-900">{formatDate(link.created_at)}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Redemption Link</span>
                    <div className="flex space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(link.redemption_url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copyUrl(link.redemption_url)}
                      >
                        {copiedUrl === link.redemption_url ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-100 p-3 rounded">
                    <code className="text-xs font-mono text-gray-700 break-all">
                      {link.redemption_url}
                    </code>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create Tokenized Link</h2>
              <p className="text-gray-600 mb-4">
                Link creation form coming soon. For now, links are created automatically when you allocate rewards to members.
              </p>
              <Button onClick={() => setShowCreateForm(false)}>Close</Button>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
