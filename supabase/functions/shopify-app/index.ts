import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loyalty Bolt 2.0 - Installation Success</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f9fafb;
      min-height: 100vh;
      padding: 40px 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      max-width: 700px;
      margin: 0 auto;
      padding: 40px;
    }

    .header {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 12px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      color: white;
      font-weight: bold;
    }

    .status {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      background: #d1fae5;
      color: #065f46;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    h1 {
      font-size: 28px;
      color: #111827;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 16px;
      color: #6b7280;
      line-height: 1.5;
    }

    .shop-info {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 8px;
      margin: 24px 0;
    }

    .shop-info strong {
      color: #92400e;
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .shop-info p {
      margin: 0;
      color: #78350f;
      font-size: 16px;
      font-weight: 600;
    }

    .next-steps {
      margin: 32px 0;
    }

    .next-steps h2 {
      font-size: 18px;
      color: #111827;
      margin-bottom: 16px;
    }

    .step {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .step-number {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }

    .step-content {
      flex: 1;
    }

    .step-content h3 {
      font-size: 15px;
      color: #111827;
      margin-bottom: 4px;
    }

    .step-content p {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }

    .code-box {
      background: #1f2937;
      color: #10b981;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      margin-top: 8px;
      overflow-x: auto;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 32px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }

    .btn-primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .btn-secondary {
      background: white;
      color: #059669;
      border: 2px solid #059669;
    }

    .btn-secondary:hover {
      background: #ecfdf5;
    }

    .info-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      border-radius: 8px;
      margin: 24px 0;
    }

    .info-box h3 {
      font-size: 14px;
      color: #1e40af;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .info-box p {
      font-size: 13px;
      color: #1e3a8a;
      line-height: 1.5;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">LB</div>

      <div class="status">
        <span class="status-dot"></span>
        Installation Successful
      </div>

      <h1>Welcome to Loyalty Bolt 2.0</h1>
      <p class="subtitle">Your loyalty and rewards platform has been installed successfully!</p>
    </div>

    <div id="shop-info" class="shop-info" style="display: none;">
      <strong>Connected Store:</strong>
      <p id="shop-name"></p>
    </div>

    <div class="info-box">
      <h3>Important: Enable App Blocks</h3>
      <p>To activate the loyalty widget on your storefront, you need to enable the app blocks in your theme customizer.</p>
    </div>

    <div class="next-steps">
      <h2>Next Steps to Activate Widget</h2>

      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h3>Open Theme Customizer</h3>
          <p>Go to Online Store → Themes → Customize</p>
        </div>
      </div>

      <div class="step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h3>Enable App Embeds</h3>
          <p>Look for "App embeds" section in the left sidebar, find the loyalty widget, and toggle it ON. Then click Save.</p>
        </div>
      </div>

      <div class="step">
        <div class="step-number">3</div>
        <div class="step-content">
          <h3>Test on Your Store</h3>
          <p>Visit your storefront and you should see the floating loyalty widget in the bottom-right corner.</p>
        </div>
      </div>

      <div class="step">
        <div class="step-number">4</div>
        <div class="step-content">
          <h3>Configure Loyalty Program</h3>
          <p>Access the dashboard to set up points rules, create rewards, and configure campaigns.</p>
        </div>
      </div>
    </div>

    <div class="info-box">
      <h3>Alternative: Manual Installation</h3>
      <p>If app embeds don't appear, add this script to your theme.liquid file before &lt;/body&gt;:</p>
      <div class="code-box" id="script-code"></div>
    </div>

    <div class="actions">
      <a href="#" id="dashboard-btn" class="btn btn-primary" target="_blank">Open Dashboard</a>
      <a href="#" id="theme-btn" class="btn btn-secondary" target="_blank">Go to Theme Customizer</a>
    </div>
  </div>

  <script>
    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    const clientId = urlParams.get('client_id');

    // Display shop info if available
    if (shop) {
      document.getElementById('shop-info').style.display = 'block';
      document.getElementById('shop-name').textContent = shop;

      // Update script code with actual shop
      const scriptCode = \`<script src="https://lizgppzyyljqbmzdytia.supabase.co/functions/v1/widget-script?shop=\${shop}" async><\\/script>\`;
      document.getElementById('script-code').textContent = scriptCode;

      // Update theme customizer link
      const themeBtn = document.getElementById('theme-btn');
      themeBtn.href = \`https://\${shop}/admin/themes/current/editor?context=apps\`;
    }

    // Set dashboard link
    const dashboardBtn = document.getElementById('dashboard-btn');
    const appUrl = 'https://lizgppzyyljqbmzdytia.supabase.co';

    if (clientId) {
      dashboardBtn.href = \`\${appUrl}/#/client/dashboard?client_id=\${clientId}\`;
    } else {
      dashboardBtn.href = appUrl;
    }

    // Handle iframe context
    if (window.parent !== window) {
      console.log('Running in Shopify Admin iframe');

      // Make links open in new tab when in iframe
      document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
          if (link.href && link.href !== '#') {
            e.preventDefault();
            window.open(link.href, '_blank');
          }
        });
      });
    }

    // Log for debugging
    console.log('Loyalty Bolt 2.0 - Installation Success');
    console.log('Shop:', shop);
    console.log('Client ID:', clientId);
  </script>
</body>
</html>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Return HTML content with query parameters preserved
    return new Response(HTML_CONTENT, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    console.error("Error serving app page:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to load app page",
        details: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
