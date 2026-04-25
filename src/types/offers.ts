// ─── Offers & Rewards Types ────────────────────────────────────────────────
// Based on GoSelf DB schema. rewards table = offer definitions.
// offer_distributions = per-client points config.
// offer_codes = the actual code pool.

export type OfferType = 'store_discount' | 'partner_voucher' | 'marketplace_offer';
export type CodeSource = 'shopify_generated' | 'shopify_imported' | 'csv_uploaded';
export type CouponType = 'unique' | 'generic';
export type TrackingType = 'automatic' | 'manual';
export type RewardType = 'flat_discount' | 'percentage_discount' | 'free_item' | 'upto_discount' | 'fixed_value' | 'other';
export type OfferStatus = 'draft' | 'active' | 'paused' | 'exhausted' | 'expired';
export type AccessType = 'points_redemption' | 'campaign_reward' | 'free_claim' | 'both';
export type CodeStatus = 'available' | 'assigned' | 'redeemed' | 'expired' | 'revoked';

export interface Offer {
  id: string;
  reward_id?: string;
  title: string;
  description?: string;
  steps_to_redeem?: string;
  image_url?: string;
  terms_conditions?: string;
  redemption_link?: string;
  offer_type: OfferType;
  code_source?: CodeSource;
  coupon_type: CouponType;
  generic_coupon_code?: string;
  tracking_type: TrackingType;
  reward_type: RewardType;
  discount_value?: number;
  max_discount_value?: number;
  min_purchase_amount?: number;
  currency: string;
  is_marketplace: boolean;
  is_active: boolean;
  status: OfferStatus;
  available_codes: number;
  total_codes_uploaded: number;
  owner_client_id?: string;
  client_id?: string;
  brand_id?: string;
  valid_until?: string;
  tags?: string[];
  redeems_at_shop_domain?: string;
  created_at: string;
  updated_at?: string;
  // joined
  offer_distributions?: OfferDistribution[];
  offer_codes?: { status: CodeStatus }[];
  owner_client?: { name: string };
}

export interface OfferDistribution {
  id: string;
  offer_id: string;
  distributing_client_id: string;
  access_type: AccessType;
  points_cost: number | null;
  max_per_member: number;
  max_total_issuances: number | null;
  current_issuances: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // joined
  offer?: Offer;
}

export interface OfferCode {
  id: string;
  offer_id: string;
  distribution_id?: string;
  code?: string;
  status: CodeStatus;
  assigned_to_member_id?: string;
  assigned_at?: string;
  assignment_channel?: string;
  distributed_by_client_id?: string;
  redeemed_at?: string;
  redemption_source?: string;
  shopify_synced: boolean;
  expires_at?: string;
  created_at: string;
}

export interface MarketplaceOffer extends Offer {
  already_adopted: boolean;
  my_points_cost: number | null;
  issuer_name?: string;
  issuer_logo?: string;
}

// ─── Form types for creating offers ────────────────────────────────────────

export interface CreateStoreOfferForm {
  title: string;
  description: string;
  reward_type: RewardType;
  discount_value: number;
  min_purchase_amount: number;
  coupon_type: CouponType;
  generic_coupon_code: string;
  codes_to_generate: number;
  code_input: string; // newline-separated for import
  valid_until: string;
  code_source: CodeSource;
}

export interface CreatePartnerVoucherForm {
  // Step 1
  partner_name: string;
  category: string;
  terms_conditions: string;
  // Step 2
  coupon_type: CouponType;
  generic_coupon_code: string;
  csv_codes: string[];
  valid_until: string;
  // Step 3
  points_cost: number;
  max_per_member: number;
  access_type: AccessType;
}

export interface AdoptOfferForm {
  offer_id: string;
  access_type: AccessType;
  points_cost: number;
  max_per_member: number;
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  store_discount: 'Store Offer',
  partner_voucher: 'Partner Voucher',
  marketplace_offer: 'Marketplace Offer',
};

export const CODE_SOURCE_LABELS: Record<CodeSource, string> = {
  shopify_generated: 'Generate via Shopify',
  shopify_imported: 'Import from Shopify',
  csv_uploaded: 'Upload Codes',
};

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  points_redemption: 'Points redemption',
  campaign_reward: 'Campaign only',
  free_claim: 'Free claim',
  both: 'Points + Campaign',
};

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  flat_discount: 'Flat discount',
  percentage_discount: 'Percentage discount',
  free_item: 'Free item',
  upto_discount: 'Up to discount',
  fixed_value: 'Fixed value',
  other: 'Other',
};

export const PARTNER_CATEGORIES = [
  'Food & Drink',
  'Fashion',
  'Lifestyle',
  'Health & Fitness',
  'Entertainment',
  'Travel',
  'Electronics',
  'Other',
];
