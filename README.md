# Stock App

Next.js + Supabase: **multi-usuario** (una tienda por cuenta), stock en tiempo real, ventas con escaneo QR/código de barras y fotos en Storage. Login y registro con email/contraseña.

## Requisitos

- Node 20+
- Proyecto en [Supabase](https://supabase.com)

## Auth (sin verificación de email)

En Supabase: **Authentication → Providers → Email** → desactivá **Confirm email** (o equivalente), para que el alta sea inmediata y el usuario pueda entrar sin abrir un link del correo.

## Variables de entorno

Copiá [`.env.example`](.env.example) a `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Son necesarias para **cliente, sesión y middleware** (incluidas las redirecciones a `/login`). No hay otra forma de configurar el proyecto Supabase en la app: todo pasa por estas variables.

## Base de datos y Storage

1. **Proyecto nuevo:** en **SQL Editor** ejecutá [`supabase/stock_app_init.sql`](supabase/stock_app_init.sql).
2. **Ya tenías el esquema viejo (anon abierto):** hacé backup y aplicá [`supabase/stock_app_multitenant_migration.sql`](supabase/stock_app_multitenant_migration.sql), o migrá manualmente según las notas del archivo.
3. Realtime: el script suma tablas a `supabase_replication` / publicación `supabase_realtime` si aplica.
4. Fotos: bucket `stock-app-product-images`, rutas `{store_id}/{product_id}/archivo`.

**Modelo:** tabla `stock_app_stores` (1 por usuario), `store_id` en productos y ventas, RLS solo para rol `authenticated`, RPCs `adjust_stock` y `apply_sale_line_items` con aislamiento por tienda.

## App local

```bash
cd stock-app
npm install
cp .env.example .env.local
# Editá .env.local con tu proyecto
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) → **Crear cuenta** o **Iniciar sesión** → Stock / Ventas.

### Cámara / escáner en el iPhone

Safari **no permite** usar la cámara si la página es **HTTP** salvo excepciones como `localhost`. Si abrís la app desde la Mac con `http://192.168.x.x:3000`, el escáner va a fallar.

- **Producción:** usá la URL **HTTPS** de Vercel (o tu hosting); ahí la cámara funciona con permisos normales.
- **Desarrollo desde la red local:** ejecutá `npm run dev:https` y entrá con **`https://<tu-ip>:3000`**. El certificado es autofirmado: en el iPhone tocá **Avanzado** → **Continuar** (o equivalente) la primera vez.

## Flujo de verificación manual

1. Registro e inicio de sesión.
2. **Stock:** ingreso por escaneo o demo, producto nuevo con foto opcional.
3. **Ventas:** carrito, confirmar venta, comprobar stock e historial.
4. Segundo usuario: datos distintos (otra tienda), mismo barcode permitido en otro tenant.

## Scripts

| Comando | Descripción      |
|----------------|------------------|
| `npm run dev`    | Desarrollo       |
| `npm run dev:https` | Desarrollo con HTTPS (útil para probar la cámara desde el iPhone en la red local) |
| `npm run build`  | Build producción |
| `npm run start`  | Servir build     |
| `npm run lint`   | ESLint           |

## GitHub

[GITHUB_SETUP.md](GITHUB_SETUP.md)
