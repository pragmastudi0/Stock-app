"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  active: boolean;
  onScan: (text: string) => void;
  onClose: () => void;
  title?: string;
};

export function QrBarcodeScanner({
  active,
  onScan,
  onClose,
  title = "Escanear código",
}: Props) {
  const regionId = useId().replace(/:/g, "");
  const containerId = `qr-region-${regionId}`;
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stopCamera = useCallback(async () => {
    const h = html5Ref.current;
    html5Ref.current = null;
    if (!h) return;
    try {
      await h.stop();
    } catch {
      /* ignore */
    }
    try {
      h.clear();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!active) {
      void stopCamera();
      setError(null);
      return;
    }

    let cancelled = false;
    setStarting(true);
    setError(null);

    const onDecoded = (decodedText: string) => {
      const h = html5Ref.current;
      if (h) {
        try {
          void h.pause(true);
        } catch {
          /* ignore */
        }
      }
      onScan(decodedText.trim());
      setTimeout(() => {
        const cur = html5Ref.current;
        if (cur) {
          try {
            void cur.resume();
          } catch {
            /* ignore */
          }
        }
      }, 500);
    };

    const start = async () => {
      const el = document.getElementById(containerId);
      if (!el) return;
      const h = new Html5Qrcode(containerId, { verbose: false });
      html5Ref.current = h;
      try {
        await h.start(
          { facingMode: { ideal: "environment" } },
          {
            fps: 10,
            qrbox: (viewW, viewH) => {
              const min = Math.min(viewW, viewH);
              const size = Math.floor(min * 0.72);
              return { width: size, height: size };
            },
          },
          onDecoded,
          () => {},
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo abrir la cámara. Probá permisos o HTTPS.",
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [active, containerId, onScan, stopCamera]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-lg font-medium text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            Cerrar
          </button>
        </div>

        <div className="relative aspect-square w-full max-h-[min(70vh,420px)] bg-black">
          <div id={containerId} className="h-full w-full [&_video]:h-full [&_video]:object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div className="relative h-full max-h-[280px] w-full max-w-[280px] rounded-xl border-2 border-emerald-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-x-4 top-4 h-0.5 animate-scan-line bg-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            </div>
          </div>
        </div>

        {starting && (
          <p className="px-4 py-2 text-center text-sm text-zinc-400">
            Iniciando cámara…
          </p>
        )}
        {error && (
          <p className="px-4 py-2 text-center text-sm text-red-400">{error}</p>
        )}

        <div className="space-y-3 border-t border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Ingreso manual</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Código de barras o QR"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => {
                const t = manual.trim();
                if (t) onScan(t);
              }}
              className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Usar
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs text-zinc-500">Simulación (demo)</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onScan("5901234123457")}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Demo EAN
              </button>
              <button
                type="button"
                onClick={() => onScan("DEMO-QR-APPLE-20W")}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Demo cargador
              </button>
              <button
                type="button"
                onClick={() => onScan("DEMO-GENERIC-001")}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Demo genérico
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
