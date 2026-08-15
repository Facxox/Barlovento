import 'server-only';
import { getServerSupabase } from './supabase-server';
import { getServiceSupabase } from './supabase-admin';

export type ReviewRow = {
  id: number;
  user_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  approved: boolean;
  created_at: string;
  updated_at: string;
};

export type ReviewWithAuthor = ReviewRow & {
  author_name: string | null;
};

export type ReviewStats = {
  total: number;
  average: number;
  /** Cantidad de reviews por estrella (1..5). */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

/**
 * Lista opiniones aprobadas para mostrar en la home.
 * "Mejores primero" = rating desc, created_at desc.
 * Hace JOIN con profiles para mostrar el nombre del autor.
 * Usa el cliente server-side (anon key + RLS) — la policy sólo deja ver
 * las aprobadas, así que no hay que filtrar acá.
 */
export async function listApprovedReviews(
  limit = 20
): Promise<ReviewWithAuthor[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('reviews')
    .select('id, user_id, rating, body, approved, created_at, updated_at')
    .order('rating', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Lookup nombres por separado (evita asumir nombre del FK constraint).
  const userIds = Array.from(new Set(data.map((r) => r.user_id)));
  const nameByUserId = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);
    for (const p of (profiles ?? []) as Array<{
      user_id: string;
      full_name: string | null;
    }>) {
      nameByUserId.set(p.user_id, p.full_name);
    }
  }

  return (data as ReviewRow[]).map((r) => ({
    ...r,
    author_name: nameByUserId.get(r.user_id) ?? null,
  }));
}

/**
 * Stats agregados de las reviews aprobadas.
 */
export async function getReviewStats(): Promise<ReviewStats> {
  const empty: ReviewStats = {
    total: 0,
    average: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  const supabase = await getServerSupabase();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('approved', true);

  if (error || !data) return empty;

  const total = data.length;
  if (total === 0) return empty;

  let sum = 0;
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  };
  for (const row of data as Array<{ rating: number }>) {
    const r = Math.max(1, Math.min(5, Math.round(row.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[r] += 1;
    sum += r;
  }
  return {
    total,
    average: Math.round((sum / total) * 10) / 10,
    distribution,
  };
}

/**
 * Devuelve la review del usuario logueado (si existe) para saber si el
 * form debe mostrar "Dejá tu opinión" o "Editar tu opinión".
 */
export async function getMyReview(userId: string): Promise<ReviewRow | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ReviewRow;
}

// ─── Admin (service role, bypassa RLS) ─────────────────────────────

export async function listAllReviewsForAdmin(): Promise<ReviewWithAuthor[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('id, user_id, rating, body, approved, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  const userIds = Array.from(new Set(data.map((r) => r.user_id)));
  const nameByUserId = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);
    for (const p of (profiles ?? []) as Array<{
      user_id: string;
      full_name: string | null;
    }>) {
      nameByUserId.set(p.user_id, p.full_name);
    }
  }

  return (data as ReviewRow[]).map((r) => ({
    ...r,
    author_name: nameByUserId.get(r.user_id) ?? null,
  }));
}

export async function setReviewApproved(
  reviewId: number,
  approved: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };
  const { error } = await supabase
    .from('reviews')
    .update({ approved })
    .eq('id', reviewId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteReview(
  reviewId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
