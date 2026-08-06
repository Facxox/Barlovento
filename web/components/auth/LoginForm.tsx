'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/types';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get('next') ?? '/mi-cuenta';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError('Supabase no está configurado todavía.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError('Email o contraseña incorrectos.');
      return;
    }
    router.push(next);
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
        autoComplete="email"
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
        {loading ? 'Entrando…' : 'Iniciar sesión'}
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </button>

      {error && <p className="font-body text-sm text-red-400">{error}</p>}

      <p className="text-center font-body text-sm text-bone/60">
        ¿Sos nuevo?{' '}
        <Link href="/signup" className="text-gold hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
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
