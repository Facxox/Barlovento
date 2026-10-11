-- =================================================================
-- Barlovento · 0019_container_products
-- =================================================================
-- Sistema de productos contenedores (latas, cajas, packs personalizables).
--
-- Una lata puede contener N unidades de productos que el cliente elige.
-- Toda la configuración se administra desde el panel sin tocar código.
--
-- Modelo:
--
--   public.products        + cols:        is_container, container_*
--                                        can_be_in_container
--   public.product_container_items  →    filas: container_product_id +
--                                              child_product_id + min +
--                                              max + sort_order
--   public.cart_container_compositions →  snapshot del carrito
--                                              (cart_session_id +
--                                              container_product_id +
--                                              child_product_id + qty +
--                                              parent_line_id)
--   public.order_container_items      →  persistido en el pedido
--                                              (order_id + container_id +
--                                              child_product_id + qty +
--                                              child_name + child_price)
--
-- Precios:
--   - container_base_price   → precio independiente del contenido
--                              (NULL = usar products.price)
--   - price_mode             → 'replace' (sólo base) | 'base_plus_content'
--                              (base + Σ contenidos) | 'content_only'
--                              (Σ contenidos, base = 0)
--
-- Reglas de capacidad:
--   - capacity             → unidades máximas que entran en el contenedor
--   - min_select_units     → mínimo de unidades seleccionables
--   - max_select_units     → máximo seleccionable (≤ capacity)
--   - require_full         → si true, el cliente NO puede agregar al
--                            carrito hasta alcanzar `capacity`
--
-- Notas de implementación:
--   * Todas las FKs usan ON DELETE CASCADE para no dejar huérfanos.
--   * `price_mode` valida con CHECK a nivel DB.
--   * `cart_session_id` es un id que el cliente guarda en localStorage;
--     NO se valida referencia a una tabla porque puede ser inventado
--     por el navegador. La validación real del stock y composición se
--     hace en el checkout server-side.
--   * `order_container_items` snapshot nombre/precio del hijo en el
--     momento de la compra (no se pierde si después se renombra un
--     alfajor o se sube el precio).
-- =================================================================


-- -----------------------------------------------------------------
-- 1) Extender products con campos de contenedor / contenido
-- -----------------------------------------------------------------
alter table public.products
  add column if not exists is_container boolean not null default false,
  add column if not exists container_base_price numeric(10,2),
  add column if not exists price_mode text not null default 'base_plus_content',
  add column if not exists container_capacity integer,
  add column if not exists container_min_units integer not null default 1,
  add column if not exists container_max_units integer,
  add column if not exists container_require_full boolean not null default false,
  add column if not exists can_be_in_container boolean not null default false;

-- Sanity-check para price_mode
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_price_mode_allowed'
  ) then
    alter table public.products
      add constraint products_price_mode_allowed
      check (price_mode in ('replace','base_plus_content','content_only'));
  end if;
end$$;

-- Coherencia: si is_container = true, container_capacity debe estar set
-- y > 0. No forzamos los demás campos obligatorios para no romper al
-- admin que recién está tildando el toggle (los puede dejar en NULL).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_container_capacity_positive'
  ) then
    alter table public.products
      add constraint products_container_capacity_positive
      check (container_capacity is null or container_capacity > 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'products_container_min_le_max'
  ) then
    alter table public.products
      add constraint products_container_min_le_max
      check (
        container_max_units is null
        or container_min_units <= container_max_units
      );
  end if;
end$$;

create index if not exists products_is_container_idx
  on public.products (is_container)
  where is_container = true;


-- -----------------------------------------------------------------
-- 2) Hijos permitidos por contenedor
-- -----------------------------------------------------------------
create table if not exists public.product_container_items (
  id                   bigserial primary key,
  container_product_id text not null references public.products(id) on delete cascade,
  child_product_id     text not null references public.products(id) on delete cascade,
  min_qty              integer not null default 0 check (min_qty >= 0),
  max_qty              integer,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  unique (container_product_id, child_product_id),
  check (max_qty is null or max_qty > 0),
  check (max_qty is null or min_qty <= max_qty)
);

create index if not exists product_container_items_container_idx
  on public.product_container_items (container_product_id, sort_order);


-- -----------------------------------------------------------------
-- 3) Composiciones de carrito (transient, no persistente histórico)
-- -----------------------------------------------------------------
create table if not exists public.cart_container_compositions (
  id                   bigserial primary key,
  cart_session_id      text not null,
  container_product_id text not null references public.products(id) on delete cascade,
  child_product_id     text not null references public.products(id) on delete cascade,
  qty                  integer not null check (qty > 0),
  parent_line_id       text not null,
  created_at           timestamptz not null default now(),
  unique (cart_session_id, parent_line_id, child_product_id)
);

create index if not exists cart_container_session_idx
  on public.cart_container_compositions (cart_session_id);


-- -----------------------------------------------------------------
-- 4) Composiciones persistidas en el pedido
-- -----------------------------------------------------------------
create table if not exists public.order_container_items (
  id                bigserial primary key,
  order_id          bigint not null references public.orders(id) on delete cascade,
  container_item_id text not null,
  container_product_id text not null,
  child_product_id  text not null,
  child_name        text not null,
  child_price       numeric(10,2) not null check (child_price >= 0),
  child_image       text,
  qty               integer not null check (qty > 0),
  created_at        timestamptz not null default now()
);

create index if not exists order_container_items_order_idx
  on public.order_container_items (order_id);

create index if not exists order_container_items_container_item_idx
  on public.order_container_items (order_id, container_item_id);


-- -----------------------------------------------------------------
-- 5) RLS
-- -----------------------------------------------------------------
alter table public.product_container_items enable row level security;
alter table public.cart_container_compositions enable row level security;
alter table public.order_container_items enable row level security;

-- product_container_items: lectura pública (necesario para que el
-- configurador muestre los productos habilitados sin auth). Escritura
-- sólo admin.
drop policy if exists "container_items public read" on public.product_container_items;
create policy "container_items public read"
  on public.product_container_items for select using (true);

drop policy if exists "container_items admin write" on public.product_container_items;
create policy "container_items admin write"
  on public.product_container_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- cart_container_compositions: lectura/escritura anónima (carrito del
-- visitante vive en anon). El stock y la composición final los valida
-- el server en el checkout (route.ts).
drop policy if exists "cart_container anon all" on public.cart_container_compositions;
create policy "cart_container anon all"
  on public.cart_container_compositions for all
  to anon
  using (true)
  with check (true);

drop policy if exists "cart_container auth all" on public.cart_container_compositions;
create policy "cart_container auth all"
  on public.cart_container_compositions for all
  to authenticated
  using (true)
  with check (true);

-- order_container_items: lectura sólo admin. Escritura sólo service-role
-- (la hace el server al generar el pedido).
drop policy if exists "order_container admin read" on public.order_container_items;
create policy "order_container admin read"
  on public.order_container_items for select
  using (auth.role() = 'authenticated');
