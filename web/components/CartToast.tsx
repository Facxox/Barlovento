'use client';

import { useEffect, useState } from 'react';

export type CartToastItem = {
  id: string;
  name: string;
  image: string;
};

/**
 * Mini confirmación visual cuando el visitante agrega un producto al
 * carrito. Se monta en el root del layout y se muestra/oculta
 * automáticamente a través de un CustomEvent disparado desde el carrito.
 *
 * No abre el drawer — sólo muestra una notificación fugaz.
 */
export default function CartToast() {
  const [item, setItem] = useState<CartToastItem | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const onAdded = (event: Event) => {
      const ce = event as CustomEvent<CartToastItem>;
      setItem(ce.detail);
      setVisible(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVisible(false), 2200);
    };

    window.addEventListener('barlovento:cart-added', onAdded);
    return () => {
      window.removeEventListener('barlovento:cart-added', onAdded);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!item) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'pointer-events-none fixed bottom-6 right-6 z-[60] flex items-center gap-3 border border-gold/30 bg-carbon/95 px-4 py-3 text-bone shadow-2xl backdrop-blur transition-all duration-300',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0',
      ].join(' ')}
      style={{ minWidth: 240 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.image}
        alt=""
        className="h-10 w-10 rounded object-cover ring-1 ring-gold/30"
      />
      <div className="flex flex-col">
        <span className="font-body text-[10px] uppercase tracking-ultra text-gold">
          Agregado al carrito
        </span>
        <span className="font-display text-sm leading-tight text-bone">
          {item.name}
        </span>
      </div>
      <span className="ml-2 text-gold">✓</span>
    </div>
  );
}
