import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { clientMenuItems } from './clientMenuItems';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  Code
} from 'lucide-react';

interface WidgetConfig {
  id: string;
  client_id: string;
  widget_type: string;
  widget_name: string;
  is_enabled: boolean;
  shopify_store_domain: string | null;
  widget_settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface WidgetType {
  type: string;
  name: string;
  description: string;
  extensionType: 'theme' | 'checkout';
  defaultSettings: Record<string, any>;
}

const widgetTypes: WidgetType[] = [
  {
    type: 'announcement_bar',
    name: 'Announcement Bar',
    description: 'Header notification bar for rewards messaging',
    extensionType: 'theme',
    defaultSettings: {
      message: 'Join our rewards program and get exclusive benefits!',
      cta_text: 'Learn More',
      dismissible: true
    }
  },
  {
    type: 'floating_widget',
    name: 'Floating Widget',
    description: 'Floating button for quick rewards access',
    extensionType: 'theme',
    defaultSettings: {
      position: 'bottom-right',
      enabled: true
    }
  },
  {
    type: 'product_banner',
    name: 'Product Banner',
    description: 'Rewards banner on product pages',
    extensionType: 'theme',
    defaultSettings: {
      title: 'Get Exclusive Rewards!',
      description: 'Purchase this product and unlock special member benefits',
      cta_text: 'Learn More'
    }
  },
  {
    type: 'cart_rewards',
    name: 'Cart Rewards',
    description: 'Rewards messaging in cart',
    extensionType: 'checkout',
    defaultSettings: {
      position: 'top'
    }
  },
  {
    type: 'thankyou_card',
    name: 'Thank You Card',
    description: 'Reward card on order confirmation page',
    extensionType: 'checkout',
    defaultSettings: {}
  }
];

export default function WidgetManagement() {
  const { profile } = useAuth();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScriptModal, setShowScriptModal] = useState<WidgetConfig | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [customSettings, setCustomSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchWidgets();
  }, [profile]);

  const fetchWidgets = async () => {
    if (!profile?.client_id) return;

    const { data, error } = await supabase
      .from('widget_configurations')
      .select('*')
      .eq('client_id', profile.client_id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setWidgets(data);
    }
    setLoading(false);
  };

  const createWidget = async (widgetType: WidgetType) => {
    if (!profile?.client_id) return;

    const { error } = await supabase
      .from('widget_configurations')
      .insert({
        client_id: profile.client_id,
        widget_type: widgetType.type,
        widget_name: widgetType.name,
        is_enabled: true,
        widget_settings: widgetType.defaultSettings
      });

    if (!error) {
      fetchWidgets();
      setShowCreateModal(false);
    }
  };

  const toggleWidget = async (widget: WidgetConfig) => {
    const { error } = await supabase
      .from('widget_configurations')
      .update({ is_enabled: !widget.is_enabled })
      .eq('id', widget.id);

    if (!error) {
      fetchWidgets();
    }
  };

  const deleteWidget = async (widgetId: string) => {
    if (!confirm('Are you sure you want to delete this widget configuration?')) return;

    const { error } = await supabase
      .from('widget_configurations')
      .delete()
      .eq('id', widgetId);

    if (!error) {
      fetchWidgets();
    }
  };

  const openEditModal = (widget: WidgetConfig) => {
    setEditingWidget(widget);
    setCustomSettings(widget.widget_settings || {});
  };

  const updateWidget = async () => {
    if (!editingWidget) return;

    const { error } = await supabase
      .from('widget_configurations')
      .update({
        widget_settings: customSettings
      })
      .eq('id', editingWidget.id);

    if (!error) {
      fetchWidgets();
      setEditingWidget(null);
      setCustomSettings({});
    }
  };

  const copyWidgetId = (widgetId: string) => {
    navigator.clipboard.writeText(widgetId);
    setCopiedId(widgetId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWidgetTypeInfo = (type: string) => {
    return widgetTypes.find(w => w.type === type);
  };

  const supportsScriptInstallation = (widgetType: string) => {
    return ['floating_widget', 'thankyou_card', 'product_banner'].includes(widgetType);
  };

  const generateWidgetScript = (widget: WidgetConfig) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const settings = widget.widget_settings || {};

    if (widget.widget_type === 'floating_widget') {
      const position = settings.position || 'bottom-right';
      const size = settings.size || 60;
      const bgColor = settings.backgroundColor || '#667eea';
      const iconColor = settings.iconColor || '#ffffff';
      const redirectUrl = settings.redirectUrl || '/pages/rewards';

      const positionStyles = position.includes('bottom')
        ? `bottom: 20px;`
        : `top: 20px;`;
      const horizontalPosition = position.includes('right')
        ? `right: 20px;`
        : `left: 20px;`;

      return `<!-- Rewards Floating Widget -->
<script>
(function() {
  const PORTAL_API = '${supabaseUrl}/functions/v1/widget-rewards-portal';
  const WIDGET_ID = '${widget.id}';
  let currentStep = 'phone';
  let phoneNumber = '';
  let userRewards = null;

  const button = document.createElement('div');
  button.id = 'rewards-floating-widget';
  button.style.cssText = \`
    position: fixed;
    ${positionStyles}
    ${horizontalPosition}
    width: ${size}px;
    height: ${size}px;
    background: ${bgColor};
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: transform 0.2s;
  \`;

  button.innerHTML = \`
    <svg width="28" height="28" fill="${iconColor}" viewBox="0 0 24 24">
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v4h-2zm0 6h2v2h-2z"/>
    </svg>
  \`;

  button.onmouseover = () => button.style.transform = 'scale(1.1)';
  button.onmouseout = () => button.style.transform = 'scale(1)';
  button.onclick = openModal;

  function openModal() {
    const modal = document.createElement('div');
    modal.id = 'rewards-modal';
    modal.style.cssText = \`position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.3s;\`;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = \`background: white; border-radius: 16px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s;\`;

    modalContent.innerHTML = \`
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .rewards-spinner { border: 3px solid #f3f3f3; border-top: 3px solid ${bgColor}; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
      <div style="padding: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 24px; color: #1a202c;">Your Rewards</h2>
          <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #718096; line-height: 1;">✕</button>
        </div>
        <div id="modal-body"></div>
      </div>
    \`;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    document.getElementById('close-modal').onclick = () => { modal.remove(); currentStep = 'phone'; };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); currentStep = 'phone'; } };

    renderStep();
  }

  function renderStep() {
    const body = document.getElementById('modal-body');
    if (!body) return;

    if (currentStep === 'phone') {
      body.innerHTML = \`
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
          <h3 style="font-size: 28px; font-weight: 600; color: #1a202c; margin: 0 0 12px 0;">Unlock your exclusive offers!</h3>
          <p style="color: #718096; font-size: 15px; margin: 0 0 32px 0;">A quick step to view personalized offers & gift cards!</p>
          <input type="tel" id="phone-input" placeholder="Enter your mobile number" style="width: 100%; padding: 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; margin-bottom: 16px; box-sizing: border-box;" />
          <button id="send-otp-btn" style="width: 100%; padding: 16px; background: #1a202c; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">SHOW MY OFFERS <span style="font-size: 20px;">🪙✨</span></button>
          <p style="color: #a0aec0; font-size: 12px; margin: 16px 0 0 0;">By continuing, you're giving consent to <a href="#" style="color: ${bgColor};">T&Cs</a> & <a href="#" style="color: ${bgColor};">Privacy Policy</a>.</p>
          <div id="error-msg" style="color: #e53e3e; margin-top: 12px; font-size: 14px;"></div>
        </div>
      \`;
      document.getElementById('send-otp-btn').onclick = sendOTP;
    } else if (currentStep === 'otp') {
      body.innerHTML = \`
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
          <h3 style="font-size: 24px; font-weight: 600; color: #1a202c; margin: 0 0 12px 0;">Verify your number</h3>
          <p style="color: #718096; font-size: 15px; margin: 0 0 32px 0;">Enter the 6-digit code sent to<br><strong>\${phoneNumber}</strong></p>
          <input type="text" id="otp-input" placeholder="Enter 6-digit code" maxlength="6" style="width: 100%; padding: 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 20px; text-align: center; letter-spacing: 8px; margin-bottom: 16px; box-sizing: border-box;" />
          <button id="verify-otp-btn" style="width: 100%; padding: 16px; background: #1a202c; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">VERIFY & CONTINUE</button>
          <button id="resend-otp-btn" style="width: 100%; padding: 12px; background: none; color: ${bgColor}; border: none; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 12px;">Resend OTP</button>
          <div id="error-msg" style="color: #e53e3e; margin-top: 12px; font-size: 14px;"></div>
        </div>
      \`;
      document.getElementById('verify-otp-btn').onclick = verifyOTP;
      document.getElementById('resend-otp-btn').onclick = sendOTP;
    } else if (currentStep === 'rewards') {
      renderRewards();
    }
  }

  async function sendOTP() {
    const input = document.getElementById('phone-input');
    const btn = document.getElementById('send-otp-btn') || document.getElementById('resend-otp-btn');
    const errorDiv = document.getElementById('error-msg');

    if (currentStep === 'phone') {
      phoneNumber = input.value.trim();
      if (!phoneNumber || phoneNumber.length < 10) {
        errorDiv.textContent = 'Please enter a valid phone number';
        return;
      }
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="rewards-spinner"></div>';

    try {
      const response = await fetch(PORTAL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp', phone: phoneNumber, widget_id: WIDGET_ID })
      });

      const data = await response.json();

      if (data.success) {
        currentStep = 'otp';
        renderStep();
        if (data.demo_otp) {
          console.log('Demo OTP:', data.demo_otp);
          alert('Demo OTP: ' + data.demo_otp);
        }
      } else {
        errorDiv.textContent = data.error || 'Failed to send OTP';
        btn.disabled = false;
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      btn.disabled = false;
    }
  }

  async function verifyOTP() {
    const input = document.getElementById('otp-input');
    const btn = document.getElementById('verify-otp-btn');
    const errorDiv = document.getElementById('error-msg');

    const otp = input.value.trim();
    if (!otp || otp.length !== 6) {
      errorDiv.textContent = 'Please enter the 6-digit code';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="rewards-spinner"></div>';

    try {
      const response = await fetch(PORTAL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', phone: phoneNumber, otp: otp, widget_id: WIDGET_ID })
      });

      const data = await response.json();

      if (data.success) {
        userRewards = data;
        currentStep = 'rewards';
        renderStep();
      } else {
        errorDiv.textContent = data.error || 'Invalid code. Please try again.';
        btn.disabled = false;
        btn.innerHTML = 'VERIFY & CONTINUE';
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.innerHTML = 'VERIFY & CONTINUE';
    }
  }

  function renderRewards() {
    const body = document.getElementById('modal-body');
    if (!body || !userRewards) return;

    const { user, memberships, rewards } = userRewards;

    if (rewards.length === 0) {
      body.innerHTML = \`<div style="text-align: center; padding: 40px 20px;"><div style="font-size: 64px; margin-bottom: 16px;">🎁</div><h3 style="font-size: 20px; color: #1a202c; margin: 0 0 8px 0;">No rewards yet</h3><p style="color: #718096; font-size: 14px;">Make a purchase to earn exclusive rewards!</p></div>\`;
      return;
    }

    const rewardsHTML = rewards.map(allocation => {
      const reward = allocation.reward;
      const membership = allocation.membership;
      const available = allocation.quantity_allocated - allocation.quantity_redeemed;

      return \`<div style="border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: linear-gradient(135deg, #f7fafc 0%, #ffffff 100%);"><div style="display: flex; gap: 16px; align-items: start;"><div style="width: 60px; height: 60px; border-radius: 8px; background: ${bgColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="font-size: 32px;">\${reward.reward_type === 'discount' ? '🎟️' : reward.reward_type === 'gift_card' ? '🎁' : '⭐'}</span></div><div style="flex: 1;"><div style="font-size: 12px; color: ${bgColor}; font-weight: 600; margin-bottom: 4px;">\${membership.program_name}</div><h4 style="font-size: 18px; font-weight: 600; color: #1a202c; margin: 0 0 8px 0;">\${reward.reward_title}</h4><p style="font-size: 14px; color: #718096; margin: 0 0 12px 0;">\${reward.reward_description || ''}</p><div style="display: flex; justify-content: space-between; align-items: center;"><div style="display: inline-block; padding: 6px 12px; background: #edf2f7; border-radius: 6px; font-size: 14px; font-weight: 600; color: #2d3748;">\${available} Available</div><button onclick="alert('Redeeming reward...')" style="padding: 10px 20px; background: #1a202c; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">Claim Now</button></div></div></div></div>\`;
    }).join('');

    body.innerHTML = \`<div style="margin-bottom: 24px; padding: 16px; background: linear-gradient(135deg, ${bgColor}15 0%, ${bgColor}05 100%); border-radius: 12px; text-align: center;"><div style="font-size: 14px; color: #718096; margin-bottom: 4px;">Welcome back!</div><div style="font-size: 20px; font-weight: 600; color: #1a202c;">\${user.name || user.email}</div><div style="font-size: 14px; color: ${bgColor}; font-weight: 600; margin-top: 8px;">\${memberships.length} Active Membership\${memberships.length !== 1 ? 's' : ''}</div></div><div style="margin-bottom: 16px;"><h3 style="font-size: 16px; font-weight: 600; color: #1a202c; margin: 0 0 16px 0;">Your Rewards (\${rewards.length})</h3>\${rewardsHTML}</div>\`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(button));
  } else {
    document.body.appendChild(button);
  }
})();
</script>`;
    }

    if (widget.widget_type === 'thankyou_card') {
      const title = settings.title || "You've Earned a Reward!";
      const description = settings.description || "Thank you for your purchase!";
      const ctaText = settings.ctaText || 'Claim Your Reward';
      const gradientStart = settings.gradientStart || '#667eea';
      const gradientEnd = settings.gradientEnd || '#764ba2';
      const fontFamily = settings.fontFamily || 'system-ui';

      return `<!-- Rewards Thank You Card -->
<script>
(function() {
  const WIDGET_API = '${supabaseUrl}/functions/v1/widget-render';
  const WIDGET_ID = '${widget.id}';

  // Only run on thank you page
  if (!window.Shopify?.checkout?.order_id) return;

  const orderData = {
    order_id: Shopify.checkout.order_id,
    order_number: Shopify.checkout.order_number,
    email: Shopify.checkout.email,
    total_price: Shopify.checkout.total_price / 100,
    currency: Shopify.checkout.currency
  };

  fetch(WIDGET_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${supabaseKey}'
    },
    body: JSON.stringify({
      widget_type: 'thankyou_card',
      widget_id: WIDGET_ID,
      order_id: orderData.order_id,
      customer_email: orderData.email,
      order_total: orderData.total_price,
      page_context: {
        type: 'thank_you',
        order_number: orderData.order_number
      }
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.should_render) return;

    const card = document.createElement('div');
    card.innerHTML = \`
      <div style="
        background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%);
        color: white;
        padding: 24px;
        border-radius: 12px;
        margin: 20px 0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-family: ${fontFamily};
      ">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="
            background: white;
            color: ${gradientStart};
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
          ">🎁</div>
          <div style="flex: 1;">
            <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">
              \${data.ui_payload.title || "${title}"}
            </h3>
            <p style="margin: 0; opacity: 0.9; font-size: 14px;">
              \${data.ui_payload.description || "${description}"}
            </p>
          </div>
        </div>

        \${data.ui_payload.reward_details ? \`
          <div style="
            background: rgba(255,255,255,0.15);
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
          ">
            <div style="font-weight: 600; margin-bottom: 4px;">
              \${data.ui_payload.reward_details.title}
            </div>
            <div style="opacity: 0.9; font-size: 14px;">
              \${data.ui_payload.reward_details.description || ''}
            </div>
          </div>
        \` : ''}

        \${data.ui_payload.redeem_url ? \`
          <a href="\${data.ui_payload.redeem_url}" style="
            display: inline-block;
            background: white;
            color: ${gradientStart};
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 12px;
          ">
            \${data.ui_payload.cta_text || "${ctaText}"}
          </a>
        \` : ''}

        \${data.ui_payload.instructions ? \`
          <p style="margin: 12px 0 0 0; opacity: 0.8; font-size: 13px;">
            \${data.ui_payload.instructions}
          </p>
        \` : ''}
      </div>
    \`;

    const mainContent = document.querySelector('.main__content, .step__sections, main');
    if (mainContent) {
      mainContent.insertBefore(card, mainContent.firstChild);
    }
  })
  .catch(error => console.error('Rewards widget error:', error));
})();
</script>`;
    }

    if (widget.widget_type === 'product_banner') {
      const title = settings.title || 'Get Exclusive Rewards!';
      const description = settings.description || 'Purchase this product and unlock special member benefits';
      const ctaText = settings.ctaText || 'Learn More';
      const gradientStart = settings.gradientStart || '#667eea';
      const gradientEnd = settings.gradientEnd || '#764ba2';
      const fontFamily = settings.fontFamily || 'system-ui';

      return `<!-- Rewards Product Banner -->
<script>
(function() {
  const WIDGET_API = '${supabaseUrl}/functions/v1/widget-render';
  const WIDGET_ID = '${widget.id}';

  // Only run on product pages
  if (!window.location.pathname.includes('/products/')) return;

  const productId = window.location.pathname.split('/products/')[1];

  fetch(WIDGET_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${supabaseKey}'
    },
    body: JSON.stringify({
      widget_type: 'product_banner',
      widget_id: WIDGET_ID,
      product_id: productId,
      page_context: { type: 'product' }
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.should_render) return;

    const banner = document.createElement('div');
    banner.style.cssText = \`
      background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      font-family: ${fontFamily};
    \`;

    banner.innerHTML = \`
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 32px;">🎁</div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
            \${data.ui_payload.title || "${title}"}
          </h3>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">
            \${data.ui_payload.description || "${description}"}
          </p>
        </div>
        \${data.ui_payload.cta_url ? \`
          <a href="\${data.ui_payload.cta_url}" style="
            background: white;
            color: ${gradientStart};
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            white-space: nowrap;
          ">
            \${data.ui_payload.cta_text || "${ctaText}"}
          </a>
        \` : ''}
      </div>
    \`;

    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (productForm) {
      productForm.parentNode.insertBefore(banner, productForm);
    }
  })
  .catch(error => console.error('Rewards widget error:', error));
})();
</script>`;
    }

    return '';
  };

  const copyScript = (script: string) => {
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (loading) {
    return (
      <DashboardLayout menuItems={clientMenuItems}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading widgets...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout menuItems={clientMenuItems}>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopify Widgets</h1>
          <p className="text-gray-600 mt-1">
            Manage your Shopify app extensions and widgets
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Widget
        </Button>
      </div>

      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Deployment Required</h3>
            <p className="text-sm text-blue-800 mb-3">
              These widgets need to be deployed as Shopify app extensions using the Shopify CLI.
              After deployment, you can enable and configure them in your Shopify admin.
            </p>
            <a
              href="/SHOPIFY_APP_COMPLETE_DEPLOYMENT.md"
              target="_blank"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              View Deployment Guide
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </Card>

      {widgets.length === 0 ? (
        <Card className="p-12 text-center">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No widgets configured
          </h3>
          <p className="text-gray-600 mb-6">
            Add your first widget to start displaying rewards on your Shopify store
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Widget
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6">
          {widgets.map((widget) => {
            const typeInfo = getWidgetTypeInfo(widget.widget_type);
            return (
              <Card key={widget.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {widget.widget_name}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        widget.is_enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {widget.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {typeInfo?.extensionType === 'checkout' ? 'Checkout' : 'Theme'} Extension
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4">
                      {typeInfo?.description}
                    </p>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-medium text-gray-500">Widget ID:</span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {widget.id}
                      </code>
                      <button
                        onClick={() => copyWidgetId(widget.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copiedId === widget.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {widget.shopify_store_domain && (
                      <div className="text-sm text-gray-600 mb-4">
                        <span className="font-medium">Store:</span> {widget.shopify_store_domain}
                      </div>
                    )}

                    {Object.keys(widget.widget_settings).length > 0 && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Settings</h4>
                        <pre className="text-xs text-gray-600 overflow-auto">
                          {JSON.stringify(widget.widget_settings, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {supportsScriptInstallation(widget.widget_type) && (
                      <button
                        onClick={() => setShowScriptModal(widget)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                        title="View Installation Script"
                      >
                        <Code className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleWidget(widget)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      title={widget.is_enabled ? 'Disable' : 'Enable'}
                    >
                      {widget.is_enabled ? (
                        <Eye className="w-5 h-5" />
                      ) : (
                        <EyeOff className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => openEditModal(widget)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Customize"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteWidget(widget.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Add Widget
              </h2>
              <p className="text-gray-600 mb-6">
                Select a widget type to add to your Shopify store
              </p>

              <div className="grid gap-4">
                {widgetTypes.map((type) => (
                  <button
                    key={type.type}
                    onClick={() => createWidget(type)}
                    className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {type.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {type.description}
                        </p>
                        <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {type.extensionType === 'checkout' ? 'Checkout' : 'Theme'} Extension
                        </span>
                      </div>
                      <Plus className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingWidget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-6xl w-full my-8">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Customize Widget
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {getWidgetTypeInfo(editingWidget.widget_type)?.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingWidget(null);
                    setCustomSettings({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Customization Form */}
                <div className="space-y-6">
                  <h3 className="font-semibold text-gray-900">Settings</h3>

                  {/* Common Settings for All Widgets */}
                  {editingWidget.widget_type === 'floating_widget' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Position
                        </label>
                        <select
                          value={customSettings.position || 'bottom-right'}
                          onChange={(e) => setCustomSettings({ ...customSettings, position: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="bottom-right">Bottom Right</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="top-left">Top Left</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Button Size (px)
                        </label>
                        <input
                          type="number"
                          value={customSettings.size || 60}
                          onChange={(e) => setCustomSettings({ ...customSettings, size: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          min="40"
                          max="100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Background Color
                        </label>
                        <input
                          type="color"
                          value={customSettings.backgroundColor || '#667eea'}
                          onChange={(e) => setCustomSettings({ ...customSettings, backgroundColor: e.target.value })}
                          className="w-full h-10 px-2 py-1 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Icon Color
                        </label>
                        <input
                          type="color"
                          value={customSettings.iconColor || '#ffffff'}
                          onChange={(e) => setCustomSettings({ ...customSettings, iconColor: e.target.value })}
                          className="w-full h-10 px-2 py-1 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Redirect URL
                        </label>
                        <input
                          type="text"
                          value={customSettings.redirectUrl || '/pages/rewards'}
                          onChange={(e) => setCustomSettings({ ...customSettings, redirectUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="/pages/rewards"
                        />
                      </div>
                    </>
                  )}

                  {editingWidget.widget_type === 'thankyou_card' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Title
                        </label>
                        <input
                          type="text"
                          value={customSettings.title || "You've Earned a Reward!"}
                          onChange={(e) => setCustomSettings({ ...customSettings, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={customSettings.description || "Thank you for your purchase!"}
                          onChange={(e) => setCustomSettings({ ...customSettings, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CTA Button Text
                        </label>
                        <input
                          type="text"
                          value={customSettings.ctaText || 'Claim Your Reward'}
                          onChange={(e) => setCustomSettings({ ...customSettings, ctaText: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Background Gradient Start
                        </label>
                        <input
                          type="color"
                          value={customSettings.gradientStart || '#667eea'}
                          onChange={(e) => setCustomSettings({ ...customSettings, gradientStart: e.target.value })}
                          className="w-full h-10 px-2 py-1 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Background Gradient End
                        </label>
                        <input
                          type="color"
                          value={customSettings.gradientEnd || '#764ba2'}
                          onChange={(e) => setCustomSettings({ ...customSettings, gradientEnd: e.target.value })}
                          className="w-full h-10 px-2 py-1 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Font Family
                        </label>
                        <select
                          value={customSettings.fontFamily || 'system-ui'}
                          onChange={(e) => setCustomSettings({ ...customSettings, fontFamily: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="system-ui">System Default</option>
                          <option value="Arial, sans-serif">Arial</option>
                          <option value="Georgia, serif">Georgia</option>
                          <option value="'Courier New', monospace">Courier New</option>
                          <option value="Verdana, sans-serif">Verdana</option>
                        </select>
                      </div>
                    </>
                  )}

                  {editingWidget.widget_type === 'product_banner' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Title
                        </label>
                        <input
                          type="text"
                          value={customSettings.title || 'Get Exclusive Rewards!'}
                          onChange={(e) => setCustomSettings({ ...customSettings, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={customSettings.description || 'Purchase this product and unlock special member benefits'}
                          onChange={(e) => setCustomSettings({ ...customSettings, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CTA Button Text
                        </label>
                        <input
                          type="text"
                          value={customSettings.ctaText || 'Learn More'}
                          onChange={(e) => setCustomSettings({ ...customSettings, ctaText: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Background Gradient Start
                        </label>
                        <input
                          type="color"
                          value={customSettings.gradientStart || '#667eea'}
                          onChange={(e) => setCustomSettings({ ...customSettings, gradientStart: e.target.value })}
                          className="w-full h-10 px-2 py-1 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Background Gradient End
                        </label>
                        <input
                          type="color"
                          value={customSettings.gradientEnd || '#764ba2'}
                          onChange={(e) => setCustomSettings({ ...customSettings, gradientEnd: e.target.value })}
                          className="w-full h-10 px-2 py-1 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Font Family
                        </label>
                        <select
                          value={customSettings.fontFamily || 'system-ui'}
                          onChange={(e) => setCustomSettings({ ...customSettings, fontFamily: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="system-ui">System Default</option>
                          <option value="Arial, sans-serif">Arial</option>
                          <option value="Georgia, serif">Georgia</option>
                          <option value="'Courier New', monospace">Courier New</option>
                          <option value="Verdana, sans-serif">Verdana</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Live Preview */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Preview</h3>
                  <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50 min-h-[400px] relative">
                    {editingWidget.widget_type === 'floating_widget' && (
                      <div className="relative h-full">
                        <p className="text-sm text-gray-500 mb-4">Preview of floating widget:</p>
                        <div
                          style={{
                            position: 'absolute',
                            [customSettings.position?.includes('bottom') ? 'bottom' : 'top']: '20px',
                            [customSettings.position?.includes('right') ? 'right' : 'left']: '20px',
                            width: `${customSettings.size || 60}px`,
                            height: `${customSettings.size || 60}px`,
                            background: customSettings.backgroundColor || '#667eea',
                            borderRadius: '50%',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <svg width="28" height="28" fill={customSettings.iconColor || 'white'} viewBox="0 0 24 24">
                            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v4h-2zm0 6h2v2h-2z"/>
                          </svg>
                        </div>
                      </div>
                    )}

                    {editingWidget.widget_type === 'thankyou_card' && (
                      <div
                        style={{
                          background: `linear-gradient(135deg, ${customSettings.gradientStart || '#667eea'} 0%, ${customSettings.gradientEnd || '#764ba2'} 100%)`,
                          color: 'white',
                          padding: '24px',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                          fontFamily: customSettings.fontFamily || 'system-ui',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{
                            background: 'white',
                            color: customSettings.gradientStart || '#667eea',
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                          }}>🎁</div>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>
                              {customSettings.title || "You've Earned a Reward!"}
                            </h3>
                            <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
                              {customSettings.description || "Thank you for your purchase!"}
                            </p>
                          </div>
                        </div>
                        <button style={{
                          display: 'inline-block',
                          background: 'white',
                          color: customSettings.gradientStart || '#667eea',
                          padding: '12px 24px',
                          borderRadius: '6px',
                          border: 'none',
                          fontWeight: 600,
                          marginTop: '12px',
                          cursor: 'pointer',
                        }}>
                          {customSettings.ctaText || 'Claim Your Reward'}
                        </button>
                      </div>
                    )}

                    {editingWidget.widget_type === 'product_banner' && (
                      <div
                        style={{
                          background: `linear-gradient(135deg, ${customSettings.gradientStart || '#667eea'} 0%, ${customSettings.gradientEnd || '#764ba2'} 100%)`,
                          color: 'white',
                          padding: '20px',
                          borderRadius: '8px',
                          fontFamily: customSettings.fontFamily || 'system-ui',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ fontSize: '32px' }}>🎁</div>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
                              {customSettings.title || 'Get Exclusive Rewards!'}
                            </h3>
                            <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
                              {customSettings.description || 'Purchase this product and unlock special member benefits'}
                            </p>
                          </div>
                          <button style={{
                            background: 'white',
                            color: customSettings.gradientStart || '#667eea',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: 'none',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}>
                            {customSettings.ctaText || 'Learn More'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingWidget(null);
                    setCustomSettings({});
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={updateWidget}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScriptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Script Installation
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Copy and paste this script into your Shopify theme
                  </p>
                </div>
                <button
                  onClick={() => setShowScriptModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Check className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    No App Required
                  </span>
                  <span className="text-gray-600 text-sm">
                    Quick installation without Shopify app deployment
                  </span>
                </div>

                {showScriptModal.widget_type === 'floating_widget' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Installation Steps:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                      <li>Go to your Shopify admin</li>
                      <li>Navigate to <strong>Online Store → Themes</strong></li>
                      <li>Click <strong>Actions → Edit code</strong></li>
                      <li>Open <strong>Layout → theme.liquid</strong></li>
                      <li>Scroll to the bottom, just before the closing <code className="bg-gray-100 px-1">&lt;/body&gt;</code> tag</li>
                      <li>Paste the script below</li>
                      <li>Click <strong>Save</strong></li>
                    </ol>
                  </div>
                )}

                {showScriptModal.widget_type === 'thankyou_card' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Installation Steps:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                      <li>Go to your Shopify admin</li>
                      <li>Navigate to <strong>Settings → Checkout</strong></li>
                      <li>Scroll to <strong>Order status page → Additional scripts</strong></li>
                      <li>Paste the script below into the text box</li>
                      <li>Click <strong>Save</strong></li>
                      <li>Test by placing an order and viewing the thank you page</li>
                    </ol>
                  </div>
                )}

                {showScriptModal.widget_type === 'product_banner' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Installation Steps:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                      <li>Go to your Shopify admin</li>
                      <li>Navigate to <strong>Online Store → Themes</strong></li>
                      <li>Click <strong>Actions → Edit code</strong></li>
                      <li>Open <strong>Sections → product-template.liquid</strong> (or similar)</li>
                      <li>Find a good location (typically before or after the product form)</li>
                      <li>Paste the script below</li>
                      <li>Click <strong>Save</strong></li>
                    </ol>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Script Code:</h3>
                  <Button
                    onClick={() => copyScript(generateWidgetScript(showScriptModal))}
                    size="sm"
                  >
                    {copiedScript ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Script
                      </>
                    )}
                  </Button>
                </div>

                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{generateWidgetScript(showScriptModal)}</code>
                </pre>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Important Notes:</h4>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• The widget will automatically call your API to fetch reward data</li>
                  <li>• Widget ID is already configured in the script</li>
                  <li>• Make sure your widget-render edge function is deployed</li>
                  <li>• Test on a development theme first before going live</li>
                  {showScriptModal.widget_type === 'thankyou_card' && (
                    <li>• Only appears on the order confirmation page after checkout</li>
                  )}
                  {showScriptModal.widget_type === 'product_banner' && (
                    <li>• Only appears on product pages (/products/*)</li>
                  )}
                </ul>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowScriptModal(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    copyScript(generateWidgetScript(showScriptModal));
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy & Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
