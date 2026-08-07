-- 0010_load_full_nutrition_from_json.sql
--
-- Sincroniza `products.description` y `products.nutrition` con los datos
-- completos que vinieron del JSON de nutrición. Para los 3 productos que
-- antes tenían `nutrition = NULL` (frutos-rojos, pretzel, lotus), los
-- carga por primera vez.
--
-- El `description` guarda la descripción promocional concatenada con los
-- ingredientes ("… Ingredientes: …"), que es como se muestra en la PDP.

BEGIN;

UPDATE public.products SET
  description = 'El Alfajor Clásico es el homenaje perfecto a la receta tradicional que todos amamos: combina una suave masa de chocolate, un cremoso relleno de abundante dulce de leche y una fina cobertura de chocolate semi amargo. Ideal para acompañar tu café de la tarde o regalarte ese momento dulce que nunca falla. Ingredientes: Masa de chocolate, relleno de dulce de leche y baño de chocolate semi amargo.',
  nutrition = '{"portion":"100 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":540,"kj":2257,"carbs_g":85,"protein_g":8,"fat_g":19,"saturated_g":11,"fiber_g":2.4,"sodium_mg":82,"trans_g":0,"warning_labels":["Exceso Azúcar","Exceso Grasas","Exceso Grasas Saturadas"]}'::jsonb,
  updated_at = now()
WHERE id = 'clasico';

UPDATE public.products SET
  description = 'El Alfajor Marroc llega para enamorar a los amantes de la combinación chocolatosa y cremosa: reúne una irresistible masa de chocolate, un abundante relleno de crema de maní y un elegante toque final con chocolate semi amargo. El equilibrio perfecto entre lo crujiente y lo untuoso para disfrutar en cualquier momento del día. Ingredientes: Tapas de galletitas artesanales sin ralladura de naranja, mezcla de chocolate blanco y manteca de maní y cobertura de cacao semi amargo.',
  nutrition = '{"portion":"100 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":660,"kj":2759,"carbs_g":78,"protein_g":4,"fat_g":35,"saturated_g":17,"fiber_g":3.7,"sodium_mg":82,"trans_g":0,"warning_labels":["Exceso Azúcar","Exceso Grasas","Exceso Grasas Saturadas"]}'::jsonb,
  updated_at = now()
WHERE id = 'marroc';

UPDATE public.products SET
  description = 'El Alfajor Suspiro eleva la experiencia del alfajor a otro nivel gracias a su irresistible juego de texturas: integra una intensa masa de chocolate, dulce de leche repostero y un crujiente disco de merengue en su interior, todo sellado con chocolate semi amargo. Un verdadero capricho crocante e inolvidable. Ingredientes: Tapas de galletitas artesanales, dulce de leche, disco de merengue horneado y cobertura de cacao semi amargo.',
  nutrition = '{"portion":"110 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":568,"kj":2375,"carbs_g":92,"protein_g":8.4,"fat_g":19,"saturated_g":11,"fiber_g":2.4,"sodium_mg":82,"trans_g":0,"warning_labels":["Exceso Azúcar","Exceso Grasas","Exceso Grasas Saturadas"]}'::jsonb,
  updated_at = now()
WHERE id = 'suspiro';

UPDATE public.products SET
  description = 'El Alfajor Dulce Avellana une lo mejor de dos mundos en un solo bocado: presenta una exquisita masa de chocolate rellena del clásico dulce de leche que esconde un tentador corazón de crema de avellanas, bañado por completo en chocolate semi amargo. Una combinación sofisticada e irresistible. Ingredientes: Tapas de galletitas artesanales, dulce de leche, crema de avellanas con cacao y cobertura de cacao semi amargo.',
  nutrition = '{"portion":"100 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":509,"kj":2127,"carbs_g":85.1,"protein_g":6.5,"fat_g":15.4,"saturated_g":7.3,"fiber_g":2.4,"sodium_mg":52,"trans_g":0,"warning_labels":["Exceso Azúcar","Exceso Grasas Saturadas"]}'::jsonb,
  updated_at = now()
WHERE id = 'dulce-avellana';

UPDATE public.products SET
  description = 'Inspirado en la última tendencia gourmand, el Alfajor Dubai ofrece una explosión de sabores exóticos y crujientes: fusiona una distintiva masa de cacao, dulce de leche tradicional y un deslumbrante centro de crema de pistachos con fideos kataifi, bañado en chocolate semi amargo. Una experiencia gourmet única en su clase. Ingredientes: Masa de cacao, relleno de dulce de leche y centro de crema de pistachos y kataifi con baño de chocolate semi amargo.',
  nutrition = '{"portion":"100 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":506,"kj":2126,"carbs_g":84.8,"protein_g":6.4,"fat_g":15.7,"saturated_g":6.4,"fiber_g":2.4,"sodium_mg":47,"trans_g":0,"warning_labels":[]}'::jsonb,
  updated_at = now()
WHERE id = 'dubai';

UPDATE public.products SET
  description = 'El Alfajor Frutos Rojos logra el contraste de acidez y dulzura perfecto: combina una intensa masa de cacao, un centro suave de dulce de leche equilibrado con un vibrante corazón de mermelada de frutos rojos y su tradicional baño de chocolate semi amargo. Una opción fresca y frutal que atrapa desde el primer bocado. Ingredientes: Masa de cacao, relleno de dulce de leche y centro de mermelada de frutos rojos, bañado en chocolate semi amargo.',
  nutrition = '{"portion":"90 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":327,"kj":1367,"carbs_g":52,"protein_g":5,"fat_g":11,"saturated_g":7,"fiber_g":0,"sodium_mg":51,"trans_g":0,"warning_labels":[]}'::jsonb,
  updated_at = now()
WHERE id = 'frutos-rojos';

UPDATE public.products SET
  description = 'El Alfajor Pretzel es la tentación definitiva para los fanáticos del contraste entre lo dulce y lo salado: elaborado con masa de cacao, una capa de dulce de leche y un sorprendente centro de crema de pretzel, todo bañado en chocolate semi amargo. Un perfil de sabor moderno y adictivo. Ingredientes: Masa de cacao, relleno de dulce de leche y centro de crema de pretzel, bañado en chocolate semi amargo.',
  nutrition = '{"portion":"90 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":327,"kj":1367,"carbs_g":52,"protein_g":5,"fat_g":11,"saturated_g":7,"fiber_g":0,"sodium_mg":51,"trans_g":0,"warning_labels":[]}'::jsonb,
  updated_at = now()
WHERE id = 'pretzel';

UPDATE public.products SET
  description = 'El Alfajor Lotus rinde tributo a las famosas galletas especiadas en una versión inolvidable: integra masa de cacao con un generoso relleno de dulce de leche y un cremoso centro de pasta Lotus, bañado en suave chocolate semi amargo. El toque especiado ideal para transformar tu merienda. Ingredientes: Masa de cacao, relleno de dulce de leche y centro de crema de Lotus, bañado en chocolate semi amargo.',
  nutrition = '{"portion":"90 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":327,"kj":1367,"carbs_g":52,"protein_g":5,"fat_g":11,"saturated_g":7,"fiber_g":0,"sodium_mg":51,"trans_g":0,"warning_labels":[]}'::jsonb,
  updated_at = now()
WHERE id = 'lotus';

UPDATE public.products SET
  description = 'Date un gusto delicioso y saludable sin romper tu rutina. Descubre el alfajor Fit: elaborado artesanalmente a base de harina de avena, relleno de dulce de leche repostero sin azúcar y bañado con cobertura sin azúcar añadida. Con solo 184 kcal por unidad. Ingredientes: Tapas de galletitas artesanales con base de harina de avena, dulce de leche repostero sin azúcar y cobertura sin azúcar.',
  nutrition = '{"portion":"80 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":184,"kj":767,"carbs_g":16,"protein_g":3.5,"fat_g":11,"saturated_g":4,"fiber_g":2,"sodium_mg":1.6,"trans_g":0,"warning_labels":[]}'::jsonb,
  updated_at = now()
WHERE id = 'fit';

UPDATE public.products SET
  description = 'El alfajor Proteico está pensado para acompañar tus metas diarias sin sacrificar sabor: combina galletas artesanales de avena y cacao enriquecidas con proteína, un cremoso relleno de dulce de leche light y una cobertura de chocolate sin azúcar. Con 12 g de proteína por unidad, es la recarga perfecta post-entreno. Ingredientes: Tapas de galletitas artesanales realizadas con harina de avena, cacao, proteína en polvo, aceite de girasol, huevos frescos, polvo de hornear, Eritriol y sorbato de potasio. Rellenos de dulce de leche light. Bañados con chocolate sin azúcar.',
  nutrition = '{"portion":"90 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":198,"kj":832,"carbs_g":21,"protein_g":12,"fat_g":7,"saturated_g":4,"fiber_g":3,"sodium_mg":6,"trans_g":0,"warning_labels":[]}'::jsonb,
  updated_at = now()
WHERE id = 'proteico';

UPDATE public.products SET
  description = 'El Alfajor NutriFit es la combinación perfecta entre nutrición, fibra y el mejor sabor: elaborado de forma artesanal con tapas de harina y salvado de avena, un suave relleno de dulce de leche light y bañado en chocolate sin azúcar. Con 5 g de fibra y 0% azúcar añadida, es la opción ideal para disfrutar de una merienda completa y nutritiva. Ingredientes: Tapas de galletitas artesanales realizadas con harina de avena, salvado de avena, aceite de girasol, huevos frescos, polvo de hornear, Eritriol y sorbato de potasio. Rellenos de dulce de leche light. Bañados con chocolate sin azúcar.',
  nutrition = '{"portion":"90 g · 1 unidad","servings_per_package":1,"rows":[],"kcal":225,"kj":945,"carbs_g":21,"protein_g":6,"fat_g":13,"saturated_g":5,"fiber_g":5,"sodium_mg":6,"trans_g":0,"warning_labels":[]}'::jsonb,
  updated_at = now()
WHERE id = 'nutrifit';

COMMIT;
