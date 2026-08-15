/**
 * Server component. Reusable star display.
 *
 * - readOnly=true: render plano (decorativo). Aún anuncia el valor a SR.
 * - readOnly=false: render interactivo (botones) — usado en ReviewForm.
 */

type StarRatingProps = {
  value: number; // 0..5, soporta fracciones para promedios
  size?: number;
  readOnly?: boolean;
  /** Color del relleno. Default dorado Barlovento. */
  color?: string;
  /** Color del fondo de la estrella (estrella vacía). */
  emptyColor?: string;
  /** Sólo si readOnly=false: nombre accesible del grupo. */
  name?: string;
  /** Sólo si readOnly=false: handler de cambio (1..5). */
  onChange?: (v: 1 | 2 | 3 | 4 | 5) => void;
};

export default function StarRating({
  value,
  size = 16,
  readOnly = true,
  color = '#D4AF37',
  emptyColor = 'rgba(245,241,230,0.18)',
  name,
  onChange,
}: StarRatingProps) {
  const rounded = Math.round(value * 2) / 2; // 0..5 en pasos de 0.5
  const ariaLabel =
    name ??
    `${rounded} de 5 estrellas`;

  const stars = [1, 2, 3, 4, 5].map((i) => {
    const fillRatio = Math.max(0, Math.min(1, rounded - (i - 1)));
    const fillId = `starfill-${i}`;
    return (
      <svg
        key={i}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
        focusable="false"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="1" y2="0">
            <stop offset={`${fillRatio * 100}%`} stopColor={color} />
            <stop
              offset={`${fillRatio * 100}%`}
              stopColor={emptyColor}
            />
          </linearGradient>
        </defs>
        <path
          d="M12 2.6l3.06 6.21 6.86 1-4.96 4.83 1.17 6.82L12 18.27l-6.13 3.19 1.17-6.82L2.08 9.81l6.86-1L12 2.6z"
          fill={`url(#${fillId})`}
          stroke={color}
          strokeOpacity={fillRatio > 0 ? 0.4 : 0.2}
          strokeWidth={1}
        />
      </svg>
    );
  });

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={ariaLabel}
        className="inline-flex items-center gap-0.5 align-middle"
      >
        {stars}
      </span>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={name ?? 'Calificación'}
      className="inline-flex items-center gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= rounded;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}
            onClick={() => onChange?.(i as 1 | 2 | 3 | 4 | 5)}
            className="rounded-sm p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              aria-hidden
              focusable="false"
            >
              <path
                d="M12 2.6l3.06 6.21 6.86 1-4.96 4.83 1.17 6.82L12 18.27l-6.13 3.19 1.17-6.82L2.08 9.81l6.86-1L12 2.6z"
                fill={active ? color : 'transparent'}
                stroke={color}
                strokeOpacity={active ? 0.9 : 0.3}
                strokeWidth={1.5}
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
