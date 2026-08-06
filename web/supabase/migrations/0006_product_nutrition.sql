-- 0006_product_nutrition.sql
--
-- Información nutricional por producto. Guardamos todo en una sola
-- columna JSONB para que el shape sea flexible (no todos los alfajores
-- declaran los mismos nutrientes en la etiqueta). El storefront la
-- renderiza como tabla tipo packaging.
--
-- Shape esperado:
--   {
--     "portion": "1 alfajor (40 g)",
--     "servings_per_package": 12,
--     "rows": [
--       { "nutrient": "Valor energético",  "amount": "180 kcal", "dv": "9%" },
--       { "nutrient": "Carbohidratos",     "amount": "22 g",    "dv": "8%" },
--       ...
--     ]
--   }
--
-- Si `nutrition` es NULL, el producto no muestra tabla nutricional.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS nutrition jsonb;

ALTER TABLE public.wholesale_products
  ADD COLUMN IF NOT EXISTS nutrition jsonb;
