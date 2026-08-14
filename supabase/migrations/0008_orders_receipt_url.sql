-- 0008_orders_receipt_url.sql
-- Agrega la columna opcional receipt_url a orders para guardar el comprobante
-- de transferencia bancaria subido por el cliente.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS receipt_url text;

COMMENT ON COLUMN orders.receipt_url IS
  'URL pública del comprobante de transferencia bancaria subido por el cliente (opcional).';
