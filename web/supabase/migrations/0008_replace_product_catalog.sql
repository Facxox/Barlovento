-- 0008_replace_product_catalog.sql
--
-- Sincroniza la tabla `products` con el catálogo nuevo de 8 alfajores:
-- borra los productos anteriores (Clásico/Chocolate Negro/Bombón/Coco/
-- Frutos del Bosque/Marroc) y hace upsert de los 8 definitivos con sus
-- descripciones largas y precios actualizados (UYU 100 o 125).

BEGIN;

-- 1. Borrar los IDs que ya no existen en el catálogo nuevo.
DELETE FROM public.products
WHERE id IN (
  'chocolate-negro',
  'bombon',
  'coco',
  'marroc',
  'frutos-rojos'
);

-- 2. Upsert de los 8 productos nuevos.
INSERT INTO public.products
  (id, name, description, price, currency, category, image, badge, is_active, sort_order, nutrition)
VALUES
  ('clasico',
   'Alfajor Clásico',
   'El Alfajor Clásico es el homenaje perfecto a la receta tradicional que todos amamos: combina una suave masa de chocolate, un cremoso relleno de abundante dulce de leche y una fina cobertura de chocolate semi amargo. Ideal para acompañar tu café de la tarde o regalarte ese momento dulce que nunca falla. Ingredientes: Masa de chocolate, relleno de dulce de leche y baño de chocolate semi amargo.',
   100,
   'UYU',
   'clasicos',
   '',
   'El original',
   true,
   1,
   NULL),

  ('marroc',
   'Alfajor Marroc',
   'El Alfajor Marroc llega para enamorar a los amantes de la combinación chocolatosa y cremosa: reúne una irresistible masa de chocolate, un abundante relleno de crema de maní y un elegante toque final con chocolate semi amargo. El equilibrio perfecto entre lo crujiente y lo untuoso para disfrutar en cualquier momento del día. Ingredientes: Masa de chocolate, relleno de crema de maní y baño de chocolate semi amargo.',
   100,
   'UYU',
   'clasicos',
   '',
   'Nuevo',
   true,
   2,
   NULL),

  ('suspiro',
   'Alfajor Suspiro',
   'El Alfajor Suspiro eleva la experiencia del alfajor a otro nivel gracias a su irresistible juego de texturas: integra una intensa masa de chocolate, dulce de leche repostero y un crujiente disco de merengue en su interior, todo sellado con chocolate semi amargo. Un verdadero capricho crocante e inolvidable. Ingredientes: Masa de chocolate, relleno de dulce de leche y disco de merengue, bañado en chocolate semi amargo.',
   100,
   'UYU',
   'chocolate',
   '',
   'Nuevo',
   true,
   3,
   NULL),

  ('dulce-avellana',
   'Alfajor Dulce Avellana',
   'El Alfajor Dulce Avellana une lo mejor de dos mundos en un solo bocado: presenta una exquisita masa de chocolate rellena del clásico dulce de leche que esconde un tentador corazón de crema de avellanas, bañado por completo en chocolate semi amargo. Una combinación sofisticada e irresistible. Ingredientes: Masa de chocolate, relleno de dulce de leche y centro de crema de avellanas, con baño de chocolate semi amargo.',
   100,
   'UYU',
   'chocolate',
   '',
   'Nuevo',
   true,
   4,
   NULL),

  ('dubai',
   'Alfajor Dubai',
   'Inspirado en la última tendencia gourmand, el Alfajor Dubai ofrece una explosión de sabores exóticos y crujientes: fusiona una distintiva masa de cacao, dulce de leche tradicional y un deslumbrante centro de crema de pistachos con fideos kataifi, bañado en chocolate semi amargo. Una experiencia gourmet única en su clase. Ingredientes: Masa de cacao, relleno de dulce de leche y centro de crema de pistachos y kataifi con baño de chocolate semi amargo.',
   125,
   'UYU',
   'especiales',
   '',
   'Tendencia',
   true,
   5,
   NULL),

  ('frutos-rojos',
   'Alfajor Frutos Rojos',
   'El Alfajor Frutos Rojos logra el contraste de acidez y dulzura perfecto: combina una intensa masa de cacao, un centro suave de dulce de leche equilibrado con un vibrante corazón de mermelada de frutos rojos y su tradicional baño de chocolate semi amargo. Una opción fresca y frutal que atrapa desde el primer bocado. Ingredientes: Masa de cacao, relleno de dulce de leche y centro de mermelada de frutos rojos, bañado en chocolate semi amargo.',
   125,
   'UYU',
   'especiales',
   '',
   'Frutal',
   true,
   6,
   NULL),

  ('pretzel',
   'Alfajor Pretzel',
   'El Alfajor Pretzel es la tentación definitiva para los fanáticos del contraste entre lo dulce y lo salado: elaborado con masa de cacao, una capa de dulce de leche y un sorprendente centro de crema de pretzel, todo bañado en chocolate semi amargo. Un perfil de sabor moderno y adictivo. Ingredientes: Masa de cacao, relleno de dulce de leche y centro de crema de pretzel, bañado en chocolate semi amargo.',
   125,
   'UYU',
   'especiales',
   '',
   'Sal & Dulce',
   true,
   7,
   NULL),

  ('lotus',
   'Alfajor Lotus',
   'El Alfajor Lotus rinde tributo a las famosas galletas especiadas en una versión inolvidable: integra masa de cacao con un generoso relleno de dulce de leche y un cremoso centro de pasta Lotus, bañado en suave chocolate semi amargo. El toque especiado ideal para transformar tu merienda. Ingredientes: Masa de cacao, relleno de dulce de leche y centro de crema de Lotus, bañado en chocolate semi amargo.',
   125,
   'UYU',
   'especiales',
   '',
   'Especiado',
   true,
   8,
   NULL)
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
