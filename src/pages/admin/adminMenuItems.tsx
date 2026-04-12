import { LayoutDashboard, Building2, Award, Gift, Users, Settings, BarChart3, Ticket, Zap, ShoppingCart, Store, Layers, RefreshCw, GitBranch, Globe, TrendingUp, CreditCard } from 'lucide-react';

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
    label: 'Brand Redemptions',
    path: '/admin/brand-redemptions',
    icon: <RefreshCw className="w-5 h-5" />,
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
    label: 'Network Rules',
    path: '/admin/network-rules',
    icon: <GitBranch className="w-5 h-5" />,
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
    label: 'Global Users',
    path: '/admin/global-users',
    icon: <Globe className="w-5 h-5" />,
  },
  {
    label: 'Referral Analytics',
    path: '/admin/referral-analytics',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    label: 'Billing',
    path: '/admin/billing',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    path: '/admin/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];
