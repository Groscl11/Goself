import { LayoutDashboard, Gift, CheckCircle, BarChart3, Users, Handshake, Settings } from 'lucide-react';

export const brandMenuItems = [
  { label: 'Dashboard', path: '/brand', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'My Rewards', path: '/brand/rewards', icon: <Gift className="w-5 h-5" /> },
  { label: 'Voucher Tracking', path: '/brand/vouchers', icon: <CheckCircle className="w-5 h-5" /> },
  { label: 'Brand Directory', path: '/brand/directory', icon: <Users className="w-5 h-5" /> },
  { label: 'Collaborations', path: '/brand/collaborations', icon: <Handshake className="w-5 h-5" /> },
  { label: 'Analytics', path: '/brand/analytics', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Settings', path: '/brand/settings', icon: <Settings className="w-5 h-5" /> },
];
