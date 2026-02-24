# Rewardhub

A comprehensive membership rewards platform that connects clients, brands, and members in a scalable ecosystem. Built with React, TypeScript, Supabase, and Tailwind CSS.

## Features

### Core Functionality

- **Multi-Role Authentication**: Support for Admin, Client, Brand, and Member roles with role-based access control
- **Client Dashboard**: Manage membership programs, members, and rewards
- **Member Management**: Comprehensive member profiles with detailed tracking of memberships, rewards, vouchers, and redemption history
- **Rewards Marketplace**: Centralized marketplace where clients can select rewards from multiple brands
- **Brand Portal**: Brands can submit and manage their rewards, track performance
- **Member Portal**: End-users can view their memberships, available rewards, and vouchers
- **Voucher System**: Automated voucher generation and expiry tracking
- **Redemption Tracking**: Complete history of all reward redemptions
- **E-commerce Integration**: Framework for integrating with platforms like Shopify (ready for implementation)

### Key Features by Role

#### Admin
- Manage all clients and brands
- Approve brand applications
- Oversee rewards marketplace
- Platform-wide analytics
- User management

#### Client
- Create and manage membership programs
- Define program rules (validity, reward limits, eligibility)
- Browse and select rewards from marketplace
- Upload custom rewards
- Import member data via CSV
- View detailed member profiles including:
  - Active memberships
  - Allocated rewards
  - Available and redeemed vouchers
  - Complete redemption history
  - Expiry tracking with warnings
- Integration management (Shopify, WooCommerce, etc.)
- Analytics and reporting

#### Brand
- Submit rewards to marketplace
- Manage voucher inventory
- Track reward performance
- View redemption analytics
- Monitor approval status

#### Member
- View active memberships
- Access available rewards
- View voucher wallet
- Track redemption history
- Receive expiry notifications

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Routing**: React Router v7
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React

## Database Schema

The platform uses a comprehensive database schema with the following key tables:

- `profiles` - User profiles with role assignments
- `clients` - Client organizations
- `brands` - Brand entities
- `rewards` - Reward catalog
- `membership_programs` - Client-created programs
- `member_users` - End-user members
- `member_memberships` - Membership assignments
- `member_rewards_allocation` - Reward allocations to members
- `vouchers` - Unique voucher codes with expiry tracking
- `redemptions` - Complete redemption history
- `integration_configs` - E-commerce platform configurations
- `automation_rules` - Rules for automatic reward assignment

All tables include Row Level Security (RLS) policies for multi-tenant data isolation.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase project set up
- Environment variables configured

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. The database schema has already been created via migrations

4. (Optional) Seed demo data by running the SQL in `seed-demo-data.sql` in your Supabase SQL Editor

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## User Roles and Access

### Creating Your First Admin User

1. Sign up through the application (`/signup`)
2. Select "Client" as the account type (you can change this later)
3. In Supabase, update your profile:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### Creating a Client User

1. Admin creates a client organization in the admin dashboard
2. User signs up with role "Client"
3. Admin assigns the user to the client organization:
```sql
UPDATE profiles SET client_id = 'client_uuid' WHERE email = 'client@email.com';
```

### Creating a Brand User

1. User signs up with role "Brand"
2. Admin creates a brand entity and assigns it to the user
3. Update the profile:
```sql
UPDATE profiles SET brand_id = 'brand_uuid' WHERE email = 'brand@email.com';
```

## Member Management

The member management system provides comprehensive tracking:

### Member Profile View

Each member profile displays:
- **Overview Stats**: Total memberships, allocated rewards, available vouchers, redemptions
- **Memberships Tab**: All assigned memberships with status and expiry dates
- **Rewards Tab**: Allocated rewards with quantity tracking and expiry warnings
- **Vouchers Tab**: All vouchers (available, redeemed, expired) with codes and expiry dates
- **History Tab**: Complete redemption history with dates, channels, and locations

### Expiry Tracking

- **Color-coded warnings**: Visual indicators for items expiring within 7 days
- **Expired indicators**: Clear marking of expired items
- **Status badges**: Quick status identification (Active, Expired, Available, Redeemed)

### Member Data Import

Clients can import member data via:
1. CSV upload (coming soon)
2. Direct API integration with e-commerce platforms (framework ready)

## E-commerce Integration

### Shopify Integration (OAuth 2.0) ✅ COMPLETE

**Status:** Production-ready OAuth 2.0 integration with automatic webhook registration

**Features:**
- ✅ One-click OAuth connection
- ✅ Automatic webhook registration (orders/create, orders/paid, customers/create)
- ✅ Real-time order synchronization
- ✅ HMAC signature verification
- ✅ Webhook event logging and tracking
- ✅ Secure credential management

**Setup Documentation:**

📚 **Start Here:** [`SHOPIFY_INTEGRATION_INDEX.md`](./SHOPIFY_INTEGRATION_INDEX.md) - Documentation index

**Quick Links:**
- 🚀 **First-time setup:** [`SHOPIFY_APP_SETUP_COMPLETE_GUIDE.md`](./SHOPIFY_APP_SETUP_COMPLETE_GUIDE.md)
- ⚡ **Quick start:** [`SHOPIFY_OAUTH_QUICK_START.md`](./SHOPIFY_OAUTH_QUICK_START.md)
- 🔗 **URL reference:** [`SHOPIFY_URL_REFERENCE.md`](./SHOPIFY_URL_REFERENCE.md)
- 🔧 **Technical details:** [`SHOPIFY_OAUTH_REFACTOR.md`](./SHOPIFY_OAUTH_REFACTOR.md)

**Merchant Experience:**
1. Click "Connect Shopify Store"
2. Enter shop domain
3. Approve permissions on Shopify
4. Redirected back → Connected ✅

**Time to Connect:** 30 seconds (vs 5+ minutes with manual setup)

### Other Platforms

**WooCommerce:** Framework ready (not yet implemented)
**Custom Integrations:** API endpoints available

### Integration Database Schema

- `integration_configs` - OAuth credentials and connection status
- `shopify_webhook_events` - Webhook event logging and processing
- `shopify_orders` - Synchronized order data
- Automatic reward allocation via triggers

## Roadmap

### Phase 1 (Current)
- [x] Core authentication and role-based access
- [x] Admin, Client, Brand, Member dashboards
- [x] Member management with detailed tracking
- [x] Voucher and redemption system
- [x] Database schema with RLS
- [x] **Shopify OAuth 2.0 integration** ✅ **NEW**

### Phase 2 (Next)
- [ ] Rewards marketplace browsing interface
- [ ] Membership program builder with drag-and-drop
- [ ] CSV member import functionality
- [ ] Custom reward creation for clients
- [ ] Bulk voucher management

### Phase 3
- [ ] WooCommerce integration (Shopify ✅ complete)
- [ ] Enhanced automation rules engine
- [ ] Email notification system with Edge Functions
- [ ] Advanced reporting and analytics
- [ ] Scheduled jobs for expiry management

### Phase 4
- [ ] Mobile app (React Native)
- [ ] QR code redemption
- [ ] Member self-service portal enhancements
- [ ] White-label options for clients
- [ ] API for third-party integrations

## Security

- Row Level Security (RLS) enabled on all tables
- Multi-tenant data isolation
- Role-based access control throughout the application
- Secure authentication with Supabase Auth
- Input validation and sanitization
- Encrypted sensitive data storage

## Contributing

This is a production-ready foundation that can be extended with additional features as needed.

## Support

For questions or issues, please refer to the inline code documentation or create an issue in your repository.

## License

Proprietary - All rights reserved
