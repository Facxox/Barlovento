-- =================================================================
-- Barlovento · 0004_profiles
-- =================================================================
-- Tabla de perfil del cliente + trigger auto-create al signup.
-- CORRER DESPUÉS de setup-completo.sql (usa set_updated_at()).
-- =================================================================

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  address     text,
  city        text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada user lee su propio profile.
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- Trigger: crear fila en profiles cuando se crea un auth.users.
-- raw_user_meta_data.full_name viene del SignupForm.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, email, full_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    false
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger (usa set_updated_at() del setup-completo).
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Vista rápida para vos.
create or replace view public.profiles_admin_view as
  select user_id, email, full_name, phone, is_admin, created_at
  from public.profiles
  order by is_admin desc, created_at desc;
