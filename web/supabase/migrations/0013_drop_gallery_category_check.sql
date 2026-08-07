-- 0013_drop_gallery_category_check.sql
--
-- La categoría de cada item de galería se administra dinámicamente desde
-- /admin/categorias-galeria, así que una CHECK CONSTRAINT que whitelistee
-- los 3 slugs originales ('elaboracion', 'producto', 'ferias') rompe el
-- flujo apenas el admin crea una categoría nueva.
--
-- La constraint se removió en este commit; las migraciones futuras no la
-- recrean.

ALTER TABLE public.gallery_items DROP CONSTRAINT IF EXISTS gallery_items_category_check;
