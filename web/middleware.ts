import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresca la cookie de sesión de Supabase en cada request y protege /admin/*.
 *
 * Reglas:
 *  - /admin/* (excepto /admin/login) requiere user autenticado Y is_admin=true.
 *  - /admin/login: si ya hay user logueado → /admin.
 *  - si no configurado, deja pasar (modo dev).
 *
 * Además reenvía el pathname en `x-pathname` para que el root layout pueda
 * ocultar el chrome público (Navbar/Footer/Float/Cart) en /admin/*.
 */
export async function middleware(request: NextRequest) {
  // Reenviamos el pathname al layout para detectar rutas admin. Hay que
  // crear la request "siguiente" antes de pasar por supabase, porque las
  // cookies se setean contra `request` y `response` por separado.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith('/admin');
  const isLoginRoute = path === '/admin/login';

  // Sin sesión y ruta admin (no login) → /admin/login.
  if (isAdminRoute && !isLoginRoute && !user) {
    const loginUrl = new URL('/admin/login', request.url);
    if (path !== '/admin') loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // /admin/login con sesión → /admin.
  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Con sesión pero NO admin en /admin/* (no login) → /admin/login?error=no_admin.
  if (isAdminRoute && !isLoginRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('error', 'no_admin');
      if (path !== '/admin') loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Todas las rutas (excepto _next y assets) para poder pasar x-pathname.
    '/((?!_next/static|_next/image|favicon.ico|Logo.jpg|Assets/).*)',
  ],
};
