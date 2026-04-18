import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function createBrowserSupabase(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
