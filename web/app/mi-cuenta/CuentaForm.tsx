'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/types';
import { updateProfile } from '@/lib/profile-actions';

type Profile = {
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  is_admin?: boolean | null;
};

export default function CuentaForm({ initial }: { initial?: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        await updateProfile({
          full_name: fullName,
          phone,
          address,
          city,
        });
        setSaved(true);
        router.refresh();
      } catch (err: any) {
        setError(err?.message ?? 'No se pudieron guardar los cambios.');
      }
    });
  };

  const onSignOut = async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Nombre completo" value={fullName} onChange={setFullName} required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Teléfono" type="tel" value={phone} onChange={setPhone} required />
        <Field label="Ciudad" value={city} onChange={setCity} required />
      </div>
      <Field label="Dirección" value={address} onChange={setAddress} required />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="group inline-flex items-center gap-3 rounded-full bg-gold px-7 py-3 font-body text-sm font-medium text-carbon transition hover:bg-gold-light disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="ml-auto rounded-full border border-carbon-line px-5 py-3 font-body text-xs uppercase tracking-ultra text-bone/60 hover:border-gold hover:text-gold transition"
        >
          Cerrar sesión
        </button>
      </div>

      {saved && (
        <p className="font-body text-sm text-gold">Datos guardados ✓</p>
      )}
      {error && (
        <p className="font-body text-sm text-red-400">{error}</p>
      )}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
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
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border-b border-carbon-line bg-transparent px-3 py-3 font-body text-bone focus:border-gold focus:bg-carbon-raised/30 outline-none transition"
      />
    </label>
  );
}
