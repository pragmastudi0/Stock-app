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
      className="flex shrink-0 items-center gap-2 text-xs text-zinc-400"
      title={label}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />
      <span className="max-w-[100px] truncate sm:max-w-[160px]">{label}</span>
    </div>
  );
}

const nav = [
  { href: "/stock", label: "Stock" },
  { href: "/sales", label: "Ventas" },
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
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
          <Link
            href={user ? "/stock" : "/login"}
            className="min-h-[44px] min-w-0 shrink-0 content-center font-semibold tracking-tight text-white"
          >
            Stock App
          </Link>
          {!isAuthPage && user && (
            <span className="truncate text-xs text-zinc-500 sm:hidden">
              {storeName || user.email}
            </span>
          )}
        </div>

        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 sm:mx-0 sm:flex-1 sm:justify-center sm:overflow-visible sm:pb-0">
          {!isAuthPage &&
            user &&
            nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`shrink-0 rounded-md px-4 py-2.5 text-sm transition sm:py-1.5 ${
                  pathname === n.href
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {n.label}
              </Link>
            ))}
          {isAuthPage && (
            <span className="px-3 py-2.5 text-sm text-zinc-500 sm:py-1.5">
              Cuenta
            </span>
          )}
        </nav>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          {!isAuthPage && user && <StatusDot />}
          {user && (
            <>
              <span
                className="hidden max-w-[140px] truncate text-xs text-zinc-400 sm:inline"
                title={user.email ?? undefined}
              >
                {storeName || user.email}
              </span>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-md border border-zinc-600 px-3 text-xs text-zinc-300 hover:bg-zinc-800 sm:min-h-0 sm:min-w-0 sm:py-1"
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
