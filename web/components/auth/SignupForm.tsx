'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/types';

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!fullName.trim()) {
      setError('Poné tu nombre.');
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError('Supabase no está configurado todavía.');
      return;
    }

    setLoading(true);

    // signUp con metadata.full_name → el trigger lo levanta en profiles.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Si la confirmación por email está activada en Supabase,
    // la sesión no se crea acá. Forzamos signIn para entrar al sitio
    // ya logueado (si falla por email-not-confirmed, mostramos mensaje).
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      // Abrimos en nueva pestaña la pantalla "Revisa tu correo" para que el
      // usuario confirme desde su mail. No redirigimos la pestaña actual:
      // si confirma el email y vuelve a /signup, sigue viendo su formulario.
      window.open(
        '/signup/check-email',
        'barlovento-check-email',
        'noopener,noreferrer'
      );
      setError(
        'Cuenta creada. Te abrimos una pestaña para que revises tu email y la confirmes.'
      );
      return;
    }

    router.push('/mi-cuenta');
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Nombre completo" value={fullName} onChange={setFullName} required autoComplete="name" />
      <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
      <Field label="Contraseña" type="password" value={password} onChange={setPassword} required autoComplete="new-password" hint="Mínimo 6 caracteres." />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Teléfono" type="tel" value={phone} onChange={setPhone} required autoComplete="tel" />
        <Field label="Ciudad" value={city} onChange={setCity} required autoComplete="address-level2" />
      </div>
      <Field label="Dirección" value={address} onChange={setAddress} required autoComplete="street-address" />

      <button
        type="submit"
        disabled={loading}
        className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-gold px-7 py-3.5 font-body text-sm font-medium text-carbon transition hover:bg-gold-light disabled:opacity-50"
      >
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </button>

      {error && (
        <p className="font-body text-sm text-red-400">{error}</p>
      )}

      <p className="text-center font-body text-sm text-bone/60">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-gold hover:underline">
          Iniciar sesión
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
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
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
      {hint && (
        <span className="mt-1 block font-body text-[11px] text-bone/40">{hint}</span>
      )}
    </label>
  );
}
