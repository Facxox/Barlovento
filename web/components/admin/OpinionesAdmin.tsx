'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import StarRating from '@/components/StarRating';
import type { ReviewWithAuthor } from '@/lib/reviews';

type Props = {
  initial: ReviewWithAuthor[];
};

function formatDateEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function OpinionesAdmin({ initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function call(id: number, action: 'approve' | 'hide' | 'delete') {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => {
        if (action === 'delete') {
          setItems((prev) => prev.filter((r) => r.id !== id));
        } else {
          setItems((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, approved: action === 'approve' } : r
            )
          );
        }
        router.refresh();
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setBusyId(null);
    }
  }

  const total = items.length;
  const hidden = items.filter((r) => !r.approved).length;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-bone">Opiniones</h1>
          <p className="mt-1 font-body text-sm text-bone/60">
            {total} en total · {hidden} ocultas
          </p>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 font-body text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="overflow-x-auto border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="p-3">#</th>
              <th className="p-3">Autor</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Comentario</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Estado</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.id}
                className="border-b border-carbon-line/40 last:border-0 align-top"
              >
                <td className="p-3 font-body text-sm text-bone/60">#{r.id}</td>
                <td className="p-3 font-body text-xs text-bone/80">
                  {r.author_name ?? (
                    <span className="text-bone/40">Sin nombre</span>
                  )}
                </td>
                <td className="p-3">
                  <StarRating value={r.rating} size={14} />
                </td>
                <td className="p-3 max-w-md">
                  <p className="font-body text-sm text-bone/85">{r.body}</p>
                </td>
                <td className="p-3 font-body text-xs text-bone/60">
                  {formatDateEs(r.created_at)}
                </td>
                <td className="p-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra',
                      r.approved
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300',
                    ].join(' ')}
                  >
                    {r.approved ? 'pública' : 'oculta'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {r.approved ? (
                      <button
                        type="button"
                        onClick={() => call(r.id, 'hide')}
                        disabled={busyId === r.id}
                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-amber-300 transition hover:bg-amber-500 hover:text-carbon disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Ocultar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => call(r.id, 'approve')}
                        disabled={busyId === r.id}
                        className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-emerald-300 transition hover:bg-emerald-500 hover:text-carbon disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('¿Borrar esta opinión? No se puede deshacer.')) {
                          call(r.id, 'delete');
                        }
                      }}
                      disabled={busyId === r.id}
                      className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-red-300 transition hover:bg-red-500 hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-12 text-center font-body text-sm text-bone/50"
                >
                  Todavía no hay opiniones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
