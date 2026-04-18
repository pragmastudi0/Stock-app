"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  active: boolean;
  onScan: (text: string) => void;
  onClose: () => void;
  title?: string;
};

function insecureContextMessage(): string {
  return [
    "Safari en el iPhone solo permite cámara en HTTPS (o en localhost en la Mac).",
    "Si entrás por http://192.168… o http://tu-ip:3000, la cámara está bloqueada.",
    "Solución: usá la URL de producción (Vercel), o en desarrollo ejecutá npm run dev:https y abrí https://… aceptando el certificado autofirmado.",
  ].join(" ");
}

function pickBackCameraId(
  cameras: { id: string; label: string }[],
): string | null {
  if (cameras.length === 0) return null;
  const byLabel = cameras.find((c) =>
    /back|rear|trasera|environment|posterior|wide|ultra/i.test(c.label),
  );
  if (byLabel) return byLabel.id;
  if (cameras.length >= 2) return cameras[cameras.length - 1]?.id ?? null;
  return cameras[0].id;
}

function humanizeCameraError(err: unknown, secureContext: boolean): string {
  if (!secureContext) return insecureContextMessage();

  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  const msg = err instanceof Error ? err.message : "";

  if (name === "NotAllowedError" || /not allowed|permission|denied/i.test(msg)) {
    return "Permiso de cámara denegado. En Ajustes → Safari → tu sitio, permití la cámara, o tocá de nuevo y aceptá el permiso.";
  }
  if (name === "NotFoundError" || /no camera|could not find/i.test(msg)) {
    return "No se detectó ninguna cámara en este dispositivo.";
  }
  if (name === "NotReadableError" || /could not start video source/i.test(msg)) {
    return "La cámara está en uso por otra app. Cerrá la otra app u otra pestaña y probá de nuevo.";
  }
  if (name === "OverconstrainedError") {
    return "No se pudo usar la cámara trasera con estos ajustes. Probá de nuevo o usá ingreso manual.";
  }

  if (msg) return msg;
  return "No se pudo abrir la cámara. Revisá permisos, que la página sea HTTPS y probá de nuevo.";
}

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

    const secureContext =
      typeof window !== "undefined" && window.isSecureContext;

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

    const scanConfig = {
      fps: 10,
      qrbox: (viewW: number, viewH: number) => {
        const min = Math.min(viewW, viewH);
        const size = Math.floor(min * 0.72);
        return { width: size, height: size };
      },
    };

    const safeStop = async (h: Html5Qrcode) => {
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
    };

    const start = async () => {
      try {
        if (!secureContext) {
          if (!cancelled) setError(insecureContextMessage());
          return;
        }

        const el = document.getElementById(containerId);
        if (!el) return;

        const h = new Html5Qrcode(containerId, { verbose: false });
        html5Ref.current = h;

        const attempts: Array<string | MediaTrackConstraints> = [
          { facingMode: "environment" },
          { facingMode: { ideal: "environment" } },
        ];

        let cams: { id: string; label: string }[] = [];
        try {
          cams = await Html5Qrcode.getCameras();
        } catch {
          cams = [];
        }
        const backId = pickBackCameraId(cams);
        if (backId) attempts.push(backId);

        attempts.push({ facingMode: "user" });

        let lastErr: unknown = null;
        for (const cameraIdOrConfig of attempts) {
          if (cancelled) return;
          try {
            await h.start(
              cameraIdOrConfig,
              scanConfig,
              onDecoded,
              () => {},
            );
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            await safeStop(h);
          }
        }

        if (lastErr != null && !cancelled) {
          setError(humanizeCameraError(lastErr, secureContext));
        }
      } catch (e) {
        if (!cancelled) {
          setError(humanizeCameraError(e, secureContext));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <div className="relative max-h-[min(92dvh,900px)] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-3 sm:px-4">
          <h2 className="min-w-0 truncate text-base font-medium text-white sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white sm:min-h-0 sm:py-1"
          >
            Cerrar
          </button>
        </div>

        <div className="relative aspect-square w-full max-h-[min(72dvh,420px)] bg-black">
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

        <div className="space-y-3 border-t border-zinc-800 p-3 sm:p-4">
          <p className="text-xs text-zinc-500">Ingreso manual</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Código de barras o QR"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white sm:min-h-0"
            />
            <button
              type="button"
              onClick={() => {
                const t = manual.trim();
                if (t) onScan(t);
              }}
              className="min-h-11 shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 sm:min-h-0"
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
