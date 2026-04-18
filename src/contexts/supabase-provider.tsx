"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LS_SUPABASE_ANON_KEY,
  LS_SUPABASE_URL,
  type SupabaseConnectionStatus,
} from "@/lib/supabase/config";
import { createBrowserSupabase } from "@/lib/supabase/browser-client";

type SupabaseCtx = {
  client: SupabaseClient | null;
  status: SupabaseConnectionStatus;
  errorMessage: string | null;
  reconnect: () => void;
  setCredentials: (url: string, anonKey: string) => void;
  clearCredentials: () => void;
};

const Ctx = createContext<SupabaseCtx | null>(null);

function readStored(): { url: string; key: string } | null {
  if (typeof window === "undefined") return null;
  const url = localStorage.getItem(LS_SUPABASE_URL)?.trim();
  const key = localStorage.getItem(LS_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [status, setStatus] = useState<SupabaseConnectionStatus>("unknown");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verify = useCallback(async (c: SupabaseClient) => {
    setStatus("checking");
    setErrorMessage(null);
    const { error } = await c.from("stock_app_products").select("id").limit(1);
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("connected");
  }, []);

  const connectFromStorage = useCallback(() => {
    const stored = readStored();
    if (!stored) {
      setClient(null);
      setStatus("unknown");
      setErrorMessage(null);
      return;
    }
    const c = createBrowserSupabase(stored.url, stored.key);
    setClient(c);
    void verify(c);
  }, [verify]);

  useEffect(() => {
    connectFromStorage();
  }, [connectFromStorage]);

  const setCredentials = useCallback(
    (url: string, anonKey: string) => {
      localStorage.setItem(LS_SUPABASE_URL, url.trim());
      localStorage.setItem(LS_SUPABASE_ANON_KEY, anonKey.trim());
      const c = createBrowserSupabase(url.trim(), anonKey.trim());
      setClient(c);
      void verify(c);
    },
    [verify],
  );

  const clearCredentials = useCallback(() => {
    localStorage.removeItem(LS_SUPABASE_URL);
    localStorage.removeItem(LS_SUPABASE_ANON_KEY);
    setClient(null);
    setStatus("unknown");
    setErrorMessage(null);
  }, []);

  const reconnect = useCallback(() => {
    if (client) void verify(client);
    else connectFromStorage();
  }, [client, verify, connectFromStorage]);

  const value = useMemo(
    () => ({
      client,
      status,
      errorMessage,
      reconnect,
      setCredentials,
      clearCredentials,
    }),
    [client, status, errorMessage, reconnect, setCredentials, clearCredentials],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupabase() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSupabase must be used within SupabaseProvider");
  return v;
}
