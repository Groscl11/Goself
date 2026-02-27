import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleBasedRoute } from './components/RoleBasedRoute';
import { PublicRoute } from './components/PublicRoute';
import { Login } from './pages/Login';
import ShopifyCallback from './pages/auth/ShopifyCallback';
import { Signup } from './pages/Signup';
import { ClientRegistration } from './pages/public/ClientRegistration';
import { ProgramDiscovery } from './pages/public/ProgramDiscovery';
import { RewardRedemption } from './pages/public/RewardRedemption';
import ClaimReward from './pages/public/ClaimReward';
import RedeemRewards from './pages/public/RedeemRewards';
import { SelectRewards } from './pages/public/SelectRewards';
import { RedemptionSuccess } from './pages/public/RedemptionSuccess';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminRewards } from './pages/admin/AdminRewards';
import { AdminBrands } from './pages/admin/AdminBrands';
import { BrandDetail } from './pages/admin/BrandDetail';
import { BrandForm } from './pages/admin/BrandForm';
import { AdminClients } from './pages/admin/AdminClients';
import { ClientDetail } from './pages/admin/ClientDetail';
import { ClientForm } from './pages/admin/ClientForm';
import { AdminUsers } from './pages/admin/AdminUsers';
import { UserDetail } from './pages/admin/UserDetail';
import { UserForm } from './pages/admin/UserForm';
import { RewardAllocations } from './pages/admin/RewardAllocations';
import Transactions from './pages/admin/Transactions';
import { MembershipPrograms } from './pages/admin/MembershipPrograms';
import { MembershipProgramForm } from './pages/admin/MembershipProgramForm';
import { CampaignRules } from './pages/admin/CampaignRules';
import { AdminOrders } from './pages/admin/AdminOrders';
import { ClientDashboard } from './pages/client/ClientDashboard';
import { Members } from './pages/client/Members';
import { MemberDetail } from './pages/client/MemberDetail';
import { MemberForm } from './pages/client/MemberForm';
import { ImportMembers } from './pages/client/ImportMembers';
import LoyaltyProgram from './pages/client/LoyaltyProgram';
import { RewardsMarketplace } from './pages/client/RewardsMarketplace';
import { MembershipManagement } from './pages/client/MembershipManagement';
import { CreateMembershipProgram } from './pages/client/CreateMembershipProgram';
import { ClientRewards } from './pages/client/ClientRewards';
import { Integrations } from './pages/client/Integrations';
import { Reports } from './pages/client/Reports';
import { MessageTemplates } from './pages/client/MessageTemplates';
import CommunicationLogs from './pages/client/CommunicationLogs';
import { Campaigns } from './pages/client/Campaigns';
import { CampaignsAdvanced } from './pages/client/CampaignsAdvanced';
import { CampaignWizard } from './pages/client/CampaignWizard';
import CampaignTriggerLogs from './pages/client/CampaignTriggerLogs';
import { Settings as ClientSettings } from './pages/client/Settings';
import { Orders } from './pages/client/Orders';
import { ShopifyWidgets } from './pages/client/ShopifyWidgets';
import WidgetManagement from './pages/client/WidgetManagement';
import WidgetConfigurations from './pages/client/WidgetConfigurations';
import { TokenizedLinks } from './pages/client/TokenizedLinks';
import { BrandDashboard } from './pages/brand/BrandDashboard';
import { BrandRewards } from './pages/brand/BrandRewards';
import { BrandRewardForm } from './pages/brand/BrandRewardForm';
import { BrandVouchers } from './pages/brand/BrandVouchers';
import { BrandAnalytics } from './pages/brand/BrandAnalytics';
import { BrandDirectory } from './pages/brand/BrandDirectory';
import { BrandProfileView } from './pages/brand/BrandProfileView';
import { BrandCollaborations } from './pages/brand/BrandCollaborations';
import { MemberPortal } from './pages/member/MemberPortal';
import { MemberMemberships } from './pages/member/MemberMemberships';
import { MemberRewards } from './pages/member/MemberRewards';
import { MemberVouchers } from './pages/member/MemberVouchers';
import { MemberSettings } from './pages/member/MemberSettings';
import MemberLoyaltyPoints from './pages/member/LoyaltyPoints';
import { AdminSettings } from './pages/admin/AdminSettings';
import { BrandSettings } from './pages/brand/BrandSettings';
import { LoyaltyMembers } from './pages/client/LoyaltyMembers';
import { LoyaltyTransactions } from './pages/client/LoyaltyTransactions';
import { ReferralTracking } from './pages/client/ReferralTracking';
import { LoyaltyConfiguration } from './pages/client/LoyaltyConfiguration';
import { ReferFriend } from './pages/member/ReferFriend';
import { StoreInstallations } from './pages/admin/StoreInstallations';

function DashboardRouter() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  switch (profile.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'client':
      return <Navigate to="/client" replace />;
    case 'brand':
      return <Navigate to="/brand" replace />;
    case 'member':
      return <Navigate to="/member" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/shopify-callback" element={<ShopifyCallback />} />
          <Route path="/join/:clientSlug" element={<PublicRoute><ClientRegistration /></PublicRoute>} />
          <Route path="/join/:clientSlug/programs" element={<ProgramDiscovery />} />
          <Route path="/redeem" element={<RewardRedemption />} />
          <Route path="/redeem/:token" element={<RedeemRewards />} />
          <Route path="/claim/:token" element={<ClaimReward />} />
          <Route path="/claim-rewards" element={<SelectRewards />} />
          <Route path="/redemption-success" element={<RedemptionSuccess />} />

          <Route path="/admin" element={<RoleBasedRoute allowedRoles={['admin']}><AdminDashboard /></RoleBasedRoute>} />
          <Route path="/admin/store-installations" element={<RoleBasedRoute allowedRoles={['admin']}><StoreInstallations /></RoleBasedRoute>} />
          <Route path="/admin/rewards" element={<RoleBasedRoute allowedRoles={['admin']}><AdminRewards /></RoleBasedRoute>} />
          <Route path="/admin/rewards/allocations" element={<RoleBasedRoute allowedRoles={['admin']}><RewardAllocations /></RoleBasedRoute>} />
          <Route path="/admin/transactions" element={<RoleBasedRoute allowedRoles={['admin']}><Transactions /></RoleBasedRoute>} />
          <Route path="/admin/membership-programs" element={<RoleBasedRoute allowedRoles={['admin']}><MembershipPrograms /></RoleBasedRoute>} />
          <Route path="/admin/membership-programs/:id" element={<RoleBasedRoute allowedRoles={['admin']}><MembershipProgramForm /></RoleBasedRoute>} />
          <Route path="/admin/campaign-rules" element={<RoleBasedRoute allowedRoles={['admin']}><CampaignRules /></RoleBasedRoute>} />
          <Route path="/admin/orders" element={<RoleBasedRoute allowedRoles={['admin']}><AdminOrders /></RoleBasedRoute>} />
          <Route path="/admin/brands" element={<RoleBasedRoute allowedRoles={['admin']}><AdminBrands /></RoleBasedRoute>} />
          <Route path="/admin/brands/new" element={<RoleBasedRoute allowedRoles={['admin']}><BrandForm /></RoleBasedRoute>} />
          <Route path="/admin/brands/:id" element={<RoleBasedRoute allowedRoles={['admin']}><BrandDetail /></RoleBasedRoute>} />
          <Route path="/admin/brands/:id/edit" element={<RoleBasedRoute allowedRoles={['admin']}><BrandForm /></RoleBasedRoute>} />
          <Route path="/admin/clients" element={<RoleBasedRoute allowedRoles={['admin']}><AdminClients /></RoleBasedRoute>} />
          <Route path="/admin/clients/new" element={<RoleBasedRoute allowedRoles={['admin']}><ClientForm /></RoleBasedRoute>} />
          <Route path="/admin/clients/:id" element={<RoleBasedRoute allowedRoles={['admin']}><ClientDetail /></RoleBasedRoute>} />
          <Route path="/admin/clients/:id/edit" element={<RoleBasedRoute allowedRoles={['admin']}><ClientForm /></RoleBasedRoute>} />
          <Route path="/admin/users" element={<RoleBasedRoute allowedRoles={['admin']}><AdminUsers /></RoleBasedRoute>} />
          <Route path="/admin/users/new" element={<RoleBasedRoute allowedRoles={['admin']}><UserForm /></RoleBasedRoute>} />
          <Route path="/admin/users/:id" element={<RoleBasedRoute allowedRoles={['admin']}><UserDetail /></RoleBasedRoute>} />
          <Route path="/admin/users/:id/edit" element={<RoleBasedRoute allowedRoles={['admin']}><UserForm /></RoleBasedRoute>} />
          <Route path="/admin/settings" element={<RoleBasedRoute allowedRoles={['admin']}><AdminSettings /></RoleBasedRoute>} />
          <Route path="/client" element={<RoleBasedRoute allowedRoles={['client']}><ClientDashboard /></RoleBasedRoute>} />
          <Route path="/client/programs" element={<RoleBasedRoute allowedRoles={['client']}><MembershipManagement /></RoleBasedRoute>} />
          <Route path="/client/programs/new" element={<RoleBasedRoute allowedRoles={['client']}><CreateMembershipProgram /></RoleBasedRoute>} />
          <Route path="/client/membership-programs/:id/edit" element={<RoleBasedRoute allowedRoles={['client']}><CreateMembershipProgram /></RoleBasedRoute>} />
          <Route path="/client/members" element={<RoleBasedRoute allowedRoles={['client']}><Members /></RoleBasedRoute>} />
          <Route path="/client/members/new" element={<RoleBasedRoute allowedRoles={['client']}><MemberForm /></RoleBasedRoute>} />
          <Route path="/client/members/import" element={<RoleBasedRoute allowedRoles={['client']}><ImportMembers /></RoleBasedRoute>} />
          <Route path="/client/members/:id" element={<RoleBasedRoute allowedRoles={['client']}><MemberDetail /></RoleBasedRoute>} />
          <Route path="/client/members/:id/edit" element={<RoleBasedRoute allowedRoles={['client']}><MemberForm /></RoleBasedRoute>} />
          <Route path="/client/loyalty-points" element={<RoleBasedRoute allowedRoles={['client']}><LoyaltyProgram /></RoleBasedRoute>} />
          <Route path="/client/loyalty-members" element={<RoleBasedRoute allowedRoles={['client']}><LoyaltyMembers /></RoleBasedRoute>} />
          <Route path="/client/loyalty-transactions" element={<RoleBasedRoute allowedRoles={['client']}><LoyaltyTransactions /></RoleBasedRoute>} />
          <Route path="/client/referral-tracking" element={<RoleBasedRoute allowedRoles={['client']}><ReferralTracking /></RoleBasedRoute>} />
          <Route path="/client/loyalty-config" element={<RoleBasedRoute allowedRoles={['client']}><LoyaltyConfiguration /></RoleBasedRoute>} />
          <Route path="/client/my-rewards" element={<RoleBasedRoute allowedRoles={['client']}><ClientRewards /></RoleBasedRoute>} />
          <Route path="/client/rewards" element={<RoleBasedRoute allowedRoles={['client']}><RewardsMarketplace /></RoleBasedRoute>} />
          <Route path="/client/campaigns" element={<RoleBasedRoute allowedRoles={['client']}><Campaigns /></RoleBasedRoute>} />
          <Route path="/client/campaigns-advanced" element={<RoleBasedRoute allowedRoles={['client']}><CampaignsAdvanced /></RoleBasedRoute>} />
          <Route path="/client/campaigns/new" element={<RoleBasedRoute allowedRoles={['client']}><CampaignWizard /></RoleBasedRoute>} />
          <Route path="/client/campaign-logs" element={<RoleBasedRoute allowedRoles={['client']}><CampaignTriggerLogs /></RoleBasedRoute>} />
          <Route path="/client/templates" element={<RoleBasedRoute allowedRoles={['client']}><MessageTemplates /></RoleBasedRoute>} />
          <Route path="/client/communications" element={<RoleBasedRoute allowedRoles={['client']}><CommunicationLogs /></RoleBasedRoute>} />
          <Route path="/client/integrations" element={<RoleBasedRoute allowedRoles={['client']}><Integrations /></RoleBasedRoute>} />
          <Route path="/client/orders" element={<RoleBasedRoute allowedRoles={['client']}><Orders /></RoleBasedRoute>} />
          <Route path="/client/widgets" element={<RoleBasedRoute allowedRoles={['client']}><ShopifyWidgets /></RoleBasedRoute>} />
          <Route path="/client/extensions" element={<RoleBasedRoute allowedRoles={['client']}><WidgetManagement /></RoleBasedRoute>} />
          <Route path="/client/widget-configs" element={<RoleBasedRoute allowedRoles={['client']}><WidgetConfigurations /></RoleBasedRoute>} />
          <Route path="/client/tokenized-links" element={<RoleBasedRoute allowedRoles={['client']}><TokenizedLinks /></RoleBasedRoute>} />
          <Route path="/client/reports" element={<RoleBasedRoute allowedRoles={['client']}><Reports /></RoleBasedRoute>} />
          <Route path="/client/settings" element={<RoleBasedRoute allowedRoles={['client']}><ClientSettings /></RoleBasedRoute>} />
          <Route path="/brand" element={<RoleBasedRoute allowedRoles={['brand']}><BrandDashboard /></RoleBasedRoute>} />
          <Route path="/brand/rewards" element={<RoleBasedRoute allowedRoles={['brand']}><BrandRewards /></RoleBasedRoute>} />
          <Route path="/brand/rewards/new" element={<RoleBasedRoute allowedRoles={['brand']}><BrandRewardForm /></RoleBasedRoute>} />
          <Route path="/brand/vouchers" element={<RoleBasedRoute allowedRoles={['brand']}><BrandVouchers /></RoleBasedRoute>} />
          <Route path="/brand/directory" element={<RoleBasedRoute allowedRoles={['brand']}><BrandDirectory /></RoleBasedRoute>} />
          <Route path="/brand/directory/:id" element={<RoleBasedRoute allowedRoles={['brand']}><BrandProfileView /></RoleBasedRoute>} />
          <Route path="/brand/collaborations" element={<RoleBasedRoute allowedRoles={['brand']}><BrandCollaborations /></RoleBasedRoute>} />
          <Route path="/brand/analytics" element={<RoleBasedRoute allowedRoles={['brand']}><BrandAnalytics /></RoleBasedRoute>} />
          <Route path="/brand/settings" element={<RoleBasedRoute allowedRoles={['brand']}><BrandSettings /></RoleBasedRoute>} />
          <Route path="/member" element={<RoleBasedRoute allowedRoles={['member']}><MemberPortal /></RoleBasedRoute>} />
          <Route path="/member/memberships" element={<RoleBasedRoute allowedRoles={['member']}><MemberMemberships /></RoleBasedRoute>} />
          <Route path="/member/rewards" element={<RoleBasedRoute allowedRoles={['member']}><MemberRewards /></RoleBasedRoute>} />
          <Route path="/member/loyalty-points" element={<RoleBasedRoute allowedRoles={['member']}><MemberLoyaltyPoints /></RoleBasedRoute>} />
          <Route path="/member/refer" element={<RoleBasedRoute allowedRoles={['member']}><ReferFriend /></RoleBasedRoute>} />
          <Route path="/member/vouchers" element={<RoleBasedRoute allowedRoles={['member']}><MemberVouchers /></RoleBasedRoute>} />
          <Route path="/member/settings" element={<RoleBasedRoute allowedRoles={['member']}><MemberSettings /></RoleBasedRoute>} />

          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/unauthorized" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Unauthorized</h1>
                <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
                <a href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
                  Go to Dashboard
                </a>
              </div>
            </div>
          } />

          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">404 - Not Found</h1>
                <p className="text-gray-600 mb-6">The page you're looking for doesn't exist.</p>
                <a href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
                  Go to Dashboard
                </a>
              </div>
            </div>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
