-- 0004_auth_security_hardening.sql
--
-- Resuelve advertencias de Supabase Security Advisor:
--   * function_search_path_mutable en set_updated_at, handle_new_user, mark_user_as_admin.
--   * Exposición indebida de EXECUTE a PUBLIC/anon/authenticated en funciones privilegiadas.
--   * Idempotencia de security_invoker en profiles_admin_view.
--
-- Decisiones:
--   * is_admin(uid) mantiene EXECUTE para authenticated porque las políticas RLS
--     "profiles admin read all" y "wholesale_products admin write" la invocan.
--     Su search_path ya estaba fijado en una migración previa; se re-afirma aquí.
--   * handle_new_user sólo se ejecuta desde el trigger on_auth_user_created.
--     No necesita EXECUTE público; el trigger corre como table owner.
--   * mark_user_as_admin es RPC administrativa que escribe en auth.users y
--     debe llamarse únicamente desde service_role.
--   * set_updated_at es trigger interno; el usuario nunca la invoca por RPC.

-- 1) Fijar search_path en funciones que faltaban.
ALTER FUNCTION public.set_updated_at()
  SET search_path = '';
ALTER FUNCTION public.handle_new_user()
  SET search_path = '';
ALTER FUNCTION public.mark_user_as_admin(p_email text)
  SET search_path = '';

-- 2) Confirmar search_path de is_admin (idempotente).
ALTER FUNCTION public.is_admin(uid uuid)
  SET search_path = '';

-- 3) Revocar EXECUTE público de funciones privilegiadas.
--    handle_new_user: sólo lo necesita el trigger; ningún rol RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

--    mark_user_as_admin: escalada de privilegios si anon/authenticated la llaman.
--    Sólo service_role (y postgres) deben poder invocarla.
REVOKE EXECUTE ON FUNCTION public.mark_user_as_admin(p_email text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_user_as_admin(p_email text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_user_as_admin(p_email text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_user_as_admin(p_email text) TO service_role;

--    set_updated_at: trigger-only.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;

--    is_admin: anon no debe poder invocarla para mapear admins internos.
--    authenticated la necesita porque la usan las políticas RLS.
REVOKE EXECUTE ON FUNCTION public.is_admin(uid uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uid uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin(uid uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_admin(uid uuid) TO service_role;

-- 4) Idempotencia explícita de security_invoker en profiles_admin_view.
--    La migración original la define con la opción correcta; este ALTER
--    deja el estado versionado y autoreparable si se recrea la vista.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles_admin_view'
  ) THEN
    EXECUTE 'ALTER VIEW public.profiles_admin_view SET (security_invoker = true)';
  END IF;
END
$$;
