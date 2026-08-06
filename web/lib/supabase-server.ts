import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente Supabase server-side (App Router).
 *
 * Persistencia larga: las cookies de sesión se setean con maxAge de 1 año.
 * Si las env vars no están configuradas, retorna null y los queries caen al
 * fallback JSON (para que el dev local funcione sin setup).
 */
export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = cookies();

  const cookieOptions: CookieOptions = {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // el browser client necesita leerlas
    secure: process.env.NODE_ENV === 'production',
  };

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...cookieOptions, ...options })
          );
        } catch {
          // Server Components no pueden setear cookies; el middleware se encarga.
        }
      },
    },
  });
}