import Link from 'next/link';
import { getProducts, getGallery, getEvents } from '@/lib/queries';
import { listOrders, countPendingOrders } from '@/lib/orders';

export default async function AdminDashboard() {
  const [products, gallery, events, pending] = await Promise.all([
    getProducts(),
    getGallery(),
    getEvents(),
    countPendingOrders(),
  ]);
  const orders = await listOrders();
  const recentOrders = orders.slice(0, 5);

  const quickLinks = [
    { href: '/admin/productos', label: 'Productos' },
    { href: '/admin/categorias', label: 'Categorías' },
    { href: '/admin/galeria', label: 'Galería' },
    { href: '/admin/eventos', label: 'Eventos' },
    { href: '/admin/textos', label: 'Textos de marca' },
    { href: '/admin/pedidos', label: 'Pedidos' },
    { href: '/admin/usuarios', label: 'Usuarios' },
  ];

  const cards: Array<{ href: string; label: string; value: string | number; hint: string }> = [
    {
      href: '/admin/productos',
      label: 'Productos',
      value: products.filter((p) => p.is_active).length,
      hint: `${products.length} en total · ${products.filter((p) => !p.is_active).length} inactivos`,
    },
    {
      href: '/admin/galeria',
      label: 'Galería',
      value: gallery.length,
      hint: 'Imágenes publicadas',
    },
    {
      href: '/admin/eventos',
      label: 'Eventos',
      value: events.filter((e) => e.kind === 'upcoming').length,
      hint: `${events.filter((e) => e.kind === 'past').length} en archivo`,
    },
    {
      href: '/admin/pedidos',
      label: 'Pedidos pendientes',
      value: pending,
      hint: pending === 0 ? 'Al día' : 'Por revisar',
    },
  ];

  return (
    <div>
      <header className="mb-10">
        <p className="font-body text-xs uppercase tracking-ultra text-gold">Panel</p>
        <h1 className="mt-2 font-display text-4xl text-bone">Resumen</h1>
        <p className="mt-2 font-body text-bone/60">
          Editá el sitio sin tocar código. Todo se guarda al instante.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group block border border-carbon-line bg-carbon p-6 transition hover:border-gold/60"
          >
            <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
              {c.label}
            </p>
            <p className="mt-3 font-display text-4xl text-gold">{c.value}</p>
            <p className="mt-2 font-body text-xs text-bone/60">{c.hint}</p>
            <p className="mt-4 font-body text-xs uppercase tracking-ultra text-bone/40 group-hover:text-gold">
              Gestionar →
            </p>
          </Link>
        ))}
      </div>

      {/* Accesos directos a todas las funcionalidades */}
      <section className="mt-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
              Accesos directos
            </p>
            <h2 className="mt-2 font-display text-2xl text-bone">
              Todas las funcionalidades
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="group flex items-center justify-between border border-carbon-line bg-carbon px-5 py-4 transition hover:border-gold/60"
            >
              <span className="font-body text-sm text-bone">{q.label}</span>
              <span className="font-body text-xs uppercase tracking-ultra text-bone/40 group-hover:text-gold">
                Abrir →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl text-bone">Últimos pedidos</h2>
          <Link
            href="/admin/pedidos"
            className="font-body text-xs uppercase tracking-ultra text-gold hover:underline"
          >
            Ver todos →
          </Link>
        </div>

        <div className="mt-6 border border-carbon-line bg-carbon">
          {recentOrders.length === 0 ? (
            <p className="p-8 text-center font-body text-sm text-bone/50">
              Todavía no hay pedidos.
            </p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
                  <th className="p-4">#</th>
                  <th className="p-4">Canal</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Fecha</th>
                </tr>
              </thead>
              <tbody className="font-body text-sm">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-carbon-line/40 last:border-0">
                    <td className="p-4 text-bone/70">#{o.id}</td>
                    <td className="p-4">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                          o.channel === 'mercadopago'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-emerald-500/20 text-emerald-300',
                        ].join(' ')}
                      >
                        {o.channel}
                      </span>
                    </td>
                    <td className="p-4 text-bone">
                      {o.currency} {o.total.toFixed(0)}
                    </td>
                    <td className="p-4 text-bone/70">{o.status}</td>
                    <td className="p-4 text-bone/60">
                      {new Date(o.created_at).toLocaleString('es-UY', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}