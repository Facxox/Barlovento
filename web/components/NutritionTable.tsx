import type { Nutrition } from '@/lib/queries';

/**
 * Tabla nutricional estilo etiqueta de packaging.
 *
 * Si el `data` trae el bloque extendido (`kcal`, `kj`, macros u
 * `warning_labels`), lo renderiza como packaging-style label con valor
 * energético, macros y octógonos de rotulado. Si no, cae al shape viejo
 * (`rows[]`) que el admin carga a mano.
 */
export default function NutritionTable({ data }: { data: Nutrition | null }) {
  if (!data) return null;

  const hasExtended =
    data.kcal != null ||
    data.kj != null ||
    data.carbs_g != null ||
    data.protein_g != null ||
    data.fat_g != null ||
    data.saturated_g != null ||
    data.fiber_g != null ||
    data.sodium_mg != null ||
    data.trans_g != null ||
    (data.warning_labels != null && data.warning_labels.length > 0);

  if (hasExtended) {
    return <ExtendedBlock data={data} />;
  }

  return <LegacyRowsBlock data={data} />;
}

const g = (n: number | null | undefined) =>
  n == null ? '—' : `${n} g`;
const mg = (n: number | null | undefined) =>
  n == null ? '—' : `${n} mg`;
const kcal = (n: number | null | undefined) =>
  n == null ? '—' : `${n} kcal`;
const kj = (n: number | null | undefined) =>
  n == null ? '—' : `${n} kJ`;

function ExtendedBlock({ data }: { data: Nutrition }) {
  const portion = data.portion || '—';
  const labels = data.warning_labels ?? [];

  return (
    <div className="border-t border-ink/10 bg-bone/80 px-4 py-4 font-body text-[12px] text-ink/85">
      <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
        Información nutricional
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-3 border-b border-ink/20 pb-2">
        <span className="text-ink/60">Porción</span>
        <span className="text-right text-ink">{portion}</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 border-b border-ink/20 pb-2">
        <span className="text-ink/60">Valor energético</span>
        <span className="text-right text-ink">
          {kcal(data.kcal ?? null)} ({kj(data.kj ?? null)})
        </span>
      </div>

      <table className="mt-3 w-full text-left">
        <tbody>
          <Row label="Carbohidratos" value={g(data.carbs_g ?? null)} />
          <Row label="Proteínas" value={g(data.protein_g ?? null)} />
          <Row label="Grasas totales" value={g(data.fat_g ?? null)} indent />
          <Row label="Saturadas" value={g(data.saturated_g ?? null)} />
          <Row
            label="Grasas trans"
            value={g(data.trans_g ?? null)}
          />
          <Row
            label="Fibra alimentaria"
            value={g(data.fiber_g ?? null)}
          />
          <Row
            label="Sodio"
            value={mg(data.sodium_mg ?? null)}
          />
        </tbody>
      </table>

      <p className="mt-3 text-[10px] text-ink/50">
        % VD basado en una dieta de 2.000 kcal.
      </p>

      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {labels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full border border-ink/30 bg-cream px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-ink/80"
            >
              <span aria-hidden>⚠</span>
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  indent,
}: {
  label: string;
  value: string;
  indent?: boolean;
}) {
  return (
    <tr className="border-b border-ink/10 last:border-0">
      <td className={`py-1.5 ${indent ? 'pl-4 text-ink/65' : 'text-ink/85'}`}>
        {indent && <span aria-hidden className="mr-2">↳</span>}
        {label}
      </td>
      <td className="py-1.5 text-right text-ink/85">{value}</td>
    </tr>
  );
}

function LegacyRowsBlock({ data }: { data: Nutrition }) {
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
