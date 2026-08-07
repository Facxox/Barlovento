'use client';

import { useEffect, useState } from 'react';

type Period = '7d' | '30d' | '90d' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: '90d', label: 'Últimos 90 días' },
  { id: 'all', label: 'Todo el tiempo' },
];

type DailyPoint = {
  date: string;
  visitors: number;
  pageViews: number;
  revenueByCurrency?: Record<string, number>;
  ordersCount?: number;
};

type TrafficData = {
  totals: { visitors: number; pageViews: number };
  deltas: { visitors: number | null; pageViews: number | null };
  timeSeries: DailyPoint[];
};

type SalesData = {
  totals: {
    revenueByCurrency: Record<string, number>;
    ordersCount: number;
    totalRevenue: number;
  };
  deltas: { revenue: number | null; ordersCount: number | null };
  timeSeries: DailyPoint[];
};

const formatNumber = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

const formatCurrency = (n: number, currency: string) =>
  new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);

const formatShortDay = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('es-UY', { month: 'short', day: 'numeric' });
};

const formatFullDay = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('es-UY', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>('30d');
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/admin/metrics?period=${period}`).then((r) => {
        if (!r.ok) throw new Error(`Metrics ${r.status}`);
        return r.json();
      }),
      fetch(`/api/admin/sales?period=${period}`).then((r) => {
        if (!r.ok) throw new Error(`Sales ${r.status}`);
        return r.json();
      }),
    ])
      .then(([t, s]) => {
        if (cancelled) return;
        setTraffic(t);
        setSales(s);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Error al cargar.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-bone">Analíticas</h1>
          <p className="mt-1 font-body text-sm text-bone/60">
            Tráfico de la tienda y rendimiento de ventas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={[
                'rounded-full border px-4 py-1.5 font-body text-xs uppercase tracking-ultra transition',
                period === p.id
                  ? 'border-gold bg-gold text-carbon'
                  : 'border-carbon-line text-bone/70 hover:border-bone/50',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {loading && (
        <p className="font-body text-sm text-bone/60">Cargando…</p>
      )}
      {error && (
        <p className="font-body text-sm text-red-400">{error}</p>
      )}

      {!loading && !error && traffic && sales && (
        <>
          <Section
            title="Tráfico"
            description="Visitas a la tienda pública."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <KpiCard
                label="Visitors"
                value={formatNumber(traffic.totals.visitors)}
                delta={traffic.deltas.visitors}
              />
              <KpiCard
                label="Page Views"
                value={formatNumber(traffic.totals.pageViews)}
                delta={traffic.deltas.pageViews}
              />
            </div>
            <Chart
              data={traffic.timeSeries}
              lines={[
                { key: 'visitors', label: 'Visitors', color: '#E8C766' },
                { key: 'pageViews', label: 'Page Views', color: '#D4AF37' },
              ]}
              valueFormat={formatNumber}
              emptyHint="Sin tráfico todavía."
            />
          </Section>

          <Section
            title="Ventas"
            description="Ingresos y pedidos del período."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <KpiCard
                label="Ingresos"
                value={formatSalesTotal(sales)}
                delta={sales.deltas.revenue}
              />
              <KpiCard
                label="Pedidos"
                value={formatNumber(sales.totals.ordersCount)}
                delta={sales.deltas.ordersCount}
              />
            </div>
            <Chart
              data={sales.timeSeries.map((d) => ({
                ...d,
                visitors: d.ordersCount ?? 0,
              }))}
              lines={[
                { key: 'visitors', label: 'Pedidos', color: '#E8C766' },
              ]}
              valueFormat={formatNumber}
              emptyHint="Sin pedidos todavía."
            />
          </Section>
        </>
      )}
    </div>
  );
}

function formatSalesTotal(sales: SalesData): string {
  const entries = Object.entries(sales.totals.revenueByCurrency);
  if (entries.length === 0) return '—';
  return entries
    .map(([cur, val]) => formatCurrency(val, cur))
    .join(' · ');
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow text-gold">{title}</p>
          <p className="mt-1 font-body text-sm text-bone/60">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number | null;
}) {
  const showDelta = delta !== null;
  const positive = showDelta && (delta as number) > 0;
  const negative = showDelta && (delta as number) < 0;
  const deltaStr = showDelta
    ? `${positive ? '+' : ''}${delta}%`
    : '—';
  const deltaClass = !showDelta
    ? 'bg-carbon-line text-bone/50'
    : positive
    ? 'bg-emerald-500/20 text-emerald-300'
    : negative
    ? 'bg-rose-500/20 text-rose-300'
    : 'bg-carbon-line text-bone/70';

  return (
    <div className="border border-carbon-line bg-carbon p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
          {label}
        </p>
        <span
          className={[
            'rounded-full px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra',
            deltaClass,
          ].join(' ')}
        >
          {deltaStr}
        </span>
      </div>
      <p className="mt-4 font-display text-4xl font-bold text-bone">{value}</p>
    </div>
  );
}

function Chart({
  data,
  lines,
  valueFormat,
  emptyHint,
}: {
  data: DailyPoint[];
  lines: { key: string; label: string; color: string }[];
  valueFormat: (n: number) => string;
  emptyHint: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const hasData = data.some((d) => lines.some((l) => (d as any)[l.key] > 0));
  if (!hasData) {
    return (
      <div className="mt-4 grid h-48 place-items-center border border-carbon-line bg-carbon text-bone/40 font-body text-xs uppercase tracking-ultra">
        {emptyHint}
      </div>
    );
  }

  const W = 720;
  const H = 240;
  const PAD_X = 32;
  const PAD_Y = 24;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  const maxY = Math.max(
    1,
    ...data.map((d) =>
      Math.max(...lines.map((l) => Number((d as any)[l.key]) || 0))
    )
  );

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const yFor = (v: number) => PAD_Y + innerH - (v / maxY) * innerH;
  const xFor = (i: number) => PAD_X + i * xStep;

  const buildPath = (key: string) => {
    return data
      .map((d, i) => {
        const v = Number((d as any)[key]) || 0;
        return `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`;
      })
      .join(' ');
  };

  const labelsEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="mt-4 border border-carbon-line bg-carbon p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            <span className="font-body text-[10px] uppercase tracking-ultra text-bone/60">
              {l.label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Gráfico de analíticas"
        >
          <defs>
            <linearGradient id="areaGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8C766" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#E8C766" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid horizontal sutil */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={PAD_Y + innerH * t}
              y2={PAD_Y + innerH * t}
              stroke="#2A2A2A"
              strokeWidth="1"
            />
          ))}

          {lines.map((l) => {
            const path = buildPath(l.key);
            const areaPath = `${path} L ${xFor(data.length - 1)} ${PAD_Y + innerH} L ${PAD_X} ${PAD_Y + innerH} Z`;
            return (
              <g key={l.key}>
                <path d={areaPath} fill="url(#areaGold)" />
                <path
                  d={path}
                  fill="none"
                  stroke={l.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Línea guía cuando se hace hover */}
          {hover !== null && (
            <line
              x1={xFor(hover)}
              x2={xFor(hover)}
              y1={PAD_Y}
              y2={PAD_Y + innerH}
              stroke="#D4AF37"
              strokeOpacity="0.4"
              strokeDasharray="4 4"
            />
          )}

          {/* Hover overlay (capa transparente) */}
          {data.map((_, i) => (
            <rect
              key={i}
              x={xFor(i) - xStep / 2}
              y={PAD_Y}
              width={xStep}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {/* Eje X: etiquetas en saltos */}
          {data.map((d, i) => {
            if (i % labelsEvery !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={i}
                x={xFor(i)}
                y={H - 6}
                fontSize="10"
                textAnchor="middle"
                fill="#FFFFFF80"
                style={{ fontFamily: 'inherit' }}
              >
                {formatShortDay(d.date)}
              </text>
            );
          })}

          {/* Punto destacado cuando hay hover */}
          {hover !== null &&
            lines.map((l) => {
              const v = Number((data[hover] as any)[l.key]) || 0;
              return (
                <circle
                  key={l.key}
                  cx={xFor(hover)}
                  cy={yFor(v)}
                  r="4"
                  fill={l.color}
                  stroke="#0B0B0B"
                  strokeWidth="2"
                />
              );
            })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-gold/30 bg-carbon/95 px-3 py-2 font-body text-xs text-bone shadow-lg backdrop-blur"
            style={{
              left: `${(xFor(hover) / W) * 100}%`,
              top: `${(PAD_Y / H) * 100}%`,
            }}
          >
            <p className="text-[10px] uppercase tracking-ultra text-bone/50">
              {formatFullDay(data[hover].date)}
            </p>
            {lines.map((l) => (
              <p key={l.key} className="mt-1 flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                <span className="text-bone/70">{l.label}:</span>
                <span className="text-bone">
                  {valueFormat(Number((data[hover] as any)[l.key]) || 0)}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
