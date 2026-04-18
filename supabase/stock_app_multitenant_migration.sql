-- Migración: de esquema anon monolítico a multitenant + auth.
-- Ejecutar en SQL Editor DESPUÉS de backup. Revisar pasos de backfill si ya hay datos.

-- 1) Tiendas y trigger de registro
CREATE TABLE IF NOT EXISTS public.stock_app_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Mi tienda',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_app_stores_owner_unique UNIQUE (owner_id)
);

CREATE OR REPLACE FUNCTION public.stock_app_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stock_app_stores (owner_id, name)
  VALUES (NEW.id, 'Mi tienda');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_stock_app_auth_user_created ON auth.users;
CREATE TRIGGER on_stock_app_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.stock_app_handle_new_user();

-- Tiendas para usuarios ya existentes (sin tienda)
INSERT INTO public.stock_app_stores (owner_id, name)
SELECT u.id, 'Mi tienda'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_app_stores s WHERE s.owner_id = u.id
);

-- 2) Columnas store_id (nullable primero)
ALTER TABLE public.stock_app_products  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stock_app_stores (id) ON DELETE CASCADE;

ALTER TABLE public.stock_app_sales
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stock_app_stores (id) ON DELETE CASCADE;

-- 3) Backfill: asignar toda la data huérfana a la primera tienda (ajustar si tenés varios dueños)
UPDATE public.stock_app_products p
SET store_id = (SELECT id FROM public.stock_app_stores ORDER BY created_at LIMIT 1)
WHERE p.store_id IS NULL;

UPDATE public.stock_app_sales sa
SET store_id = (SELECT id FROM public.stock_app_stores ORDER BY created_at LIMIT 1)
WHERE sa.store_id IS NULL;

-- Si quedan NULL por no haber tiendas, crear una mínima requiere un usuario manual.

ALTER TABLE public.stock_app_products
  ALTER COLUMN store_id SET NOT NULL;

ALTER TABLE public.stock_app_sales
  ALTER COLUMN store_id SET NOT NULL;

-- 4) Unicidad barcode por tienda
ALTER TABLE public.stock_app_products
  DROP CONSTRAINT IF EXISTS stock_app_products_barcode_key;

ALTER TABLE public.stock_app_products
  DROP CONSTRAINT IF EXISTS stock_app_products_store_barcode_unique;

ALTER TABLE public.stock_app_products
  ADD CONSTRAINT stock_app_products_store_barcode_unique UNIQUE (store_id, barcode);

-- 5) Funciones trigger (mismo cuerpo que stock_app_init.sql)
CREATE OR REPLACE FUNCTION public.stock_app_set_row_store_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  sid uuid;
BEGIN
  SELECT s.id INTO sid
  FROM public.stock_app_stores s
  WHERE s.owner_id = auth.uid();
  IF sid IS NULL THEN
    RAISE EXCEPTION 'No hay tienda para el usuario actual';
  END IF;
  IF NEW.store_id IS NOT NULL AND NEW.store_id <> sid THEN
    RAISE EXCEPTION 'store_id no válido para tu usuario';
  END IF;
  NEW.store_id := sid;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stock_app_validate_sale_item_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  s_store uuid;
  p_store uuid;
BEGIN
  SELECT sa.store_id INTO s_store FROM public.stock_app_sales sa WHERE sa.id = NEW.sale_id;
  SELECT p.store_id INTO p_store FROM public.stock_app_products p WHERE p.id = NEW.product_id;
  IF s_store IS NULL OR p_store IS NULL OR s_store <> p_store THEN
    RAISE EXCEPTION 'El producto no pertenece a la misma tienda que la venta';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_stock_app_products_store ON public.stock_app_products;
CREATE TRIGGER tr_stock_app_products_store
  BEFORE INSERT ON public.stock_app_products
  FOR EACH ROW
  EXECUTE PROCEDURE public.stock_app_set_row_store_id();

DROP TRIGGER IF EXISTS tr_stock_app_sales_store ON public.stock_app_sales;
CREATE TRIGGER tr_stock_app_sales_store
  BEFORE INSERT ON public.stock_app_sales
  FOR EACH ROW
  EXECUTE PROCEDURE public.stock_app_set_row_store_id();

DROP TRIGGER IF EXISTS tr_stock_app_sale_items_store ON public.stock_app_sale_items;
CREATE TRIGGER tr_stock_app_sale_items_store
  BEFORE INSERT ON public.stock_app_sale_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.stock_app_validate_sale_item_store();

-- 6) RPCs multitenant (mismas definiciones que stock_app_init.sql)

CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock integer;
  v_store uuid;
BEGIN
  SELECT s.id INTO v_store
  FROM public.stock_app_stores s
  WHERE s.owner_id = auth.uid();
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Sin tienda asociada';
  END IF;

  UPDATE public.stock_app_products p
  SET stock = p.stock + p_delta
  WHERE p.id = p_product_id
    AND p.store_id = v_store
    AND p.stock + p_delta >= 0
  RETURNING p.stock INTO new_stock;

  IF new_stock IS NULL THEN
    RAISE EXCEPTION 'Stock insuficiente, producto inexistente o no pertenece a tu tienda';
  END IF;

  RETURN new_stock;
END;
$$;

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
  v_store uuid;
BEGIN
  SELECT s.id INTO v_store
  FROM public.stock_app_stores s
  WHERE s.owner_id = auth.uid();
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Sin tienda asociada';
  END IF;

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
    WHERE p.id = pid AND p.store_id = v_store;
    IF unit_price IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado: %', pid;
    END IF;
    total := total + unit_price * qty;
  END LOOP;

  INSERT INTO public.stock_app_sales (store_id, total)
  VALUES (v_store, total)
  RETURNING id INTO sale_id;

  FOR line IN SELECT * FROM jsonb_array_elements(line_items)
  LOOP
    pid := (line->>'product_id')::uuid;
    qty := (line->>'quantity')::integer;
    SELECT p.price INTO unit_price
    FROM public.stock_app_products p
    WHERE p.id = pid AND p.store_id = v_store
    FOR UPDATE;
    IF unit_price IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    INSERT INTO public.stock_app_sale_items (sale_id, product_id, quantity, unit_price)
    VALUES (sale_id, pid, qty, unit_price);
    UPDATE public.stock_app_products p
    SET stock = p.stock - qty
    WHERE p.id = pid AND p.store_id = v_store AND p.stock >= qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', pid;
    END IF;
  END LOOP;

  RETURN sale_id;
END;
$$;

-- 7) Políticas y permisos (eliminar anon abierto)

DROP POLICY IF EXISTS stock_app_products_all_anon ON public.stock_app_products;
DROP POLICY IF EXISTS stock_app_sales_all_anon ON public.stock_app_sales;
DROP POLICY IF EXISTS stock_app_sale_items_all_anon ON public.stock_app_sale_items;
DROP POLICY IF EXISTS stock_app_products_all_auth ON public.stock_app_products;
DROP POLICY IF EXISTS stock_app_sales_all_auth ON public.stock_app_sales;
DROP POLICY IF EXISTS stock_app_sale_items_all_auth ON public.stock_app_sale_items;

REVOKE ALL ON public.stock_app_stores FROM PUBLIC;
REVOKE ALL ON public.stock_app_products FROM PUBLIC;
REVOKE ALL ON public.stock_app_sales FROM PUBLIC;
REVOKE ALL ON public.stock_app_sale_items FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.stock_app_stores TO authenticated;
GRANT ALL ON public.stock_app_products TO authenticated;
GRANT ALL ON public.stock_app_sales TO authenticated;
GRANT ALL ON public.stock_app_sale_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_sale_line_items(jsonb) TO authenticated;

ALTER TABLE public.stock_app_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_app_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_app_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_app_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_app_stores_owner_select ON public.stock_app_stores;
CREATE POLICY stock_app_stores_owner_select ON public.stock_app_stores
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS stock_app_stores_owner_update ON public.stock_app_stores;
CREATE POLICY stock_app_stores_owner_update ON public.stock_app_stores
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS stock_app_products_tenant ON public.stock_app_products;
CREATE POLICY stock_app_products_tenant ON public.stock_app_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_app_stores s
      WHERE s.id = stock_app_products.store_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_app_stores s
      WHERE s.id = stock_app_products.store_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS stock_app_sales_tenant ON public.stock_app_sales;
CREATE POLICY stock_app_sales_tenant ON public.stock_app_sales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_app_stores s
      WHERE s.id = stock_app_sales.store_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_app_stores s
      WHERE s.id = stock_app_sales.store_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS stock_app_sale_items_tenant ON public.stock_app_sale_items;
CREATE POLICY stock_app_sale_items_tenant ON public.stock_app_sale_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stock_app_sales sa
      JOIN public.stock_app_stores s ON s.id = sa.store_id
      WHERE sa.id = stock_app_sale_items.sale_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.stock_app_sales sa
      JOIN public.stock_app_stores s ON s.id = sa.store_id
      WHERE sa.id = stock_app_sale_items.sale_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS stock_app_storage_insert ON storage.objects;
DROP POLICY IF EXISTS stock_app_storage_update ON storage.objects;
DROP POLICY IF EXISTS stock_app_storage_delete ON storage.objects;

CREATE POLICY stock_app_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'stock-app-product-images'
    AND (string_to_array(name, '/'))[1] = (
      SELECT st.id::text FROM public.stock_app_stores st WHERE st.owner_id = auth.uid()
    )
  );

CREATE POLICY stock_app_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'stock-app-product-images'
    AND (string_to_array(name, '/'))[1] = (
      SELECT st.id::text FROM public.stock_app_stores st WHERE st.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'stock-app-product-images'
    AND (string_to_array(name, '/'))[1] = (
      SELECT st.id::text FROM public.stock_app_stores st WHERE st.owner_id = auth.uid()
    )
  );

CREATE POLICY stock_app_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'stock-app-product-images'
    AND (string_to_array(name, '/'))[1] = (
      SELECT st.id::text FROM public.stock_app_stores st WHERE st.owner_id = auth.uid()
    )
  );
