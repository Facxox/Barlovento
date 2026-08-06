-- 0007_orders_customer_address.sql
--
-- Agrega campos de dirección a la tabla `orders` para que el checkout guarde
-- los datos completos de envío del cliente. El payment intent de Mercado
-- Pago se persiste aparte en `mp_preference_id` / `mp_payment_id`; estos
-- campos son para uso interno (coordinar la encomienda).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS customer_city text,
  ADD COLUMN IF NOT EXISTS customer_notes text;
