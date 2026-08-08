-- =================================================================
-- Barlovento · 0005_orders_customer_type
-- =================================================================
-- Diferenciar pedidos minoristas (mercadopago) de mayoristas
-- (whatsapp con customer_type='wholesale').
--
-- 1) Añade columna customer_type con check.
-- 2) Backfill: si el customer_email matchea un profile.customer_type
--    'wholesale', marcamos wholesale. El resto queda 'retail'.
-- 3) Default 'retail' para filas nuevas sin clasificación.
-- 4) Índice para acelerar agregaciones por canal de venta.
-- =================================================================

alter table public.orders
  add column if not exists customer_type text
    not null default 'retail'
    check (customer_type in ('retail', 'wholesale'));

-- Backfill idempotente: vincula por email con profiles.
update public.orders o
   set customer_type = 'wholesale'
  from public.profiles p
 where p.email is not null
   and o.customer_email is not null
   and lower(p.email) = lower(o.customer_email)
   and p.customer_type = 'wholesale'
   and o.customer_type <> 'wholesale';

create index if not exists orders_customer_type_created
  on public.orders (customer_type, created_at desc);
