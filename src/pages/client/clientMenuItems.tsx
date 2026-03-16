import { LayoutDashboard, Users, Award, Settings, ShoppingBag, Zap, BarChart3, Package, FileText, Megaphone, ShoppingCart, Sparkles, Mail, Coins, UserPlus, Cog, Receipt, Tag, Building2, CreditCard } from 'lucide-react';

export const clientMenuItems = [
  {
    label: 'Dashboard',
    path: '/client',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Membership Programs',
    path: '/client/programs',
    icon: <Award className="w-5 h-5" />,
  },
  {
    label: 'Members',
    path: '/client/members',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Loyalty Points',
    path: '/client/loyalty-points',
    icon: <Coins className="w-5 h-5" />,
  },
  {
    label: 'Loyalty Members',
    path: '/client/loyalty-members',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Loyalty Transactions',
    path: '/client/loyalty-transactions',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Offers & Rewards',
    path: '/client/offers',
    icon: <Tag className="w-5 h-5" />,
  },
  {
    label: 'Brand Redemptions',
    path: '/client/brand-redemptions',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Referral Tracking',
    path: '/client/referral-tracking',
    icon: <UserPlus className="w-5 h-5" />,
  },
  {
    label: 'Ways to Earn Points',
    path: '/client/loyalty-config',
    icon: <Cog className="w-5 h-5" />,
  },
  {
    label: 'Rewards Marketplace',
    path: '/client/rewards',
    icon: <ShoppingBag className="w-5 h-5" />,
  },
  {
    label: 'Reward Campaigns',
    path: '/client/campaigns',
    icon: <Megaphone className="w-5 h-5" />,
  },
  {
    label: 'Message Templates',
    path: '/client/templates',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Communication Logs',
    path: '/client/communications',
    icon: <Mail className="w-5 h-5" />,
  },
  {
    label: 'Integrations',
    path: '/client/integrations',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    label: 'Orders',
    path: '/client/orders',
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    label: 'Shopify & Widgets',
    path: '/client/widgets',
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    label: 'Reports',
    path: '/client/reports',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    path: '/client/settings',
    icon: <Settings className="w-5 h-5" />,
  },
  {
    label: 'Plan & Billing',
    path: '/client/billing',
    icon: <CreditCard className="w-5 h-5" />,
  },
];
