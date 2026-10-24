'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Cuenta regresiva de una foto programada. Al llegar a 0 pide al server
// la página de nuevo (router.refresh), que ya devuelve la foto. Si el
// reloj del visitante va adelantado, reintenta cada pocos segundos.
export default function GaleriaCountdown({ publishAt }: { publishAt: string }) {
  const router = useRouter();
  const target = new Date(publishAt).getTime();
  // null hasta montar: evita mismatch de hidratación entre server y cliente.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now === null ? null : Math.max(0, target - now);
  const done = remaining === 0;

  useEffect(() => {
    if (!done) return;
    router.refresh();
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [done, router]);

  if (remaining === null) return <div className="h-24" aria-hidden="true" />;

  if (done) {
    return (
      <p className="font-body text-sm uppercase tracking-ultra text-gold-deep">
        Revelando…
      </p>
    );
  }

  const s = Math.floor(remaining / 1000);
  const parts = [
    { value: Math.floor(s / 86400), label: 'días' },
    { value: Math.floor((s % 86400) / 3600), label: 'horas' },
    { value: Math.floor((s % 3600) / 60), label: 'min' },
    { value: s % 60, label: 'seg' },
  ];

  return (
    <div className="flex justify-center gap-3 sm:gap-6" role="timer" aria-live="off">
      {parts.map((p) => (
        <div
          key={p.label}
          className="min-w-[4.5rem] border border-ink/15 px-3 py-4 text-center sm:min-w-[6rem]"
        >
          <p className="font-display text-4xl text-ink sm:text-5xl tabular-nums">
            {String(p.value).padStart(2, '0')}
          </p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-ultra text-ink/60">
            {p.label}
          </p>
        </div>
      ))}
    </div>
  );
}
