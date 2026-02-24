export type UserRole = 'admin' | 'client' | 'brand' | 'member';
export type BrandStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type RewardStatus = 'draft' | 'pending' | 'active' | 'inactive' | 'expired';
export type MembershipStatus = 'active' | 'expired' | 'revoked' | 'pending';
export type VoucherStatus = 'available' | 'redeemed' | 'expired' | 'revoked';
export type IntegrationPlatform = 'shopify' | 'woocommerce' | 'custom';
export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          email: string;
          client_id: string | null;
          brand_id: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name?: string;
          email: string;
          client_id?: string | null;
          brand_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string;
          email?: string;
          client_id?: string | null;
          brand_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          name: string;
          description: string;
          logo_url: string | null;
          primary_color: string;
          contact_email: string;
          contact_phone: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          logo_url?: string | null;
          primary_color?: string;
          contact_email: string;
          contact_phone?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          logo_url?: string | null;
          primary_color?: string;
          contact_email?: string;
          contact_phone?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      brands: {
        Row: {
          id: string;
          name: string;
          description: string;
          logo_url: string | null;
          website_url: string | null;
          status: BrandStatus;
          contact_email: string;
          contact_phone: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          logo_url?: string | null;
          website_url?: string | null;
          status?: BrandStatus;
          contact_email: string;
          contact_phone?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          logo_url?: string | null;
          website_url?: string | null;
          status?: BrandStatus;
          contact_email?: string;
          contact_phone?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      rewards: {
        Row: {
          id: string;
          brand_id: string;
          client_id: string | null;
          title: string;
          description: string;
          terms_conditions: string;
          value_description: string;
          image_url: string | null;
          category: string;
          status: RewardStatus;
          is_marketplace: boolean;
          voucher_count: number;
          redeemed_count: number;
          expiry_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          client_id?: string | null;
          title: string;
          description?: string;
          terms_conditions?: string;
          value_description?: string;
          image_url?: string | null;
          category?: string;
          status?: RewardStatus;
          is_marketplace?: boolean;
          voucher_count?: number;
          redeemed_count?: number;
          expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          client_id?: string | null;
          title?: string;
          description?: string;
          terms_conditions?: string;
          value_description?: string;
          image_url?: string | null;
          category?: string;
          status?: RewardStatus;
          is_marketplace?: boolean;
          voucher_count?: number;
          redeemed_count?: number;
          expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      membership_programs: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          description: string;
          validity_days: number;
          max_rewards_total: number | null;
          max_rewards_per_brand: number | null;
          auto_renew: boolean;
          eligibility_criteria: Record<string, any>;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          description?: string;
          validity_days?: number;
          max_rewards_total?: number | null;
          max_rewards_per_brand?: number | null;
          auto_renew?: boolean;
          eligibility_criteria?: Record<string, any>;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          name?: string;
          description?: string;
          validity_days?: number;
          max_rewards_total?: number | null;
          max_rewards_per_brand?: number | null;
          auto_renew?: boolean;
          eligibility_criteria?: Record<string, any>;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      membership_program_rewards: {
        Row: {
          id: string;
          program_id: string;
          reward_id: string;
          quantity_limit: number | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          reward_id: string;
          quantity_limit?: number | null;
          added_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          reward_id?: string;
          quantity_limit?: number | null;
          added_at?: string;
        };
      };
      member_users: {
        Row: {
          id: string;
          client_id: string;
          auth_user_id: string | null;
          email: string;
          full_name: string;
          phone: string;
          external_id: string | null;
          metadata: Record<string, any>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          auth_user_id?: string | null;
          email: string;
          full_name?: string;
          phone?: string;
          external_id?: string | null;
          metadata?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          auth_user_id?: string | null;
          email?: string;
          full_name?: string;
          phone?: string;
          external_id?: string | null;
          metadata?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      member_memberships: {
        Row: {
          id: string;
          member_id: string;
          program_id: string;
          status: MembershipStatus;
          activated_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          program_id: string;
          status?: MembershipStatus;
          activated_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          program_id?: string;
          status?: MembershipStatus;
          activated_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      member_rewards_allocation: {
        Row: {
          id: string;
          member_id: string;
          membership_id: string;
          reward_id: string;
          quantity_allocated: number;
          quantity_redeemed: number;
          allocated_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          member_id: string;
          membership_id: string;
          reward_id: string;
          quantity_allocated?: number;
          quantity_redeemed?: number;
          allocated_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          member_id?: string;
          membership_id?: string;
          reward_id?: string;
          quantity_allocated?: number;
          quantity_redeemed?: number;
          allocated_at?: string;
          expires_at?: string | null;
        };
      };
      vouchers: {
        Row: {
          id: string;
          reward_id: string;
          member_id: string | null;
          allocation_id: string | null;
          code: string;
          status: VoucherStatus;
          expires_at: string | null;
          redeemed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reward_id: string;
          member_id?: string | null;
          allocation_id?: string | null;
          code: string;
          status?: VoucherStatus;
          expires_at?: string | null;
          redeemed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reward_id?: string;
          member_id?: string | null;
          allocation_id?: string | null;
          code?: string;
          status?: VoucherStatus;
          expires_at?: string | null;
          redeemed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      redemptions: {
        Row: {
          id: string;
          voucher_id: string;
          member_id: string;
          reward_id: string;
          redemption_channel: string;
          redemption_location: string | null;
          redemption_metadata: Record<string, any>;
          redeemed_at: string;
        };
        Insert: {
          id?: string;
          voucher_id: string;
          member_id: string;
          reward_id: string;
          redemption_channel?: string;
          redemption_location?: string | null;
          redemption_metadata?: Record<string, any>;
          redeemed_at?: string;
        };
        Update: {
          id?: string;
          voucher_id?: string;
          member_id?: string;
          reward_id?: string;
          redemption_channel?: string;
          redemption_location?: string | null;
          redemption_metadata?: Record<string, any>;
          redeemed_at?: string;
        };
      };
      integration_configs: {
        Row: {
          id: string;
          client_id: string;
          platform: IntegrationPlatform;
          platform_name: string;
          credentials: Record<string, any>;
          webhook_url: string | null;
          sync_frequency_minutes: number;
          last_sync_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          platform: IntegrationPlatform;
          platform_name: string;
          credentials?: Record<string, any>;
          webhook_url?: string | null;
          sync_frequency_minutes?: number;
          last_sync_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          platform?: IntegrationPlatform;
          platform_name?: string;
          credentials?: Record<string, any>;
          webhook_url?: string | null;
          sync_frequency_minutes?: number;
          last_sync_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_sync_log: {
        Row: {
          id: string;
          integration_id: string;
          external_order_id: string;
          order_data: Record<string, any>;
          sync_status: SyncStatus;
          error_message: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          integration_id: string;
          external_order_id: string;
          order_data?: Record<string, any>;
          sync_status?: SyncStatus;
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          integration_id?: string;
          external_order_id?: string;
          order_data?: Record<string, any>;
          sync_status?: SyncStatus;
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
      };
      automation_rules: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          description: string;
          trigger_type: string;
          conditions: Record<string, any>;
          action_type: string;
          action_config: Record<string, any>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          description?: string;
          trigger_type?: string;
          conditions?: Record<string, any>;
          action_type: string;
          action_config?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          name?: string;
          description?: string;
          trigger_type?: string;
          conditions?: Record<string, any>;
          action_type?: string;
          action_config?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
