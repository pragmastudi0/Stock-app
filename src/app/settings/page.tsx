"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSupabase } from "@/contexts/supabase-provider";
import {
  LS_SUPABASE_ANON_KEY,
  LS_SUPABASE_URL,
} from "@/lib/supabase/config";

export default function SettingsPage() {
  const { setCredentials, clearCredentials, status, errorMessage, reconnect } =
    useSupabase();
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrl(localStorage.getItem(LS_SUPABASE_URL) ?? "");
    setKey(localStorage.getItem(LS_SUPABASE_ANON_KEY) ?? "");
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setCredentials(url, key);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Configuración Supabase</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pegá la URL del proyecto y la clave <code className="text-zinc-300">anon</code> / publishable. Se guardan solo en este navegador.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <label className="block space-y-1">
          <span className="text-sm text-zinc-400">URL del proyecto</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-400">API Key (anon)</span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="eyJ..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Guardar y probar
          </button>
          <button
            type="button"
            onClick={() => reconnect()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Probar de nuevo
          </button>
          <button
            type="button"
            onClick={() => {
              clearCredentials();
              setUrl("");
              setKey("");
            }}
            className="rounded-lg border border-red-900/50 px-4 py-2 text-sm text-red-300 hover:bg-red-950/40"
          >
            Borrar credenciales
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
        <p className="font-medium text-zinc-300">Estado</p>
        <p className="mt-1 text-zinc-500">
          {status === "connected" && "Conexión correcta (tabla stock_app_products accesible)."}
          {status === "checking" && "Comprobando…"}
          {status === "unknown" && "Aún no hay credenciales guardadas."}
          {status === "error" && (
            <span className="text-red-400">{errorMessage}</span>
          )}
        </p>
      </div>
    </div>
  );
}
