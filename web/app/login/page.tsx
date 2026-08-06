import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = { title: 'Iniciar sesión · Barlovento' };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-carbon px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3">
          <img
            src="/Logo.jpg"
            alt="Barlovento"
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <p className="font-display text-2xl text-gold leading-none">Barlovento</p>
            <p className="font-body text-[11px] uppercase tracking-ultra text-bone/60 mt-1">
              Iniciar sesión
            </p>
          </div>
        </div>

        <h1 className="font-display text-3xl text-bone">Bienvenido de vuelta.</h1>
        <p className="mt-2 font-body text-sm text-bone/60">
          Entrá a tu cuenta para ver pedidos y datos de envío.
        </p>

        <div className="mt-8">
          <Suspense fallback={<p className="text-bone/50 text-sm">Cargando…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
