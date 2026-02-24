/**
 * Unified Widget Rendering API
 * Shopify 2024-2025 Compliant
 *
 * Single endpoint for ALL widget types
 * Handles: floating, product_banner, announcement_bar, thankyou_card, cart_drawer, membership_portal
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WidgetRenderRequest {
  widget_type: string;
  widget_id: string;
  shop?: string;
  customer_id?: string;
  page_context?: any;
  order_id?: string;
  cart_value?: number;
  cart_line_count?: number;
  product_id?: string;
  customer_email?: string;
  order_total?: number;
}

interface WidgetRenderResponse {
  should_render: boolean;
  ui_payload?: any;
  redeem_url?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData: WidgetRenderRequest = await req.json();
    const {
      widget_type,
      widget_id,
      shop,
      customer_id,
      page_context,
      order_id,
      cart_value,
      cart_line_count,
      product_id,
      customer_email,
      order_total
    } = requestData;

    // Validate request
    if (!widget_type || !widget_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch widget configuration
    const { data: widget, error: widgetError } = await supabase
      .from('shopify_widgets')
      .select('*, clients!inner(id, name)')
      .eq('id', widget_id)
      .eq('is_enabled', true)
      .maybeSingle();

    if (widgetError || !widget) {
      return new Response(
        JSON.stringify({ should_render: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to appropriate handler
    let response: WidgetRenderResponse;

    switch (widget_type) {
      case 'floating':
        response = await handleFloatingWidget(supabase, widget, customer_id);
        break;
      case 'product_banner':
        response = await handleProductBanner(supabase, widget, product_id, customer_id);
        break;
      case 'announcement_bar':
        response = await handleAnnouncementBar(supabase, widget, customer_id);
        break;
      case 'thankyou_card':
        response = await handleThankYouCard(supabase, widget, order_id, customer_email, order_total);
        break;
      case 'cart_drawer':
        response = await handleCartDrawer(supabase, widget, customer_id, cart_value);
        break;
      case 'membership_portal':
        response = await handleMembershipPortal(supabase, widget, customer_id);
        break;
      default:
        response = { should_render: false };
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Widget render error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', should_render: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleFloatingWidget(supabase: any, widget: any, customerId?: string): Promise<WidgetRenderResponse> {
  // Check if customer has unclaimed rewards
  if (!customerId) {
    return { should_render: false };
  }

  const { data: rewards, error } = await supabase
    .from('reward_allocations')
    .select('rewards(name, description)')
    .eq('member_id', customerId)
    .eq('status', 'allocated')
    .limit(1)
    .maybeSingle();

  if (error || !rewards) {
    return { should_render: false };
  }

  return {
    should_render: true,
    ui_payload: {
      title: widget.settings?.title || 'You have rewards!',
      description: widget.settings?.description || rewards.rewards.description || 'Click to claim your exclusive rewards',
    },
    redeem_url: widget.settings?.redeem_url || '/apps/rewards'
  };
}

async function handleProductBanner(supabase: any, widget: any, productId?: string, customerId?: string): Promise<WidgetRenderResponse> {
  // Show banner if customer has active membership or available rewards
  const showBanner = widget.settings?.always_show || false;

  if (!showBanner && !customerId) {
    return { should_render: false };
  }

  return {
    should_render: true,
    ui_payload: {
      title: widget.settings?.title || 'Exclusive Member Rewards',
      description: widget.settings?.description || 'Purchase this product and unlock special benefits',
    },
    redeem_url: widget.settings?.cta_url || '/apps/rewards'
  };
}

async function handleAnnouncementBar(supabase: any, widget: any, customerId?: string): Promise<WidgetRenderResponse> {
  // Check if announcement should be shown
  const settings = widget.settings || {};

  // Check date range if configured
  if (settings.start_date) {
    const startDate = new Date(settings.start_date);
    if (new Date() < startDate) {
      return { should_render: false };
    }
  }

  if (settings.end_date) {
    const endDate = new Date(settings.end_date);
    if (new Date() > endDate) {
      return { should_render: false };
    }
  }

  return {
    should_render: true,
    ui_payload: {
      message: settings.message || 'Join our rewards program and get exclusive benefits!',
    },
    redeem_url: settings.cta_url || '/apps/rewards'
  };
}

async function handleThankYouCard(supabase: any, widget: any, orderId?: string, customerEmail?: string, orderTotal?: number): Promise<WidgetRenderResponse> {
  if (!orderId || !customerEmail) {
    return { should_render: false };
  }

  // Check if order qualifies for reward based on campaign rules
  // This is where you'd implement your reward allocation logic

  // For now, show if order total meets minimum (if configured)
  const minOrderValue = widget.settings?.min_order_value || 0;

  if (orderTotal && orderTotal < minOrderValue) {
    return { should_render: false };
  }

  // Check if customer has membership program
  const { data: member } = await supabase
    .from('members')
    .select('id, membership_programs(name)')
    .eq('email', customerEmail)
    .eq('client_id', widget.client_id)
    .maybeSingle();

  if (!member) {
    // Offer enrollment
    return {
      should_render: true,
      ui_payload: {
        title: 'Thank you for your purchase!',
        description: 'Join our rewards program and start earning benefits on future orders.',
        cta_text: 'Join Now',
      },
      redeem_url: `/apps/rewards/enroll?email=${encodeURIComponent(customerEmail)}`
    };
  }

  // Show reward claim
  return {
    should_render: true,
    ui_payload: {
      title: "You've earned a reward!",
      description: 'Thank you for your purchase. Your exclusive reward is ready to claim.',
      reward_details: {
        title: widget.settings?.reward_title || 'Member Bonus',
        description: widget.settings?.reward_description || 'Special offer for valued members',
      },
      cta_text: 'Claim Your Reward',
      instructions: 'Visit your rewards portal to view and redeem your reward.',
    },
    redeem_url: `/apps/rewards/claim?order=${orderId}`
  };
}

async function handleCartDrawer(supabase: any, widget: any, customerId?: string, cartValue?: number): Promise<WidgetRenderResponse> {
  if (!customerId) {
    return { should_render: false };
  }

  // Check available rewards
  const { data: allocations, error } = await supabase
    .from('reward_allocations')
    .select('rewards(name, description, value)')
    .eq('member_id', customerId)
    .eq('status', 'allocated')
    .limit(1)
    .maybeSingle();

  if (error || !allocations) {
    return { should_render: false };
  }

  return {
    should_render: true,
    ui_payload: {
      title: 'Rewards Available!',
      description: 'You have exclusive rewards waiting',
      reward_preview: {
        title: allocations.rewards.name,
        description: allocations.rewards.description,
      },
      cta_text: 'View My Rewards',
      footer_text: 'Complete checkout to earn more rewards'
    },
    redeem_url: '/apps/rewards'
  };
}

async function handleMembershipPortal(supabase: any, widget: any, customerId?: string): Promise<WidgetRenderResponse> {
  // Portal always renders - actual content loaded on portal page
  return {
    should_render: true,
    ui_payload: {
      title: 'Member Portal',
      description: 'Access your rewards, vouchers, and membership benefits',
    },
    redeem_url: '/apps/rewards'
  };
}
