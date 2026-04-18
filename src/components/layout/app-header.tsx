"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSupabase } from "@/contexts/supabase-provider";

function StatusDot() {
  const { status, errorMessage } = useSupabase();
  const label =
    status === "connected"
      ? "Conectado a Supabase"
      : status === "checking"
        ? "Comprobando…"
        : status === "error"
          ? errorMessage ?? "Error de conexión"
          : "Sin configurar";
  const color =
    status === "connected"
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
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
      <span className="hidden sm:inline max-w-[200px] truncate">{label}</span>
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

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-white">
          Stock App
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {nav.map((n) => (
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
        </nav>
        <StatusDot />
      </div>
    </header>
  );
}
