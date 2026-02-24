import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Users, Building2, Award, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminMenuItems } from './adminMenuItems';

interface Stats {
  totalClients: number;
  totalBrands: number;
  totalRewards: number;
  totalMembers: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalBrands: 0,
    totalRewards: 0,
    totalMembers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [clients, brands, rewards, members] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('brands').select('id', { count: 'exact', head: true }),
        supabase.from('rewards').select('id', { count: 'exact', head: true }),
        supabase.from('member_users').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalClients: clients.count || 0,
        totalBrands: brands.count || 0,
        totalRewards: rewards.count || 0,
        totalMembers: members.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Clients',
      value: stats.totalClients,
      icon: <Building2 className="w-8 h-8 text-blue-600" />,
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Brands',
      value: stats.totalBrands,
      icon: <Award className="w-8 h-8 text-green-600" />,
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Rewards',
      value: stats.totalRewards,
      icon: <TrendingUp className="w-8 h-8 text-orange-600" />,
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Total Members',
      value: stats.totalMembers,
      icon: <Users className="w-8 h-8 text-purple-600" />,
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <DashboardLayout menuItems={adminMenuItems} title="Admin Dashboard">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your membership rewards platform</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${stat.bgColor}`}>
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Activity feed coming soon...</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href="/admin/clients"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-900">Manage Clients</p>
                <p className="text-sm text-gray-600 mt-1">View and manage client organizations</p>
              </a>
              <a
                href="/admin/brands"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-900">Review Brands</p>
                <p className="text-sm text-gray-600 mt-1">Approve pending brand applications</p>
              </a>
              <a
                href="/admin/rewards"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-900">Manage Rewards</p>
                <p className="text-sm text-gray-600 mt-1">Review and manage marketplace rewards</p>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
