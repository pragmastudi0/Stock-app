"use client";

import Image from "next/image";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { QrBarcodeScanner } from "@/components/scanner/qr-barcode-scanner";
import { useSupabase } from "@/contexts/supabase-provider";
import type { StockAppProduct } from "@/lib/types/database";
import { uploadProductImage } from "@/lib/storage/product-image";

type PendingEntry = {
  product: StockAppProduct;
  delta: number;
};

type InboundState =
  | null
  | { barcode: string; product: StockAppProduct };

type NewWizard =
  | null
  | {
      barcode: string;
      step: "photo" | "form";
      file?: File;
      previewUrl?: string;
      name: string;
      brand: string;
      category: string;
      price: string;
      stock: string;
      low_stock_threshold: string;
    };

export default function StockPage() {
  const { client, status } = useSupabase();
  const [products, setProducts] = useState<StockAppProduct[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"inbound" | "queue" | null>(
    null,
  );
  const [pending, setPending] = useState<Record<string, PendingEntry>>({});
  const [inbound, setInbound] = useState<InboundState>(null);
  const [inboundQty, setInboundQty] = useState("1");
  const [newWizard, setNewWizard] = useState<NewWizard>(null);
  const [busy, setBusy] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!client) return;
    setLoadErr(null);
    const { data, error } = await client
      .from("stock_app_products")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      setLoadErr(error.message);
      return;
    }
    setProducts((data as StockAppProduct[]) ?? []);
  }, [client]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!client || status !== "connected") return;
    const channel = client
      .channel("stock_app_products_rt")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_app_products",
        },
        () => {
          void loadProducts();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, status, loadProducts]);

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold),
    [products],
  );
  const outOfStock = useMemo(() => products.filter((p) => p.stock <= 0), [products]);

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

  const handleScanResult = useCallback(
    async (code: string) => {
      if (!client) return;
      const barcode = code.trim();
      if (!barcode) return;

      if (scanTarget === "queue") {
        const p = await findByBarcode(barcode);
        if (!p) {
          alert("Código no registrado. Usá «Ingreso por escaneo» para dar de alta.");
          return;
        }
        setPending((prev) => {
          const cur = prev[p.id];
          const nextDelta = (cur?.delta ?? 0) + 1;
          return {
            ...prev,
            [p.id]: { product: p, delta: nextDelta },
          };
        });
        return;
      }

      if (scanTarget === "inbound") {
        setScannerOpen(false);
        const p = await findByBarcode(barcode);
        if (p) {
          setInbound({ barcode, product: p });
          setInboundQty("1");
        } else {
          setNewWizard({
            barcode,
            step: "photo",
            name: "",
            brand: "",
            category: "",
            price: "0",
            stock: "1",
            low_stock_threshold: "5",
          });
        }
        setScanTarget(null);
      }
    },
    [client, findByBarcode, scanTarget],
  );

  async function applyPending() {
    if (!client) return;
    setBusy(true);
    try {
      for (const entry of Object.values(pending)) {
        const { error } = await client.rpc("adjust_stock", {
          p_product_id: entry.product.id,
          p_delta: entry.delta,
        });
        if (error) throw new Error(error.message);
      }
      setPending({});
      await loadProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setBusy(false);
    }
  }

  async function confirmInbound(e: FormEvent) {
    e.preventDefault();
    if (!client || !inbound?.product) return;
    const q = Math.max(1, parseInt(inboundQty, 10) || 0);
    setBusy(true);
    try {
      const { error } = await client.rpc("adjust_stock", {
        p_product_id: inbound.product.id,
        p_delta: q,
      });
      if (error) throw new Error(error.message);
      setInbound(null);
      await loadProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function manualDelta(productId: string, delta: number) {
    if (!client) return;
    setBusy(true);
    try {
      const { error } = await client.rpc("adjust_stock", {
        p_product_id: productId,
        p_delta: delta,
      });
      if (error) throw new Error(error.message);
      await loadProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function onPhotoSelected(file: File | null) {
    if (!file || !newWizard) return;
    const previewUrl = URL.createObjectURL(file);
    setNewWizard({
      ...newWizard,
      file,
      previewUrl,
      step: "form",
    });
  }

  async function submitNewProduct(e: FormEvent) {
    e.preventDefault();
    if (!client || !newWizard) return;
    setBusy(true);
    try {
      const price = parseFloat(newWizard.price.replace(",", ".")) || 0;
      const stock = Math.max(0, parseInt(newWizard.stock, 10) || 0);
      const low = Math.max(0, parseInt(newWizard.low_stock_threshold, 10) || 5);
      const { data: inserted, error: insErr } = await client
        .from("stock_app_products")
        .insert({
          barcode: newWizard.barcode,
          name: newWizard.name.trim() || "Sin nombre",
          brand: newWizard.brand.trim() || null,
          category: newWizard.category.trim() || null,
          price,
          stock: 0,
          low_stock_threshold: low,
          image_url: null,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      const id = (inserted as { id: string }).id;

      let imageUrl: string | null = null;
      if (newWizard.file) {
        imageUrl = await uploadProductImage(client, id, newWizard.file);
        const { error: upErr } = await client
          .from("stock_app_products")
          .update({ image_url: imageUrl })
          .eq("id", id);
        if (upErr) throw new Error(upErr.message);
      }

      if (stock > 0) {
        const { error: adErr } = await client.rpc("adjust_stock", {
          p_product_id: id,
          p_delta: stock,
        });
        if (adErr) throw new Error(adErr.message);
      }

      if (newWizard.previewUrl) URL.revokeObjectURL(newWizard.previewUrl);
      setNewWizard(null);
      await loadProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "connected" || !client) {
    return (
      <p className="text-zinc-400">
        Configurá Supabase en <a href="/settings" className="text-emerald-400 underline">Config</a> para usar Stock.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Stock</h1>
          <p className="text-sm text-zinc-500">
            Vista en tiempo real · ajustes manuales · escaneo con cola opcional
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setScanTarget("inbound");
              setScannerOpen(true);
            }}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Ingreso por escaneo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setScanTarget("queue");
              setScannerOpen(true);
            }}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Escanear cola (+1)
          </button>
        </div>
      </div>

      {(lowStockProducts.length > 0 || outOfStock.length > 0) && (
        <div
          className="rounded-xl border border-amber-600/40 bg-amber-950/40 px-4 py-3 text-amber-100"
          role="status"
        >
          <p className="font-medium">Atención stock</p>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-200/90">
            {outOfStock.length > 0 && (
              <li>Sin stock: {outOfStock.map((p) => p.name || p.barcode).join(", ")}</li>
            )}
            {lowStockProducts.length > 0 && (
              <li>
                Stock bajo:{" "}
                {lowStockProducts.map((p) => `${p.name || p.barcode} (${p.stock})`).join(", ")}
              </li>
            )}
          </ul>
        </div>
      )}

      {Object.keys(pending).length > 0 && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-emerald-200">
              Ajustes pendientes (suma de escaneos +1)
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => applyPending()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Aplicar al stock
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-zinc-300">
            {Object.values(pending).map((e) => (
              <li key={e.product.id}>
                {e.product.name || e.product.barcode}{" "}
                <span className="text-emerald-400">+{e.delta}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadErr && (
        <p className="text-sm text-red-400">{loadErr}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="p-3">Producto</th>
              <th className="p-3">Código</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const critical =
                p.stock <= 0 ? "out" : p.stock <= p.low_stock_threshold ? "low" : "ok";
              return (
                <tr key={p.id} className="border-b border-zinc-800/80">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xs text-zinc-600">
                            —
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-white">
                          {critical === "out" && (
                            <span title="Sin stock" aria-label="Sin stock">
                              ⚠️
                            </span>
                          )}
                          {critical === "low" && p.stock > 0 && (
                            <span title="Stock bajo" aria-label="Stock bajo">
                              ⚠️
                            </span>
                          )}
                          {p.name || "Sin nombre"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {p.brand || "—"} · {p.category || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-zinc-400">{p.barcode}</td>
                  <td className="p-3 text-right tabular-nums">
                    <span
                      className={
                        critical === "out"
                          ? "text-red-400"
                          : critical === "low"
                            ? "text-amber-400"
                            : "text-white"
                      }
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => manualDelta(p.id, -1)}
                        className="rounded-md border border-zinc-600 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => manualDelta(p.id, 1)}
                        className="rounded-md border border-zinc-600 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-zinc-500">
                  No hay productos. Usá «Ingreso por escaneo» para crear el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <QrBarcodeScanner
        active={scannerOpen}
        onScan={(t) => void handleScanResult(t)}
        onClose={() => {
          setScannerOpen(false);
          setScanTarget(null);
        }}
        title={
          scanTarget === "queue"
            ? "Cola: cada lectura suma +1"
            : "Ingreso de mercadería"
        }
      />

      {inbound?.product && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={confirmInbound}
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
          >
            <h3 className="text-lg font-medium text-white">Ingreso de stock</h3>
            <p className="mt-2 text-sm text-zinc-400">
              {inbound.product.name} · código {inbound.barcode}
            </p>
            <label className="mt-4 block text-sm text-zinc-400">
              Unidades que entran
              <input
                type="number"
                min={1}
                value={inboundQty}
                onChange={(e) => setInboundQty(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInbound(null)}
                className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {newWizard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            {newWizard.step === "photo" && (
              <>
                <h3 className="text-lg font-medium text-white">Producto nuevo</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Código: <span className="font-mono">{newWizard.barcode}</span>
                </p>
                <p className="mt-4 text-sm text-zinc-500">
                  Sacá una foto del producto (o elegí archivo). Se guarda en Supabase Storage.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-4 block w-full text-sm text-zinc-400"
                  onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="mt-4 text-sm text-zinc-500 underline"
                  onClick={() =>
                    setNewWizard({ ...newWizard, step: "form" })
                  }
                >
                  Saltar foto
                </button>
              </>
            )}
            {newWizard.step === "form" && (
              <form onSubmit={submitNewProduct} className="space-y-3">
                <h3 className="text-lg font-medium text-white">Datos del producto</h3>
                <p className="text-xs text-zinc-500 font-mono">{newWizard.barcode}</p>
                {newWizard.previewUrl && (
                  <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-lg bg-zinc-800">
                    <Image
                      src={newWizard.previewUrl}
                      alt="Vista previa"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <label className="block text-sm">
                  <span className="text-zinc-400">Nombre</span>
                  <input
                    required
                    value={newWizard.name}
                    onChange={(e) =>
                      setNewWizard({ ...newWizard, name: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-400">Marca</span>
                  <input
                    value={newWizard.brand}
                    onChange={(e) =>
                      setNewWizard({ ...newWizard, brand: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-400">Categoría</span>
                  <input
                    value={newWizard.category}
                    onChange={(e) =>
                      setNewWizard({ ...newWizard, category: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-400">Precio</span>
                  <input
                    value={newWizard.price}
                    onChange={(e) =>
                      setNewWizard({ ...newWizard, price: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-400">Stock inicial</span>
                  <input
                    type="number"
                    min={0}
                    value={newWizard.stock}
                    onChange={(e) =>
                      setNewWizard({ ...newWizard, stock: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-400">Umbral stock bajo</span>
                  <input
                    type="number"
                    min={0}
                    value={newWizard.low_stock_threshold}
                    onChange={(e) =>
                      setNewWizard({
                        ...newWizard,
                        low_stock_threshold: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                </label>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (newWizard.previewUrl)
                        URL.revokeObjectURL(newWizard.previewUrl);
                      setNewWizard(null);
                    }}
                    className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
