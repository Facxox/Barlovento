-- =================================================================
-- Barlovento · Setup completo de Supabase (Fases 2 + 3 + 4)
-- =================================================================
-- Pegar este archivo entero en Supabase → SQL Editor → New query.
-- Es idempotente: se puede correr varias veces sin romper.
--
-- Incluye:
--   1. Schema base (products, gallery_items, events, site_content)
--   2. Tabla orders con columnas de Mercado Pago
--   3. RLS: lectura pública selectiva, escritura solo admin
--   4. Storage bucket "barlovento-media" + policies
--   5. Trigger updated_at
--   6. Policies para Fase 4 (anon INSERT whatsapp)
--   7. Seed: productos, galería, eventos, textos de marca
--   8. Helper para crear el primer admin
-- =================================================================


-- =================================================================
-- 1) products
-- =================================================================
create table if not exists public.products (
  id           text primary key,
  name         text not null,
  description  text not null,
  price        numeric(10, 2) not null check (price >= 0),
  currency     text not null default 'UYU',
  category     text not null,
  image        text not null,
  badge        text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists products_active_sort
  on public.products (is_active, sort_order);
create index if not exists products_category
  on public.products (category);


-- =================================================================
-- 2) gallery_items
-- =================================================================
create table if not exists public.gallery_items (
  id          bigserial primary key,
  title       text not null,
  category    text not null check (category in ('elaboracion', 'producto', 'ferias')),
  image       text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists gallery_category_sort
  on public.gallery_items (category, sort_order);


-- =================================================================
-- 3) events
-- =================================================================
create table if not exists public.events (
  id          bigserial primary key,
  title       text not null,
  date        date not null,
  location    text not null,
  description text not null,
  image       text not null,
  kind        text not null default 'upcoming' check (kind in ('upcoming', 'past')),
  created_at  timestamptz not null default now()
);
create index if not exists events_kind_date
  on public.events (kind, date);


-- =================================================================
-- 4) site_content (key-value editable para textos de marca)
-- =================================================================
create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);


-- =================================================================
-- 5) orders (Fase 4)
-- =================================================================
create table if not exists public.orders (
  id             bigserial primary key,
  items          jsonb not null,
  total          numeric(10, 2) not null,
  currency       text not null default 'UYU',
  channel        text not null check (channel in ('mercadopago', 'whatsapp')),
  status         text not null default 'pending'
                 check (status in ('pending', 'paid', 'fulfilled', 'cancelled')),
  customer_name  text,
  customer_phone text,
  customer_email text,
  mp_preference_id text,
  mp_payment_id    text,
  created_at     timestamptz not null default now()
);
create index if not exists orders_status_created
  on public.orders (status, created_at desc);


-- =================================================================
-- 6) RLS — público lee, admin escribe
-- =================================================================
alter table public.products       enable row level security;
alter table public.gallery_items  enable row level security;
alter table public.events         enable row level security;
alter table public.site_content   enable row level security;
alter table public.orders         enable row level security;

-- Productos: público solo lee los activos
drop policy if exists "products public read" on public.products;
create policy "products public read"
  on public.products for select
  using (is_active = true);

-- Galería, eventos, site_content: lectura pública total
drop policy if exists "gallery public read" on public.gallery_items;
create policy "gallery public read"
  on public.gallery_items for select using (true);

drop policy if exists "events public read" on public.events;
create policy "events public read"
  on public.events for select using (true);

drop policy if exists "site_content public read" on public.site_content;
create policy "site_content public read"
  on public.site_content for select using (true);

-- Orders: solo autenticados (admin) leen
drop policy if exists "orders admin read" on public.orders;
create policy "orders admin read"
  on public.orders for select
  using (auth.role() = 'authenticated');

-- Escritura general: solo autenticados (admin)
drop policy if exists "products admin write" on public.products;
create policy "products admin write"
  on public.products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "gallery admin write" on public.gallery_items;
create policy "gallery admin write"
  on public.gallery_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "events admin write" on public.events;
create policy "events admin write"
  on public.events for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "site_content admin write" on public.site_content;
create policy "site_content admin write"
  on public.site_content for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Fase 4: anon puede INSERT en orders SOLO si el canal es WhatsApp.
-- Los pedidos de Mercado Pago los inserta el server con service_role,
-- así que no necesitan policy para anon.
drop policy if exists "anon insert whatsapp orders" on public.orders;
create policy "anon insert whatsapp orders"
  on public.orders for insert
  to anon
  with check (channel = 'whatsapp');


-- =================================================================
-- 7) Storage bucket
-- =================================================================
insert into storage.buckets (id, name, public)
values ('barlovento-media', 'barlovento-media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read"
  on storage.objects for select
  using (bucket_id = 'barlovento-media');

drop policy if exists "media admin write" on storage.objects;
create policy "media admin write"
  on storage.objects for insert
  with check (bucket_id = 'barlovento-media' and auth.role() = 'authenticated');

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update"
  on storage.objects for update
  using (bucket_id = 'barlovento-media' and auth.role() = 'authenticated');

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete"
  on storage.objects for delete
  using (bucket_id = 'barlovento-media' and auth.role() = 'authenticated');


-- =================================================================
-- 8) Trigger updated_at
-- =================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_site_content_updated on public.site_content;
create trigger trg_site_content_updated
  before update on public.site_content
  for each row execute function public.set_updated_at();


-- =================================================================
-- 9) Seed inicial (productos, galería, eventos, textos)
-- =================================================================

-- Productos
insert into public.products (id, name, description, price, currency, category, image, badge, is_active, sort_order) values
  ('clasico',          'Alfajor Clásico',          'Dos tapas de masa sable dorada, dulce de leche reposado y un baño de chocolate semiamargo. La receta que empezó todo.', 120, 'UYU', 'clasicos',   '/Assets/FotoProducto1.png', 'El original',      true, 1),
  ('chocolate-negro',  'Chocolate Negro 70%',      'Para los que buscan intensidad. Cobertura de chocolate 70% cacao sobre un corazón generoso de dulce de leche.',        145, 'UYU', 'chocolate',  '/Assets/FotoProducto2.png', 'Intenso',          true, 2),
  ('bombon',           'Bombón Barlovento',        'Masa tierna, dulce de leche y un terminado de merengue italiano tostado. El favorito de las mesas dulces.',           165, 'UYU', 'especiales', '/Assets/FotoProducto3.png', 'Edición limitada', true, 3),
  ('coco',             'Coco & Dulce de Leche',    'Cobertura de coco rallado caramelizado. Crocante por fuera, suave por dentro. Un viaje a la costa.',                   135, 'UYU', 'especiales', '/Assets/FotoProducto5.png', null,               true, 4),
  ('frutos-rojos',     'Frutos del Bosque',        'Reducción de frutos rojos artesanales, chocolate blanco y un toque de limón. Frescura en cada mordisco.',                175, 'UYU', 'especiales', '/Assets/FotoProducto6.png', 'Nuevo',            true, 5),
  ('marroc',           'Marroc & Almendras',       'Trozos de almendra tostada, pasta de maní y un baño de chocolate con leche. Para compartir — o no.',                    155, 'UYU', 'clasicos',   '/Assets/FotoProducto1.png', null,               true, 6)
on conflict (id) do nothing;

-- Galería
insert into public.gallery_items (title, category, image, sort_order) values
  ('Proceso en el obrador',    'elaboracion', '/Assets/Proceso de obrador.png',  1),
  ('Corte transversal',        'producto',    '/Assets/FotoProducto1.png',      2),
  ('Stand en la feria',        'ferias',      '/Assets/Stand en feria.png',      3),
  ('Equipo en jornada',        'elaboracion', '/Assets/Equipo en jornada.png',  4),
  ('Catering para eventos',    'ferias',      '/Assets/Catering.png',            5),
  ('Premiación medalla de oro','ferias',      '/Assets/Premiación medalla.png', 6)
on conflict do nothing;

-- Eventos
insert into public.events (title, date, location, description, image, kind) values
  ('Feria del Alfajor — Trinidad', '2026-09-12', 'Plaza Constitución, Trinidad',
   'Stand propio con toda la línea y dos ediciones especiales que solo aparecen en la feria.',
   '/Assets/Stand en feria.png', 'upcoming'),
  ('Expo Prado 2026',             '2026-10-04', 'Predio rural del Prado, Montevideo',
   'Catering de alfajores para inauguración del stand de productores del interior.',
   '/Assets/Catering.png', 'upcoming'),
  ('Premio Pyme — Medalla de Oro','2025-11-22', 'Cámara Empresarial de Trinidad',
   'Reconocimiento como Mejor Alfajor Pyme en el departamento de Flores.',
   '/Assets/Premiación medalla.png', 'past')
on conflict do nothing;

-- Textos de marca (key-value)
insert into public.site_content (key, value) values
  ('historia', '{
    "eyebrow": "Nuestra historia",
    "headline": "De una receta familiar a un oficio compartido",
    "body": [
      "Barlovento nació en una cocina de Trinidad, donde una receta familiar se hizo primero famosa entre los vecinos y, después, entre los que cruzaban el departamento para probarla.",
      "Hoy seguimos trabajando como el primer día: masa a mano, reposos largos, dulce de leche en paila. Cada alfajor pasa por cuatro personas antes de llegar a tu mesa."
    ],
    "image": "/Assets/historia-obrador.png",
    "image_caption": "Obrador en Trinidad, Flores"
  }'::jsonb),
  ('mision', '{
    "eyebrow": "Misión",
    "headline": "Devolverle al alfajor su carácter artesanal",
    "body": "Producir alfajores en pequeñas series, con materia prima local y procesos honestos. Que cada unidad que sale del obrador pueda llevar nuestro nombre sin reservas."
  }'::jsonb),
  ('vision', '{
    "eyebrow": "Visión",
    "headline": "Trinidad como capital del alfajor artesanal",
    "body": "Convertir a nuestro departamento en un punto de referencia del alfajor hecho a mano, tanto para Uruguay como para quien lo descubra de paso."
  }'::jsonb),
  ('contacto', '{
    "whatsapp": "+59899123456",
    "email": "hola@barlovento.uy",
    "direccion": "Trinidad, Flores, Uruguay",
    "instagram": "https://instagram.com/barlovento.uy",
    "facebook": "https://facebook.com/barloventoalfajores",
    "horarios": "Lunes a viernes · 9 a 18 h"
  }'::jsonb)
on conflict (key) do nothing;


-- =================================================================
-- 10) Admin user — instrucciones y helper
-- =================================================================
-- Para crear el primer admin, hay dos pasos:
--
--   a) Crear el usuario desde el Dashboard de Supabase:
--      Authentication → Users → "Add user" → "Create new user"
--      con email + password. NO se puede hacer 100% desde SQL
--      porque la contraseña va hasheada.
--
--   b) (Opcional) Marcarlo como admin en raw_app_meta_data
--      con la función helper que está al final. La middleware y
--      los server actions ya solo requieren auth.role() = 'authenticated',
--      así que el flag no es estrictamente necesario, pero queda
--      disponible si después querés hacer gating más granular.

-- DEPRECADO: la promoción a admin ahora se hace directo en la tabla
-- public.profiles (campo is_admin). Esta función queda para no romper
-- setups viejos; no la uses en proyectos nuevos.
-- create or replace function public.mark_user_as_admin(p_email text)
-- returns void
-- language plpgsql
-- security definer
-- as $$
-- begin
--   update auth.users
--      set raw_app_meta_data =
--          coalesce(raw_app_meta_data, '{}'::jsonb)
--          || jsonb_build_object('is_admin', true)
--    where email = p_email;
--   if not found then
--     raise notice 'Deprecado: ahora se edita public.profiles.is_admin directamente.';
--   end if;
-- end;
-- $$;


-- =================================================================
-- 12) profiles (clientes y admins) + trigger auto-create
--     Es la fuente de verdad de is_admin. Promoción a admin se hace
--     desde Supabase Dashboard → Table Editor → profiles → is_admin.
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

drop policy if exists "profiles self read"   on public.profiles;
create policy "profiles self read"
  on public.profiles for select using (auth.uid() = user_id);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
  on public.profiles for insert with check (auth.uid() = user_id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: al crearse un auth.users, crear la fila en profiles.
-- raw_user_meta_data.full_name viene del form de signup.
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

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Vista para vos: ves quién es admin de un vistazo.
create or replace view public.profiles_admin_view as
  select user_id, email, full_name, phone, is_admin, created_at
  from public.profiles
  order by is_admin desc, created_at desc;

-- =================================================================
-- 13) Tabla admin_users (opcional) — si querés una lista blanca
--     explícita. Descomentar si lo querés usar.
-- =================================================================
--
-- create table if not exists public.admin_users (
--   user_id uuid primary key references auth.users(id) on delete cascade,
--   email   text not null,
--   created_at timestamptz not null default now()
-- );