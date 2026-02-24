/**
 * Widget Script Loader
 * Returns JavaScript code that initializes the loyalty widget
 * Called as: <script src="...widget-script?shop=example.myshopify.com">
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shop = url.searchParams.get('shop');

    if (!shop) {
      return new Response('// Error: shop parameter required', {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/javascript',
        }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get widget configuration for this shop
    const { data: installation } = await supabase
      .from('store_installations')
      .select('id, client_id, shop_domain')
      .eq('shop_domain', shop)
      .eq('installation_status', 'active')
      .maybeSingle();

    if (!installation) {
      return new Response('// Store not found or inactive', {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/javascript',
        }
      });
    }

    // Get widget configurations
    const { data: configs } = await supabase
      .from('widget_configurations')
      .select('*')
      .eq('client_id', installation.client_id)
      .eq('is_active', true);

    const config = configs && configs.length > 0 ? configs[0] : {
      widget_position: 'bottom-right',
      primary_color: '#667eea',
      secondary_color: '#764ba2',
      show_on_all_pages: true,
      auto_popup: false,
      popup_delay_seconds: 3
    };

    // Generate the widget JavaScript
    const widgetScript = generateWidgetScript(shop, installation.client_id, config);

    return new Response(widgetScript, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('Widget script error:', error);
    return new Response(`// Error loading widget: ${error.message}`, {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript',
      }
    });
  }
});

function generateWidgetScript(shop: string, clientId: string, config: any): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  return `
(function() {
  'use strict';

  // RewardHub Loyalty Widget
  // Shop: ${shop}

  var RewardHub = window.RewardHub || {};

  // Configuration
  RewardHub.config = {
    shop: '${shop}',
    clientId: '${clientId}',
    apiUrl: '${supabaseUrl}/functions/v1',
    position: '${config.widget_position || 'bottom-right'}',
    primaryColor: '${config.primary_color || '#667eea'}',
    secondaryColor: '${config.secondary_color || '#764ba2'}',
    autoPopup: ${config.auto_popup || false},
    popupDelay: ${config.popup_delay_seconds || 3},
    showOnAllPages: ${config.show_on_all_pages !== false}
  };

  // Create widget container
  RewardHub.createWidget = function() {
    if (document.getElementById('rewardhub-widget-container')) {
      return; // Already created
    }

    var container = document.createElement('div');
    container.id = 'rewardhub-widget-container';
    container.style.cssText = 'position: fixed; z-index: 999999; ' + RewardHub.getPositionStyles();

    // Create floating button
    var button = document.createElement('button');
    button.id = 'rewardhub-widget-button';
    button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
    button.style.cssText = 'width: 60px; height: 60px; border-radius: 50%; border: none; background: linear-gradient(135deg, ' + RewardHub.config.primaryColor + ' 0%, ' + RewardHub.config.secondaryColor + ' 100%); color: white; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; display: flex; align-items: center; justify-content: center;';

    button.onmouseover = function() {
      this.style.transform = 'scale(1.1)';
    };
    button.onmouseout = function() {
      this.style.transform = 'scale(1)';
    };
    button.onclick = function() {
      RewardHub.openPanel();
    };

    container.appendChild(button);
    document.body.appendChild(container);

    // Auto popup if configured
    if (RewardHub.config.autoPopup && !RewardHub.hasSeenPopup()) {
      setTimeout(function() {
        RewardHub.openPanel();
        RewardHub.markPopupSeen();
      }, RewardHub.config.popupDelay * 1000);
    }
  };

  RewardHub.getPositionStyles = function() {
    var position = RewardHub.config.position;
    switch(position) {
      case 'bottom-left':
        return 'bottom: 20px; left: 20px;';
      case 'top-right':
        return 'top: 20px; right: 20px;';
      case 'top-left':
        return 'top: 20px; left: 20px;';
      default: // bottom-right
        return 'bottom: 20px; right: 20px;';
    }
  };

  RewardHub.openPanel = function() {
    // Create modal panel
    if (document.getElementById('rewardhub-modal')) {
      document.getElementById('rewardhub-modal').style.display = 'flex';
      return;
    }

    var modal = document.createElement('div');
    modal.id = 'rewardhub-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000000; display: flex; align-items: center; justify-content: center;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background: white; border-radius: 16px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);';

    // Load content via iframe or fetch
    var iframe = document.createElement('iframe');
    iframe.src = '${supabaseUrl}/functions/v1/widget-rewards-portal?shop=${shop}&customer_email=' + encodeURIComponent(RewardHub.getCustomerEmail());
    iframe.style.cssText = 'width: 100%; height: 600px; border: none; border-radius: 16px;';

    panel.appendChild(iframe);
    modal.appendChild(panel);

    modal.onclick = function(e) {
      if (e.target === modal) {
        RewardHub.closePanel();
      }
    };

    document.body.appendChild(modal);
  };

  RewardHub.closePanel = function() {
    var modal = document.getElementById('rewardhub-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  RewardHub.getCustomerEmail = function() {
    // Try to get from Shopify customer object
    if (typeof Shopify !== 'undefined' && Shopify.customer) {
      return Shopify.customer.email || '';
    }
    return '';
  };

  RewardHub.hasSeenPopup = function() {
    return localStorage.getItem('rewardhub_popup_seen') === 'true';
  };

  RewardHub.markPopupSeen = function() {
    localStorage.setItem('rewardhub_popup_seen', 'true');
  };

  // Initialize widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', RewardHub.createWidget);
  } else {
    RewardHub.createWidget();
  }

  // Public API
  window.RewardHub = RewardHub;

  RewardHub.init = function(options) {
    if (options) {
      Object.assign(RewardHub.config, options);
    }
    RewardHub.createWidget();
  };

  RewardHub.show = function() {
    var container = document.getElementById('rewardhub-widget-container');
    if (container) container.style.display = 'block';
  };

  RewardHub.hide = function() {
    var container = document.getElementById('rewardhub-widget-container');
    if (container) container.style.display = 'none';
  };

  RewardHub.refresh = function() {
    // Refresh widget data
    console.log('RewardHub: Refreshing widget data');
  };

  RewardHub.isRegistered = function() {
    return RewardHub.getCustomerEmail() !== '';
  };

  RewardHub.getPoints = function() {
    return fetch(RewardHub.config.apiUrl + '/get-loyalty-status?shop=' + RewardHub.config.shop + '&email=' + encodeURIComponent(RewardHub.getCustomerEmail()))
      .then(function(res) { return res.json(); })
      .then(function(data) { return data.points || 0; });
  };

  console.log('RewardHub Widget loaded for ${shop}');
})();
`;
}
