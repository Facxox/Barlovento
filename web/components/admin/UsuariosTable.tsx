'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCustomerType, type CustomerType } from '@/lib/admin-actions';
import type { AdminProfile, UsersStats } from '@/lib/admin-queries';
import UserOrdersDrawer from './UserOrdersDrawer';

const formatUY = (n: number) =>
  new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0,
  }).format(n);

export default function UsuariosTable({
  initial,
  stats,
}: {
  initial: AdminProfile[];
  stats: UsersStats;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [filter, setFilter] = useState<'all' | CustomerType>('all');
  const [query, setQuery] = useState('');
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerEmail, setDrawerEmail] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    if (filter !== 'all' && u.customer_type !== filter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q) ||
        (u.city ?? '').toLowerCase().includes(q);
      if (!hay) return false;
    }
    return true;
  });

  const onToggle = (u: AdminProfile) => {
    const next: CustomerType =
      u.customer_type === 'wholesale' ? 'retail' : 'wholesale';
    const prev = u.customer_type;
    // Optimistic.
    setUsers((list) =>
      list.map((x) =>
        x.user_id === u.user_id ? { ...x, customer_type: next } : x
      )
    );
    setBusyId(u.user_id);
    setError(null);
    startTransition(async () => {
      try {
        await updateCustomerType(u.user_id, next);
        router.refresh();
      } catch (err: any) {
        // Roll back.
        setUsers((list) =>
          list.map((x) =>
            x.user_id === u.user_id ? { ...x, customer_type: prev } : x
          )
        );
        setError(err.message ?? 'Error al guardar.');
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-bone">Usuarios</h1>
        <p className="mt-1 font-body text-sm text-bone/60">
          {stats.total} cuentas · {stats.wholesale} mayoristas · {stats.retail}{' '}
          minoristas · {stats.admins} admins
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          placeholder="Buscar email, nombre, ciudad…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone placeholder-bone/40 focus:border-gold outline-none"
        />
        <div className="flex gap-1">
          {(
            [
              { k: 'all', label: 'Todos' },
              { k: 'retail', label: 'Minoristas' },
              { k: 'wholesale', label: 'Mayoristas' },
            ] as const
          ).map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFilter(f.k)}
              className={[
                'rounded-full px-3 py-1.5 font-body text-[10px] uppercase tracking-ultra transition',
                filter === f.k
                  ? 'bg-gold text-carbon'
                  : 'border border-carbon-line text-bone/70 hover:text-bone',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 font-body text-sm text-red-400">{error}</p>
      )}

      <div className="overflow-x-auto border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="p-3">Usuario</th>
              <th className="p-3">Contacto</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Pedidos</th>
              <th className="p-3">Total gastado</th>
              <th className="p-3">Registro</th>
              <th className="p-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="font-body text-sm">
            {filtered.map((u) => {
              const isBusy = busyId === u.user_id;
              const isWholesale = u.customer_type === 'wholesale';
              return (
                <tr
                  key={u.user_id}
                  className="border-b border-carbon-line/40 last:border-0"
                >
                  <td className="p-3">
                    <p className="text-bone">{u.full_name || '—'}</p>
                    <p className="text-[11px] text-bone/60">{u.email}</p>
                    {u.is_admin && (
                      <span className="mt-1 inline-block rounded-full border border-gold/40 px-2 py-0.5 text-[9px] uppercase tracking-ultra text-gold">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-bone/80">
                    <p>{u.phone || '—'}</p>
                    <p className="text-[11px] text-bone/60">
                      {[u.city, u.address].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </td>
                  <td className="p-3">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                        isWholesale
                          ? 'bg-gold/20 text-gold'
                          : 'bg-carbon-line text-bone/60',
                      ].join(' ')}
                    >
                      {isWholesale ? 'Mayorista' : 'Minorista'}
                    </span>
                  </td>
                  <td className="p-3 text-bone/80">
                    <button
                      type="button"
                      onClick={() => setDrawerEmail(u.email)}
                      disabled={!u.email || u.orders_count === 0}
                      className="rounded-full border border-carbon-line px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-bone/80 hover:border-gold hover:text-gold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        u.orders_count === 0
                          ? 'Este cliente no tiene pedidos todavía'
                          : `Ver los ${u.orders_count} pedidos de ${u.email}`
                      }
                    >
                      Ver pedidos · {u.orders_count}
                    </button>
                  </td>
                  <td className="p-3 text-bone/80">
                    {u.total_spent > 0 ? formatUY(u.total_spent) : '—'}
                  </td>
                  <td className="p-3 text-bone/60">
                    {new Date(u.created_at).toLocaleDateString('es-UY', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onToggle(u)}
                      disabled={isBusy}
                      className={[
                        'rounded-full px-3 py-1.5 font-body text-[10px] uppercase tracking-ultra transition disabled:opacity-50',
                        isWholesale
                          ? 'border border-carbon-line text-bone/70 hover:bg-carbon-raised'
                          : 'bg-gold text-carbon hover:bg-gold-light',
                      ].join(' ')}
                    >
                      {isBusy
                        ? '…'
                        : isWholesale
                        ? 'Pasar a minorista'
                        : 'Pasar a mayorista'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center font-body text-sm text-bone/50"
                >
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UserOrdersDrawer
        email={drawerEmail}
        userLabel={
          filtered.find((u) => u.email === drawerEmail)?.full_name ||
          drawerEmail ||
          ''
        }
        open={!!drawerEmail}
        onClose={() => setDrawerEmail(null)}
      />
    </div>
  );
}