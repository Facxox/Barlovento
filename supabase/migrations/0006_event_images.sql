-- 0006_event_images.sql
-- Múltiples fotos por evento. La columna events.image sigue siendo
-- la portada; las demás viven acá ordenadas por position.

create table if not exists public.event_images (
  id          bigserial primary key,
  event_id    bigint not null references public.events(id) on delete cascade,
  url         text   not null,
  position    int    not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists event_images_event_position
  on public.event_images (event_id, position);

alter table public.event_images enable row level security;

drop policy if exists "event_images public read" on public.event_images;
create policy "event_images public read"
  on public.event_images for select using (true);

drop policy if exists "event_images admin write" on public.event_images;
create policy "event_images admin write"
  on public.event_images for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Backfill: copiar la portada actual como primera imagen de cada
-- evento que tenga image. No falla si ya hay filas.
insert into public.event_images (event_id, url, position)
select id, image, 0 from public.events
where image is not null and image <> ''
on conflict do nothing;
