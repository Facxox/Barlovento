'use client';

import { useInView } from './useInView';

/**
 * Línea dorada horizontal que se "dibuja" al entrar al viewport.
 * Es el signature element — aparece entre secciones como un hilo de oro
 * que cose la narrativa visual.
 */
export default function GoldDivider({ className = '' }: { className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <div ref={ref} className={['relative', className].join(' ')} aria-hidden>
      <div
        className={[
          'gold-line gold-line-draw mx-auto max-w-6xl',
          inView ? 'is-in-view' : '',
        ].join(' ')}
      />
    </div>
  );
}