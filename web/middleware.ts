import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'crypto';

/**
 * Refresca la cookie de sesión de Supabase en cada request y protege /admin/*.
 *
 * Además registra pageviews en la tabla `visitas` (fire-and-forget vía
 * `waitUntil` para no agregar latencia a la respuesta). Excluye
 * /admin/*, /api/* y assets estáticos del registro. El visitor_hash se
 * calcula como SHA-256(IP + UA) para distinguir Page Views de Visitors
 * únicos sin guardar identificadores reales.
 */
export async function middleware(request: NextRequest) {
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

  // ----------------------------------------------------------------
  // Tracking de pageviews (fire-and-forget).
  // Sólo registramos rutas de la tienda pública. Saltamos /admin/*,
  // /api/*, y el resto ya queda cubierto por el matcher de abajo.
  // ----------------------------------------------------------------
  if (
    !isAdminRoute &&
    !path.startsWith('/api/') &&
    request.method === 'GET'
  ) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      null;
    const userAgent = request.headers.get('user-agent')?.slice(0, 255) ?? null;
    const visitorHash = createHash('sha256')
      .update(`${ip ?? ''}|${userAgent ?? ''}`)
      .digest('hex');

    // Fire-and-forget: la promesa se ejecuta en background, no
    // bloquea la respuesta al usuario. (Next 14.2.5 no expone
    // `waitUntil` en NextResponse; lo que importa es no awaitear.)
    void (async () => {
      try {
        const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await service.from('visitas').insert({
          ruta: path.slice(0, 255),
          ip,
          user_agent: userAgent,
          visitor_hash: visitorHash,
        });
      } catch {
        // Si falla la inserción de analytics, no impactamos al usuario.
      }
    })();
  }

  return response;
}

export const config = {
  matcher: [
    // Todas las rutas (excepto _next, assets, favicon y api) para poder
    // pasar x-pathname y registrar pageviews.
    '/((?!_next/static|_next/image|favicon.ico|Logo.jpg|Assets/|api/).*)',
  ],
};
