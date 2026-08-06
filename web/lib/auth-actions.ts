'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { validatePassword } from '@/lib/password-validation';

export type AuthResult =
  | { ok: true; destination: string; needsConfirmation?: boolean }
  | { ok: false; error: string };

function safeInternalPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;

  try {
    const parsed = new URL(value, 'https://barlovento.local');
    if (parsed.origin !== 'https://barlovento.local') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export async function signIn(
  email: string,
  password: string,
  destination = '/mi-cuenta'
): Promise<AuthResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: 'Supabase no está configurado todavía.' };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return { ok: false, error: 'Email o contraseña incorrectos.' };
  }

  return { ok: true, destination: safeInternalPath(destination, '/mi-cuenta') };
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
}): Promise<AuthResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: 'Supabase no está configurado todavía.' };

  const passwordCheck = validatePassword(input.password);
  if (!passwordCheck.ok) return { ok: false, error: passwordCheck.reason };

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        address: input.address.trim(),
        city: input.city.trim(),
      },
      emailRedirectTo: `${siteUrl}/`,
    },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.session) {
    return { ok: true, destination: '/signup/check-email', needsConfirmation: true };
  }

  return { ok: true, destination: '/mi-cuenta' };
}

export async function signOut(): Promise<void> {
  const supabase = await getServerSupabase();
  if (supabase) await supabase.auth.signOut();
}
