"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSupabase } from "@/contexts/supabase-provider";
import {
  LS_SUPABASE_ANON_KEY,
  LS_SUPABASE_URL,
} from "@/lib/supabase/config";

export default function SettingsPage() {
  const { setCredentials, clearCredentials, status, errorMessage, reconnect, user } =
    useSupabase();
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
          Para <strong className="text-zinc-200">login y sesión</strong> hace falta{" "}
          <code className="text-zinc-300">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code className="text-zinc-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en{" "}
          <code className="text-zinc-300">.env.local</code> (el middleware no puede leer
          solo localStorage).
        </p>
        {hasEnv && (
          <p className="mt-2 text-sm text-emerald-400/90">
            Variables públicas detectadas en el build; la sesión usa esas credenciales.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        <p className="font-medium text-zinc-300">Opcional: override en el navegador</p>
        <p className="mt-1">
          Si no usás .env.local, podés guardar URL y anon key acá; reiniciá la página          después. El middleware de Next.js seguirá necesitando .env para redirigir
          correctamente al login.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
      >
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
            Guardar y recargar
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
            Borrar credenciales locales
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
        <p className="font-medium text-zinc-300">Estado</p>
        <p className="mt-1 text-zinc-500">
          {!user && "Iniciá sesión para comprobar acceso a datos."}
          {user && status === "connected" && "Conexión correcta (RLS + tablas)."}
          {user && status === "checking" && "Comprobando…"}
          {user && status === "unknown" && "Sin sesión o sin credenciales."}
          {user && status === "error" && (
            <span className="text-red-400">{errorMessage}</span>
          )}
        </p>
      </div>
    </div>
  );
}
