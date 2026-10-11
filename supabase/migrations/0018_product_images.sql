-- =================================================================
-- Barlovento · 0018_product_images
-- =================================================================
-- Galería de imágenes por producto.
--
-- - Tabla `product_images` con 1 fila por foto asociada a un producto.
--   `sort_order` se persiste en DB para que el orden sobreviva al
--   renombrado/borrado y la galería quede estable entre cargas.
-- - `is_primary` marca la foto principal; usada en catálogo, búsqueda
--   y como preview. Sólo puede haber UNA `is_primary = true` por
--   producto: lo garantiza un índice parcial único.
-- - RLS:
--     * Lectura pública (igual que `products`).
--     * Escritura sólo admin (authenticated).
-- - Bucket "barlovento-media" ya existe (0001_init.sql). Las URLs
--   públicas siguen el patrón /storage/v1/object/public/barlovento-media/...
-- - Migración idempotente. NO modifica la columna legacy `image` de
--   `products`: mantiene compatibilidad con todos los seeds existentes.
-- =================================================================

create table if not exists public.product_images (
  id          bigserial primary key,
  product_id  text not null references public.products(id) on delete cascade,
  url         text not null,
  alt         text,
  sort_order  integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists product_images_product_sort_idx
  on public.product_images (product_id, sort_order);

-- Garantiza 1 sola imagen primaria por producto. Los inserts/updates
-- desde el admin deben coordinar esto (típicamente dentro de la misma
-- transacción: clear otras primarias -> set nueva primaria).
create unique index if not exists product_images_one_primary_per_product
  on public.product_images (product_id)
  where is_primary = true;

alter table public.product_images enable row level security;

-- Lectura pública (el join se hace desde el storefront que ya filtra
-- is_active en products; este select sin filtro mantiene simetría con
-- los policies existentes en `products`/`gallery_items`).
drop policy if exists "product_images public read" on public.product_images;
create policy "product_images public read"
  on public.product_images for select
  using (true);

-- Admin puede todo.
drop policy if exists "product_images admin write" on public.product_images;
create policy "product_images admin write"
  on public.product_images for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Trigger para mantener updated_at en products coherente cuando se
-- modifica la galería (puramente informativo, ayuda a invalidar caches).
create or replace function public.touch_product_on_image_change()
returns trigger language plpgsql as $$
begin
  update public.products
     set updated_at = now()
   where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_product_images_touch on public.product_images;
create trigger trg_product_images_touch
  after insert or update or delete on public.product_images
  for each row execute function public.touch_product_on_image_change();
