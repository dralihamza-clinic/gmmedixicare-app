import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True when .env was filled in before the app was built/started.
export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes("YOUR-PROJECT-REF")
);

// Anon key only. Access control is enforced by the RLS policies in sql/.
// If the env is missing we still create a client (with placeholders) so the
// app can render a clear "not configured" screen instead of crashing.
export const supabase = createClient(
  isSupabaseConfigured ? url! : "https://placeholder.supabase.co",
  isSupabaseConfigured ? anonKey! : "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
