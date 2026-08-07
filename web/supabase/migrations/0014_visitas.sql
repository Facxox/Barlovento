-- 0014_visitas.sql
--
-- Tabla de analiticas de trafico para el panel /admin/analiticas.
-- Una fila por pageview del sitio publico. La captura se hace en
-- web/middleware.ts (fire-and-forget para no agregar latencia).
--
-- Se excluyen del registro:
--   - /admin/* (no nos interesa el trafico del panel)
--   - /api/* (no son vistas)
--   - assets estaticos (favicon, /Assets/, /_next/...)
-- El filtrado se hace en el middleware; esta tabla no tendria que
-- recibir esos hits, pero lo mencionamos para que el lector lo
-- tenga presente.

CREATE TABLE IF NOT EXISTS public.visitas (
  id BIGSERIAL PRIMARY KEY,
  ruta VARCHAR(255) NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip VARCHAR(45),
  user_agent VARCHAR(255),
  -- Hash anonimo IP + UA. Sirve para distinguir "Page Views"
  -- (cada hit) de "Visitors" unicos (distinct visitor_hash).
  visitor_hash VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_visitas_fecha_hora ON public.visitas (fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_visitas_visitor_hash ON public.visitas (visitor_hash);
CREATE INDEX IF NOT EXISTS idx_visitas_ruta ON public.visitas (ruta);

-- RLS: ninguno. La tabla esta aislada detras del service-role client
-- (escritura desde el middleware) y las queries de lectura pasan por
-- un endpoint /api/admin/* que requiere admin via requireAdminStrict.
-- Aun asi, por si alguien la usa desde el cliente anon, bloqueamos
-- todo y dejamos las policies intencionalmente vacias.
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- Nadie puede leerla desde el cliente anon/authenticated.
-- Las queries se hacen con service-role desde el server.
DROP POLICY IF EXISTS visitas_admin_read ON public.visitas;
DROP POLICY IF EXISTS visitas_anon_write ON public.visitas;
