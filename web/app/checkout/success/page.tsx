import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
        Pago confirmado
      </p>
      <h1 className="mt-3 font-display text-4xl text-bone">
        Recibimos tu pedido
      </h1>
      <p className="mt-6 font-body text-base leading-relaxed text-bone/70">
        En breve nos pondremos en contacto para coordinar la entrega. Guardá tu
        número de pedido — si no te llega un mail de confirmación en los próximos
        minutos, escribinos por WhatsApp.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-gold px-6 py-3 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
        >
          Volver al sitio
        </Link>
        <Link
          href="/productos"
          className="rounded-full border border-carbon-line px-6 py-3 font-body text-xs uppercase tracking-ultra text-bone/80 transition hover:border-bone/50"
        >
          Seguir comprando
        </Link>
      </div>
    </section>
  );
}