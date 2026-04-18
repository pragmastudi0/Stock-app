"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSupabase } from "@/contexts/supabase-provider";

function StatusDot() {
  const { status, errorMessage, user } = useSupabase();
  const label = !user
    ? "Sin sesión"
    : status === "connected"
      ? "Conectado"
      : status === "checking"
        ? "Comprobando…"
        : status === "error"
          ? errorMessage ?? "Error"
          : "Listo";
  const color = !user
    ? "bg-zinc-500"
    : status === "connected"
      ? "bg-emerald-500"
      : status === "checking"
        ? "bg-amber-400 animate-pulse"
        : status === "error"
          ? "bg-red-500"
          : "bg-zinc-500";

  return (
    <div
      className="flex items-center gap-2 text-xs text-zinc-400"
      title={label}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />
      <span className="hidden max-w-[160px] truncate sm:inline">{label}</span>
    </div>
  );
}

const nav = [
  { href: "/", label: "Inicio" },
  { href: "/stock", label: "Stock" },
  { href: "/sales", label: "Ventas" },
  { href: "/settings", label: "Config" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, storeName } = useSupabase();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-white">
          Stock App
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {!isAuthPage &&
            nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  pathname === n.href
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {n.label}
              </Link>
            ))}
          {isAuthPage && (
            <span className="px-3 py-1.5 text-sm text-zinc-500">Cuenta</span>
          )}
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <StatusDot />
          {user && (
            <>
              <span className="hidden max-w-[140px] truncate text-xs text-zinc-400 sm:inline" title={user.email}>
                {storeName ? `${storeName}` : user.email}
              </span>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Salir
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
