# Migración a otra empresa — Guía completa

Esta guía es para **clonar este proyecto como base** para otra marca que
vende online y necesita prácticamente lo mismo: tienda con catálogo,
galería, eventos, retiro/envío coordinado por WhatsApp, Mercado Pago,
cupones, admin panel, auth y analytics.

El nuevo proyecto mantiene **el mismo schema de DB**, **la misma
arquitectura de código** y **los mismos endpoints**. Lo que cambia son
textos, fotos, dominio, paleta visual, credenciales y datos seed.

> **Importante**: las tablas son las mismas — no hay que crear SQL
> nuevo para un cliente nuevo. Sólo se re-corre el `setup-completo.sql`
> + las migraciones en orden.

---

## 0. Checklist de alto nivel

1. Crear proyecto nuevo (carpeta + repo).
2. Crear proyecto Supabase nuevo.
3. Correr `setup-completo.sql` y todas las migraciones en orden.
4. Crear bucket de storage público `media`.
5. Crear app de Mercado Pago nueva (cuenta del cliente).
6. Crear proyecto Vercel nuevo + variables de entorno.
7. Cambiar textos en `site-content` (home/about/contacto/hero).
8. Reemplazar logo, fotos y paleta de Tailwind.
9. Cargar productos, categorías y galería.
10. Crear usuario admin inicial.
11. Deploy y smoke test end-to-end.

---

## 1. Stack (lo que se mantiene)

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 App Router |
| Lenguaje | TypeScript |
| UI | React 18 |
| Estilos | Tailwind CSS 3 |
| DB / Auth / Storage | Supabase (Postgres + GoTrue + S3) |
| Pagos | Mercado Pago SDK |
| Fonts | Cormorant Garamond + Inter (o lo que el cliente quiera) |
| Deploy | Vercel |

---

## 2. Variables de entorno

Definidas en `web/.env.example`. Para el nuevo cliente, completar `web/.env.local` y replicar en Vercel.

| Variable | Tipo | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | URL del proyecto Supabase del cliente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | SECRET | Service role — sólo server-side |
| `MERCADO_PAGO_ACCESS_TOKEN` | SECRET | Token de la app del cliente (cuenta homologada) |
| `MERCADO_PAGO_WEBHOOK_SECRET` | SECRET | HMAC-SHA256 para validar webhooks |
| `NEXT_PUBLIC_SITE_URL` | public | URL del sitio (ej. `https://tienda-del-cliente.com.uy`) |
| `ENABLE_MP_SIMULATOR` | SECRET | `'1'` para habilitar `/api/admin/simulate-payment` |

**Importante**: nunca exponer `SUPABASE_SERVICE_ROLE_KEY` ni tokens MP al cliente. Las env vars `NEXT_PUBLIC_*` sí van al bundle.

---

## 3. Base de datos — qué correr y en qué orden

### 3.1 Schema base

Archivo: `supabase/setup-completo.sql` — define el schema completo (products, wholesale_products, categories, gallery, events, profiles, orders, visitas, site_content) + RLS + storage policies + seed. Idempotente.

### 3.2 Migraciones en orden

Aplicar estas migraciones de `supabase/migrations/` y `web/supabase/migrations/` en el SQL Editor de Supabase, en orden numérico:

| # | Archivo | Qué hace |
|---|---|---|
| 0002 | `customer_type` | agrega `customer_type` a `profiles` |
| 0004 | `auth_security_hardening` | `is_admin()` SECURITY DEFINER + hardening |
| 0006 | (verificar existencia) | otras tablas/columns de auth |
| 0007 | `coupons` | tablas `coupons`, `coupon_rules`, `coupon_redemptions` + RLS + función `increment_coupon_usage` + 3 cupones seed |
| 0008-0015 | (verificar) | migrations varias |
| 0016 | `units_per_pack_and_shipping` | `units_per_pack` + `shipping_cost`/`shipping_currency` en orders |
| 0017 | `pickup_fulfillment` | `fulfillment` + `pickup_status` (modalidad retiro) |

> El proyecto tiene las migraciones en dos carpetas (`supabase/` y
> `web/supabase/`). Confirmar cuáles ya están aplicadas en el proyecto
> nuevo con `list_migrations` antes de correr cualquier cosa dos veces.

### 3.3 Funciones requeridas

La app asume que existen en `public`:

- `is_admin(uid uuid)` — chequea si un user es admin (usada por RLS).
- `mark_user_as_admin(p_email text)` — promote a admin.
- `increment_coupon_usage(p_coupon_id uuid)` — cupones.
- `set_updated_at()` — trigger genérico.

Si no aparecen después del setup completo, ver `0004_auth_security_hardening.sql` y `0007_coupons.sql`.

### 3.4 Tablas clave (resumen)

| Tabla | Uso |
|---|---|
| `products` | catálogo minorista |
| `wholesale_products` | catálogo mayorista |
| `categories` | categorías de productos |
| `gallery_categories` | categorías de galería |
| `gallery_items` | fotos de galería |
| `events` + `event_images` | eventos (próximos / pasados) |
| `site_content` | key-value: historia, hero, misión, visión, valores, puntos de venta, regalos empresariales, mayoristas, contacto |
| `profiles` | usuarios (full_name, phone, address, city, is_admin, customer_type) |
| `coupons` + `coupon_rules` + `coupon_redemptions` | sistema de cupones |
| `orders` | pedidos (mercadopago, whatsapp) |
| `visitas` | pageviews (analytics) |

### 3.5 Storage

- Bucket: **`barlovento-media`** (público). Para el nuevo cliente podés renombrarlo o crear uno nuevo con otro nombre — pero el código referencia `barlovento-media` en `lib/storage.ts`. Si lo renombrás, actualizá las refs.
- Policies: lectura pública + escritura admin (auth).
- Paths:
  - `products/<timestamp>-<safeName>.<ext>`
  - `gallery/<timestamp>-<safeName>.<ext>`
  - `events/<eventId>/<timestamp>-<safeName>.<ext>`
  - `site/historia/<timestamp>-<safeName>.<ext>`
  - `site/hero/<timestamp>-<safeName>.<ext>`

---

## 4. Cambios por hacer en el código

### 4.1 Identidad y SEO (textos hardcoded)

| Archivo | Qué cambiar |
|---|---|
| `web/app/sitemap.ts` | `SITE_URL` |
| `web/app/robots.ts` | `SITE_URL` |
| `web/app/layout.tsx` | `metadataBase`, OpenGraph `url`, JSON-LD (`@id`, `url`, `logo`, `image`) |
| `web/app/productos/[id]/page.tsx` | OpenGraph `url`, JSON-LD del producto |
| `web/data/site-content.json` | **toda** la copia del sitio: historia, hero, misión, visión, valores, puntos de venta, regalos empresariales, mayoristas, contacto |

> Si el cliente quiere que el SEO no esté hardcodeado sino en DB, hay
> que mover estas constantes a `site_content` y leerlas del server.

### 4.2 Logo y marca

- `web/public/Logo.jpg` — wordmark.
- `Assets/Logo.jpg` — duplicado legacy.
- `app/icon.jpg` — favicon.
- `web/app/manifest.ts` — revisar `name` y `short_name`.

### 4.3 Paleta de Tailwind

`web/tailwind.config.ts` define tokens con nombres semánticos:
`carbon`, `gold`, `cream`, `bone`, `ink`. Para un cliente con otra
identidad:

- Editar la sección `theme.extend.colors` en `tailwind.config.ts`.
- Actualizar el `themeColor` en `web/app/layout.tsx` (`viewport`).
- Cambiar las clases `bg-gold`, `text-gold-deep`, `border-gold/40`, etc. si querés reemplazarlas por otra paleta. Las animaciones (`gold-draw`, `fade-up`, `soft-pulse`, `shimmer`) también están atadas al color.

### 4.4 Fonts

`web/app/layout.tsx` carga Cormorant Garamond + Inter vía Google Fonts. Cambiar el array `fonts` si el cliente usa otras. Recordar agregar `preconnect` a los orígenes.

### 4.5 WhatsApp y contacto

`whatsapp` se lee desde `site_content.json → contacto.whatsapp` y se pasa a:
- `WhatsAppFloat`
- `CartDrawer`
- `app/layout.tsx` (JSON-LD `telephone`)
- `buildPickupWaLink` (en `web/lib/whatsapp-link.ts`)

Para el cliente nuevo: editar `web/data/site-content.json` y subir a la DB.

### 4.6 Productos y catálogo

El admin (`/admin/productos`) carga productos con campos:
`id`, `name`, `description`, `price`, `currency`, `category`, `image`, `badge`, `is_active`, `sort_order`, `units_per_pack`, `nutrition`.

- Categorías se manejan aparte en `/admin/categorias`.
- Hay un clon minorista → mayorista con botón "Clonar a mayorista".
- Las imágenes se suben vía ImageDropzone al bucket `barlovento-media/products/`.

### 4.7 Galería y eventos

Idem admin. Las rutas de storage están documentadas arriba.

### 4.8 Textos de marca

`/admin/textos` edita `site_content` (key-value JSON). Claves disponibles:
`historia`, `hero`, `mision`, `vision`, `valores`, `puntos_venta`, `regalos_empresariales`, `mayoristas`, `contacto`.

Si querés agregar una clave nueva, tenés que extender `SiteContent` en `web/lib/queries.ts` y el editor en `web/components/admin/TextosEditor.tsx`.

### 4.9 Checkout y envío

`web/app/checkout/CheckoutForm.tsx` y `web/app/api/checkout/route.ts` implementan la lógica de envío (195/220 UYU) y retiro coordinado. La política de envío está hardcoded en dos archivos (cliente y server). Para cambiarla:

- Editar las constantes `SHIPPING_LE_20`, `SHIPPING_MAS_20`, `SHIPPING_THRESHOLD` en **ambos** archivos (mantener consistencia).

### 4.10 Mercado Pago

- Crear cuenta del cliente (o que el cliente la cree).
- Crear app MP y obtener `access_token` (producción, no test).
- Homologar la cuenta si el cliente quiere cobrar de verdad (sin homologar, MP puede rechazar pagos).
- En MP → Webhooks, configurar `https://<dominio>/api/webhook/mp` y un secret. El secret va a `MERCADO_PAGO_WEBHOOK_SECRET`.
- El código ya maneja fail-closed si falta el secret (rechaza webhooks no firmados).

---

## 5. Estructura de carpetas (qué hay y para qué sirve)

```
Barlovento/
├── context.md                  # referencia viva del proyecto
├── propuesta_cliente.txt       # propuesta comercial (NO migrar)
├── migracion_a_otra_empresa.md # esta guía
├── Assets/                     # imágenes de marca (legacy, algunas)
├── imagenContexto/             # capturas para diagnóstico
├── imagenesEstaticas/
├── supabase/
│   ├── setup-completo.sql      # schema base + RLS + storage + seed
│   └── migrations/0004_profiles.sql
└── web/
    ├── .env.example
    ├── middleware.ts           # refresh cookies + guard /admin + pageviews
    ├── next.config.js
    ├── tailwind.config.ts
    ├── package.json
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx            # home: composición de secciones
    │   ├── error.tsx
    │   ├── login/  signup/  signup/check-email/
    │   ├── mi-cuenta/
    │   ├── productos/[id]/
    │   ├── checkout/  (page, success, failure, pending)
    │   ├── admin/
    │   │   ├── login/  layout/  page (Resumen)
    │   │   ├── productos/  categorias/  categorias-galeria/
    │   │   ├── galeria/  eventos/  textos/
    │   │   ├── pedidos/  retiros/  cupones/
    │   │   ├── usuarios/  analiticas/
    │   └── api/
    │       ├── checkout/  webhook/mp/  orders/whatsapp/
    │       ├── coupons/validate/  me/
    │       └── admin/
    │           ├── coupons/  orders/mark-paid/  orders/pickup-status/
    │           ├── simulate-payment/  mp-health/
    │           ├── metrics/  sales/  top-products/
    │           ├── user-orders/  event-images/
    ├── components/
    │   ├── Navbar/  Footer/  Hero/  Historia/  MisionVision/  Valores/
    │   ├── PuntosVenta/  ProductosHero/  Tienda/  TiendaServer/
    │   ├── Galeria/  GaleriaServer/  Contacto/  ContactoServer/
    │   ├── Eventos/  EventosList/  EventLightbox/
    │   ├── RegalosEmpresariales/  NutritionTable/  ProductoDetalle/
    │   ├── CartContext/  CartDrawer/  CartToast/  WhatsAppFloat/
    │   ├── Reveal/  useInView/  GoldDivider/  ShortDate/  formatDate/
    │   ├── formatMoney/  CouponInput/
    │   ├── auth/  (LoginForm, SignupForm)
    │   └── admin/  (AdminNav, Productos*, ProductoForm, GaleriaGrid,
    │                EventosTable, TextosEditor, PedidosTable, RetirosTable,
    │                CouponsAdmin, CategoriasTable, UsuariosTable,
    │                UserOrdersDrawer, AnalyticsDashboard, ImageDropzone)
    ├── data/                    # fallback JSON (cuando Supabase no está)
    │   ├── products.json  gallery.json  gallery-categories.json
    │   ├── events.json  categories.json  site-content.json
    ├── lib/
    │   ├── supabase-server/  supabase-admin/  types/  queries/
    │   ├── admin-queries/  admin-actions/  auth-actions/  profile-actions/
    │   ├── password-validation/  storage/  orders/  mercadopago/
    │   ├── mp-webhook/  coupons/  coupon-checkout/  analytics/
    │   ├── whatsapp-link/
    ├── public/
    │   └── Logo.jpg
    └── supabase/migrations/    # 0002..0017
```

---

## 6. Convenciones del código (mantener)

- **Server components** por default; `'use client'` sólo cuando hay estado/efectos.
- **Server Actions** para mutaciones (reciben `FormData` para File uploads).
- **`service_role` client** sólo en route handlers y server actions. Nunca al cliente.
- **Fechas**: ISO `YYYY-MM-DD` en DB. Formateo con helpers de `formatDate.ts` (no `toLocaleString` ni `Intl` para evitar hydration mismatches).
- **Moneda**: default UYU. Soportadas también USD, ARS, BRL, CLP, MXN, COP, PEN. Símbolos en `formatMoney.ts`.
- **Naming**: tablas/columnas `snake_case`, tipos TS `PascalCase`, funciones `camelCase`.
- **Comentarios en español** dentro del código y mensajes de UI en español.
- **Fallback JSON** en `web/data/` — cualquier tabla consultada en la home debe tener su JSON.
- **Edge Runtime**: usar `crypto.subtle.digest` (no `node:crypto`).

---

## 7. Rutas de la API (referencia rápida)

| Método | Path | Auth | Descripción |
|---|---|---|---|
| POST | `/api/checkout` | público | crea Preference MP + pre-persiste orden |
| POST | `/api/webhook/mp` | HMAC | notificaciones MP |
| POST | `/api/orders/whatsapp` | público | inserta orden whatsapp |
| POST | `/api/coupons/validate` | público | preview de descuento |
| GET | `/api/me` | opcional | `{ user, profile }` |
| GET/POST/PATCH/DELETE | `/api/admin/coupons` | admin | CRUD coupons |
| POST | `/api/admin/orders/mark-paid` | admin | cambiar status |
| POST | `/api/admin/orders/pickup-status` | admin | cambiar pickup_status |
| POST | `/api/admin/simulate-payment` | admin + flag | simular pago MP |
| GET | `/api/admin/mp-health` | admin | diagnóstico token |
| GET | `/api/admin/metrics` | admin | traffic analytics |
| GET | `/api/admin/sales` | admin | ingresos + deltas |
| GET | `/api/admin/top-products` | admin | top 5 por canal |
| GET | `/api/admin/user-orders` | admin | pedidos por email |
| GET | `/api/admin/event-images` | admin | imágenes de evento |

---

## 8. Rutas de página

### Públicas
- `/` (home)
- `/productos/[id]`
- `/checkout`, `/checkout/success|failure|pending`
- `/login`, `/signup`, `/signup/check-email`
- `/mi-cuenta` (protegida)

### Admin (`/admin/*`)
- `/admin/login`
- `/admin` (dashboard)
- `/admin/productos`, `/admin/categorias`, `/admin/categorias-galeria`
- `/admin/galeria`, `/admin/eventos`, `/admin/textos`
- `/admin/pedidos`, `/admin/retiros`, `/admin/cupones`
- `/admin/usuarios`, `/admin/analiticas`

---

## 9. Pasos detallados de migración

### Paso 1: Repo
1. Clonar el repo actual como base: `git clone <repo-actual> nuevo-proyecto && cd nuevo-proyecto`.
2. Borrar `propuesta_cliente.txt` y este `.md` antes del primer commit del cliente (son docs internos de Barlovento).
3. Actualizar `package.json` (`name`, `description`).
4. Push al repo del cliente.

### Paso 2: Supabase
1. Crear proyecto Supabase nuevo.
2. **Site URL**: `https://<dominio-del-cliente>`.
3. **Redirect URLs**: `https://<dominio-del-cliente>/**` y `http://localhost:3000/**` (para dev).
4. Crear bucket `barlovento-media` (público).
5. En el SQL Editor correr en orden:
   - `supabase/setup-completo.sql`
   - migraciones `web/supabase/migrations/0002..0017` (chequear cuáles están ya en el setup-completo y cuáles no)
6. Verificar que las tablas existen: `list_tables`.
7. Verificar que las funciones existen: `select * from pg_proc where proname in ('is_admin','mark_user_as_admin','increment_coupon_usage','set_updated_at');`.
8. Crear el primer admin manualmente:
   ```sql
   select public.mark_user_as_admin('email-del-cliente@dominio.com');
   ```

### Paso 3: Storage
1. Crear bucket `barlovento-media` (público).
2. Verificar las policies de storage:
   - `media public read` (SELECT público)
   - `media admin write` / `update` / `delete` (autenticado)

### Paso 4: Mercado Pago
1. Cliente crea cuenta MP (o la da).
2. Crear app en MP.
3. Obtener `access_token` de producción.
4. Configurar webhook en MP: URL = `https://<dominio>/api/webhook/mp`, evento `payment`, secret aleatorio.
5. Guardar `MERCADO_PAGO_WEBHOOK_SECRET` en Vercel.

### Paso 5: Variables de entorno
Llenar `web/.env.local` con las vars del nuevo proyecto. Replicar en Vercel project settings (production + preview).

### Paso 6: Personalización de código
- `web/app/sitemap.ts` y `web/app/robots.ts`: `SITE_URL`.
- `web/app/layout.tsx`: `metadataBase`, OpenGraph, JSON-LD.
- `web/app/productos/[id]/page.tsx`: OG + JSON-LD.
- `web/tailwind.config.ts`: paleta del cliente.
- `web/app/layout.tsx` viewport `themeColor`.
- `web/data/site-content.json`: toda la copia.
- Logo: `web/public/Logo.jpg` + `web/app/icon.jpg` + `Assets/Logo.jpg`.
- Imágenes de marca: `Assets/` si las seguís sirviendo de ahí.

### Paso 7: Cargar contenido
- Productos vía admin (o seed en JSON para empezar).
- Categorías.
- Galería.
- Eventos.
- Textos.

### Paso 8: Deploy
1. Conectar el repo a Vercel.
2. Configurar env vars.
3. Primer deploy.
4. Verificar el dominio custom en Vercel → Domains.

### Paso 9: Smoke test
- [ ] Home carga y se ve la marca nueva.
- [ ] Tienda lista productos.
- [ ] Carrito funciona.
- [ ] Checkout con Mercado Pago en sandbox.
- [ ] Checkout con retiro coordinado dispara el CTA de WhatsApp.
- [ ] Webhook MP firma y reconcilia la orden.
- [ ] Login admin funciona.
- [ ] Crear/editar/borrar producto desde admin.
- [ ] Crear/activar cupón y validarlo en checkout.
- [ ] Analytics cuenta pageviews.

---

## 10. Lo que NO migrar

- `Assets/` salvo el logo (muchos son específicos de Barlovento).
- `imagenContexto/` (diagnóstico).
- `imagenesEstaticas/`.
- `propuesta_cliente.txt` y este `.md`.
- Historias de commits (mejor squash al crear el repo del cliente).

---

## 11. Decisiones a tomar con el cliente antes de migrar

1. **Dominio** y DNS.
2. **Colores / paleta** + fuentes.
3. **Logo** (Wordmark + isotipo + favicon).
4. **Catálogo inicial** (qué productos, qué precios, qué categorías).
5. **Política de envío** (mantener 195/220 o cambiar).
6. **Modalidades**: envío + retiro, sólo retiro, sólo envío.
7. **Métodos de pago**: MP + WA, sólo uno, agregar otros.
8. **Cupones**: traer o empezar de cero.
9. **Quién es admin** (email del dueño).
10. **Hosting/dominio del cliente** o se mantiene en Vercel.
