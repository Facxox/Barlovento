'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from './CartContext';
import { getBrowserSupabase } from '@/lib/types';

const navLinks = [
  { label: 'Productos', href: '#productos' },
  { label: 'Tienda', href: '#tienda' },
  { label: 'Historia', href: '#historia' },
  { label: 'Eventos', href: '#eventos' },
  { label: 'Galería', href: '#galeria' },
  { label: 'Contacto', href: '#contacto' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { count, open: openCart } = useCart();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Detecta sesión activa y reacciona a cambios (login / logout).
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let mounted = true;
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string | null } | null } }) => {
      if (mounted) setUserEmail(data.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { email?: string | null } | null } | null) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname]);

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-40 transition-colors duration-500',
        scrolled
          ? 'bg-carbon/90 border-b border-carbon-line'
          : 'bg-transparent',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Barlovento">
          {/* Logo del local — wordmark oficial */}
          <img
            src="/Logo.jpg"
            alt="Barlovento"
            className="h-9 w-9 rounded-full object-cover"
          />
          <span className="font-display text-lg tracking-wide text-bone">
            Barlovento
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="gold-underline font-body text-[13px] uppercase tracking-ultra text-bone/80 hover:text-bone"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={openCart}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-gold/40 text-bone hover:border-gold hover:text-gold transition"
            aria-label="Abrir carrito"
          >
            <CartIcon />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-carbon">
                {count}
              </span>
            )}
          </button>

          <button
            className="lg:hidden grid h-10 w-10 place-items-center rounded-full border border-gold/40 text-bone"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={open}
          >
            <span className="block h-px w-5 bg-bone relative before:absolute before:-top-1.5 before:left-0 before:h-px before:w-5 before:bg-bone after:absolute after:top-1.5 after:left-0 after:h-px after:w-5 after:bg-bone" />
          </button>

          <Link
            href={userEmail ? '/mi-cuenta' : '/login'}
            className="hidden lg:inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 font-body text-[11px] uppercase tracking-ultra text-bone/85 transition hover:border-gold hover:text-gold"
            onClick={() => setOpen(false)}
          >
            {userEmail ? 'Mi cuenta' : 'Iniciar sesión'}
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={[
          'lg:hidden overflow-hidden transition-[max-height] duration-500',
          open ? 'max-h-96' : 'max-h-0',
        ].join(' ')}
      >
        <nav className="mx-6 mb-4 rounded-2xl border border-carbon-line bg-carbon-raised p-4">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 font-body text-sm uppercase tracking-ultra text-bone/85 border-b border-carbon-line"
            >
              {l.label}
            </a>
          ))}
          <Link
            href={userEmail ? '/mi-cuenta' : '/login'}
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-full border border-gold/40 px-4 py-3 text-center font-body text-sm uppercase tracking-ultra text-bone/85"
          >
            {userEmail ? 'Mi cuenta' : 'Iniciar sesión'}
          </Link>
        </nav>
      </div>
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
      <circle cx="9" cy="21" r="1.2" />
      <circle cx="18" cy="21" r="1.2" />
    </svg>
  );
}