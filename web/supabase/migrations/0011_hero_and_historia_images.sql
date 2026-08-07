-- 0011_hero_and_historia_images.sql
--
-- Sincroniza Supabase con el nuevo modelo:
--   - `historia.images` (array de {url, caption}): si está vacío, lo
--     inicializa con la imagen legacy (`image` + `image_caption`).
--   - Crea la fila `site_content.hero` con los textos por defecto que
--     estaban hardcodeados en Hero.tsx, para que la landing siga
--     funcionando aunque el admin nunca edite el Hero.

BEGIN;

-- 1. Poblar historia.images con la imagen legacy si está vacío
UPDATE public.site_content
SET value = jsonb_set(
  value,
  '{images}',
  CASE
    WHEN value->'images' IS NULL OR jsonb_array_length(value->'images') = 0
      THEN jsonb_build_array(
        jsonb_build_object(
          'url', COALESCE(value->>'image', ''),
          'caption', value->'image_caption'
        )
      )
    ELSE value->'images'
  END
)
WHERE key = 'historia';

-- 2. Insertar hero si no existe (idempotente)
INSERT INTO public.site_content (key, value)
VALUES (
  'hero',
  '{
    "eyebrow": "Alfajores artesanales · Trinidad, Uruguay",
    "headline": "Irresistibles",
    "intro": "Elaboramos alfajores artesanales premium desde Trinidad, Uruguay, con ingredientes seleccionados y recetas que transforman cada bocado en una experiencia inolvidable.",
    "cta_label": "Ver tienda",
    "cta_href": "#tienda",
    "background_image": "/Assets/Foto hero editorial.png"
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
