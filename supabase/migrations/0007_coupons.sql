-- =================================================================
-- Barlovento · Módulo de cupones y promociones (Fase 5)
-- =================================================================
-- Idempotente. Pegar en Supabase SQL Editor.
-- Diseñado para coexistir con products / orders existentes.
-- =================================================================


-- =================================================================
-- 1) coupons  — definición de cada cupón/promoción
-- =================================================================
-- Un cupón puede tener varios "rules" (beneficios apilables: ej.
-- 20% descuento + envío gratis). Las reglas son las que se aplican
-- al carrito; el cupón es solo la "campaña" con sus restricciones.
-- =================================================================
create table if not exists public.coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  description     text,

  -- Estado
  is_active       boolean not null default true,

  -- Vigencia
  starts_at       timestamptz,
  ends_at         timestamptz,

  -- Restricciones globales
  min_subtotal    numeric(10, 2) check (min_subtotal is null or min_subtotal >= 0),
  max_discount    numeric(10, 2) check (max_discount is null or max_discount >= 0),
  usage_limit     integer          check (usage_limit is null or usage_limit > 0),
  usage_count     integer not null default 0,
  per_user_limit  integer          check (per_user_limit is null or per_user_limit > 0),

  -- Combinabilidad: si false, no puede coexistir con otros cupones en el mismo carrito
  combinable      boolean not null default false,

  -- Audiencia: restringe a retail, wholesale, o ambos (null = ambos)
  customer_type   text check (customer_type is null or customer_type in ('retail', 'wholesale')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists coupons_active_code   on public.coupons (is_active, code);
create index if not exists coupons_window        on public.coupons (starts_at, ends_at);


-- =================================================================
-- 2) coupon_rules — beneficios concretos (1..N por cupón)
-- =================================================================
-- kind define el TIPO de beneficio. Las condiciones de aplicabilidad
-- (qué productos/categorías alcanzan) viven en applies_to, con la
-- convención: { "all": true } | { "product_ids": [...] } |
-- { "categories": [...] }.
-- =================================================================
create table if not exists public.coupon_rules (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references public.coupons(id) on delete cascade,

  -- 'percent' | 'fixed' | 'free_shipping' | 'bxgy' | 'gift_product'
  kind            text not null check (kind in ('percent', 'fixed', 'free_shipping', 'bxgy', 'gift_product')),

  -- Para percent / fixed: el valor numérico (% o monto en moneda del cupón).
  value           numeric(10, 2),

  -- Para bxgy: { buy_qty, get_qty, get_discount_pct }.
  -- Para gift_product: { gift_product_id }.
  config          jsonb not null default '{}'::jsonb,

  -- A qué ítems aplica este beneficio
  applies_to      jsonb not null default '{"all": true}'::jsonb,

  sort_order      integer not null default 0
);

create index if not exists coupon_rules_coupon on public.coupon_rules (coupon_id, sort_order);


-- =================================================================
-- 3) coupon_redemptions — auditoría de uso
-- =================================================================
-- Registra CADA uso (incluso los fallidos vía status='rejected' para
-- detectar abuso). Una fila por canje aplicado a una orden.
-- =================================================================
create table if not exists public.coupon_redemptions (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references public.coupons(id) on delete restrict,
  rule_id         uuid references public.coupon_rules(id) on delete set null,

  order_id        bigint references public.orders(id) on delete set null,

  user_id         uuid references auth.users(id) on delete set null,
  customer_email  text,                       -- fallback si el usuario no estaba logueado
  customer_type   text check (customer_type is null or customer_type in ('retail', 'wholesale')),

  -- 'applied' | 'rejected' | 'refunded'
  status          text not null default 'applied' check (status in ('applied', 'rejected', 'refunded')),

  discount_amount numeric(10, 2) not null default 0,
  currency        text not null default 'UYU',

  cart_snapshot   jsonb,                      -- carrito al momento del canje (para auditoría)

  reason          text,                       -- motivo de rechazo si status='rejected'
  created_at      timestamptz not null default now()
);

create index if not exists coupon_redemptions_coupon  on public.coupon_redemptions (coupon_id, created_at);
create index if not exists coupon_redemptions_user    on public.coupon_redemptions (user_id, coupon_id);
create index if not exists coupon_redemptions_order   on public.coupon_redemptions (order_id);


-- =================================================================
-- 4) Trigger updated_at en coupons
-- =================================================================
drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();


-- =================================================================
-- 5) RLS
-- =================================================================
-- Lectura pública SOLO de cupones activos (necesaria para validar
-- en checkout). El detalle completo se filtra server-side igual.
-- Escritura solo admin vía service role.
-- =================================================================
alter table public.coupons             enable row level security;
alter table public.coupon_rules        enable row level security;
alter table public.coupon_redemptions  enable row level security;

drop policy if exists coupons_select_active on public.coupons;
create policy coupons_select_active on public.coupons
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true)
  );

drop policy if exists coupon_rules_select_active on public.coupon_rules;
create policy coupon_rules_select_active on public.coupon_rules
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.coupons c
      where c.id = coupon_rules.coupon_id and c.is_active = true
    )
  );

drop policy if exists coupon_rules_admin_all on public.coupon_rules;
create policy coupon_rules_admin_all on public.coupon_rules
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true)
  );

drop policy if exists coupon_redemptions_select_own on public.coupon_redemptions;
create policy coupon_redemptions_select_own on public.coupon_redemptions
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true)
  );

drop policy if exists coupon_redemptions_admin_write on public.coupon_redemptions;
create policy coupon_redemptions_admin_write on public.coupon_redemptions
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true)
  );


-- =================================================================
-- 6) Helper: incrementar usage_count atómicamente con guarda de límite
-- =================================================================
-- Hace el chequeo y el increment en la misma UPDATE para que dos
-- checkouts concurrentes con el último cupo no se cuelen. Devuelve
-- el nuevo usage_count, o NULL si excede el límite (en cuyo caso
-- el caller debe abortar la redención).
-- =================================================================
create or replace function public.increment_coupon_usage(p_coupon_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  update public.coupons
     set usage_count = usage_count + 1,
         updated_at  = now()
   where id = p_coupon_id
     and (usage_limit is null or usage_count < usage_limit)
  returning usage_count into new_count;

  if new_count is null then
    raise exception 'coupon_usage_limit_reached' using errcode = 'P0001';
  end if;
  return new_count;
end;
$$;

revoke all on function public.increment_coupon_usage(uuid) from public;
grant execute on function public.increment_coupon_usage(uuid) to service_role;


-- =================================================================
-- 7) Seed: cupones de ejemplo
-- =================================================================
insert into public.coupons (code, description, is_active, starts_at, ends_at, min_subtotal, usage_limit, combinable, customer_type)
values
  ('BIENVENIDO10', '10% off en tu primera compra', true, now(), now() + interval '90 days', 500, 1000, false, 'retail'),
  ('ENVIOGRATIS',  'Envío bonificado en cualquier pedido', true, now(), now() + interval '30 days', 0, null, true, null),
  ('VERANO20',     '20% off en categoría Vinos', true, now(), now() + interval '60 days', 1000, 500, false, null)
on conflict (code) do nothing;

-- Reglas para los seeds
insert into public.coupon_rules (coupon_id, kind, value, applies_to, sort_order)
select c.id, 'percent', 10, '{"all": true}'::jsonb, 0
  from public.coupons c where c.code = 'BIENVENIDO10'
  and not exists (select 1 from public.coupon_rules r where r.coupon_id = c.id);

insert into public.coupon_rules (coupon_id, kind, value, applies_to, sort_order)
select c.id, 'free_shipping', null, '{"all": true}'::jsonb, 0
  from public.coupons c where c.code = 'ENVIOGRATIS'
  and not exists (select 1 from public.coupon_rules r where r.coupon_id = c.id);

insert into public.coupon_rules (coupon_id, kind, value, applies_to, sort_order)
select c.id, 'percent', 20, '{"categories": ["Vinos"]}'::jsonb, 0
  from public.coupons c where c.code = 'VERANO20'
  and not exists (select 1 from public.coupon_rules r where r.coupon_id = c.id);
