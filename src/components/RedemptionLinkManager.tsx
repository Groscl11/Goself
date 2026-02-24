import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Link2, Copy, Check, Trash2, Plus, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RedemptionLink {
  id: string;
  program_id: string;
  unique_code: string;
  redemption_url: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface MembershipProgram {
  id: string;
  name: string;
}

interface RedemptionLinkManagerProps {
  clientId: string;
}

export function RedemptionLinkManager({ clientId }: RedemptionLinkManagerProps) {
  const [links, setLinks] = useState<RedemptionLink[]>([]);
  const [programs, setPrograms] = useState<MembershipProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string>('');

  const [formData, setFormData] = useState({
    program_id: '',
    max_uses: '',
    expires_in_days: '',
  });

  useEffect(() => {
    loadPrograms();
    loadLinks();
  }, [clientId]);

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_programs')
        .select('id, name')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  };

  const loadLinks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('redemption_links')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateUniqueCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.program_id) {
      alert('Please select a membership program');
      return;
    }

    try {
      const uniqueCode = generateUniqueCode();
      const baseUrl = window.location.origin;
      const redemptionUrl = `${baseUrl}/redeem?code=${uniqueCode}`;

      let expiresAt = null;
      if (formData.expires_in_days) {
        const daysToAdd = parseInt(formData.expires_in_days);
        expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
      }

      const linkData = {
        client_id: clientId,
        program_id: formData.program_id,
        unique_code: uniqueCode,
        redemption_url: redemptionUrl,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        expires_at: expiresAt,
        is_active: true,
      };

      const { error } = await supabase.from('redemption_links').insert([linkData]);

      if (error) throw error;

      setShowCreateForm(false);
      setFormData({
        program_id: '',
        max_uses: '',
        expires_in_days: '',
      });
      loadLinks();
      alert('Redemption link created successfully!');
    } catch (error) {
      console.error('Error creating link:', error);
      alert('Failed to create redemption link. Please try again.');
    }
  };

  const handleToggleActive = async (link: RedemptionLink) => {
    try {
      const { error } = await supabase
        .from('redemption_links')
        .update({
          is_active: !link.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id);

      if (error) throw error;
      loadLinks();
    } catch (error) {
      console.error('Error toggling link status:', error);
      alert('Failed to update link status.');
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this redemption link?')) {
      return;
    }

    try {
      const { error } = await supabase.from('redemption_links').delete().eq('id', linkId);

      if (error) throw error;
      loadLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      alert('Failed to delete link.');
    }
  };

  const copyToClipboard = (url: string, linkId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(linkId);
    setTimeout(() => setCopiedLink(''), 2000);
  };

  const getProgramName = (programId: string) => {
    const program = programs.find((p) => p.id === programId);
    return program?.name || 'Unknown Program';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Redemption Links</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Generate links to share on thank you pages, emails, or order confirmations
              </p>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showCreateForm && (
            <form onSubmit={handleCreateLink} className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold text-gray-900 mb-4">Create New Redemption Link</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Membership Program *
                  </label>
                  <select
                    required
                    value={formData.program_id}
                    onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a program</option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Max Uses (Optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={formData.max_uses}
                      onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Expires In (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Never expires"
                      value={formData.expires_in_days}
                      onChange={(e) =>
                        setFormData({ ...formData, expires_in_days: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1">
                    Generate Link
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading redemption links...</div>
          ) : links.length === 0 ? (
            <div className="text-center py-8">
              <Link2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No redemption links yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first link to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {getProgramName(link.program_id)}
                        </h4>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            link.is_active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {link.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Code: {link.unique_code}</span>
                        <span>
                          Uses: {link.uses_count}
                          {link.max_uses ? ` / ${link.max_uses}` : ' / ∞'}
                        </span>
                        {link.expires_at && (
                          <span>
                            Expires: {new Date(link.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      readOnly
                      value={link.redemption_url}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyToClipboard(link.redemption_url, link.id)}
                    >
                      {copiedLink === link.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <a
                      href={link.redemption_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-9 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleToggleActive(link)}
                    >
                      {link.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDelete(link.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Shopify Thank You Page</h4>
              <p className="text-sm text-gray-600 mb-2">
                Add this code to your Shopify theme's thank you page or use Shopify Scripts:
              </p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
  <h3 style="color: white; margin: 0 0 10px 0;">🎁 Claim Your Exclusive Rewards!</h3>
  <p style="color: white; margin: 0 0 15px 0;">Thank you for your purchase! Join our membership program to unlock special benefits.</p>
  <a href="YOUR_REDEMPTION_LINK_HERE" style="display: inline-block; background: white; color: #667eea; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Claim Rewards Now</a>
</div>`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Email Template</h4>
              <p className="text-sm text-gray-600 mb-2">
                Include this in your order confirmation emails:
              </p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`Subject: Your Order Confirmation + Special Rewards Inside! 🎁

Thank you for your order!

As a valued customer, you're eligible for exclusive membership rewards.
Click the link below to claim your benefits:

[CLAIM YOUR REWARDS] → YOUR_REDEMPTION_LINK_HERE

Benefits include:
• Access to exclusive discounts
• Early access to new products
• Priority customer support
• And much more!`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
