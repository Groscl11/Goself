(function() {
  'use strict';

  const SUPABASE_URL = window.REWARD_WIDGET_CONFIG?.supabaseUrl || 'https://lizgppzyyljqbmzdytia.supabase.co';
  const SUPABASE_ANON_KEY = window.REWARD_WIDGET_CONFIG?.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0';

  class RewardWidget {
    constructor() {
      this.widgets = new Map();
    }

    async init(widgetId, options = {}) {
      try {
        const widget = await this.fetchWidgetConfig(widgetId);

        if (!widget || !widget.is_enabled) {
          console.warn('Widget not found or disabled:', widgetId);
          return;
        }

        this.widgets.set(widgetId, widget);
        this.render(widgetId, widget, options);
      } catch (error) {
        console.error('Error initializing widget:', error);
      }
    }

    async fetchWidgetConfig(widgetId) {
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/shopify_widgets?id=eq.${widgetId}&select=*`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch widget configuration');
        }

        const data = await response.json();
        return data[0];
      } catch (error) {
        console.error('Error fetching widget:', error);
        return null;
      }
    }

    render(widgetId, widget, options) {
      const type = widget.widget_type || options.type || 'floating';

      switch(type) {
        case 'floating':
          this.renderFloatingWidget(widgetId, widget);
          break;
        case 'thankyou_card':
          this.renderThankYouCard(widgetId, widget);
          break;
        case 'product_banner':
          this.renderProductBanner(widgetId, widget);
          break;
        case 'cart_drawer':
          this.renderCartDrawer(widgetId, widget);
          break;
        case 'announcement_bar':
          this.renderAnnouncementBar(widgetId, widget);
          break;
        case 'membership_portal':
          this.renderMembershipPortal(widgetId, widget);
          break;
        default:
          console.warn('Unknown widget type:', type);
      }
    }

    renderFloatingWidget(widgetId, widget) {
      const container = document.createElement('div');
      container.id = `reward-widget-floating-${widgetId}`;
      container.className = 'reward-widget-floating';

      container.innerHTML = `
        <div style="
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 9999;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          max-width: 300px;
        " onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 15px 35px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.2)'">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
            🎁 ${widget.name || 'Special Reward'}
          </div>
          <div style="font-size: 14px; opacity: 0.95; line-height: 1.4;">
            ${widget.description || 'Click to claim your exclusive reward!'}
          </div>
        </div>
      `;

      container.addEventListener('click', () => {
        this.showRedemptionModal(widgetId, widget);
      });

      document.body.appendChild(container);
    }

    renderThankYouCard(widgetId, widget) {
      const container = document.createElement('div');
      container.id = `reward-widget-thankyou-${widgetId}`;
      container.className = 'reward-widget-thankyou';

      container.innerHTML = `
        <div style="
          background: white;
          border: 2px solid #667eea;
          border-radius: 12px;
          padding: 24px;
          margin: 20px 0;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        ">
          <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
          <h3 style="font-size: 24px; font-weight: 600; color: #1a202c; margin-bottom: 8px;">
            ${widget.name || 'Thank You!'}
          </h3>
          <p style="font-size: 16px; color: #4a5568; margin-bottom: 16px;">
            ${widget.description || 'Your order includes a special reward!'}
          </p>
          <button onclick="window.RewardWidgetInstance.showRedemptionModal('${widgetId}', ${JSON.stringify(widget).replace(/"/g, '&quot;')})" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            Claim Your Reward
          </button>
        </div>
      `;

      const targetContainer = document.getElementById(`reward-widget-${widgetId}`);
      if (targetContainer) {
        targetContainer.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
    }

    renderProductBanner(widgetId, widget) {
      const container = document.createElement('div');
      container.id = `reward-widget-banner-${widgetId}`;
      container.className = 'reward-widget-banner';

      container.innerHTML = `
        <div style="
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px;
          margin: 16px 0;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        ">
          <div style="flex: 1; min-width: 200px;">
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">
              ${widget.name || 'Special Offer'}
            </div>
            <div style="font-size: 14px; opacity: 0.9;">
              ${widget.description || 'Get exclusive rewards with your purchase!'}
            </div>
          </div>
          <button onclick="window.RewardWidgetInstance.showRedemptionModal('${widgetId}', ${JSON.stringify(widget).replace(/"/g, '&quot;')})" style="
            background: white;
            color: #667eea;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
          ">
            Learn More
          </button>
        </div>
      `;

      const targetContainer = document.getElementById(`reward-widget-${widgetId}`);
      if (targetContainer) {
        targetContainer.appendChild(container);
      } else {
        const productForm = document.querySelector('form[action*="/cart/add"]') || document.querySelector('.product-form');
        if (productForm) {
          productForm.parentNode.insertBefore(container, productForm);
        } else {
          document.body.appendChild(container);
        }
      }
    }

    renderCartDrawer(widgetId, widget) {
      const container = document.createElement('div');
      container.id = `reward-widget-cart-${widgetId}`;
      container.className = 'reward-widget-cart';

      container.innerHTML = `
        <div style="
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 12px 0;
        ">
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 24px; margin-right: 8px;">🎁</span>
            <div style="font-size: 16px; font-weight: 600; color: #1a202c;">
              ${widget.name || 'Rewards Available'}
            </div>
          </div>
          <div style="font-size: 14px; color: #4a5568; margin-bottom: 12px;">
            ${widget.description || 'You have exclusive rewards waiting!'}
          </div>
          <button onclick="window.RewardWidgetInstance.showRedemptionModal('${widgetId}', ${JSON.stringify(widget).replace(/"/g, '&quot;')})" style="
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
          ">
            View Rewards
          </button>
        </div>
      `;

      const targetContainer = document.getElementById(`reward-widget-${widgetId}`);
      if (targetContainer) {
        targetContainer.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
    }

    renderAnnouncementBar(widgetId, widget) {
      const container = document.createElement('div');
      container.id = `reward-widget-announcement-${widgetId}`;
      container.className = 'reward-widget-announcement';

      container.innerHTML = `
        <div style="
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 16px;
          text-align: center;
          font-size: 14px;
          cursor: pointer;
          position: relative;
          z-index: 9998;
        " onclick="window.RewardWidgetInstance.showRedemptionModal('${widgetId}', ${JSON.stringify(widget).replace(/"/g, '&quot;')})">
          <strong>${widget.name || 'Special Announcement'}</strong>
          ${widget.description ? ` - ${widget.description}` : ''}
          <span style="margin-left: 8px; text-decoration: underline;">Click to learn more →</span>
        </div>
      `;

      const targetContainer = document.getElementById(`reward-widget-${widgetId}`);
      if (targetContainer) {
        targetContainer.appendChild(container);
      } else {
        document.body.insertBefore(container, document.body.firstChild);
      }
    }

    renderMembershipPortal(widgetId, widget) {
      const container = document.getElementById(`reward-widget-${widgetId}`) ||
                       document.getElementById('membership-portal') ||
                       document.body;

      container.innerHTML = `
        <div style="max-width: 600px; margin: 40px auto; padding: 20px;">
          <div style="
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            padding: 32px;
            text-align: center;
          ">
            <div style="font-size: 64px; margin-bottom: 16px;">🎁</div>
            <h2 style="font-size: 28px; font-weight: 600; color: #1a202c; margin-bottom: 12px;">
              ${widget.name || 'Member Portal'}
            </h2>
            <p style="font-size: 16px; color: #4a5568; margin-bottom: 24px;">
              ${widget.description || 'Access your exclusive member rewards and benefits'}
            </p>
            <button onclick="window.RewardWidgetInstance.showRedemptionModal('${widgetId}', ${JSON.stringify(widget).replace(/"/g, '&quot;')})" style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              padding: 14px 40px;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
              Access Portal
            </button>
          </div>
        </div>
      `;
    }

    showRedemptionModal(widgetId, widget) {
      const modal = document.createElement('div');
      modal.id = 'reward-widget-modal';
      modal.innerHTML = `
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 20px;
        " onclick="if(event.target === this) this.remove()">
          <div style="
            background: white;
            border-radius: 12px;
            max-width: 500px;
            width: 100%;
            padding: 32px;
            position: relative;
            max-height: 90vh;
            overflow-y: auto;
          " onclick="event.stopPropagation()">
            <button onclick="document.getElementById('reward-widget-modal').remove()" style="
              position: absolute;
              top: 16px;
              right: 16px;
              background: none;
              border: none;
              font-size: 24px;
              cursor: pointer;
              color: #999;
              line-height: 1;
              padding: 0;
              width: 30px;
              height: 30px;
            ">&times;</button>

            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎁</div>
              <h3 style="font-size: 24px; font-weight: 600; color: #1a202c; margin-bottom: 8px;">
                ${widget.name || 'Claim Your Reward'}
              </h3>
              <p style="font-size: 14px; color: #4a5568;">
                ${widget.description || 'Enter your details to access your exclusive reward'}
              </p>
            </div>

            <form id="reward-claim-form" style="margin-bottom: 20px;">
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #4a5568; margin-bottom: 6px;">
                  Email Address
                </label>
                <input type="email" id="reward-email" required style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid #e2e8f0;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                " placeholder="your@email.com">
              </div>

              <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #4a5568; margin-bottom: 6px;">
                  Phone (Optional)
                </label>
                <input type="tel" id="reward-phone" style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid #e2e8f0;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                " placeholder="+1234567890">
              </div>

              <button type="submit" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                transition: transform 0.2s;
              " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                Claim Reward
              </button>
            </form>

            <div id="reward-message" style="display: none; padding: 12px; border-radius: 6px; text-align: center; font-size: 14px;"></div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      document.getElementById('reward-claim-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reward-email').value;
        const phone = document.getElementById('reward-phone').value;

        const messageDiv = document.getElementById('reward-message');
        messageDiv.style.display = 'block';
        messageDiv.style.background = '#e6f7ff';
        messageDiv.style.color = '#0066cc';
        messageDiv.textContent = 'Processing your reward...';

        setTimeout(() => {
          messageDiv.style.background = '#d4edda';
          messageDiv.style.color = '#155724';
          messageDiv.textContent = 'Success! Check your email for your reward details.';

          setTimeout(() => {
            modal.remove();
          }, 2000);
        }, 1500);
      });
    }
  }

  window.RewardWidgetInstance = new RewardWidget();
  window.RewardWidget = window.RewardWidgetInstance;

  const script = document.currentScript;
  if (script && script.hasAttribute('data-widget-id')) {
    const widgetId = script.getAttribute('data-widget-id');
    window.RewardWidgetInstance.init(widgetId);
  }
})();
