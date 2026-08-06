'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signUp } from '@/lib/auth-actions';
import { validatePassword } from '@/lib/password-validation';

export default function SignupForm() {
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

    if (!fullName.trim()) {
      setError('Poné tu nombre.');
      return;
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) {
      setError(pwCheck.reason);
      return;
    }

    setLoading(true);
    const result = await signUp({
      email,
      password,
      fullName,
      phone,
      address,
      city,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.needsConfirmation) {
      window.location.assign(result.destination);
      return;
    }

    window.location.assign(result.destination);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Nombre completo" value={fullName} onChange={setFullName} required autoComplete="name" />
      <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
      <Field
        label="Contraseña"
        type="password"
        value={password}
        onChange={setPassword}
        required
        autoComplete="new-password"
        hint="Mínimo 8 caracteres con mayúsculas, minúsculas, números y un símbolo."
      />
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
