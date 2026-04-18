# Stock App

Next.js + Supabase: stock en tiempo real, ventas con carrito por escaneo QR/código de barras, fotos en Storage y panel de configuración (URL + anon key en el navegador).

## Requisitos

- Node 20+
- Proyecto en [Supabase](https://supabase.com) (gratis OK)

## Base de datos y Storage

1. En Supabase: **SQL Editor** → pegá y ejecutá el script [`supabase/stock_app_init.sql`](supabase/stock_app_init.sql) (una sola vez).
2. Verificá en **Database → Replication** que `stock_app_products` (y si querés `stock_app_sales`) estén publicados para Realtime (el script intenta añadirlos a `supabase_realtime`).
3. El bucket `stock-app-product-images` queda creado para fotos públicas.

> **Seguridad:** las políticas RLS permiten acceso amplio al rol `anon` para este esquema. Usá un proyecto Supabase dedicado a la tienda; para producción con usuarios reales, endurecé políticas y Auth.

## App local

```bash
cd stock-app
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) → **Config** → pegá la **URL del proyecto** y la **anon key** (Settings → API en Supabase) → Guardar y probar.

## Flujo de verificación manual

1. **Config:** estado “Conectado” y sin error en la tabla `stock_app_products`.
2. **Stock → Ingreso por escaneo:** botón demo “Demo genérico” (o escanear) → si no existe, completá foto (opcional) y datos → el producto aparece en la grilla.
3. **Stock → Escanear cola (+1):** varias lecturas del mismo código → **Aplicar al stock** y comprobar que el stock sube.
4. **Ventas:** escanear el mismo producto → ajustar cantidades → **Confirmar venta** → el stock baja y el historial muestra el total.
5. **Móvil:** servir con HTTPS (p. ej. `ngrok` o deploy en Vercel) para que la cámara funcione.

## Scripts

| Comando    | Descripción      |
|-----------|------------------|
| `npm run dev`   | Desarrollo       |
| `npm run build` | Build producción |
| `npm run start` | Servir build     |
| `npm run lint`  | ESLint           |

## GitHub

Para crear el repo `pragmastudi0/Stock-app` y subir el código, seguí [GITHUB_SETUP.md](GITHUB_SETUP.md).
