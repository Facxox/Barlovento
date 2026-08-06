'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-carbon px-6 text-center">
      <div className="max-w-md">
        <p className="text-eyebrow">Algo se rompió</p>
        <h1 className="mt-3 h-display text-bone">Error inesperado</h1>
        <p className="mt-3 font-body text-sm text-bone/60">
          {error.message || 'Probá recargar la página.'}
        </p>
        {error.digest && (
          <p className="mt-2 font-body text-[10px] uppercase tracking-ultra text-bone/40">
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-full border border-gold px-5 py-2 font-body text-xs uppercase tracking-ultra text-gold hover:bg-gold hover:text-carbon transition"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
