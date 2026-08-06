-- 0005_categories.sql
--
-- Crea la tabla `categories` para administrar las categorías de alfajores
-- desde el panel admin. Reemplaza el dropdown hardcodeado de ProductoForm.tsx
-- (clasicos / chocolate / especiales) por una lista administrable.
--
-- Decisiones de diseño:
--   - PK = slug textual (ej: 'clasicos'). Es el valor que se guarda en
--     `products.category` / `wholesale_products.category`, así que no hay
--     que migrar datos existentes.
--   - `label` es el nombre legible para mostrar en UI y filtros.
--   - `sort_order` define el orden en chips/filtros del storefront.
--   - `is_active` permite ocultar categorías sin perder histórico de
--     productos que las usen.
--   - El storefront sigue derivando categorías de products con
--     Array.from(new Set(...)) como fallback — esta tabla es la fuente
--     para ProductoForm y para un eventual filtro del Tienda.
--
-- Aplicar: pegar en SQL Editor o usar `supabase db push`.

CREATE TABLE IF NOT EXISTS public.categories (
  id text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories read" ON public.categories;
CREATE POLICY "categories read" ON public.categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write" ON public.categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS idx_categories_sort
  ON public.categories (sort_order);

-- Seed inicial — replica el dropdown anterior para no romper nada.
INSERT INTO public.categories (id, label, sort_order, is_active) VALUES
  ('clasicos',   'Clásicos',   1, true),
  ('chocolate',  'Chocolate',  2, true),
  ('especiales', 'Especiales', 3, true)
ON CONFLICT (id) DO NOTHING;
