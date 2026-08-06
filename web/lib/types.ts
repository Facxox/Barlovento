import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Cliente Supabase en el navegador.
 *
 * Usa el storage de cookies estándar de @supabase/ssr para que las páginas y
 * APIs del servidor reciban la misma sesión que el navegador.
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  if (!browserClient) browserClient = createBrowserClient(url, key);
  return browserClient;
}
