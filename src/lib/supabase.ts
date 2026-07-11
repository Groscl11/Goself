import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// SECURITY (H-14): never hardcode Supabase keys in source code.
// Both values must be supplied via environment variables at build time.
// If missing, throw immediately at module load so the misconfiguration
// is caught during deployment rather than silently connecting to the
// wrong project with a committed key.
if (!import.meta.env.VITE_SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL is required — set it in your .env file');
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required — set it in your .env file');
}

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// flowType: 'implicit' is required for server-side generated magic links (admin.generateLink).
// Those links produce #access_token=... in the URL hash (implicit flow).
// The default PKCE flow only looks for a ?code= param and ignores the hash, causing
// getSession() to return null and the magic-link SSO to fall back to /login.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
  },
});
