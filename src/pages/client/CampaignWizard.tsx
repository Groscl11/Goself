import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  Users,
  Gift,
  Mail,
  MessageSquare,
  MessageCircle,
  Calendar,
  FileSpreadsheet,
  Send,
  Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';
import * as XLSX from 'xlsx';

interface Program {
  id: string;
  name: string;
  description: string;
  validity_days: number;
}

interface Reward {
  id: string;
  title: string;
  description: string;
  value_description: string;
  brands: { name: string };
}

interface Template {
  id: string;
  name: string;
  template_type: string;
  subject: string | null;
  body: string;
}

interface UploadedUser {
  full_name: string;
  email: string;
  phone: string;
}

export function CampaignWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  const [campaignData, setCampaignData] = useState({
    name: '',
    description: '',
    campaign_type: 'membership_enrollment' as 'membership_enrollment' | 'reward_distribution' | 'general',
    message_type: 'email' as 'sms' | 'email' | 'whatsapp' | 'all',
    template_id: '',
    custom_subject: '',
    custom_message: '',
    target_audience: 'new_upload' as 'all_members' | 'specific_members' | 'new_upload',
    program_id: '',
    reward_id: '',
    scheduled_at: '',
  });

  const [programs, setPrograms] = useState<Program[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [existingMembers, setExistingMembers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [uploadedUsers, setUploadedUsers] = useState<UploadedUser[]>([]);
  const [previewMessage, setPreviewMessage] = useState({ subject: '', body: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadClientId();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadPrograms();
      loadRewards();
      loadTemplates();
      loadMembers();
    }
  }, [clientId]);

  const loadClientId = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

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

  const loadPrograms = async () => {
    const { data } = await supabase
      .from('membership_programs')
      .select('id, name, description, validity_days')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('name');

    setPrograms(data || []);
  };

  const loadRewards = async () => {
    const { data } = await supabase
      .from('rewards')
      .select('id, title, description, value_description, brands(name)')
      .or(`client_id.eq.${clientId},is_marketplace.eq.true`)
      .eq('status', 'active')
      .order('title');

    setRewards(data || []);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('name');

    setTemplates(data || []);
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from('member_users')
      .select('id, full_name, email, phone')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('full_name');

    setExistingMembers(data || []);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet) as any[];

        const users = data.map((row) => ({
          full_name: row.full_name || row.name || '',
          email: row.email || '',
          phone: row.phone || row.mobile || '',
        }));

        setUploadedUsers(users.filter((u) => u.full_name && u.email));
        alert(`Successfully loaded ${users.filter((u) => u.full_name && u.email).length} users`);
      } catch (error) {
        console.error('Error parsing Excel:', error);
        alert('Failed to parse Excel file. Please check the format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const generatePreview = () => {
    const template = templates.find((t) => t.id === campaignData.template_id);
    const program = programs.find((p) => p.id === campaignData.program_id);
    const reward = rewards.find((r) => r.id === campaignData.reward_id);

    let subject = campaignData.custom_subject || template?.subject || '';
    let body = campaignData.custom_message || template?.body || '';

    const sampleLink = 'https://yourapp.com/enroll/abc123xyz456';

    subject = subject
      .replace(/{name}/g, 'John Doe')
      .replace(/{program}/g, program?.name || 'Membership Program')
      .replace(/{client}/g, 'Your Company')
      .replace(/{link}/g, sampleLink);

    body = body
      .replace(/{name}/g, 'John Doe')
      .replace(/{program}/g, program?.name || 'Membership Program')
      .replace(/{client}/g, 'Your Company')
      .replace(/{link}/g, sampleLink)
      .replace(/{reward}/g, reward?.title || 'Exclusive Reward');

    setPreviewMessage({ subject, body });
  };

  useEffect(() => {
    if (step === 4) {
      generatePreview();
    }
  }, [step, campaignData]);

  const handleCreateCampaign = async () => {
    try {
      setCreating(true);

      const recipients =
        campaignData.target_audience === 'new_upload'
          ? uploadedUsers
          : campaignData.target_audience === 'all_members'
          ? existingMembers
          : existingMembers.filter((m) => selectedMembers.includes(m.id));

      if (recipients.length === 0) {
        alert('No recipients selected');
        return;
      }

      const campaignInsert = {
        client_id: clientId,
        name: campaignData.name,
        description: campaignData.description,
        campaign_type: campaignData.campaign_type,
        message_type: campaignData.message_type,
        template_id: campaignData.template_id || null,
        custom_message: campaignData.custom_message || null,
        target_audience: campaignData.target_audience,
        status: campaignData.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: campaignData.scheduled_at || null,
        total_recipients: recipients.length,
        created_by: userId,
      };

      const { data: campaign, error: campaignError } = await supabase
        .from('message_campaigns')
        .insert([campaignInsert])
        .select()
        .single();

      if (campaignError) throw campaignError;

      if (campaignData.target_audience === 'new_upload') {
        const newMembers = await Promise.all(
          uploadedUsers.map(async (user) => {
            const { data: existingMember } = await supabase
              .from('member_users')
              .select('id')
              .eq('email', user.email)
              .eq('client_id', clientId)
              .maybeSingle();

            if (existingMember) {
              return existingMember;
            }

            const { data: newMember, error } = await supabase
              .from('member_users')
              .insert([
                {
                  client_id: clientId,
                  full_name: user.full_name,
                  email: user.email,
                  phone: user.phone,
                  is_active: true,
                },
              ])
              .select()
              .single();

            if (error) {
              console.error('Error creating member:', error);
              return null;
            }

            await supabase.from('member_sources').insert([
              {
                member_id: newMember.id,
                source_type: 'campaign',
                source_campaign_id: campaign.id,
              },
            ]);

            return newMember;
          })
        );

        const validMembers = newMembers.filter((m) => m !== null);

        const recipientsToInsert = validMembers.map((member: any, index) => ({
          campaign_id: campaign.id,
          member_id: member.id,
          email: uploadedUsers[index].email,
          phone: uploadedUsers[index].phone,
          full_name: uploadedUsers[index].full_name,
          unique_link: `https://yourapp.com/enroll/${campaign.id}-${member.id}-${Date.now()}`,
          status: 'pending',
          metadata: {
            program_id: campaignData.program_id,
            reward_id: campaignData.reward_id,
          },
        }));

        const { error: recipientError } = await supabase
          .from('campaign_recipients')
          .insert(recipientsToInsert);

        if (recipientError) throw recipientError;

        if (campaignData.campaign_type === 'membership_enrollment' && campaignData.program_id) {
          const membershipsToCreate = validMembers.map((member: any) => ({
            member_id: member.id,
            program_id: campaignData.program_id,
            status: 'active',
            start_date: new Date().toISOString(),
            expiry_date: new Date(
              Date.now() +
                (programs.find((p) => p.id === campaignData.program_id)?.validity_days || 365) *
                  24 *
                  60 *
                  60 *
                  1000
            ).toISOString(),
          }));

          await supabase.from('member_memberships').insert(membershipsToCreate);
        }
      } else {
        const recipientsToInsert = recipients.map((member: any) => ({
          campaign_id: campaign.id,
          member_id: member.id,
          email: member.email,
          phone: member.phone || '',
          full_name: member.full_name,
          unique_link: `https://yourapp.com/enroll/${campaign.id}-${member.id}-${Date.now()}`,
          status: 'pending',
          metadata: {
            program_id: campaignData.program_id,
            reward_id: campaignData.reward_id,
          },
        }));

        const { error: recipientError } = await supabase
          .from('campaign_recipients')
          .insert(recipientsToInsert);

        if (recipientError) throw recipientError;
      }

      alert('Campaign created successfully! Recipients will receive messages shortly.');
      navigate('/client/campaigns');
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Campaign Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Q4 Member Enrollment"
            value={campaignData.name}
            onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          <textarea
            rows={3}
            placeholder="Describe the campaign purpose"
            value={campaignData.description}
            onChange={(e) => setCampaignData({ ...campaignData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Campaign Type *
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'membership_enrollment', label: 'Membership Enrollment', icon: Users },
              { value: 'reward_distribution', label: 'Reward Distribution', icon: Gift },
              { value: 'general', label: 'General Message', icon: Mail },
            ].map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setCampaignData({
                      ...campaignData,
                      campaign_type: type.value as any,
                    })
                  }
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    campaignData.campaign_type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Icon className="w-6 h-6 text-blue-600 mb-2" />
                  <p className="font-semibold text-gray-900 text-sm">{type.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {campaignData.campaign_type === 'membership_enrollment' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Program *
            </label>
            <select
              required
              value={campaignData.program_id}
              onChange={(e) => setCampaignData({ ...campaignData, program_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {campaignData.campaign_type === 'reward_distribution' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Reward *
            </label>
            <select
              required
              value={campaignData.reward_id}
              onChange={(e) => setCampaignData({ ...campaignData, reward_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a reward</option>
              {rewards.map((reward) => (
                <option key={reward.id} value={reward.id}>
                  {reward.title} - {reward.brands.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Message Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Message Type *
          </label>
          <div className="grid grid-cols-4 gap-3">
            {[
              { value: 'email', label: 'Email', icon: Mail },
              { value: 'sms', label: 'SMS', icon: MessageSquare },
              { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
              { value: 'all', label: 'All', icon: Send },
            ].map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setCampaignData({
                      ...campaignData,
                      message_type: type.value as any,
                    })
                  }
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    campaignData.message_type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Icon className="w-6 h-6 text-blue-600 mb-2 mx-auto" />
                  <p className="font-semibold text-gray-900 text-sm">{type.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Use Template (Optional)
          </label>
          <select
            value={campaignData.template_id}
            onChange={(e) => setCampaignData({ ...campaignData, template_id: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Write custom message</option>
            {templates
              .filter(
                (t) =>
                  campaignData.message_type === 'all' ||
                  t.template_type === campaignData.message_type
              )
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
          </select>
        </div>

        {!campaignData.template_id && campaignData.message_type === 'email' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Subject *
            </label>
            <input
              type="text"
              required
              placeholder="Enter email subject"
              value={campaignData.custom_subject}
              onChange={(e) =>
                setCampaignData({ ...campaignData, custom_subject: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {!campaignData.template_id && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Message Body *
            </label>
            <textarea
              required
              rows={8}
              placeholder="Use variables: {name}, {link}, {program}, {client}"
              value={campaignData.custom_message}
              onChange={(e) =>
                setCampaignData({ ...campaignData, custom_message: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Select Recipients</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'all_members', label: 'All Existing Members' },
            { value: 'specific_members', label: 'Specific Members' },
            { value: 'new_upload', label: 'Upload New Users' },
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() =>
                setCampaignData({
                  ...campaignData,
                  target_audience: type.value as any,
                })
              }
              className={`p-4 border-2 rounded-lg text-center transition-colors ${
                campaignData.target_audience === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <p className="font-semibold text-gray-900 text-sm">{type.label}</p>
            </button>
          ))}
        </div>

        {campaignData.target_audience === 'all_members' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-900 font-semibold">
              Sending to all {existingMembers.length} members
            </p>
          </div>
        )}

        {campaignData.target_audience === 'specific_members' && (
          <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg p-4">
            {existingMembers.map((member) => (
              <label
                key={member.id}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(member.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMembers([...selectedMembers, member.id]);
                    } else {
                      setSelectedMembers(selectedMembers.filter((id) => id !== member.id));
                    }
                  }}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-gray-900">{member.full_name}</p>
                  <p className="text-sm text-gray-600">{member.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {campaignData.target_audience === 'new_upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="text-blue-600 hover:text-blue-700 font-semibold">
                  Click to upload Excel file
                </span>
              </label>
              <p className="text-sm text-gray-500 mt-2">
                Required columns: full_name, email, phone
              </p>
            </div>

            {uploadedUsers.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-900 font-semibold">
                  {uploadedUsers.length} users loaded successfully
                </p>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  {uploadedUsers.slice(0, 5).map((user, index) => (
                    <p key={index} className="text-sm text-green-800">
                      {user.full_name} - {user.email}
                    </p>
                  ))}
                  {uploadedUsers.length > 5 && (
                    <p className="text-sm text-green-700 mt-1">
                      ...and {uploadedUsers.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Preview & Launch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Campaign Summary</h3>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold">Name:</span> {campaignData.name}
            </p>
            <p>
              <span className="font-semibold">Type:</span>{' '}
              {campaignData.campaign_type.replace('_', ' ')}
            </p>
            <p>
              <span className="font-semibold">Message Type:</span> {campaignData.message_type}
            </p>
            <p>
              <span className="font-semibold">Recipients:</span>{' '}
              {campaignData.target_audience === 'all_members'
                ? existingMembers.length
                : campaignData.target_audience === 'specific_members'
                ? selectedMembers.length
                : uploadedUsers.length}
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Message Preview
          </h3>
          {previewMessage.subject && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Subject:</p>
              <p className="font-semibold text-gray-900">{previewMessage.subject}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-2">Body:</p>
            <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap text-sm">
              {previewMessage.body}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Schedule (Optional)
          </label>
          <input
            type="datetime-local"
            value={campaignData.scheduled_at}
            onChange={(e) => setCampaignData({ ...campaignData, scheduled_at: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">Leave empty to send immediately</p>
        </div>
      </CardContent>
    </Card>
  );

  const canProceed = () => {
    if (step === 1) {
      return (
        campaignData.name &&
        (campaignData.campaign_type !== 'membership_enrollment' || campaignData.program_id) &&
        (campaignData.campaign_type !== 'reward_distribution' || campaignData.reward_id)
      );
    }
    if (step === 2) {
      return (
        campaignData.template_id ||
        (campaignData.custom_message &&
          (campaignData.message_type !== 'email' || campaignData.custom_subject))
      );
    }
    if (step === 3) {
      return (
        (campaignData.target_audience === 'all_members' && existingMembers.length > 0) ||
        (campaignData.target_audience === 'specific_members' && selectedMembers.length > 0) ||
        (campaignData.target_audience === 'new_upload' && uploadedUsers.length > 0)
      );
    }
    return true;
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Create Campaign">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Campaign</h1>
          <p className="text-gray-600 mt-2">
            Set up membership enrollment or reward distribution campaigns
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    s === step
                      ? 'bg-blue-600 text-white'
                      : s < step
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {s < step ? <Check className="w-6 h-6" /> : s}
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm font-medium">Details</span>
            <span className="text-sm font-medium">Message</span>
            <span className="text-sm font-medium">Recipients</span>
            <span className="text-sm font-medium">Launch</span>
          </div>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        <div className="mt-8 flex gap-4">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="flex-1">
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCreateCampaign} disabled={creating} className="flex-1">
              {creating ? 'Creating...' : 'Launch Campaign'}
              <Send className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
