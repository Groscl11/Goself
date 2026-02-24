import { LayoutDashboard, Users, Award, Gift, Settings, ShoppingBag, Zap, BarChart3, Package, FileText, Megaphone, ShoppingCart, Sparkles, Puzzle, Mail, Activity, Layers, Sliders, Coins, UserPlus, Cog, Receipt } from 'lucide-react';

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
    label: 'Referral Tracking',
    path: '/client/referral-tracking',
    icon: <UserPlus className="w-5 h-5" />,
  },
  {
    label: 'Loyalty Config',
    path: '/client/loyalty-config',
    icon: <Cog className="w-5 h-5" />,
  },
  {
    label: 'My Rewards',
    path: '/client/my-rewards',
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: 'Rewards Marketplace',
    path: '/client/rewards',
    icon: <ShoppingBag className="w-5 h-5" />,
  },
  {
    label: 'Campaigns',
    path: '/client/campaigns',
    icon: <Megaphone className="w-5 h-5" />,
  },
  {
    label: 'Advanced Rules',
    path: '/client/campaigns-advanced',
    icon: <Layers className="w-5 h-5" />,
  },
  {
    label: 'Campaign Trigger Logs',
    path: '/client/campaign-logs',
    icon: <Activity className="w-5 h-5" />,
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
    label: 'Shopify Widgets',
    path: '/client/widgets',
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    label: 'App Extensions',
    path: '/client/extensions',
    icon: <Puzzle className="w-5 h-5" />,
  },
  {
    label: 'Widget Configurations',
    path: '/client/widget-configs',
    icon: <Sliders className="w-5 h-5" />,
  },
  {
    label: 'Tokenized Links',
    path: '/client/tokenized-links',
    icon: <Gift className="w-5 h-5" />,
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
];
