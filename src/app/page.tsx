import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Panel</h1>
        <p className="mt-2 text-zinc-400">
          Configurá Supabase en <Link href="/settings" className="text-emerald-400 underline">Config</Link>, luego usá{" "}
          <strong className="text-zinc-200">Stock</strong> para cargas y ajustes, y{" "}
          <strong className="text-zinc-200">Ventas</strong> para el carrito con escaneo.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/stock"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition hover:border-emerald-600/50"
        >
          <h2 className="text-lg font-medium text-white">Stock</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Vista en tiempo real, ajustes manuales, escaneo con cola de cambios pendientes.
          </p>
        </Link>
        <Link
          href="/sales"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition hover:border-emerald-600/50"
        >
          <h2 className="text-lg font-medium text-white">Ventas</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Carrito por código, cantidades y confirmación que descuenta stock.
          </p>
        </Link>
      </div>
    </div>
  );
}
