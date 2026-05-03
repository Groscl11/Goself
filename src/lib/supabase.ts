import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lizgppzyyljqbmzdytia.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (
  // IMPORTANT: this fallback must match the project in VITE_SUPABASE_URL above.
  // Prod project (lizgppzyyljqbmzdytia) anon key:
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemdwcHp5eWxqcWJtemR5dGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDE0MDYsImV4cCI6MjA3OTk3NzQwNn0.E5yJHY4mjOvLiqZCfCp9vnNC7xsRAlBSdW55YE2RPC0'
);

// flowType: 'implicit' is required for server-side generated magic links (admin.generateLink).
// Those links produce #access_token=... in the URL hash (implicit flow).
// The default PKCE flow only looks for a ?code= param and ignores the hash, causing
// getSession() to return null and the magic-link SSO to fall back to /login.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
  },
});
