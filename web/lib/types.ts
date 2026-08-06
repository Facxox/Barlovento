import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente Supabase en el navegador.
 *
 * La integración SSR sincroniza la sesión entre localStorage y cookies para
 * que las páginas y APIs del servidor puedan leer al usuario autenticado.
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'barlovento-auth',
    },
  });
}
