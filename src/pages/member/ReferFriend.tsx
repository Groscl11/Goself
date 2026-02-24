import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { UserPlus, Copy, Check, Gift, Users, TrendingUp, Share2, Mail, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { memberMenuItems } from './memberMenuItems';

interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  total_points_earned: number;
  referral_link: string;
}

interface Referral {
  id: string;
  referred_email: string;
  referred_phone: string;
  status: string;
  points_awarded: number;
  created_at: string;
  completed_at: string;
}

export function ReferFriend() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [memberId, setMemberId] = useState<string>('');
  const [pointsPerReferral, setPointsPerReferral] = useState(100);

  useEffect(() => {
    loadMemberData();
  }, []);

  useEffect(() => {
    if (memberId) {
      loadReferralStats();
      loadReferrals();
    }
  }, [memberId]);

  const loadMemberData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberUser } = await supabase
        .from('member_users')
        .select('id, client_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (memberUser) {
        setMemberId(memberUser.id);

        const { data: earningRule } = await supabase
          .from('loyalty_program_earning_rules')
          .select('points_awarded')
          .eq('rule_type', 'referral_complete')
          .limit(1)
          .maybeSingle();

        if (earningRule) {
          setPointsPerReferral(earningRule.points_awarded);
        }
      }
    } catch (error) {
      console.error('Error loading member data:', error);
    }
  };

  const loadReferralStats = async () => {
    try {
      setLoading(true);

      const { data: loyaltyStatus } = await supabase
        .from('member_loyalty_status')
        .select('referral_code, referral_points_earned')
        .eq('member_user_id', memberId)
        .maybeSingle();

      if (loyaltyStatus) {
        const { data: referralsData } = await supabase
          .from('member_referrals')
          .select('id, status')
          .eq('referrer_member_id', memberId);

        const totalReferrals = referralsData?.length || 0;
        const completedReferrals = referralsData?.filter(r => r.status === 'completed').length || 0;
        const pendingReferrals = referralsData?.filter(r => r.status === 'pending').length || 0;

        const referralLink = `${window.location.origin}/register?ref=${loyaltyStatus.referral_code}`;

        setStats({
          referral_code: loyaltyStatus.referral_code,
          total_referrals: totalReferrals,
          completed_referrals: completedReferrals,
          pending_referrals: pendingReferrals,
          total_points_earned: loyaltyStatus.referral_points_earned || 0,
          referral_link: referralLink,
        });
      }
    } catch (error) {
      console.error('Error loading referral stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from('member_referrals')
        .select('*')
        .eq('referrer_member_id', memberId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReferrals(data || []);
    } catch (error) {
      console.error('Error loading referrals:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaEmail = () => {
    const subject = 'Join me and get rewards!';
    const body = `I thought you'd love this! Join using my referral link and we both get rewards:\n\n${stats?.referral_link}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const shareViaSMS = () => {
    const message = `Join me and get rewards! Use my link: ${stats?.referral_link}`;
    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
  };

  const shareViaWhatsApp = () => {
    const message = `Join me and get rewards! Use my link: ${stats?.referral_link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={memberMenuItems} title="Refer a Friend">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!stats) {
    return (
      <DashboardLayout menuItems={memberMenuItems} title="Refer a Friend">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Referral Program Not Available</h3>
              <p className="text-gray-600">The referral program is not set up for your account yet.</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={memberMenuItems} title="Refer a Friend">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Refer a Friend</h1>
          <p className="text-gray-600 mt-1">Share your unique link and earn rewards together</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Referrals</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_referrals}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed_referrals}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{stats.pending_referrals}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Points Earned</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_points_earned}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Gift className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">Earn {pointsPerReferral} Points Per Referral</h2>
                <p className="text-blue-100 mb-6">
                  Share your unique referral link with friends. When they sign up and make their first purchase, you both get rewards!
                </p>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-100 mb-2">Your Referral Link</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={stats.referral_link}
                      readOnly
                      className="flex-1 px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                    <Button
                      onClick={() => copyToClipboard(stats.referral_link)}
                      className="bg-white text-blue-600 hover:bg-blue-50"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={shareViaEmail}
                    className="bg-white/20 hover:bg-white/30 border border-white/30"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Share via Email
                  </Button>
                  <Button
                    onClick={shareViaSMS}
                    className="bg-white/20 hover:bg-white/30 border border-white/30"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Share via SMS
                  </Button>
                  <Button
                    onClick={shareViaWhatsApp}
                    className="bg-white/20 hover:bg-white/30 border border-white/30"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share via WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Share2 className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">1. Share Your Link</h3>
                <p className="text-sm text-gray-600">
                  Copy your unique referral link and share it with friends via email, SMS, or social media
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">2. Friend Signs Up</h3>
                <p className="text-sm text-gray-600">
                  Your friend clicks your link and creates an account using your referral code
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">3. Both Get Rewards</h3>
                <p className="text-sm text-gray-600">
                  When your friend makes their first purchase, you both earn points automatically
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {referrals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {referral.referred_email || referral.referred_phone || 'Pending signup'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Referred on {new Date(referral.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {referral.status === 'completed' && (
                        <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                          <Check className="w-4 h-4" />
                          +{referral.points_awarded} points
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          referral.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : referral.status === 'pending'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {referral.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <TrendingUp className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Pro Tip</h3>
                <p className="text-gray-700">
                  The more friends you refer, the more points you earn! There's no limit to how many friends you can invite.
                  Share your link on social media for even better results.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
