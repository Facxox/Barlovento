-- 0016_units_per_pack_and_shipping.sql
--
-- Dos cambios:
--
--   1) `units_per_pack` en `products` y `wholesale_products`.
--      Indica cuántos alfajores trae cada unidad (1 para alfajores sueltos,
--      12 para una caja de 12, etc.). El checkout multiplica este valor
--      por la cantidad en el carrito para calcular el envío.
--
--   2) `shipping_cost` y `shipping_currency` en `orders`.
--      Persisten el envío cobrado en Mercado Pago para que el admin
--      pueda consultarlo desde el panel.
--
-- Defaults seguros: units_per_pack = 1 (no rompe productos existentes,
-- que se consideran sueltos), shipping_cost = 0 (carrito vacío o legacy).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS units_per_pack numeric NOT NULL DEFAULT 1;

ALTER TABLE public.wholesale_products
  ADD COLUMN IF NOT EXISTS units_per_pack numeric NOT NULL DEFAULT 1;

-- Aseguramos > 0 sin reventar filas existentes (todas valen 1 hoy).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_units_per_pack_positive'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_units_per_pack_positive
      CHECK (units_per_pack > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wholesale_products_units_per_pack_positive'
  ) THEN
    ALTER TABLE public.wholesale_products
      ADD CONSTRAINT wholesale_products_units_per_pack_positive
      CHECK (units_per_pack > 0);
  END IF;
END$$;

-- Shipping en orders. shipping_cost default 0; shipping_currency queda
-- NULL cuando no hay envío (el constraint existente orders_currency_iso
-- exige un ISO de 3 letras no nulo, por eso dejamos el currency NULL
-- y no le aplicamos check propio).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_currency text;