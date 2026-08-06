'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  toggleProductActive,
  deleteProduct,
  reorderProducts,
  cloneProductToWholesale,
} from '@/lib/admin-actions';
import type { Product } from '@/lib/queries';

export default function ProductosTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const [items, setItems] = useState(products);
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(idx, 1);
    copy.splice(next, 0, moved);
    // Recalcula sort_order visible (persiste en backend al confirmar).
    copy.forEach((p, i) => (p.sort_order = i + 1));
    setItems(copy);
    startTransition(async () => {
      setBusyId(moved.id);
      await reorderProducts(copy.map((p) => p.id));
      setBusyId(null);
    });
  };

  const onToggle = async (id: string) => {
    setBusyId(id);
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: !p.is_active } : p))
    );
    await toggleProductActive(id);
    setBusyId(null);
  };

  const onDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    setBusyId(id);
    setItems((prev) => prev.filter((p) => p.id !== id));
    await deleteProduct(id);
    setBusyId(null);
  };

  const onClone = async (id: string) => {
    setBusyId(id);
    try {
      const newId = await cloneProductToWholesale(id);
      router.push(`/admin/productos?type=wholesale&justCloned=${newId}`);
    } catch (err: any) {
      alert(err.message ?? 'No pudimos clonarlo.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-bone">Productos</h1>
          <p className="mt-1 font-body text-sm text-bone/60">
            {items.length} en total.
          </p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="rounded-full bg-gold px-5 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
        >
          + Nuevo producto
        </Link>
      </header>

      <div className="border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="w-12 p-3"></th>
              <th className="p-3"></th>
              <th className="p-3">Producto</th>
              <th className="p-3">Categoría</th>
              <th className="p-3 text-right">Precio</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr
                key={p.id}
                className={[
                  'border-b border-carbon-line/40 last:border-0 transition',
                  busyId === p.id ? 'opacity-50' : '',
                  !p.is_active ? 'opacity-60' : '',
                ].join(' ')}
              >
                <td className="p-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="text-bone/50 hover:text-gold disabled:opacity-30"
                      aria-label="Subir"
                    >▲</button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      className="text-bone/50 hover:text-gold disabled:opacity-30"
                      aria-label="Bajar"
                    >▼</button>
                  </div>
                </td>
                <td className="p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-10 w-10 object-cover"
                  />
                </td>
                <td className="p-3">
                  <p className="font-display text-base text-bone">{p.name}</p>
                  {p.badge && (
                    <p className="font-body text-[10px] uppercase tracking-ultra text-gold/80">
                      {p.badge}
                    </p>
                  )}
                </td>
                <td className="p-3 font-body text-sm text-bone/70">{p.category}</td>
                <td className="p-3 text-right font-body text-sm text-bone">
                  {p.currency} {p.price.toFixed(0)}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => onToggle(p.id)}
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                      p.is_active
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-carbon-line text-bone/50',
                    ].join(' ')}
                  >
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/productos/${p.id}`}
                      className="rounded-full border border-gold/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-gold hover:bg-gold hover:text-carbon transition"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => onClone(p.id)}
                      className="rounded-full border border-gold/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-gold/80 hover:bg-gold/20 transition"
                      title="Copia este producto a la lista mayorista (sin precio)"
                    >
                      Clonar a mayorista
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="rounded-full border border-red-500/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-red-400 hover:bg-red-500/20 transition"
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-bone/50 font-body text-sm">
                  No hay productos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}