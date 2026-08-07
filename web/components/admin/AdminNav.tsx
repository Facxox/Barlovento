'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/lib/auth-actions';

const tabs = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/categorias', label: 'Categorías' },
  { href: '/admin/categorias-galeria', label: 'Cat. galería' },
  { href: '/admin/galeria', label: 'Galería' },
  { href: '/admin/eventos', label: 'Eventos' },
  { href: '/admin/textos', label: 'Textos' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/analiticas', label: 'Analíticas' },
];

export default function AdminNav() {
  const pathname = usePathname();

  const onLogout = async () => {
    await signOut();
    window.location.assign('/admin/login');
  };

  return (
    <header className="border-b border-carbon-line bg-carbon">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
        <Link href="/admin" className="flex min-w-0 shrink-0 items-center gap-3">
          <img
            src="/Logo.jpg"
            alt="Barlovento"
            className="h-9 w-9 rounded-full object-cover ring-1 ring-gold/40"
          />
          <div className="min-w-0">
            <p className="font-display text-lg leading-none text-gold">Barlovento</p>
            <p className="mt-0.5 font-body text-[10px] uppercase tracking-ultra text-bone/60">
              Panel de admin
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            target="_blank"
            className="hidden rounded-full px-3 py-2 font-body text-[10px] uppercase tracking-ultra text-bone/60 transition hover:bg-carbon-raised hover:text-bone sm:inline"
          >
            Ver sitio ↗
          </Link>
          <button
            onClick={onLogout}
            className="rounded-full border border-gold/50 px-3 py-2 font-body text-[10px] uppercase tracking-ultra text-gold transition hover:bg-gold hover:text-carbon sm:px-4"
          >
            Salir
          </button>
        </div>
      </div>

      <nav className="border-t border-carbon-line bg-carbon-raised/30">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 lg:justify-center lg:px-10 [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => {
            const active = pathname === t.href ||
              (t.href !== '/admin' && pathname.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  'shrink-0 rounded-full px-3 py-2 font-body text-[10px] uppercase tracking-[0.12em] transition sm:px-4 sm:text-xs',
                  active
                    ? 'bg-gold text-carbon shadow-[0_0_18px_rgba(212,175,55,0.18)]'
                    : 'text-bone/65 hover:bg-carbon-line/60 hover:text-bone',
                ].join(' ')}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
