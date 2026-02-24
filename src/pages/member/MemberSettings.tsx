import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LogOut, User, UserCircle, Award, Gift, CheckCircle, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const memberMenuItems = [
  { label: 'Dashboard', path: '/member', icon: <Award className="w-5 h-5" /> },
  { label: 'My Memberships', path: '/member/memberships', icon: <Award className="w-5 h-5" /> },
  { label: 'Available Rewards', path: '/member/rewards', icon: <Gift className="w-5 h-5" /> },
  { label: 'My Vouchers', path: '/member/vouchers', icon: <CheckCircle className="w-5 h-5" /> },
  { label: 'Settings', path: '/member/settings', icon: <Settings className="w-5 h-5" /> },
];

export function MemberSettings() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  return (
    <DashboardLayout menuItems={memberMenuItems} title="Settings">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              Member Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Account Type</p>
                <p className="font-medium text-gray-900">Member</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Signed in as</p>
                <p className="font-medium text-gray-900">{profile?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Full Name</p>
                <p className="font-medium text-gray-900">{profile?.full_name || 'Not set'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <User className="w-5 h-5" />
              Account Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="danger"
              onClick={async () => {
                if (confirm('Are you sure you want to sign out?')) {
                  await signOut();
                  navigate('/login');
                }
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
