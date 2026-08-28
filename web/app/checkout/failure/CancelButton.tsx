'use client';

import { useState } from 'react';

type Props = {
  orderId: number;
};

/**
 * Botón "Cancelar pedido" para mostrar en /checkout/pending y /failure.
 * Sólo se renderiza cuando la orden sigue en `pending` (lo gatea la
 * página padre). Si el webhook de MP llega entre que el usuario ve la
 * pantalla y hace click, el endpoint devuelve 409 y mostramos un
 * mensaje amable.
 */
export default function CancelButton({ orderId }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'idle' }
    | { kind: 'ok' }
    | { kind: 'conflict' }
    | { kind: 'error' }
  >({ kind: 'idle' });

  const onClick = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
      });
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (res.ok && data?.ok) {
        setResult({ kind: 'ok' });
        return;
      }
      if (res.status === 409) {
        setResult({ kind: 'conflict' });
        return;
      }
      setResult({ kind: 'error' });
    } catch {
      setResult({ kind: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  if (result.kind === 'ok') {
    return (
      <p
        role="status"
        className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 font-body text-xs uppercase tracking-ultra text-emerald-300"
      >
        Pedido cancelado
      </p>
    );
  }

  const disabled = cancelling || result.kind === 'conflict';

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled}
        className="rounded-full border border-red-400/40 bg-red-500/10 px-6 py-3 font-body text-xs uppercase tracking-ultra text-red-300 transition hover:bg-red-500 hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
      >
        {cancelling ? 'Cancelando…' : 'Cancelar pedido'}
      </button>
      {result.kind === 'conflict' && (
        <p
          role="alert"
          className="font-body text-xs text-bone/60"
        >
          Este pedido ya fue procesado y no se puede cancelar.
        </p>
      )}
      {result.kind === 'error' && (
        <p
          role="alert"
          className="font-body text-xs text-red-300"
        >
          No pudimos cancelar, probá de nuevo.
        </p>
      )}
    </div>
  );
}
