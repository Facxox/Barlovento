-- 0017_pickup_fulfillment.sql
--
-- Agrega la modalidad de "retiro coordinado por WhatsApp" al checkout:
--
--   1) `fulfillment` en `orders`: indica si el pedido se envía a domicilio
--      (`shipping`, default) o se retira previo acuerdo por WhatsApp
--      (`pickup`). Las órdenes existentes quedan en `shipping`.
--
--   2) `pickup_status` en `orders`: ciclo de coordinación para retiros.
--      NULL para órdenes con envío. Para pickup:
--        - awaiting_coordination → pagado, falta que el cliente mande WA
--        - coordinated           → la tienda ya habló con el cliente
--        - delivered             → entregado
--        - cancelled             → cancelado
--
-- Idempotente (mismo estilo que 0016): ADD COLUMN IF NOT EXISTS +
-- CHECK constraint agregado sólo si no existe.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment text NOT NULL DEFAULT 'shipping';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_status text;

-- CHECK constraints: sólo los valores válidos. Lo agregamos en un DO $$
-- para no romper si la migración se corre dos veces.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_allowed'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_fulfillment_allowed
      CHECK (fulfillment IN ('shipping', 'pickup'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_pickup_status_allowed'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_pickup_status_allowed
      CHECK (
        pickup_status IS NULL OR
        pickup_status IN (
          'awaiting_coordination',
          'coordinated',
          'delivered',
          'cancelled'
        )
      );
  END IF;
END$$;

-- Índice parcial para que la sección admin de Retiros sea barata.
CREATE INDEX IF NOT EXISTS orders_pickup_idx
  ON public.orders (created_at DESC)
  WHERE fulfillment = 'pickup';
