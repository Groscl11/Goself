import { LayoutDashboard, Award, Gift, Ticket, Settings, Coins, UserPlus } from 'lucide-react';

export const memberMenuItems = [
  {
    label: 'Dashboard',
    path: '/member',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'My Memberships',
    path: '/member/memberships',
    icon: <Award className="w-5 h-5" />,
  },
  {
    label: 'Loyalty Points',
    path: '/member/loyalty-points',
    icon: <Coins className="w-5 h-5" />,
  },
  {
    label: 'Refer a Friend',
    path: '/member/refer',
    icon: <UserPlus className="w-5 h-5" />,
  },
  {
    label: 'Available Rewards',
    path: '/member/rewards',
    icon: <Gift className="w-5 h-5" />,
  },
  {
    label: 'My Vouchers',
    path: '/member/vouchers',
    icon: <Ticket className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    path: '/member/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];
