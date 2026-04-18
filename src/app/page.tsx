"use client";

import Link from "next/link";
import { useSupabase } from "@/contexts/supabase-provider";

export default function HomePage() {
  const { storeName, user } = useSupabase();

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Panel</h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">
          {user &&
            (storeName ? (
              <>
                Tienda: <strong className="text-zinc-200">{storeName}</strong>.{" "}
              </>
            ) : (
              <>Tu tienda está lista. </>
            ))}
          Elegí <strong className="text-zinc-200">Stock</strong> o{" "}
          <strong className="text-zinc-200">Ventas</strong>.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Link
          href="/stock"
          className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition active:border-emerald-600/50 sm:p-6 sm:hover:border-emerald-600/50"
        >
          <h2 className="text-base font-medium text-white sm:text-lg">Stock</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Vista en tiempo real, ajustes y escaneo con cola.
          </p>
        </Link>
        <Link
          href="/sales"
          className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition active:border-emerald-600/50 sm:p-6 sm:hover:border-emerald-600/50"
        >
          <h2 className="text-base font-medium text-white sm:text-lg">Ventas</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Carrito por código y confirmación de venta.
          </p>
        </Link>
      </div>
    </div>
  );
}
