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
];

export default function AdminNav() {
  const pathname = usePathname();

  const onLogout = async () => {
    await signOut();
    window.location.assign('/admin/login');
  };

  return (
    <header className="border-b border-carbon-line bg-carbon">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4 lg:px-10">
        {/* Logo + título: ancho fijo, no se encoge ni se superpone con la nav. */}
        <div className="flex shrink-0 items-center gap-3">
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

        {/* Nav central: ocupa el espacio sobrante y se centra. Sin flex-1
            la nav pelea con el logo y los botones de la derecha y se
            superpone con ellos en anchos intermedios. */}
        <nav className="hidden flex-1 justify-center gap-1 md:flex">
          {tabs.map((t) => {
            const active = pathname === t.href ||
              (t.href !== '/admin' && pathname.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  'shrink-0 rounded-full px-4 py-2 font-body text-xs uppercase tracking-ultra transition',
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

        {/* Acciones derecha: ancho fijo, no se encoge. */}
        <div className="flex shrink-0 items-center gap-3">
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