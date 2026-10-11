// Tipo Nutrición client-safe. La versión "real" vive en lib/queries.ts;
// mantener sincronizada manualmente (es un subset estable).

export type Nutrition = {
  portion: string;
  servings_per_package: number | null;
  rows: { nutrient: string; amount: string; dv: string }[];
  kcal?: number | null;
  kj?: number | null;
  carbs_g?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  saturated_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
  trans_g?: number | null;
  warning_labels?: string[] | null;
};
