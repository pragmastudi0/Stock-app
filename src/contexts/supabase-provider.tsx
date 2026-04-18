"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupabaseConnectionStatus } from "@/lib/supabase/config";
import {
  createStockAppBrowserClient,
  getSupabaseCredentials,
} from "@/lib/supabase/client";

export type StockAppStoreRow = {
  id: string;
  name: string;
};

type SupabaseCtx = {
  client: SupabaseClient | null;
  user: User | null;
  session: Session | null;
  storeId: string | null;
  storeName: string | null;
  status: SupabaseConnectionStatus;
  errorMessage: string | null;
  reconnect: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SupabaseCtx | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [store, setStore] = useState<StockAppStoreRow | null>(null);
  const [status, setStatus] = useState<SupabaseConnectionStatus>("unknown");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshStore = useCallback(async (c: SupabaseClient) => {
    const { data, error } = await c
      .from("stock_app_stores")
      .select("id,name")
      .maybeSingle();
    if (error) {
      setStore(null);
      return;
    }
    setStore(data as StockAppStoreRow | null);
  }, []);

  const verify = useCallback(
    async (c: SupabaseClient, hasUser: boolean) => {
      if (!hasUser) {
        setStatus("unknown");
        setErrorMessage(null);
        setStore(null);
        return;
      }
      setStatus("checking");
      setErrorMessage(null);
      const { error } = await c.from("stock_app_products").select("id").limit(1);
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        setStore(null);
        return;
      }
      setStatus("connected");
      await refreshStore(c);
    },
    [refreshStore],
  );

  useEffect(() => {
    const creds = getSupabaseCredentials();
    if (!creds) {
      setClient(null);
      setUser(null);
      setSession(null);
      setStore(null);
      setStatus("unknown");
      setErrorMessage(
        "Definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local (no se configura desde la app).",
      );
      return;
    }

    const c = createStockAppBrowserClient(creds.url, creds.key);
    setClient(c);

    const {
      data: { subscription },
    } = c.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      void verify(c, !!sess?.user);
    });

    void c.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      void verify(c, !!sess?.user);
    });

    return () => subscription.unsubscribe();
  }, [verify]);

  const signOut = useCallback(async () => {
    if (client) await client.auth.signOut();
  }, [client]);

  const reconnect = useCallback(() => {
    if (client) void verify(client, !!user);
  }, [client, user, verify]);

  const value = useMemo(
    () => ({
      client,
      user,
      session,
      storeId: store?.id ?? null,
      storeName: store?.name ?? null,
      status,
      errorMessage,
      reconnect,
      signOut,
    }),
    [
      client,
      user,
      session,
      store?.id,
      store?.name,
      status,
      errorMessage,
      reconnect,
      signOut,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupabase() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSupabase must be used within SupabaseProvider");
  return v;
}
