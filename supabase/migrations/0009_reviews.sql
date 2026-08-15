-- =================================================================
-- Barlovento · 0009_reviews
-- =================================================================
-- Opiniones de clientes logueados. 1 opinión por usuario (unique en
-- user_id). Lectura pública solo de aprobadas; el admin puede mutar
-- approved desde /admin/opiniones.
-- =================================================================

create table if not exists public.reviews (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  body        text not null check (length(body) between 10 and 800),
  approved    boolean not null default true,
  created_at  timestamp with time zone not null default now(),
  updated_at  timestamp with time zone not null default now()
);

-- 1 opinión por usuario (puede editarla).
create unique index if not exists reviews_user_unique_idx
  on public.reviews (user_id);

-- Orden "mejores primero" usa (rating desc, created_at desc).
create index if not exists reviews_rating_created_idx
  on public.reviews (rating desc, created_at desc);

create index if not exists reviews_created_idx
  on public.reviews (created_at desc);

alter table public.reviews enable row level security;

-- Lectura pública solo de aprobadas.
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read"
  on public.reviews for select
  using (approved = true);

-- Insert: usuario autenticado, sólo puede crear con su propio user_id.
drop policy if exists "reviews auth insert" on public.reviews;
create policy "reviews auth insert"
  on public.reviews for insert
  with check (auth.uid() = user_id);

-- Update: sólo el dueño puede editar su review.
drop policy if exists "reviews owner update" on public.reviews;
create policy "reviews owner update"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger updated_at (reusa set_updated_at del setup-completo).
drop trigger if exists trg_reviews_updated on public.reviews;
create trigger trg_reviews_updated
  before update on public.reviews
  for each row execute function public.set_updated_at();
