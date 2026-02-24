import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Save, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface MemberFormData {
  email: string;
  full_name: string;
  phone: string;
  external_id: string;
  is_active: boolean;
  metadata: Record<string, any>;
}

export function MemberForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MemberFormData>({
    email: '',
    full_name: '',
    phone: '',
    external_id: '',
    is_active: true,
    metadata: {},
  });

  useEffect(() => {
    loadClientId();
    if (isEdit) {
      loadMember();
    }
  }, [id]);

  const loadClientId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (profile?.client_id) {
        setClientId(profile.client_id);
      }
    } catch (error) {
      console.error('Error loading client ID:', error);
    }
  };

  const loadMember = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('member_users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || '',
          external_id: data.external_id || '',
          is_active: data.is_active,
          metadata: data.metadata || {},
        });
      }
    } catch (error) {
      console.error('Error loading member:', error);
      alert('Failed to load member details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      alert('Client ID not found. Please try logging in again.');
      return;
    }

    try {
      setLoading(true);

      const memberData = {
        ...formData,
        client_id: clientId,
      };

      if (isEdit) {
        const { error } = await supabase
          .from('member_users')
          .update(memberData)
          .eq('id', id);

        if (error) throw error;
        alert('Member updated successfully');
      } else {
        const { error } = await supabase
          .from('member_users')
          .insert([memberData]);

        if (error) throw error;

        const { error: sourceError } = await supabase
          .from('member_sources')
          .insert([{
            member_id: (await supabase
              .from('member_users')
              .select('id')
              .eq('email', formData.email)
              .eq('client_id', clientId)
              .single()).data?.id,
            source_type: 'manual',
            source_details: { added_by: 'client_portal' },
          }]);

        if (sourceError) console.error('Error adding source:', sourceError);

        alert('Member added successfully');
      }

      navigate('/client/members');
    } catch (error: any) {
      console.error('Error saving member:', error);
      alert(error.message || 'Failed to save member');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof MemberFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title={isEdit ? 'Edit Member' : 'Add Member'}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/client/members')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Members
          </Button>
        </div>

        <Card>
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {isEdit ? 'Edit Member' : 'Add New Member'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                  disabled={isEdit}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="member@example.com"
                />
                {isEdit && (
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  External ID
                </label>
                <input
                  type="text"
                  value={formData.external_id}
                  onChange={(e) => handleChange('external_id', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional reference ID from your system"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use this to link the member to your existing systems
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active Member
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button type="submit" disabled={loading} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : isEdit ? 'Update Member' : 'Add Member'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/client/members')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
