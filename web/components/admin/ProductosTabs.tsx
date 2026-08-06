'use client';

import { useState, useEffect } from 'react';
import ProductosTable from './ProductosTable';
import ProductosWholesaleTable from './ProductosWholesaleTable';
import type { Product, WholesaleProduct } from '@/lib/queries';

type Tab = 'retail' | 'wholesale';

export default function ProductosTabs({
  retail,
  wholesale,
  initialTab,
  justCloned,
}: {
  retail: Product[];
  wholesale: WholesaleProduct[];
  initialTab: Tab;
  justCloned?: string | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  // Si el server action navegó con ?justCloned=X, saltamos al tab mayorista
  // y dejamos el highlight del producto clonado para la tabla (opcional).
  useEffect(() => {
    if (justCloned) setTab('wholesale');
  }, [justCloned]);

  return (
    <div>
      <div className="mb-8 flex gap-1 border-b border-carbon-line">
        <TabButton
          active={tab === 'retail'}
          onClick={() => setTab('retail')}
          label="Minoristas"
          count={retail.length}
        />
        <TabButton
          active={tab === 'wholesale'}
          onClick={() => setTab('wholesale')}
          label="Mayoristas"
          count={wholesale.length}
          goldAccent
        />
      </div>

      {tab === 'retail' ? (
        <ProductosTable products={retail} />
      ) : (
        <ProductosWholesaleTable products={wholesale} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  goldAccent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  goldAccent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative -mb-px border-b-2 px-5 py-3 font-body text-[11px] uppercase tracking-ultra transition',
        active
          ? goldAccent
            ? 'border-gold text-gold'
            : 'border-bone text-bone'
          : 'border-transparent text-bone/50 hover:text-bone',
      ].join(' ')}
    >
      {label}
      <span
        className={[
          'ml-2 rounded-full px-2 py-0.5 font-body text-[10px]',
          active
            ? 'bg-carbon-line text-bone/70'
            : 'bg-transparent text-bone/40',
        ].join(' ')}
      >
        {count}
      </span>
    </button>
  );
}
