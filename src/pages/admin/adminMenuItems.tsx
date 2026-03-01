import { LayoutDashboard, Building2, Award, Gift, Users, Settings, BarChart3, Ticket, Zap, ShoppingCart, Store, Layers } from 'lucide-react';

export const adminMenuItems = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Store Installations',
    path: '/admin/store-installations',
    icon: <Store className="w-5 h-5" />,
  },
  {
    label: 'Clients',
    path: '/admin/clients',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Brands',
    path: '/admin/brands',
    icon: <Award className="w-5 h-5" />,
  },
  {
    label: 'Rewards',
    path: '/admin/rewards',
    icon: <Gift className="w-5 h-5" />,
  },
  {
    label: 'Reward Allocations',
    path: '/admin/rewards/allocations',
    icon: <Layers className="w-5 h-5" />,
  },
  {
    label: 'Membership Programs',
    path: '/admin/membership-programs',
    icon: <Ticket className="w-5 h-5" />,
  },
  {
    label: 'Campaign Rules',
    path: '/admin/campaign-rules',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    label: 'Orders',
    path: '/admin/orders',
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    label: 'Transactions',
    path: '/admin/transactions',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    label: 'Users',
    path: '/admin/users',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    path: '/admin/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];
