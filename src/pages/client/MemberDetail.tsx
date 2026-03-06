import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  ArrowLeft, Mail, Phone, Calendar, Award, Gift, CheckCircle, Clock, Tag,
  Coins, ShoppingBag, Edit2, User, Briefcase, HeartHandshake, X,
  PlusCircle, MinusCircle, TrendingUp, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';

interface MemberData {
  id: string;
  client_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  metadata: Record<string, any>;
  gender: string | null;
  date_of_birth: string | null;
  anniversary_date: string | null;
  occupation: string | null;
  corporate_email: string | null;
}

interface MemberSource {
  source_type: string;
  created_at: string;
}

interface Membership {
  id: string;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  program: { name: string };
}

interface RewardAllocation {
  id: string;
  quantity_allocated: number;
  quantity_redeemed: number;
  allocated_at: string;
  expires_at: string | null;
  reward: { title: string };
}

interface Voucher {
  id: string;
  code: string;
  status: string;
  expires_at: string | null;
  redeemed_at: string | null;
  reward: { title: string };
}

interface Redemption {
  id: string;
  redeemed_at: string;
  redemption_channel: string;
  redemption_location: string | null;
  reward: { title: string };
  voucher: { code: string };
}

interface LoyaltyStatus {
  id: string;
  loyalty_program_id: string;
  points_balance: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  total_orders: number;
  total_spend: number;
}

interface PointsTxn {
  id: string;
  created_at: string;
  transaction_type: string;
  points_amount: number;
  balance_after: number;
  description: string;
  order_amount: number | null;
  metadata: Record<string, any>;
}

interface Order {
  id: string;
  order_id: string;
  order_number: string | null;
  total_price: number | null;
  currency: string;
  order_status: string | null;
  processed_at: string | null;
  created_at: string;
}

type TabKey = 'memberships' | 'rewards' | 'vouchers' | 'points' | 'orders' | 'transactions' | 'history';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  revoked: 'bg-gray-100 text-gray-800',
  available: 'bg-blue-100 text-blue-800',
  redeemed: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  paid: 'bg-emerald-100 text-emerald-800',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
      statusColors[status] ?? 'bg-gray-100 text-gray-800'
    }`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

function isExpired(d: string | null) { return d ? new Date(d) < new Date() : false; }
function isExpiringSoon(d: string | null) {
  if (!d) return false;
  const days = Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
  return days > 0 && days <= 7;
}
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }

function EmptyState({ text }: { text: string }) {
  return <p className="text-center text-gray-400 py-10">{text}</p>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [member, setMember] = useState<MemberData | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [allocations, setAllocations] = useState<RewardAllocation[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loyaltyStatuses, setLoyaltyStatuses] = useState<LoyaltyStatus[]>([]);
  const [pointsTxns, setPointsTxns] = useState<PointsTxn[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [memberSource, setMemberSource] = useState<MemberSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('memberships');

  // Edit profile modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MemberData>>({});
  const [editSaving, setEditSaving] = useState(false);

  // Adjust points modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustStatusId, setAdjustStatusId] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [
        memberRes, membershipRes, allocRes, voucherRes,
        redemptionRes, txnRes, sourceRes, lsRes, pointsRes, ordersRes,
      ] = await Promise.all([
        supabase.from('member_users').select('*').eq('id', id).maybeSingle(),
        supabase.from('member_memberships').select('*, program:membership_programs(name)').eq('member_id', id).order('created_at', { ascending: false }),
        supabase.from('member_rewards_allocation').select('*, reward:rewards(title)').eq('member_id', id).order('allocated_at', { ascending: false }),
        supabase.from('vouchers').select('*, reward:rewards(title)').eq('member_id', id).order('created_at', { ascending: false }),
        supabase.from('redemptions').select('*, reward:rewards(title), voucher:vouchers(code)').eq('member_id', id).order('redeemed_at', { ascending: false }),
        supabase.from('transaction_summary_view').select('*').eq('member_id', id).order('transaction_date', { ascending: false }),
        supabase.from('member_sources').select('*').eq('member_id', id).order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('member_loyalty_status').select('*, program:loyalty_programs(name)').eq('member_user_id', id).order('created_at', { ascending: false }),
        supabase.from('loyalty_points_transactions').select('*').eq('member_user_id', id).order('created_at', { ascending: false }).limit(200),
        supabase.from('shopify_orders').select('id, order_id, order_number, total_price, currency, order_status, processed_at, created_at').eq('member_id', id).order('created_at', { ascending: false }),
      ]);

      if (memberRes.error || !memberRes.data) { navigate('/client/members'); return; }

      setMember(memberRes.data);
      setMemberships(membershipRes.data ?? []);
      setAllocations(allocRes.data ?? []);
      setVouchers(voucherRes.data ?? []);
      setRedemptions(redemptionRes.data ?? []);
      setTransactions(txnRes.data ?? []);
      setMemberSource(sourceRes.data ?? null);
      setLoyaltyStatuses((lsRes.data ?? []) as LoyaltyStatus[]);
      setPointsTxns((pointsRes.data ?? []) as PointsTxn[]);
      setOrders((ordersRes.data ?? []) as Order[]);

      const ls = lsRes.data;
      if (ls && ls.length > 0) setAdjustStatusId(ls[0].id);
    } catch (err) {
      console.error('Error loading member:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const totalPointsBalance = loyaltyStatuses.reduce((s, ls) => s + (ls.points_balance ?? 0), 0);
  const totalLifetimePts = loyaltyStatuses.reduce((s, ls) => s + (ls.lifetime_points_earned ?? 0), 0);
  const availableVouchers = vouchers.filter((v) => v.status === 'available').length;

  // ─── Edit Profile ───────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!member) return;
    setEditForm({
      full_name: member.full_name,
      email: member.email,
      phone: member.phone ?? '',
      gender: member.gender ?? '',
      date_of_birth: member.date_of_birth ?? '',
      anniversary_date: member.anniversary_date ?? '',
      occupation: member.occupation ?? '',
      corporate_email: member.corporate_email ?? '',
    });
    setEditOpen(true);
  };

  const saveProfile = async () => {
    if (!member || !id) return;
    setEditSaving(true);
    const { error } = await supabase.from('member_users').update({
      full_name: editForm.full_name,
      phone: editForm.phone || null,
      gender: editForm.gender || null,
      date_of_birth: editForm.date_of_birth || null,
      anniversary_date: editForm.anniversary_date || null,
      occupation: editForm.occupation || null,
      corporate_email: editForm.corporate_email || null,
    }).eq('id', id);
    setEditSaving(false);
    if (!error) { setMember({ ...member, ...editForm } as MemberData); setEditOpen(false); }
  };

  // ─── Adjust Points ──────────────────────────────────────────────────────────
  const submitAdjustment = async () => {
    setAdjustError('');
    const amt = parseInt(adjustAmount, 10);
    if (!amt || amt <= 0) { setAdjustError('Enter a valid positive amount.'); return; }
    if (!adjustReason.trim()) { setAdjustError('Please provide a reason.'); return; }
    if (!adjustStatusId) { setAdjustError('No loyalty program found for this member.'); return; }

    setAdjustSaving(true);
    const statusRecord = loyaltyStatuses.find((ls) => ls.id === adjustStatusId);
    if (!statusRecord) { setAdjustError('Loyalty status record not found.'); setAdjustSaving(false); return; }

    const pointsDelta = adjustType === 'credit' ? amt : -amt;
    const newBalance = (statusRecord.points_balance ?? 0) + pointsDelta;

    const [txnRes, updateRes] = await Promise.all([
      supabase.from('loyalty_points_transactions').insert({
        member_loyalty_status_id: adjustStatusId,
        member_user_id: id,
        transaction_type: 'adjusted',
        points_amount: pointsDelta,
        balance_after: newBalance,
        description: adjustReason.trim(),
        metadata: { adjusted_by: 'client_admin', adjustment_type: adjustType },
      }),
      supabase.from('member_loyalty_status').update({ points_balance: newBalance }).eq('id', adjustStatusId),
    ]);

    setAdjustSaving(false);
    if (txnRes.error || updateRes.error) {
      setAdjustError('Failed to save adjustment. Please try again.');
    } else {
      setAdjustOpen(false);
      setAdjustAmount('');
      setAdjustReason('');
      loadAll();
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'memberships', label: 'Memberships' },
    { key: 'rewards', label: 'Rewards' },
    { key: 'vouchers', label: 'Vouchers' },
    { key: 'points', label: 'Loyalty Points' },
    { key: 'orders', label: 'Orders' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'history', label: 'History' },
  ];

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Member Details">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!member) {
    return (
      <DashboardLayout menuItems={clientMenuItems} title="Member Details">
        <div className="max-w-7xl mx-auto text-center py-12 text-gray-500">Member not found.</div>
      </DashboardLayout>
    );
  }

  const initials = (member.full_name || 'M').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Member Details">
      <div className="max-w-7xl mx-auto space-y-6">

        <Button variant="ghost" onClick={() => navigate('/client/members')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Members
        </Button>

        {/* ── Profile Card ── */}
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {initials}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{member.full_name || 'N/A'}</h1>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <StatusBadge status={member.is_active ? 'active' : 'inactive'} />
                      {memberSource && (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                          memberSource.source_type === 'campaign' ? 'bg-purple-100 text-purple-700' :
                          memberSource.source_type === 'import' ? 'bg-blue-100 text-blue-700' :
                          memberSource.source_type === 'organic' ? 'bg-green-100 text-green-700' :
                          memberSource.source_type === 'referral' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          <Tag className="w-3 h-3" />
                          {memberSource.source_type.charAt(0).toUpperCase() + memberSource.source_type.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" onClick={openEdit} className="flex items-center gap-2 flex-shrink-0">
                    <Edit2 className="w-4 h-4" /> Edit Profile
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                  {[
                    { icon: <Mail className="w-4 h-4 text-gray-400" />, label: 'Email', value: member.email },
                    { icon: <Phone className="w-4 h-4 text-gray-400" />, label: 'Phone', value: member.phone || '—' },
                    { icon: <User className="w-4 h-4 text-gray-400" />, label: 'Gender', value: member.gender || '—' },
                    { icon: <Calendar className="w-4 h-4 text-gray-400" />, label: 'Date of Birth', value: fmt(member.date_of_birth) },
                    { icon: <HeartHandshake className="w-4 h-4 text-gray-400" />, label: 'Anniversary', value: fmt(member.anniversary_date) },
                    { icon: <Briefcase className="w-4 h-4 text-gray-400" />, label: 'Occupation', value: member.occupation || '—' },
                    { icon: <Mail className="w-4 h-4 text-gray-400" />, label: 'Corporate Email', value: member.corporate_email || '—' },
                    { icon: <Calendar className="w-4 h-4 text-gray-400" />, label: 'Joined', value: fmt(member.created_at) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      {item.icon}
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className="font-medium text-gray-800 truncate">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: <Coins className="w-6 h-6 text-amber-600" />, bg: 'bg-amber-50', label: 'Points Balance', value: totalPointsBalance.toLocaleString() },
            { icon: <TrendingUp className="w-6 h-6 text-blue-600" />, bg: 'bg-blue-50', label: 'Lifetime Pts', value: totalLifetimePts.toLocaleString() },
            { icon: <Award className="w-6 h-6 text-purple-600" />, bg: 'bg-purple-50', label: 'Memberships', value: memberships.length },
            { icon: <Clock className="w-6 h-6 text-green-600" />, bg: 'bg-green-50', label: 'Active Vouchers', value: availableVouchers },
            { icon: <CheckCircle className="w-6 h-6 text-orange-600" />, bg: 'bg-orange-50', label: 'Redemptions', value: redemptions.length },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.bg}`}>{s.icon}</div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Card>
          <div className="border-b border-gray-200 px-6 overflow-x-auto">
            <div className="flex gap-1 -mb-px min-w-max">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === t.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <CardContent className="pt-6">

            {/* Memberships */}
            {activeTab === 'memberships' && (
              <div className="space-y-3">
                {memberships.length === 0 ? <EmptyState text="No memberships assigned" /> : memberships.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-900">{m.program.name}</p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-500">
                        {m.activated_at && <span>Activated: {fmt(m.activated_at)}</span>}
                        {m.expires_at && (
                          <span className={isExpired(m.expires_at) ? 'text-red-600 font-medium' : isExpiringSoon(m.expires_at) ? 'text-orange-600 font-medium' : ''}>
                            Expires: {fmt(m.expires_at)}{isExpired(m.expires_at) && ' (Expired)'}{isExpiringSoon(m.expires_at) && ' (Soon)'}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            )}

            {/* Rewards */}
            {activeTab === 'rewards' && (
              <div className="space-y-3">
                {allocations.length === 0 ? <EmptyState text="No rewards allocated" /> : allocations.map((a) => (
                  <div key={a.id} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{a.reward.title}</p>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          <span>Allocated: {a.quantity_allocated}</span>
                          <span>Redeemed: {a.quantity_redeemed}</span>
                          <span className="text-green-600 font-medium">Available: {a.quantity_allocated - a.quantity_redeemed}</span>
                          {a.expires_at && <span className={isExpired(a.expires_at) ? 'text-red-600 font-medium' : ''}>Expires: {fmt(a.expires_at)}</span>}
                        </div>
                      </div>
                      <Gift className="w-5 h-5 text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Vouchers */}
            {activeTab === 'vouchers' && (
              <div className="space-y-3">
                {vouchers.length === 0 ? <EmptyState text="No vouchers issued" /> : vouchers.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-900">{v.reward.title}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{v.code}</span>
                        {v.expires_at && (
                          <span className={isExpired(v.expires_at) ? 'text-red-600 font-medium' : isExpiringSoon(v.expires_at) ? 'text-orange-600 font-medium' : ''}>
                            {isExpired(v.expires_at) ? `Expired ${fmt(v.expires_at)}` : `Expires ${fmt(v.expires_at)}`}
                          </span>
                        )}
                        {v.redeemed_at && <span>Redeemed: {fmt(v.redeemed_at)}</span>}
                      </div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                ))}
              </div>
            )}

            {/* Loyalty Points */}
            {activeTab === 'points' && (
              <div className="space-y-6">
                {loyaltyStatuses.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loyaltyStatuses.map((ls) => (
                      <div key={ls.id} className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
                        <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">
                          {(ls as any).program?.name ?? 'Loyalty Program'}
                        </p>
                        <p className="text-3xl font-bold text-amber-700">{ls.points_balance.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-1">pts balance</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-600">
                          <span>Earned: {ls.lifetime_points_earned.toLocaleString()}</span>
                          <span>Redeemed: {ls.lifetime_points_redeemed.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => { setAdjustError(''); setAdjustOpen(true); }} className="flex items-center gap-2">
                    <Coins className="w-4 h-4" /> Adjust Points
                  </Button>
                </div>
                {pointsTxns.length === 0 ? <EmptyState text="No points transactions yet" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Date', 'Type', 'Points', 'Balance After', 'Description'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pointsTxns.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{fmt(t.created_at)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                t.transaction_type === 'earned' ? 'bg-green-100 text-green-700' :
                                t.transaction_type === 'redeemed' ? 'bg-orange-100 text-orange-700' :
                                t.transaction_type === 'adjusted' ? 'bg-blue-100 text-blue-700' :
                                t.transaction_type === 'bonus' ? 'bg-purple-100 text-purple-700' :
                                'bg-red-100 text-red-700'
                              }`}>{t.transaction_type}</span>
                            </td>
                            <td className={`px-4 py-3 font-semibold ${t.points_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {t.points_amount > 0 ? '+' : ''}{t.points_amount}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium">{t.balance_after}</td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Orders */}
            {activeTab === 'orders' && (
              <div>
                {orders.length === 0 ? <EmptyState text="No orders found for this member" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Order #', 'Date', 'Total', 'Currency', 'Status'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {orders.map((o) => (
                          <tr key={o.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-gray-800">#{o.order_number ?? o.order_id}</td>
                            <td className="px-4 py-3 text-gray-600">{fmt(o.processed_at ?? o.created_at)}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900">{o.total_price != null ? o.total_price.toFixed(2) : '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{o.currency}</td>
                            <td className="px-4 py-3">{o.order_status ? <StatusBadge status={o.order_status} /> : <span className="text-gray-400">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Transactions */}
            {activeTab === 'transactions' && (
              <div>
                {transactions.length === 0 ? <EmptyState text="No transaction history" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Date', 'Type', 'Reward', 'Brand', 'Voucher', 'Status', 'Value'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transactions.map((t) => (
                          <tr key={t.transaction_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{fmt(t.transaction_date)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${t.transaction_type === 'issued' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                {t.transaction_type}
                              </span>
                            </td>
                            <td className="px-4 py-3"><p className="font-medium text-gray-900">{t.reward_title}</p><p className="text-xs text-gray-400">{t.reward_code}</p></td>
                            <td className="px-4 py-3 text-gray-700">{t.brand_name}</td>
                            <td className="px-4 py-3 font-mono text-gray-800">{t.voucher_code}</td>
                            <td className="px-4 py-3"><StatusBadge status={t.voucher_status ?? 'unknown'} /></td>
                            <td className="px-4 py-3 text-gray-700">{t.discount_value ? `${t.discount_value} ${t.currency}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {redemptions.length === 0 ? <EmptyState text="No redemption history" /> : redemptions.map((r) => (
                  <div key={r.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-900">{r.reward.title}</p>
                      <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-500">
                        <span>Code: <span className="font-mono">{r.voucher.code}</span></span>
                        <span>Channel: {r.redemption_channel}</span>
                        {r.redemption_location && <span>Location: {r.redemption_location}</span>}
                        <span>{new Date(r.redeemed_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* ── Edit Profile Modal ── */}
      {editOpen && (
        <Modal title="Edit Member Profile" onClose={() => setEditOpen(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'full_name', label: 'Full Name', type: 'text' },
              { key: 'phone', label: 'Phone', type: 'tel' },
              { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
              { key: 'anniversary_date', label: 'Anniversary Date', type: 'date' },
              { key: 'occupation', label: 'Occupation', type: 'text' },
              { key: 'corporate_email', label: 'Corporate Email', type: 'email' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={String((editForm as any)[f.key] ?? '')}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={editForm.gender ?? ''}
                onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not specified</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveProfile} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </Modal>
      )}

      {/* ── Adjust Points Modal ── */}
      {adjustOpen && (
        <Modal title="Adjust Loyalty Points" onClose={() => setAdjustOpen(false)}>
          {loyaltyStatuses.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">This member has no active loyalty program. Points cannot be adjusted.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {loyaltyStatuses.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loyalty Program</label>
                  <select
                    value={adjustStatusId}
                    onChange={(e) => setAdjustStatusId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {loyaltyStatuses.map((ls) => (
                      <option key={ls.id} value={ls.id}>
                        {(ls as any).program?.name ?? ls.loyalty_program_id} — {ls.points_balance} pts
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {adjustStatusId && (() => {
                const ls = loyaltyStatuses.find((l) => l.id === adjustStatusId);
                return ls ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-700">Current balance: <strong>{ls.points_balance.toLocaleString()} pts</strong></span>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adjustment Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAdjustType('credit')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                      adjustType === 'credit' ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" /> Add Points
                  </button>
                  <button
                    onClick={() => setAdjustType('debit')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                      adjustType === 'debit' ? 'bg-red-600 border-red-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <MinusCircle className="w-4 h-4" /> Debit Points
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points Amount</label>
                <input
                  type="number" min="1" value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Note</label>
                <textarea
                  rows={2} value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Goodwill adjustment, correction, birthday bonus…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {adjustError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {adjustError}
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            {loyaltyStatuses.length > 0 && (
              <Button onClick={submitAdjustment} disabled={adjustSaving} className={adjustType === 'debit' ? 'bg-red-600 hover:bg-red-700' : ''}>
                {adjustSaving ? 'Saving…' : adjustType === 'credit' ? 'Add Points' : 'Debit Points'}
              </Button>
            )}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
