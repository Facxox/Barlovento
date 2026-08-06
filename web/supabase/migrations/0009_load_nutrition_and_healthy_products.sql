-- 0009_load_nutrition_and_healthy_products.sql
--
-- Sincroniza la DB con el catálogo final:
--   - Borra los alfajores-fit viejos (`alfajor-fitpro`, `alfajor-fit`)
--     y la categoría fantasma `id='fit'` (huérfana tras la limpieza).
--   - Crea la categoría `saludable`.
--   - Carga la información nutricional extendida (kcal, kj, macros y
--     octógonos de rotulado) en los 8 alfajores iniciales que la tienen.
--     frutos-rojos / pretzel / lotus quedan con `nutrition = NULL`.
--   - Inserta los 3 alfajores nuevos de la línea saludable (Fit, Proteico,
--     NutriFit) con sus tablas nutricionales.

BEGIN;

-- 1. Limpiar fit viejos
DELETE FROM public.products WHERE id IN ('alfajor-fitpro','alfajor-fit');

-- 2. Borrar categoría fantasma `fit` (los productos viejos ya no existen)
DELETE FROM public.categories WHERE id='fit';

-- 3. Categoría nueva: saludable
INSERT INTO public.categories (id, label, sort_order, is_active)
VALUES ('saludable', 'Saludable', 4, true)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 4. Cargar nutrition extendida en los 8 productos iniciales
UPDATE public.products SET nutrition = jsonb_build_object(
  'portion', '100 g · 1 unidad', 'servings_per_package', 1, 'rows', '[]'::jsonb,
  'kcal', 540, 'kj', 2257,
  'carbs_g', 85, 'protein_g', 8, 'fat_g', 19, 'saturated_g', 11,
  'fiber_g', 2.4, 'sodium_mg', 82, 'trans_g', 0,
  'warning_labels', jsonb_build_array('Exceso Azúcar','Exceso Grasas','Exceso Grasas Saturadas')
) WHERE id = 'clasico';

UPDATE public.products SET nutrition = jsonb_build_object(
  'portion', '100 g · 1 unidad', 'servings_per_package', 1, 'rows', '[]'::jsonb,
  'kcal', 660, 'kj', 2759,
  'carbs_g', 78, 'protein_g', 4, 'fat_g', 35, 'saturated_g', 17,
  'fiber_g', 3.7, 'sodium_mg', 82, 'trans_g', 0,
  'warning_labels', jsonb_build_array('Exceso Azúcar','Exceso Grasas','Exceso Grasas Saturadas')
) WHERE id = 'marroc';

UPDATE public.products SET nutrition = jsonb_build_object(
  'portion', '110 g · 1 unidad', 'servings_per_package', 1, 'rows', '[]'::jsonb,
  'kcal', 568, 'kj', 2375,
  'carbs_g', 92, 'protein_g', 8.4, 'fat_g', 19, 'saturated_g', 11,
  'fiber_g', 2.4, 'sodium_mg', 82, 'trans_g', 0,
  'warning_labels', jsonb_build_array('Exceso Azúcar','Exceso Grasas','Exceso Grasas Saturadas')
) WHERE id = 'suspiro';

UPDATE public.products SET nutrition = jsonb_build_object(
  'portion', '100 g · 1 unidad', 'servings_per_package', 1, 'rows', '[]'::jsonb,
  'kcal', 509, 'kj', 2127,
  'carbs_g', 85.1, 'protein_g', 6.5, 'fat_g', 15.4, 'saturated_g', 7.3,
  'fiber_g', 2.4, 'sodium_mg', 52, 'trans_g', 0,
  'warning_labels', jsonb_build_array('Exceso Azúcar','Exceso Grasas Saturadas')
) WHERE id = 'dulce-avellana';

UPDATE public.products SET nutrition = jsonb_build_object(
  'portion', '100 g · 1 unidad', 'servings_per_package', 1, 'rows', '[]'::jsonb,
  'kcal', 506, 'kj', 2126,
  'carbs_g', 84.8, 'protein_g', 6.4, 'fat_g', 15.7, 'saturated_g', 6.4,
  'fiber_g', 2.4, 'sodium_mg', 47, 'trans_g', 0,
  'warning_labels', '[]'::jsonb
) WHERE id = 'dubai';

UPDATE public.products SET nutrition = NULL
WHERE id IN ('frutos-rojos','pretzel','lotus');

-- 5. Insertar los 3 alfajores nuevos de la línea saludable
INSERT INTO public.products
  (id, name, description, price, currency, category, image, badge, is_active, sort_order, nutrition)
VALUES
  ('fit',
   'Alfajor Fit',
   'Date un gusto delicioso y saludable sin romper tu rutina. Descubre el alfajor Fit: elaborado artesanalmente a base de harina de avena, relleno de dulce de leche repostero sin azúcar y bañado con cobertura sin azúcar añadida. Con solo 184 kcal por unidad.',
   0, 'UYU', 'saludable', '', 'Sin azúcar', true, 9,
   jsonb_build_object(
     'portion', '80 g · 1 unidad', 'servings_per_package', 1, 'rows', '[]'::jsonb,
     'kcal', 184, 'kj', 767,
     'carbs_g', 16, 'protein_g', 3.5, 'fat_g', 11, 'saturated_g', 4,
     'fiber_g', 2, 'sodium_mg', 1.6, 'trans_g', 0,
     'warning_labels', '[]'::jsonb
   )),

  ('proteico',
   'Alfajor Proteico',
   'El alfajor Proteico está pensado para acompañar tus metas diarias sin sacrificar sabor: combina galletas artesanales de avena y cacao enriquecidas con proteína, un cremoso relleno de dulce de leche light y una cobertura de chocolate sin azúcar. Con 12 g de proteína por unidad, es la recarga perfecta post-entreno.',
   0, 'UYU', 'saludable', '', '12g proteína', true, 10,
   jsonb_build_object(
     'portion', '90 g · 1 unidad', 'servings_per_package', 1, 'rows', '[]'::jsonb,
     'kcal', 198, 'kj', 832,
     'carbs_g', 21, 'protein_g', 12, 'fat_g', 7, 'saturated_g', 4,
     'fiber_g', 3, 'sodium_mg', 6, 'trans_g', 0,
     'warning_labels', '[]'::jsonb
   )),

  ('nutrifit',
   'Alfajor NutriFit',
   'El Alfajor NutriFit es la combinación perfecta entre nutrición, fibra y el mejor sabor: elaborado de forma artesanal con tapas de harina y salvado de avena, un suave relleno de dulce de leche light y bañado en chocolate sin azúcar. Con 5 g de fibra y 0% azúcar añadida, es la opción ideal para disfrutar de una merienda completa y nutritiva.',
   0, 'UYU', 'saludable', '', 'Saludable', true, 11,
   jsonb_build_object(
     'portion', '90 g · 1 unidad', 'servings_per_package', 1, 'rows', '[]'::jsonb,
     'kcal', 225, 'kj', 945,
     'carbs_g', 21, 'protein_g', 6, 'fat_g', 13, 'saturated_g', 5,
     'fiber_g', 5, 'sodium_mg', 6, 'trans_g', 0,
     'warning_labels', '[]'::jsonb
   ))
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  category = EXCLUDED.category,
  image = EXCLUDED.image,
  badge = EXCLUDED.badge,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  nutrition = EXCLUDED.nutrition,
  updated_at = now();

COMMIT;
