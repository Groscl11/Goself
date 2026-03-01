import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Users, Copy, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { adminMenuItems } from './adminMenuItems';

interface UserFormData {
  full_name: string;
  email: string;
  role: string;
  client_id: string;
  brand_id: string;
  avatar_url: string;
}

interface Client {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

export function UserForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    full_name: '',
    email: '',
    role: 'member',
    client_id: '',
    brand_id: '',
    avatar_url: '',
  });

  useEffect(() => {
    fetchClientsAndBrands();
    if (isEdit) {
      fetchUser();
    }
  }, [id]);

  const fetchClientsAndBrands = async () => {
    try {
      const [clientsResult, brandsResult] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('brands').select('id, name').order('name'),
      ]);

      if (clientsResult.data) setClients(clientsResult.data);
      if (brandsResult.data) setBrands(brandsResult.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '',
          role: data.role || 'member',
          client_id: data.client_id || '',
          brand_id: data.brand_id || '',
          avatar_url: data.avatar_url || '',
        });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Password copied to clipboard!');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        const updateData = {
          full_name: formData.full_name,
          role: formData.role,
          client_id: formData.client_id && formData.client_id !== 'undefined' ? formData.client_id : null,
          brand_id: formData.brand_id && formData.brand_id !== 'undefined' ? formData.brand_id : null,
          avatar_url: formData.avatar_url && formData.avatar_url !== 'undefined' ? formData.avatar_url : null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
        navigate('/admin/users');
      } else {
        const password = generatePassword();
        setGeneratedPassword(password);

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: password,
          options: {
            emailRedirectTo: window.location.origin + '/dashboard',
            data: {
              full_name: formData.full_name,
            }
          }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create user');

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            client_id: formData.client_id && formData.client_id !== 'undefined' ? formData.client_id : null,
            brand_id: formData.brand_id && formData.brand_id !== 'undefined' ? formData.brand_id : null,
            avatar_url: formData.avatar_url && formData.avatar_url !== 'undefined' ? formData.avatar_url : null,
          });

        if (profileError) throw profileError;

        setUserCreated(true);
        alert('User created successfully! Please note the login credentials below.');
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert(error.message || 'Failed to save user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof UserFormData, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      if (field === 'role') {
        if (value === 'client') {
          newData.brand_id = '';
        } else if (value === 'brand') {
          newData.client_id = '';
        } else if (value === 'admin' || value === 'member') {
          newData.client_id = '';
          newData.brand_id = '';
        }
      }

      return newData;
    });
  };

  return (
    <DashboardLayout menuItems={adminMenuItems} title={isEdit ? 'Edit User' : 'Add User'}>
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/users')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEdit ? 'Edit User' : 'Add New User'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEdit ? 'Update user information and role' : 'Create a new user account'}
          </p>
        </div>
      </div>

      {!isEdit && userCreated && generatedPassword && (
        <Card>
          <div className="p-6 bg-green-50 border border-green-200 rounded-lg space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-2">User Created Successfully!</h3>
                <p className="text-sm text-green-800 mb-4">
                  Share these credentials with the user. They can login using these details.
                </p>

                <div className="space-y-3 bg-white p-4 rounded-lg border border-green-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm font-mono">
                        {formData.email}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(formData.email)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm font-mono">
                        {showPassword ? generatedPassword : '••••••••••••'}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(generatedPassword)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <Button onClick={() => navigate('/admin/users')}>
                    Return to Users List
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!isEdit && !userCreated && (
        <Card>
          <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> A secure password will be automatically generated. You will see the credentials after creating the user.
            </p>
          </div>
        </Card>
      )}

      {(!userCreated || isEdit) && (
        <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  disabled={isEdit}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="john@example.com"
                />
                {isEdit && (
                  <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar URL
                </label>
                <input
                  type="url"
                  value={formData.avatar_url}
                  onChange={(e) => handleChange('avatar_url', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Role & Permissions</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="member">Member</option>
                  <option value="client">Client</option>
                  <option value="brand">Brand</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {formData.role === 'admin' && 'Full access to all platform features'}
                  {formData.role === 'client' && 'Can manage membership programs and members'}
                  {formData.role === 'brand' && 'Can manage brand profile and rewards'}
                  {formData.role === 'member' && 'Can access membership portal and redeem rewards'}
                </p>
              </div>

              {formData.role === 'client' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Associated Client
                  </label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => handleChange('client_id', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Link this user to a specific client organization
                  </p>
                </div>
              )}

              {formData.role === 'brand' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Associated Brand
                  </label>
                  <select
                    value={formData.brand_id}
                    onChange={(e) => handleChange('brand_id', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Link this user to a specific brand
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/users')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </form>
      )}
    </div>
    </DashboardLayout>
  );
}
