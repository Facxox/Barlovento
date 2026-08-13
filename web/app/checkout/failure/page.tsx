import Link from 'next/link';

export default function CheckoutFailurePage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-body text-[10px] uppercase tracking-ultra text-red-400">
        Pago no procesado
      </p>
      <h1 className="mt-3 font-display text-4xl text-bone">
        No pudimos completar el pago
      </h1>
      <p className="mt-6 font-body text-base leading-relaxed text-bone/70">
        El pago fue cancelado o rechazado por el medio elegido. Probá de nuevo
        con otra tarjeta o, si preferís, completá tu pedido por WhatsApp.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/productos"
          className="rounded-full bg-gold px-6 py-3 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
        >
          Reintentar
        </Link>
        <Link
          href="/"
          className="rounded-full border border-carbon-line px-6 py-3 font-body text-xs uppercase tracking-ultra text-bone/80 transition hover:border-bone/50"
        >
          Volver al sitio
        </Link>
      </div>
    </section>
  );
}
