import { createBrowserClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

/**
 * Cliente Supabase en el navegador.
 *
 * Persistencia larga: la sesión se guarda en localStorage con TTL de 1 año
 * y desactivamos el auto-refresh (cuando el access token vence, no se
 * refresca — el usuario vuelve a hacer login). Esto evita que el cliente
 * desloguie al usuario silenciosamente cuando el refresh token expira.
 *
 * IMPORTANTE: para que esto funcione, el JWT expiry en el dashboard de
 * Supabase (Auth → Settings → JWT expiry) tiene que estar configurado en
 * un valor igual o mayor (recomendado: 1 año). Si queda en 1h (default),
 * el server rechazará las requests a esa hora aunque localStorage siga
 * teniendo el token.
 *
 * Las queries públicas son RLS-safe (solo leen datos con is_active=true).
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const ONE_YEAR_MS = 60 * 60 * 24 * 365 * 1000;
  const cookieOptions: CookieOptions = {
    maxAge: ONE_YEAR_MS,
    path: '/',
    sameSite: 'lax',
    secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
  };

  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,
      storageKey: 'barlovento-auth',
      storage: {
        getItem: (key: string) => {
          if (typeof window === 'undefined') return null;
          return window.localStorage.getItem(key);
        },
        setItem: (key: string, value: string) => {
          if (typeof window === 'undefined') return;
          window.localStorage.setItem(key, value);
        },
        removeItem: (key: string) => {
          if (typeof window === 'undefined') return;
          window.localStorage.removeItem(key);
        },
      },
    },
    cookieOptions,
  });
}