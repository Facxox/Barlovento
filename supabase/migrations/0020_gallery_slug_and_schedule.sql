-- 0020_gallery_slug_and_schedule.sql
--
-- Galería:
--   * `slug`: cada foto tiene URL propia en /galeria/<slug> (se usa para
--     imprimir QRs que llevan directo a una imagen). Único y obligatorio.
--   * `publish_at`: publicación programada. NULL = publicada ya; si es una
--     fecha futura la foto queda oculta al público hasta ese momento.
--
-- RLS:
--   * La lectura pública solo devuelve fotos ya publicadas.
--   * La escritura (y la lectura de programadas) pasa a requerir
--     profiles.is_admin. Antes alcanzaba con estar logueado, lo que dejaba
--     a cualquier cliente editar la galería.
--   * Fix de `is_admin(uid)`: corre con search_path '' pero referenciaba
--     `profiles` sin esquema, así que fallaba ("relation profiles does not
--     exist") cada vez que la policy de profiles la evaluaba para un usuario
--     no admin. Ahora usa `public.profiles`.
--
-- Idempotente.

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = uid AND is_admin = true
    );
$function$;

ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS publish_at timestamptz;

-- Backfill: slug desde el título (sin acentos, minúsculas, guiones).
WITH base AS (
  SELECT
    id,
    COALESCE(
      NULLIF(
        left(
          trim(BOTH '-' FROM regexp_replace(
            translate(lower(title), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
            '[^a-z0-9]+', '-', 'g'
          )),
          80
        ),
        ''
      ),
      'foto-' || id
    ) AS s
  FROM public.gallery_items
  WHERE slug IS NULL OR slug = ''
),
ranked AS (
  SELECT
    b.id,
    b.s,
    row_number() OVER (PARTITION BY b.s ORDER BY b.id) AS rn
  FROM base b
)
UPDATE public.gallery_items g
SET slug = CASE
  WHEN r.rn = 1
    AND NOT EXISTS (
      SELECT 1 FROM public.gallery_items o
      WHERE o.slug = r.s AND o.id <> r.id
    )
  THEN r.s
  ELSE r.s || '-' || g.id
END
FROM ranked r
WHERE g.id = r.id;

ALTER TABLE public.gallery_items ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gallery_items_slug_key
  ON public.gallery_items (slug);
CREATE INDEX IF NOT EXISTS gallery_items_publish_at
  ON public.gallery_items (publish_at);

-- RLS
DROP POLICY IF EXISTS "gallery public read" ON public.gallery_items;
CREATE POLICY "gallery public read" ON public.gallery_items
  FOR SELECT USING (publish_at IS NULL OR publish_at <= now());

DROP POLICY IF EXISTS "gallery admin write" ON public.gallery_items;
CREATE POLICY "gallery admin write" ON public.gallery_items
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true));
