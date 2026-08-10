-- 0015_orders_security_and_coupon.sql
--
-- Hardening para el checkout:
--   - columnas nuevas: user_id (FK a auth.users), coupon_code, coupon_discount
--   - índice único parcial sobre mp_preference_id (solo no nulo)
--   - columna total no-negativa (defensa en profundidad por si JS
--     calcula algo raro)
--   - columna currency con check más estricto

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric(10,2);

-- Constraint: total >= 0 y <= un límite sano (UYU 1M = ~$25k USD).
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_total_sane;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_total_sane
  CHECK (total IS NULL OR (total >= 0 AND total <= 1000000));

-- currency debe ser código ISO 4217 de 3 letras.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_currency_iso;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_currency_iso
  CHECK (currency ~ '^[A-Z]{3}$');

-- Índice único sobre mp_preference_id (sólo cuando no es nulo, así
-- las órdenes legacy sin preference no rompen el constraint).
CREATE UNIQUE INDEX IF NOT EXISTS orders_mp_preference_id_unique
  ON public.orders (mp_preference_id)
  WHERE mp_preference_id IS NOT NULL;

-- Índice para que el webhook busque rápido por preference.
CREATE INDEX IF NOT EXISTS orders_mp_preference_id_idx
  ON public.orders (mp_preference_id)
  WHERE mp_preference_id IS NOT NULL;

-- Índice para el lookup del simulador / mark-paid por id.
CREATE INDEX IF NOT EXISTS orders_id_status_idx
  ON public.orders (id, status);

-- RLS: las órdenes de MP son privadas del admin. Reforzamos la policy.
DROP POLICY IF EXISTS "orders_admin_select" ON public.orders;
CREATE POLICY "orders_admin_select"
  ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- Política para que el dueño de la orden pueda verla (mi-cuenta).
DROP POLICY IF EXISTS "orders_owner_select" ON public.orders;
CREATE POLICY "orders_owner_select"
  ON public.orders
  FOR SELECT
  USING (user_id = auth.uid());

-- Cualquier otra policy previa queda anulada. Si querés mantener
-- algo más permisivo en dev, ajustá después del merge.