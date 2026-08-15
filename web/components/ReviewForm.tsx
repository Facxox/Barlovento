'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRating from './StarRating';

type ReviewFormProps = {
  /** Si hay sesión: nombre del usuario para mostrar en el card. */
  authorName?: string | null;
  /** Si ya dejó review: el form entra en modo "Editar". */
  initial?: { rating: 1 | 2 | 3 | 4 | 5; body: string } | null;
  /** Modo auth gate: si no hay sesión, muestra CTA a /login. */
  authGateHref?: string;
};

/**
 * Form de opinión. Server-safe (no usa server-only imports). Se monta
 * dentro de Opiniones (que es server) y maneja su propio estado.
 */
export default function ReviewForm({
  authorName,
  initial,
  authGateHref = '/login?next=/',
}: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(
    initial?.rating ?? 5
  );
  const [body, setBody] = useState(initial?.body ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isLoggedIn = Boolean(authorName) || Boolean(initial);

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border border-carbon-line bg-carbon-raised p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_-8px_rgba(0,0,0,0.4)]">
        <p className="text-eyebrow text-gold">Tu opinión</p>
        <h3 className="mt-2 font-display text-2xl text-bone">
          ¿Probaste nuestros alfajores?
        </h3>
        <p className="mt-2 font-body text-sm text-bone/70">
          Iniciá sesión para dejar tu opinión y ayudar a otros clientes.
        </p>
        <Link
          href={authGateHref}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
        >
          Iniciar sesión →
        </Link>
      </div>
    );
  }

  const trimmed = body.trim();
  const minChars = 10;
  const maxChars = 800;
  const bodyValid = trimmed.length >= minChars && trimmed.length <= maxChars;
  const canSubmit = rating >= 1 && rating <= 5 && bodyValid && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, body: trimmed }),
      });
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(
          data?.error === 'duplicate'
            ? 'Ya dejaste una opinión. Editá la que tenés.'
            : data?.error === 'auth_required'
            ? 'Necesitás iniciar sesión.'
            : data?.error
            ? `No pudimos publicar tu opinión (${data.error}).`
            : 'No pudimos publicar tu opinión.'
        );
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      // Refresca el server component padre para que la nueva review
      // aparezca arriba de la lista.
      router.refresh();
    } catch {
      setError('No pudimos publicar tu opinión. Probá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_-8px_rgba(0,0,0,0.4)]">
        <p className="text-eyebrow text-emerald-300">¡Gracias!</p>
        <h3 className="mt-2 font-display text-2xl text-bone">
          Tu opinión ya está publicada
        </h3>
        <p className="mt-2 font-body text-sm text-bone/70">
          La vas a ver arriba de la lista. Si querés editarla, podés volver
          a esta sección.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-carbon-line bg-carbon-raised p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_-8px_rgba(0,0,0,0.4)]"
      noValidate
    >
      <p className="text-eyebrow text-gold">
        {initial ? 'Editar tu opinión' : 'Tu opinión'}
      </p>
      <h3 className="mt-2 font-display text-2xl text-bone">
        Contanos qué te parecieron
      </h3>
      {authorName && (
        <p className="mt-1 font-body text-xs text-bone/55">
          Publicando como <span className="text-bone">{authorName}</span>
        </p>
      )}

      <div className="mt-5">
        <p className="font-body text-xs uppercase tracking-ultra text-bone/60">
          Calificación
        </p>
        <div className="mt-2">
          <StarRating
            value={rating}
            size={28}
            readOnly={false}
            name="Calificación"
            onChange={setRating}
          />
        </div>
      </div>

      <div className="mt-5">
        <label
          htmlFor="review-body"
          className="block font-body text-xs uppercase tracking-ultra text-bone/60"
        >
          Tu comentario
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={maxChars + 50 /* permitimos tipear de más, validamos al enviar */}
          placeholder="¿Qué te gustó? ¿A quién se lo recomendarías?"
          className="mt-2 block w-full rounded-md border border-carbon-line bg-carbon px-4 py-3 font-body text-base text-bone placeholder:text-bone/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <div className="mt-1 flex items-center justify-between font-body text-xs">
          <span
            className={
              trimmed.length < minChars
                ? 'text-bone/40'
                : trimmed.length > maxChars
                ? 'text-red-300'
                : 'text-bone/55'
            }
          >
            {trimmed.length < minChars
              ? `Mínimo ${minChars} caracteres (te faltan ${minChars - trimmed.length})`
              : trimmed.length > maxChars
              ? `Máximo ${maxChars} caracteres (te pasaste por ${trimmed.length - maxChars})`
              : 'Listo'}
          </span>
          <span className="text-bone/40">
            {trimmed.length}/{maxChars}
          </span>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 font-body text-sm text-red-300"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <p className="font-body text-xs text-bone/50">
          Se publica automáticamente. Un admin puede ocultarla si es
          necesario.
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
          className="rounded-full bg-gold px-6 py-3 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? 'Publicando…'
            : initial
            ? 'Guardar cambios'
            : 'Publicar opinión'}
        </button>
      </div>
    </form>
  );
}
