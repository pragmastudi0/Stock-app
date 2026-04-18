"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseCredentials(): { url: string; key: string } | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!envUrl || !envKey) return null;
  return { url: envUrl, key: envKey };
}

export function createStockAppBrowserClient(
  url: string,
  anonKey: string,
): SupabaseClient {
  return createBrowserClient(url, anonKey);
}
