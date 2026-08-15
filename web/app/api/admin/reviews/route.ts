import { NextRequest, NextResponse } from 'next/server';
import {
  setReviewApproved,
  deleteReview,
} from '@/lib/reviews';

export const runtime = 'nodejs';

/**
 * POST /api/admin/reviews
 *
 * Body: { id: number, action: 'approve' | 'hide' | 'delete' }
 *
 * Requiere sesión admin.
 */
export async function POST(req: NextRequest) {
  try {
    const { requireAdminStrict } = await import('@/lib/admin-actions');
    await requireAdminStrict();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autorizado.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let body: { id?: unknown; action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 });
  }

  const action = String(body.action ?? '').toLowerCase();
  if (action === 'approve' || action === 'hide') {
    const result = await setReviewApproved(id, action === 'approve');
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const result = await deleteReview(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: 'invalid_action', allowed: ['approve', 'hide', 'delete'] },
    { status: 400 }
  );
}
