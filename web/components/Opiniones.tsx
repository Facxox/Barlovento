import Link from 'next/link';
import {
  listApprovedReviews,
  getReviewStats,
  getMyReview,
  type ReviewWithAuthor,
} from '@/lib/reviews';
import { getServerSupabase } from '@/lib/supabase-server';
import ReviewForm from './ReviewForm';
import StarRating from './StarRating';

function formatDateEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function authorLabel(name: string | null, userId: string): string {
  if (name && name.trim()) return name.trim();
  return 'Cliente anónimo';
}

function anonymizeUserId(userId: string): string {
  // "abcd1234-…-wxyz" → "abcd…wxyz"
  return `${userId.slice(0, 4)}…${userId.slice(-4)}`;
}

export default async function Opiniones() {
  const [reviews, stats, supabase] = await Promise.all([
    listApprovedReviews(20),
    getReviewStats(),
    getServerSupabase(),
  ]);

  // Si hay sesión, buscamos el perfil y la posible review propia para
  // pasarle al form.
  let authorName: string | null = null;
  let myReview: ReviewWithAuthor | null = null;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [{ data: profile }, mine] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle(),
        getMyReview(user.id),
      ]);
      authorName = profile?.full_name ?? null;
      myReview = mine as ReviewWithAuthor | null;
    }
  }

  const formInitial = myReview
    ? {
        rating: myReview.rating,
        body: myReview.body,
      }
    : null;

  return (
    <section
      id="opiniones"
      className="bg-carbon py-24 lg:py-32"
      aria-labelledby="opiniones-heading"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-eyebrow text-gold">Opiniones</p>
            <h2
              id="opiniones-heading"
              className="mt-3 font-display text-4xl text-bone md:text-5xl font-light"
            >
              Lo que dicen quienes ya probaron
            </h2>
            {stats.total > 0 ? (
              <div className="mt-4 flex items-center gap-3">
                <StarRating value={stats.average} size={20} />
                <span className="font-body text-sm text-bone/70">
                  <span className="font-display text-2xl text-gold">
                    {stats.average.toFixed(1)}
                  </span>{' '}
                  · {stats.total}{' '}
                  {stats.total === 1 ? 'opinión' : 'opiniones'}
                </span>
              </div>
            ) : (
              <p className="mt-4 font-body text-sm text-bone/55">
                Todavía no hay opiniones. ¡Sé el primero en dejar la tuya!
              </p>
            )}
          </div>

          {stats.total > 0 && (
            <div className="hidden md:block">
              <Link
                href="#dejar-opinion"
                className="rounded-full border border-gold/40 px-5 py-2 font-body text-xs uppercase tracking-ultra text-gold transition hover:bg-gold hover:text-carbon"
              >
                Dejar mi opinión
              </Link>
            </div>
          )}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Listado */}
          <div>
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-carbon-line bg-carbon-raised p-10 text-center">
                <p className="font-display italic text-2xl text-bone/70">
                  Pronto vas a ver acá las opiniones de la comunidad.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-carbon-line bg-carbon-raised p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <StarRating value={r.rating} size={18} />
                        <p className="mt-3 font-body text-base leading-relaxed text-bone/85">
                          {r.body}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between font-body text-xs text-bone/50">
                      <span>
                        <span className="text-bone/80">
                          {authorLabel(r.author_name, r.user_id)}
                        </span>
                        {!r.author_name && (
                          <span className="ml-2 text-bone/30">
                            ({anonymizeUserId(r.user_id)})
                          </span>
                        )}
                      </span>
                      <span>{formatDateEs(r.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Form (sticky en desktop) */}
          <aside id="dejar-opinion" className="lg:sticky lg:top-8 lg:self-start">
            <ReviewForm authorName={authorName} initial={formInitial} />
          </aside>
        </div>
      </div>
    </section>
  );
}
