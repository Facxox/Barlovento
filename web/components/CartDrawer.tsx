'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from './CartContext';

function formatUY(n: number) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CartDrawer({ whatsapp }: { whatsapp: string }) {
  const { items, isOpen, close, setQty, remove, subtotal, clear } = useCart();
  const router = useRouter();
  const phone = whatsapp.replace(/\D/g, '');
  // Si el usuario logueado es mayorista, no mostramos Mercado Pago.
  const [customerType, setCustomerType] = useState<'retail' | 'wholesale' | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const t = data?.profile?.customer_type;
        setCustomerType(t === 'wholesale' ? 'wholesale' : 'retail');
      })
      .catch(() => {
        if (!cancelled) setCustomerType('retail');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isWholesale = customerType === 'wholesale';
  const showMercadoPago = !isWholesale;

  const buildWhatsAppLink = () => {
    const lines = items
      .map((i) => `· ${i.qty} x ${i.name} — ${formatUY(i.price * i.qty)}`)
      .join('\n');
    const msg = encodeURIComponent(
      `Hola Barlovento! Quiero hacer este pedido:\n\n${lines}\n\nTotal: ${formatUY(subtotal)}\n\nGracias!`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  };

  // Captura el pedido por WhatsApp (fire-and-forget) sin bloquear el redirect.
  const captureWhatsAppOrder = () => {
    try {
      fetch('/api/orders/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            qty: i.qty,
            price: i.price,
          })),
          total: subtotal,
          currency: items[0]?.currency ?? 'UYU',
        }),
      }).catch(() => {});
    } catch {}
  };

  const goCheckout = () => {
    if (items.length === 0) return;
    close();
    router.push('/checkout');
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={close}
        className={[
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Carrito"
        className={[
          'fixed right-0 top-0 z-50 h-full w-full max-w-md bg-carbon border-l border-carbon-line',
          'transform transition-transform duration-500',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-carbon-line px-6 py-5">
            <div>
              <p className="text-eyebrow">Tu pedido</p>
              <h2 className="font-display text-2xl text-bone mt-1">Carrito</h2>
            </div>
            <button
              onClick={close}
              className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-bone hover:border-gold"
              aria-label="Cerrar carrito"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {items.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <p className="font-display italic text-2xl text-bone/70">Tu carrito está vacío</p>
                  <p className="mt-2 text-bone/50 font-body text-sm">
                    Probá un clásico y sumá los que quieras.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((i) => (
                  <li key={i.id} className="flex gap-4 border-b border-carbon-line pb-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-carbon-raised">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="font-display text-lg text-bone leading-tight">{i.name}</p>
                      <p className="text-bone/60 font-body text-sm mt-1">{formatUY(i.price)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => setQty(i.id, i.qty - 1)}
                          className="h-7 w-7 rounded-full border border-gold/40 text-gold"
                          aria-label="Restar"
                        >−</button>
                        <span className="w-6 text-center text-bone">{i.qty}</span>
                        <button
                          onClick={() => setQty(i.id, i.qty + 1)}
                          className="h-7 w-7 rounded-full border border-gold/40 text-gold"
                          aria-label="Sumar"
                        >+</button>
                        <button
                          onClick={() => remove(i.id)}
                          className="ml-auto text-bone/50 text-xs underline-offset-4 hover:text-gold hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <footer className="border-t border-carbon-line px-6 py-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-eyebrow">Subtotal</span>
                <span className="font-display text-3xl text-gold">{formatUY(subtotal)}</span>
              </div>

              <a
                href={buildWhatsAppLink()}
                target="_blank"
                rel="noopener"
                onClick={captureWhatsAppOrder}
                className="block w-full rounded-full bg-[#25D366] py-3 text-center font-body font-medium text-white hover:bg-[#1ebe57] transition"
              >
                Comprar por WhatsApp
              </a>

              {isWholesale && (
                <p className="text-center font-body text-[11px] text-bone/60">
                  Coordinamos los pedidos mayoristas por WhatsApp. No
                  aceptamos pagos con Mercado Pago en este canal.
                </p>
              )}

              {showMercadoPago && (
                <button
                  onClick={goCheckout}
                  className="block w-full rounded-full border border-gold py-3 text-center font-body text-gold hover:bg-gold hover:text-carbon transition"
                >
                  Pagar con Mercado Pago
                </button>
              )}

              <button
                onClick={clear}
                className="block w-full text-center font-body text-xs text-bone/50 hover:text-bone"
              >
                Vaciar carrito
              </button>
            </footer>
          )}
        </div>
      </aside>
    </>
  );
}
