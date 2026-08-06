-- 0002_customer_type.sql
--
-- Agrega la columna `customer_type` a `profiles` para distinguir
-- entre clientes minoristas (default) y mayoristas.
--
-- El toggle SOLO lo puede cambiar un admin desde el panel:
--   - El default es 'retail' para todos los usuarios nuevos.
--   - El admin lo sube a 'wholesale' cuando corresponda.
--   - El usuario común NO debe poder escribir esta columna: lo
--     garantiza la policy "profiles self-update" (definida en 0001_init.sql)
--     que solo permite update de columnas no-admin. Acá dejamos documentado
--     que cualquier policy nueva que liste columnas debe excluir
--     `customer_type` y `is_admin`.
--
-- Para aplicar este cambio en Supabase:
--   1. Abrir SQL Editor en el dashboard.
--   2. Pegar y correr este archivo.
--   3. Listo. Las filas existentes quedan en 'retail'.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'retail';

-- Constraint de valores permitidos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_customer_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_customer_type_check
      CHECK (customer_type IN ('retail', 'wholesale'));
  END IF;
END $$;

-- Indice para filtrar mayoristas rápido en reportes futuros.
CREATE INDEX IF NOT EXISTS idx_profiles_customer_type
  ON public.profiles (customer_type);