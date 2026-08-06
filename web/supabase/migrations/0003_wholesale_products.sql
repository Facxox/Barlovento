-- 0003_wholesale_products.sql
--
-- Crea la tabla `wholesale_products` para administrar el catálogo mayorista
-- por separado del minorista (`products`). Los mayoristas SIEMPRE coordinan
-- por WhatsApp, así que estos productos NO aparecen en la home pública
-- (la `Tienda` solo lee `products`) y el checkout les oculta Mercado Pago.
--
-- Reglas:
--   - Lectura pública (anon + authenticated): ven SOLO los productos activos
--     desde Supabase (mismo patrón que `products`); el `Tienda` de todos
--     modos no la consume.
--   - Escritura (insert/update/delete): SOLO admin, igual que `products`.
--   - El default es price=0; el admin edita el precio mayorista en
--     /admin/productos (tab Mayoristas) o después de clonar desde uno
--     minorista con el botón "Clonar a mayorista".
--
-- Aplicar: pegar en SQL Editor o usar `supabase db push`.

CREATE TABLE IF NOT EXISTS public.wholesale_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'UYU',
  category text NOT NULL DEFAULT 'clasicos',
  image text NOT NULL DEFAULT '',
  badge text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wholesale_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wholesale_products read" ON public.wholesale_products;
CREATE POLICY "wholesale_products read" ON public.wholesale_products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "wholesale_products admin write" ON public.wholesale_products;
CREATE POLICY "wholesale_products admin write" ON public.wholesale_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS idx_wholesale_products_sort
  ON public.wholesale_products (sort_order);