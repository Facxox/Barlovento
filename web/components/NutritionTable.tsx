import type { Nutrition } from '@/lib/queries';

/**
 * Tabla nutricional estilo etiqueta de packaging.
 * Renderiza la porción, las porciones por envase, y una tabla con
 * (nutriente · cantidad · % VD). Si el shape está vacío o no llega,
 * devuelve null.
 */
export default function NutritionTable({ data }: { data: Nutrition | null }) {
  if (!data) return null;
  const { portion, servings_per_package, rows } = data;
  if (!portion && rows.length === 0) return null;

  return (
    <div className="border-t border-ink/10 bg-bone/80 px-4 py-4 font-body text-[12px] text-ink/85">
      <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
        Información nutricional
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-3 border-b border-ink/20 pb-2">
        <span className="text-ink/60">Porción</span>
        <span className="text-right text-ink">{portion || '—'}</span>
      </div>
      {servings_per_package !== null && (
        <div className="mt-2 flex items-baseline justify-between gap-3 border-b border-ink/20 pb-2">
          <span className="text-ink/60">Porciones por envase</span>
          <span className="text-right text-ink">{servings_per_package}</span>
        </div>
      )}

      {rows.length > 0 && (
        <table className="mt-3 w-full text-left">
          <thead>
            <tr className="border-b border-ink/30 text-ink/60">
              <th className="py-1 font-body text-[10px] uppercase tracking-ultra">Nutriente</th>
              <th className="py-1 text-right font-body text-[10px] uppercase tracking-ultra">
                Cantidad
              </th>
              <th className="py-1 text-right font-body text-[10px] uppercase tracking-ultra">
                % VD
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-ink/10 last:border-0">
                <td className="py-1.5 text-ink/85">{r.nutrient || '—'}</td>
                <td className="py-1.5 text-right text-ink/85">{r.amount || '—'}</td>
                <td className="py-1.5 text-right text-ink/85">{r.dv || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-3 text-[10px] text-ink/50">
        % VD basado en una dieta de 2.000 kcal.
      </p>
    </div>
  );
}
