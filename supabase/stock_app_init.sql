-- Stock App — ejecutar en Supabase SQL Editor (una sola vez)
-- Tablas con prefijo stock_app_

-- Extensiones (uuid suele existir)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tablas
CREATE TABLE IF NOT EXISTS public.stock_app_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  brand text,
  category text,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_app_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  total numeric(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.stock_app_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.stock_app_sales (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.stock_app_products (id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_app_products_barcode ON public.stock_app_products (barcode);
CREATE INDEX IF NOT EXISTS idx_stock_app_sale_items_sale ON public.stock_app_sale_items (sale_id);

-- Actualizar updated_at
CREATE OR REPLACE FUNCTION public.stock_app_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_stock_app_products_updated ON public.stock_app_products;
CREATE TRIGGER tr_stock_app_products_updated
  BEFORE UPDATE ON public.stock_app_products
  FOR EACH ROW
  EXECUTE PROCEDURE public.stock_app_touch_updated_at();

-- RPC: ajuste de stock (manual y lotes)
CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock integer;
BEGIN
  UPDATE public.stock_app_products
  SET stock = stock + p_delta
  WHERE id = p_product_id
    AND stock + p_delta >= 0
  RETURNING stock INTO new_stock;

  IF new_stock IS NULL THEN
    RAISE EXCEPTION 'Stock insuficiente o producto inexistente';
  END IF;

  RETURN new_stock;
END;
$$;

-- RPC: venta atómica
CREATE OR REPLACE FUNCTION public.apply_sale_line_items(line_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_id uuid;
  line jsonb;
  pid uuid;
  qty integer;
  unit_price numeric(12, 2);
  total numeric(12, 2) := 0;
BEGIN
  IF line_items IS NULL OR jsonb_typeof(line_items) <> 'array' OR jsonb_array_length(line_items) = 0 THEN
    RAISE EXCEPTION 'line_items debe ser un array no vacío';
  END IF;

  FOR line IN SELECT * FROM jsonb_array_elements(line_items)
  LOOP
    pid := (line->>'product_id')::uuid;
    qty := (line->>'quantity')::integer;
    IF qty IS NULL OR qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;
    SELECT p.price INTO unit_price
    FROM public.stock_app_products p
    WHERE p.id = pid;
    IF unit_price IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado: %', pid;
    END IF;
    total := total + unit_price * qty;
  END LOOP;

  INSERT INTO public.stock_app_sales (total)
  VALUES (total)
  RETURNING id INTO sale_id;

  FOR line IN SELECT * FROM jsonb_array_elements(line_items)
  LOOP
    pid := (line->>'product_id')::uuid;
    qty := (line->>'quantity')::integer;
    SELECT p.price INTO unit_price
    FROM public.stock_app_products p
    WHERE p.id = pid
    FOR UPDATE;
    IF unit_price IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    INSERT INTO public.stock_app_sale_items (sale_id, product_id, quantity, unit_price)
    VALUES (sale_id, pid, qty, unit_price);
    UPDATE public.stock_app_products
    SET stock = stock - qty
    WHERE id = pid AND stock >= qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', pid;
    END IF;
  END LOOP;

  RETURN sale_id;
END;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.stock_app_products TO anon, authenticated;
GRANT ALL ON public.stock_app_sales TO anon, authenticated;
GRANT ALL ON public.stock_app_sale_items TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_sale_line_items(jsonb) TO anon, authenticated;

ALTER TABLE public.stock_app_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_app_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_app_sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_app_products_all_anon ON public.stock_app_products
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY stock_app_products_all_auth ON public.stock_app_products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY stock_app_sales_all_anon ON public.stock_app_sales
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY stock_app_sales_all_auth ON public.stock_app_sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY stock_app_sale_items_all_anon ON public.stock_app_sale_items
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY stock_app_sale_items_all_auth ON public.stock_app_sale_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime (ignorar error si ya está en la publicación)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_app_products;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_app_sales;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Storage: bucket para fotos de producto
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stock-app-product-images',
  'stock-app-product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas Storage (acceso con rol anon)
CREATE POLICY stock_app_storage_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'stock-app-product-images');

CREATE POLICY stock_app_storage_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'stock-app-product-images');

CREATE POLICY stock_app_storage_update ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'stock-app-product-images')
  WITH CHECK (bucket_id = 'stock-app-product-images');

CREATE POLICY stock_app_storage_delete ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'stock-app-product-images');
