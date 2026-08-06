'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError('Supabase no está configurado todavía.');
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        required
        autoComplete="username"
      />
      <Field
        label="Contraseña"
        type="password"
        value={password}
        onChange={setPassword}
        required
        autoComplete="current-password"
      />
      <button
        type="submit"
        disabled={loading}
        className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-gold px-7 py-3.5 font-body text-sm font-medium text-carbon transition hover:bg-gold-light disabled:opacity-50"
      >
        {loading ? 'Entrando…' : 'Entrar'}
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </button>
      {error && (
        <p className="font-body text-sm text-red-400">{error}</p>
      )}
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-carbon px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <img
            src="/Logo.jpg"
            alt="Barlovento"
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <p className="font-display text-2xl text-gold leading-none">Barlovento</p>
            <p className="font-body text-[11px] uppercase tracking-ultra text-bone/60 mt-1">
              Panel de admin
            </p>
          </div>
        </div>

        <h1 className="font-display text-3xl text-bone">Iniciar sesión</h1>
        <p className="mt-2 font-body text-sm text-bone/60">
          Accedé con tu usuario administrador.
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="font-body text-[11px] uppercase tracking-ultra text-bone/50">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border-b border-carbon-line bg-transparent px-3 py-3 font-body text-bone placeholder-bone/40 focus:border-gold focus:bg-carbon-raised/30 outline-none transition"
      />
    </label>
  );
}