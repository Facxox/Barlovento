import type { Metadata } from 'next';
import CheckoutForm from './CheckoutForm';

export const metadata: Metadata = {
  title: 'Checkout · Barlovento',
  description: 'Revisá tus datos y aceptá las condiciones del envío antes de pagar.',
};

export default function CheckoutPage() {
  return (
    <section className="bg-cream text-ink py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-eyebrow text-gold-deep">Checkout</p>
        <h1 className="mt-3 font-display text-4xl text-ink md:text-5xl font-light">
          Confirmá tu pedido
        </h1>
        <p className="mt-3 max-w-xl font-body leading-relaxed text-ink/70">
          Revisá tus datos y aceptá las condiciones del envío antes de pagar con
          Mercado Pago. El carrito ya viene cargado con lo que sumaste.
        </p>

        <div className="mt-10">
          <CheckoutForm />
        </div>
      </div>
    </section>
  );
}
