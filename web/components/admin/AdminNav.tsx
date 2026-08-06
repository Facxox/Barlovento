'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/types';

const tabs = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/galeria', label: 'Galería' },
  { href: '/admin/eventos', label: 'Eventos' },
  { href: '/admin/textos', label: 'Textos' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/usuarios', label: 'Usuarios' },
];

export default function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();

  const onLogout = async () => {
    const supabase = getBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <header className="border-b border-carbon-line bg-carbon">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <div className="flex items-center gap-3">
          <img
            src="/Logo.jpg"
            alt="Barlovento"
            className="h-9 w-9 rounded-full object-cover"
          />
          <div>
            <p className="font-display text-lg text-gold leading-none">Barlovento</p>
            <p className="font-body text-[10px] uppercase tracking-ultra text-bone/60 mt-0.5">
              Panel de admin
            </p>
          </div>
        </div>

        <nav className="hidden gap-1 md:flex">
          {tabs.map((t) => {
            const active = pathname === t.href ||
              (t.href !== '/admin' && pathname.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  'rounded-full px-4 py-2 font-body text-xs uppercase tracking-ultra transition',
                  active
                    ? 'bg-gold text-carbon'
                    : 'text-bone/70 hover:text-bone',
                ].join(' ')}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="hidden font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone md:inline"
          >
            Ver sitio ↗
          </Link>
          <button
            onClick={onLogout}
            className="rounded-full border border-gold/40 px-4 py-2 font-body text-xs uppercase tracking-ultra text-gold hover:bg-gold hover:text-carbon transition"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <nav className="flex gap-1 overflow-x-auto border-t border-carbon-line px-6 py-2 md:hidden">
        {tabs.map((t) => {
          const active = pathname === t.href ||
            (t.href !== '/admin' && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                'shrink-0 rounded-full px-3 py-1.5 font-body text-[10px] uppercase tracking-ultra transition',
                active
                  ? 'bg-gold text-carbon'
                  : 'text-bone/70',
              ].join(' ')}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}