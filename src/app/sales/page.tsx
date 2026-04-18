"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QrBarcodeScanner } from "@/components/scanner/qr-barcode-scanner";
import { useSupabase } from "@/contexts/supabase-provider";
import type { StockAppProduct, StockAppSale } from "@/lib/types/database";

type CartLine = {
  product: StockAppProduct;
  quantity: number;
};

export default function SalesPage() {
  const { client, status, user } = useSupabase();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sales, setSales] = useState<StockAppSale[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSales = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client
      .from("stock_app_sales")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      setErr(error.message);
      return;
    }
    setSales((data as StockAppSale[]) ?? []);
  }, [client]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const findByBarcode = useCallback(
    async (barcode: string) => {
      if (!client) return null;
      const { data, error } = await client
        .from("stock_app_products")
        .select("*")
        .eq("barcode", barcode)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as StockAppProduct | null;
    },
    [client],
  );

  const onScan = useCallback(
    async (code: string) => {
      const barcode = code.trim();
      if (!barcode) return;
      const p = await findByBarcode(barcode);
      if (!p) {
        alert("Producto no encontrado. Cargalo primero en Stock.");
        return;
      }
      if (p.stock <= 0) {
        alert("Sin stock disponible.");
        return;
      }
      setCart((prev) => {
        const i = prev.findIndex((l) => l.product.id === p.id);
        if (i >= 0) {
          const next = [...prev];
          const q = next[i].quantity + 1;
          if (q > p.stock) {
            alert(`Stock máximo disponible: ${p.stock}`);
            return prev;
          }
          next[i] = { ...next[i], quantity: q };
          return next;
        }
        return [...prev, { product: p, quantity: 1 }];
      });
    },
    [findByBarcode],
  );

  const setQty = (productId: string, q: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.product.id !== productId) return line;
          const max = line.product.stock;
          const n = Math.max(1, Math.min(q, max));
          return { ...line, quantity: n };
        })
        .filter((line) => line.quantity > 0),
    );
  };

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  };

  const total = useMemo(
    () =>
      cart.reduce(
        (s, l) => s + Number(l.product.price) * l.quantity,
        0,
      ),
    [cart],
  );

  async function confirmSale() {
    if (!client || cart.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const line_items = cart.map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
      }));
      const { error } = await client.rpc("apply_sale_line_items", {
        line_items,
      });
      if (error) throw new Error(error.message);
      setCart([]);
      await loadSales();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error en la venta");
    } finally {
      setBusy(false);
    }
  }

  if (!user || !client) {
    return (
      <p className="text-zinc-400">
        <a href="/login" className="text-emerald-400 underline">
          Iniciá sesión
        </a>{" "}
        para usar Ventas.
      </p>
    );
  }

  if (status !== "connected") {
    return (
      <p className="text-zinc-400">
        {status === "error"
          ? "Error de conexión. Revisá Config o el SQL multitenant."
          : "Conectando…"}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Ventas</h1>
          <p className="text-sm text-zinc-500">
            Escanear para agregar al carrito · confirmar descuenta stock
          </p>
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Escanear producto
        </button>
      </div>

      <QrBarcodeScanner
        active={scannerOpen}
        onScan={(t) => void onScan(t)}
        onClose={() => setScannerOpen(false)}
        title="Ventas — escanear código"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="text-lg font-medium text-white">Carrito</h2>
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
          {cart.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Vacío. Escanear para agregar.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {cart.map((line) => (
                <li
                  key={line.product.id}
                  className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                    {line.product.image_url ? (
                      <Image
                        src={line.product.image_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-zinc-600">
                        —
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">
                      {line.product.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      ${Number(line.product.price).toFixed(2)} c/u · máx{" "}
                      {line.product.stock}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-zinc-600 px-2 py-0.5 text-sm"
                        onClick={() =>
                          setQty(line.product.id, line.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <span className="tabular-nums text-sm">{line.quantity}</span>
                      <button
                        type="button"
                        className="rounded border border-zinc-600 px-2 py-0.5 text-sm"
                        onClick={() =>
                          setQty(line.product.id, line.quantity + 1)
                        }
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-xs text-red-400 hover:underline"
                        onClick={() => removeLine(line.product.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {cart.length > 0 && (
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <p className="flex justify-between text-lg font-semibold text-white">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmSale()}
                className="mt-4 w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Confirmar venta
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="text-lg font-medium text-white">Historial</h2>
          <ul className="mt-4 max-h-[480px] space-y-2 overflow-auto text-sm">
            {sales.map((s) => (
              <li
                key={s.id}
                className="flex justify-between rounded-lg border border-zinc-800/80 px-3 py-2 text-zinc-300"
              >
                <span className="text-zinc-500">
                  {new Date(s.created_at).toLocaleString()}
                </span>
                <span className="font-medium tabular-nums text-emerald-400">
                  ${Number(s.total).toFixed(2)}
                </span>
              </li>
            ))}
            {sales.length === 0 && (
              <li className="text-zinc-500">Sin ventas aún.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
