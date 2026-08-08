import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';

/**
 * GET /api/admin/event-images?eventId=N
 *
 * Devuelve las imágenes (id + url) de un evento ordenadas por position.
 * Sólo accesible por admin.
 */
export async function GET(req: NextRequest) {
  const { requireAdminStrict } = await import('@/lib/admin-actions');
  try {
    await requireAdminStrict();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autorizado.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const eventId = Number(req.nextUrl.searchParams.get('eventId') ?? 0);
  if (!eventId) {
    return NextResponse.json({ error: 'Falta eventId.' }, { status: 400 });
  }

  // Reusamos el cliente admin para evitar problemas con RLS en sesiones
  // parcialmente invalidadas (mismo patrón que en admin-actions).
  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ images: [] });
  }

  const { data, error } = await service
    .from('event_images')
    .select('id,url,position')
    .eq('event_id', eventId)
    .order('position', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    images: (data ?? []).map((r) => ({ id: r.id, url: r.url })),
  });
}
