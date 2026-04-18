"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { useSupabase } from "@/contexts/supabase-provider";

function LoginForm() {
  const { client, errorMessage: configError } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!client) {
      setError(configError ?? "Cliente Supabase no disponible");
      return;
    }
    setLoading(true);
    try {
      const { error: signErr } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) throw signErr;
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
    >
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-sm text-zinc-400">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-zinc-400">Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const { errorMessage: configError } = useSupabase();

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Entrá con tu cuenta. ¿No tenés?{" "}
          <Link href="/signup" className="text-emerald-400 underline">
            Crear cuenta
          </Link>
        </p>
      </div>

      {configError && (
        <p className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
          {configError}
        </p>
      )}

      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl bg-zinc-900/80" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
