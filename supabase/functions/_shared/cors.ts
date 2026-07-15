// Allowed browser origins — requests from other origins get a non-matching header
// which browsers will block. Webhook-only functions should not use CORS at all.
const ALLOWED_ORIGINS = [
  'https://app.goself.in',
  'https://dev.app.goself.in',
  'http://localhost:5173',
  'http://localhost:3000',
];

// Use this for dashboard/API functions that need browser CORS
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    'Vary': 'Origin',
  };
}

// Legacy static export — kept for widget-facing functions that must allow all origins
// (embedded in merchant storefronts with arbitrary domains)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
