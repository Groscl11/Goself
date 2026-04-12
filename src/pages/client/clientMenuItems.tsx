import {
  LayoutDashboard,
  Users,
  Coins,
  Receipt,
  Cog,
  GitBranch,
  Link2,
  Tag,
  Megaphone,
  Building2,
  ScrollText,
  FileText,
  Mail,
  BarChart3,
  ShoppingCart,
  Zap,
  Sparkles,
  Settings,
  CreditCard,
} from 'lucide-react';

export const clientMenuItems = [
  // ── No section: Dashboard ──────────────────────────────────────────────────
  {
    label: 'Dashboard',
    path: '/client',
    icon: <LayoutDashboard className="w-4 h-4" />,
  },

  // ── LOYALTY ───────────────────────────────────────────────────────────────
  {
    section: 'Loyalty',
    label: 'Members',
    path: '/client/members',
    icon: <Users className="w-4 h-4" />,
  },
  {
    section: 'Loyalty',
    label: 'Points & Tiers',
    path: '/client/loyalty-points',
    icon: <Coins className="w-4 h-4" />,
  },
  {
    section: 'Loyalty',
    label: 'Transactions',
    path: '/client/loyalty-transactions',
    icon: <Receipt className="w-4 h-4" />,
  },
  {
    section: 'Loyalty',
    label: 'Earn Rules',
    path: '/client/loyalty-config',
    icon: <Cog className="w-4 h-4" />,
  },

  // ── REFERRAL ──────────────────────────────────────────────────────────────
  {
    section: 'Referral',
    label: 'Referral Tracking',
    path: '/client/referral-tracking',
    icon: <GitBranch className="w-4 h-4" />,
  },
  {
    section: 'Referral',
    label: 'Reward Links',
    path: '/client/tokenized-links',
    icon: <Link2 className="w-4 h-4" />,
  },

  // ── REWARDS & OFFERS ──────────────────────────────────────────────────────
  {
    section: 'Rewards & Offers',
    label: 'Offers',
    path: '/client/offers',
    icon: <Tag className="w-4 h-4" />,
  },
  {
    section: 'Rewards & Offers',
    label: 'Campaigns',
    path: '/client/campaigns',
    icon: <Megaphone className="w-4 h-4" />,
  },

  {
    section: 'Rewards & Offers',
    label: 'Brand Network',
    path: '/client/brand-redemptions',
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    section: 'Rewards & Offers',
    label: 'Campaign Logs',
    path: '/client/campaign-logs',
    icon: <ScrollText className="w-4 h-4" />,
  },

  // ── COMMUNICATIONS ────────────────────────────────────────────────────────
  {
    section: 'Communications',
    label: 'Templates',
    path: '/client/templates',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    section: 'Communications',
    label: 'Message Logs',
    path: '/client/communications',
    icon: <Mail className="w-4 h-4" />,
  },

  // ── PLATFORM ──────────────────────────────────────────────────────────────
  {
    section: 'Platform',
    label: 'Reports',
    path: '/client/reports',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    section: 'Platform',
    label: 'Orders',
    path: '/client/orders',
    icon: <ShoppingCart className="w-4 h-4" />,
  },
  {
    section: 'Platform',
    label: 'Integrations',
    path: '/client/integrations',
    icon: <Zap className="w-4 h-4" />,
  },
  {
    section: 'Platform',
    label: 'Widgets & Embed',
    path: '/client/widgets',
    icon: <Sparkles className="w-4 h-4" />,
  },

  // ── ACCOUNT ───────────────────────────────────────────────────────────────
  {
    section: 'Account',
    label: 'Settings',
    path: '/client/settings',
    icon: <Settings className="w-4 h-4" />,
  },
  {
    section: 'Account',
    label: 'Plan & Billing',
    path: '/client/billing',
    icon: <CreditCard className="w-4 h-4" />,
  },
];

