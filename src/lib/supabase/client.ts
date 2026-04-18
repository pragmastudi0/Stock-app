"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LS_SUPABASE_ANON_KEY,
  LS_SUPABASE_URL,
} from "@/lib/supabase/config";

export function getSupabaseCredentials(): { url: string; key: string } | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (envUrl && envKey) return { url: envUrl, key: envKey };
  if (typeof window === "undefined") return null;
  const lsUrl = localStorage.getItem(LS_SUPABASE_URL)?.trim();
  const lsKey = localStorage.getItem(LS_SUPABASE_ANON_KEY)?.trim();
  if (lsUrl && lsKey) return { url: lsUrl, key: lsKey };
  return null;
}

export function createStockAppBrowserClient(
  url: string,
  anonKey: string,
): SupabaseClient {
  return createBrowserClient(url, anonKey);
}
