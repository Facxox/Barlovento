-- 0012_gallery_categories.sql
--
-- Crea la tabla `gallery_categories` con su propia taxonomía (separada
-- de `categories` de producto). RLS: lectura pública, escritura solo
-- admin. Seed con las 3 categorías existentes para mantener el slug
-- backward-compatible con los items de galería ya guardados.

CREATE TABLE IF NOT EXISTS public.gallery_categories (
  id text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gallery_categories read" ON public.gallery_categories;
CREATE POLICY "gallery_categories read" ON public.gallery_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "gallery_categories admin write" ON public.gallery_categories;
CREATE POLICY "gallery_categories admin write" ON public.gallery_categories
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true));

CREATE INDEX IF NOT EXISTS idx_gallery_categories_sort_order
  ON public.gallery_categories (sort_order);

INSERT INTO public.gallery_categories (id, label, sort_order, is_active) VALUES
  ('elaboracion', 'Elaboración', 1, true),
  ('producto', 'Producto', 2, true),
  ('ferias', 'Ferias', 3, true)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
