import Link from 'next/link';

export const metadata = { title: 'Revisa tu correo · Barlovento' };

export default function CheckEmailPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-carbon px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <img
            src="/Logo.jpg"
            alt="Barlovento"
            className="h-14 w-14 rounded-full object-cover"
          />
        </div>

        <p className="text-eyebrow">Casi listo</p>
        <h1 className="mt-3 font-display text-4xl text-bone">Revisa tu correo</h1>

        <p className="mt-5 font-body text-base leading-relaxed text-bone/75">
          Te enviamos un email de confirmación para activar tu cuenta.
          Hacé click en el link que está adentro y volvé a iniciar sesión.
        </p>

        <div className="mt-8 rounded-2xl border border-carbon-line bg-carbon-raised p-5">
          <p className="font-body text-sm text-bone/60">
            Si no aparece en tu bandeja de entrada, mirá la carpeta de
            <span className="text-gold"> spam o promociones</span>.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="group inline-flex items-center justify-center gap-3 rounded-full bg-gold px-7 py-3.5 font-body text-sm font-medium text-carbon transition hover:bg-gold-light"
          >
            Ir a iniciar sesión
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="/"
            className="gold-underline inline-flex items-center justify-center font-body text-sm uppercase tracking-ultra text-bone/80"
          >
            ← Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  );
}