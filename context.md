# Barlovento — Contexto completo del proyecto

Documento de referencia único. Cubre producto, stack, estructura, modelo de datos, integraciones, convenciones y estado actual al 2026-08-10.

**Mantenedor**: Facundo Langone. **Cliente**: Barlovento (alfajores artesanales, Trinidad, Flores, Uruguay).

---

## 1. Producto

**Barlovento** es una marca de **alfajores artesanales** elaborados en Trinidad, departamento de Flores, Uruguay. La empresa es familiar (fundada en junio 2021) y en 2026 vende una línea de 11 productos (clásicos, chocolate, especiales, saludables) más una línea mayorista con catálogo paralelo.

El sitio web es a la vez:
- **Brand showcase / landing** (historia, misión, visión, valores, puntos de venta, regalos empresariales, galería, eventos, contacto, mayoristas).
- **Tienda online** con catálogo dinámico y dos canales de checkout (Mercado Pago + WhatsApp).
- **Panel de administración** completo para gestionar contenido, catálogo, pedidos, cupones, usuarios y analítica — sin tocar código.

**URLs**:
- **Producción**: https://barlovento-oy5q.vercel.app
- **Dev local**: http://localhost:3000

### Canales de venta

1. **WhatsApp** (fire-and-forget, recomendado para mayoristas):
   - El cliente arma el carrito en `CartDrawer`, hace click en "Comprar por WhatsApp".
   - Se abre `wa.me/<phone>?text=<mensaje>` con el detalle del pedido.
   - En paralelo, `fetch('/api/orders/whatsapp', { keepalive: true })` persiste la orden con `channel='whatsapp'` y `status='pending'` vía service_role (bypassea RLS).
   - El admin luego confirma manualmente el pago desde el panel de pedidos.

2. **Mercado Pago Checkout Pro** (minoristas):
   - El cliente completa el form en `/checkout` y hace POST a `/api/checkout`.
   - El server resuelve productos server-side (precio/currency desde DB), revalida cupón, sanitiza datos del cliente y pre-persiste la orden con `channel='mercadopago'`, `status='pending'` antes de crear la Preference.
   - MP redirige al cliente a `init_point`. Vuelve por `/checkout/success|failure|pending`.
   - MP notifica el resultado vía webhook a `/api/webhook/mp` (firma HMAC-SHA256 verificada).
   - El webhook reconcilia la orden: actualiza `status` y `mp_payment_id`, redime el cupón si quedó pagada.

### Tipos de cliente

- **Retail** (minorista, default): ve precios retail, paga con MP.
- **Wholesale** (mayorista): ve precios mayoristas, sólo puede pagar por WhatsApp (mínimo 6 unidades por producto). El flag `is_wholesale=false` se setea en el botón "Pagar con MP" del `CartDrawer` y se valida server-side en `/api/checkout`.

---

## 2. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.5 |
| Lenguaje | TypeScript | 5.5.3 |
| UI | React | 18.3.1 |
| Estilos | Tailwind CSS | 3.4.6 |
| DB / Auth / Storage | Supabase (Postgres + GoTrue + S3) | `@supabase/ssr@0.12.4`, `@supabase/supabase-js@2.112.1` |
| Pagos | Mercado Pago SDK | `mercadopago@3.3.0` |
| Fonts | Cormorant Garamond + Inter (Google Fonts, preconnect en root layout) | — |
| Deploy | Vercel | auto-deploy desde `main` |

### Runtime

- Node 20.x. Dev con `npm run dev`, build con `npm run build`, prod con `npm start`.
- Sin framework de testing. Sin CI (`.github/workflows/` no existe). `next lint` corre pero sin reglas custom.

---

## 3. Estructura de carpetas

```
Barlovento/
├── .mcp.json                          # MCP servers (Supabase)
├── context.md                         # Este archivo
├── Assets/                            # Imágenes de marca servidas como static (logos, fotos)
├── Assets/Logo.jpg                    # Wordmark oficial (también en /public vía app/icon.jpg)
├── imagenContexto/                    # Capturas que el usuario comparte para diagnóstico
├── supabase/
│   ├── setup-completo.sql             # Schema completo, RLS, storage, seed (idempotente)
│   └── migrations/0004_profiles.sql
├── web/
│   ├── .env.example                   # Plantilla de env vars
│   ├── middleware.ts                  # Refresh de cookies + guard de /admin/* + tracking pageviews
│   ├── next.config.js                 # reactStrictMode + image formats (avif/webp) + Cache-Control chunks
│   ├── tailwind.config.ts             # Tokens de marca
│   ├── tsconfig.json
│   ├── package.json
│   ├── app/                           # App Router (rutas)
│   │   ├── layout.tsx                 # Root layout: Navbar + Footer + Cart + WhatsApp float
│   │   ├── page.tsx                   # Home: composición de secciones
│   │   ├── error.tsx                  # Global error boundary
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── signup/check-email/page.tsx
│   │   ├── mi-cuenta/
│   │   │   ├── page.tsx               # Server component: lee profile + orders
│   │   │   └── CuentaForm.tsx         # Client: edita datos + sign out
│   │   ├── admin/                     # Layout protegido por middleware
│   │   │   ├── layout.tsx             # Doble chequeo de is_admin
│   │   │   ├── page.tsx               # Dashboard con contadores + últimos pedidos
│   │   │   ├── login/page.tsx         # Login admin (reusa signIn de auth-actions)
│   │   │   ├── productos/page.tsx
│   │   │   ├── productos/nuevo/page.tsx
│   │   │   ├── productos/[id]/page.tsx
│   │   │   ├── categorias/page.tsx
│   │   │   ├── categorias-galeria/page.tsx
│   │   │   ├── galeria/page.tsx
│   │   │   ├── eventos/page.tsx
│   │   │   ├── textos/page.tsx
│   │   │   ├── pedidos/page.tsx
│   │   │   ├── cupones/page.tsx
│   │   │   ├── usuarios/page.tsx
│   │   │   └── analiticas/page.tsx
│   │   ├── checkout/
│   │   │   ├── page.tsx
│   │   │   ├── CheckoutForm.tsx       # Form + cupón + POST /api/checkout
│   │   │   ├── success/page.tsx
│   │   │   ├── failure/page.tsx
│   │   │   └── pending/page.tsx
│   │   ├── productos/[id]/page.tsx
│   │   └── api/
│   │       ├── checkout/route.ts          # Crea Preference de MP (server-side validation)
│   │       ├── webhook/mp/route.ts        # Recibe notificaciones MP (HMAC verificado)
│   │       ├── orders/whatsapp/route.ts   # Inserta order whatsapp vía service_role
│   │       ├── coupons/validate/route.ts  # Preview de descuento (cliente)
│   │       ├── me/route.ts                # Devuelve { user, profile }
│   │       └── admin/
│   │           ├── coupons/route.ts       # CRUD coupons (GET/POST/PATCH/DELETE)
│   │           ├── orders/mark-paid/route.ts  # Manual status change
│   │           ├── simulate-payment/route.ts   # Simulador (gateado por ENABLE_MP_SIMULATOR)
│   │           ├── mp-health/route.ts     # Diagnóstico token MP
│   │           ├── metrics/route.ts       # Pageviews/visitors (analytics)
│   │           ├── sales/route.ts         # Ingresos + deltas
│   │           ├── top-products/route.ts  # Top 5 retail + wholesale
│   │           ├── user-orders/route.ts   # Pedidos por email (admin)
│   │           └── event-images/route.ts  # Lista imágenes de un evento
│   ├── components/
│   │   ├── Navbar.tsx                 # Header con detección de sesión + scroll
│   │   ├── Footer.tsx                 # Server component (año actual del server)
│   │   ├── CartContext.tsx            # Provider + reducer + persistencia en localStorage
│   │   ├── CartDrawer.tsx             # Drawer lateral con MP + WhatsApp (bloquea MP si wholesale)
│   │   ├── CartToast.tsx              # Toast fugaz al agregar producto
│   │   ├── WhatsAppFloat.tsx          # Botón flotante
│   │   ├── Hero.tsx                   # Server wrapper
│   │   ├── HeroAnimated.tsx           # Hero client (useInView + medal badge)
│   │   ├── Historia.tsx               # Collage asimétrico de imágenes
│   │   ├── MisionVision.tsx
│   │   ├── Valores.tsx                # Grid flex con hairline
│   │   ├── PuntosVenta.tsx            # Departamentos
│   │   ├── ProductosHero.tsx          # 3 destacados
│   │   ├── Tienda.tsx                 # UI cliente con filtros
│   │   ├── TiendaServer.tsx           # Carga productos + detecta wholesale
│   │   ├── Galeria.tsx / GaleriaServer.tsx
│   │   ├── Contacto.tsx / ContactoServer.tsx
│   │   ├── Eventos.tsx                # Server wrapper
│   │   ├── EventosList.tsx            # Upcoming/past
│   │   ├── EventLightbox.tsx          # Lightbox con navegación + keyboard
│   │   ├── RegalosEmpresariales.tsx
│   │   ├── NutritionTable.tsx         # Packaging-style o legacy rows
│   │   ├── ProductoDetalle.tsx        # Detalle de producto
│   │   ├── Reveal.tsx                 # Animación on-scroll
│   │   ├── useInView.ts               # Hook IntersectionObserver
│   │   ├── GoldDivider.tsx
│   │   ├── ShortDate.tsx              # Server-safe date formatter (dd/mm/yyyy)
│   │   ├── formatDate.ts              # Helpers shared (es-ES, no locale del browser)
│   │   ├── CouponInput.tsx            # Input + apply/remove de cupón
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── SignupForm.tsx
│   │   └── admin/
│   │       ├── AdminNav.tsx           # Nav tabs + logout
│   │       ├── ProductosTable.tsx     # Lista retail con reordenar ▲▼
│   │       ├── ProductosWholesaleTable.tsx
│   │       ├── ProductosTabs.tsx      # Tabs retail/wholesale
│   │       ├── ProductoForm.tsx       # Editor de producto + ImageDropzone
│   │       ├── GaleriaGrid.tsx
│   │       ├── EventosTable.tsx       # Lista + MultiImageEditor
│   │       ├── TextosEditor.tsx       # Edita site_content key-value
│   │       ├── PedidosTable.tsx       # Acciones: marcar pagado / no pago / revertir
│   │       ├── CouponsAdmin.tsx       # CRUD coupons con steps colapsados
│   │       ├── CategoriasTable.tsx    # Compartida producto + galería
│   │       ├── UsuariosTable.tsx      # Lista profiles + stats + drawer de pedidos
│   │       ├── UserOrdersDrawer.tsx
│   │       ├── AnalyticsDashboard.tsx # Traffic + sales + top products
│   │       └── ImageDropzone.tsx
│   ├── data/                          # Fallback JSON (cuando Supabase no está configurado)
│   │   ├── products.json              # 11 alfajores (algunos con price=0 = sin precio fallback)
│   │   ├── gallery.json               # 6 items
│   │   ├── gallery-categories.json    # 3 categorías
│   │   ├── events.json                # 2 upcoming
│   │   ├── categories.json            # 4 categorías de producto
│   │   └── site-content.json          # Historia, hero, mision, vision, valores, contacto, etc.
│   ├── lib/
│   │   ├── supabase-server.ts         # createServerClient con cookies
│   │   ├── supabase-admin.ts          # service_role client (bypasea RLS)
│   │   ├── types.ts                   # getBrowserSupabase (cliente con cookies)
│   │   ├── queries.ts                 # getProducts / getGallery / getEvents / getSiteContent (con fallback)
│   │   ├── admin-queries.ts           # listUsersWithStats / countCoupons / getOrdersByCustomerEmail
│   │   ├── admin-actions.ts           # Server Actions: upsert/delete productos, galería, eventos, textos, customer_type
│   │   ├── auth-actions.ts            # Server Actions: signIn / signUp / signOut
│   │   ├── profile-actions.ts         # updateProfile + listMyOrders
│   │   ├── password-validation.ts     # Validador compartido cliente+server
│   │   ├── storage.ts                 # uploadImage + deleteImageByUrl
│   │   ├── orders.ts                  # listOrders + countPendingOrders + métricas + top products
│   │   ├── mercadopago.ts             # getMercadoPago (singleton)
│   │   ├── mp-webhook.ts              # processPaymentResult / processOrderById / redeemCouponIfAny
│   │   ├── coupons.ts                 # Motor de validación y cálculo de descuentos
│   │   ├── coupon-checkout.ts         # Revalidación server-side del cupón en checkout
│   │   └── analytics.ts               # Métricas de tráfico (visitas)
│   ├── public/                        # Assets estáticos servidos por Next
│   │   └── Logo.jpg                   # wordmark (también /Assets/Logo.jpg)
│   └── supabase/migrations/0002..0015.sql
└── supabase/migrations/0004_auth_security_hardening.sql
```

---

## 4. Variables de entorno

Definidas en `web/.env.example` (copiar a `web/.env.local`):

| Variable | Tipo | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (lectura RLS + auth cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | Bypasea RLS server-side (orders MP, webhook, admin queries, analytics) |
| `MERCADO_PAGO_ACCESS_TOKEN` | **SECRET** | Token de MP (credenciales de la app) |
| `NEXT_PUBLIC_SITE_URL` | public | URL base para back_urls / notification_url de MP (default `http://localhost:3000`) |
| `MERCADO_PAGO_WEBHOOK_SECRET` | **SECRET** | HMAC-SHA256 secret para verificar `x-signature` del webhook. Si falta y `MERCADO_PAGO_WEBHOOK_SECRET_ALLOW_UNVERIFIED !== '1'`, el webhook rechaza todo (fail-closed) |
| `ENABLE_MP_SIMULATOR` | **SECRET** | Si es `'1'`, habilita `/api/admin/simulate-payment`. Default: apagado |

**Importante**:
- `NEXT_PUBLIC_*` se expone al bundle del cliente.
- `SUPABASE_SERVICE_ROLE_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `ENABLE_MP_SIMULATOR` **nunca** deben llegar al cliente.

**Estado de credenciales en Vercel (2026-08-10)**:
- `SUPABASE_SERVICE_ROLE_KEY` — rotada 2026-08-06 ~13:30.
- `MERCADO_PAGO_ACCESS_TOKEN` — rotada 2026-08-06 ~13:30 (cuenta del cliente homologada).
- `MERCADO_PAGO_WEBHOOK_SECRET` — **pendiente**. Sin esto el webhook rechaza notificaciones (fail-closed).
- `SUPABASE_ANON_KEY` — pendiente rotación.

---

## 5. Modelo de datos (Supabase)

### Tablas

#### `public.profiles`
| col | tipo | notas |
|---|---|---|
| `user_id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | text | |
| `full_name` | text | |
| `phone` | text | |
| `address` | text | |
| `city` | text | |
| `is_admin` | boolean NOT NULL DEFAULT false | Flag de promoción manual |
| `customer_type` | text NOT NULL DEFAULT 'retail' | CHECK en ('retail', 'wholesale') |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `trg_profiles_updated` |

**Trigger `on_auth_user_created`**: crea automáticamente la fila en `profiles` con `is_admin=false`. `full_name/phone/address/city` vienen de `raw_user_meta_data` (lo manda el `SignupForm`).

**Funciones de soporte** (migración 0004):
- `public.is_admin(uid uuid) RETURNS boolean` — SECURITY DEFINER, search_path=''; la usan las RLS para evitar recursión.
- `public.mark_user_as_admin(p_email text)` — SECURITY DEFINER, sólo service_role.

**RLS**:
- `profiles self read` (SELECT): `auth.uid() = user_id`
- `profiles self insert` (INSERT): `auth.uid() = user_id`
- `profiles self update` (UPDATE): `auth.uid() = user_id`. **No permite escribir `customer_type` ni `is_admin`** — esas columnas solo las modifican admins vía service_role.
- `profiles admin read all` (SELECT): usa `public.is_admin(uid)`.

#### `public.products` (catálogo retail)
| col | tipo | notas |
|---|---|---|
| `id` | text PK | slug (ej. `clasico`, `chocolate-negro`) |
| `name` | text | |
| `description` | text | |
| `price` | numeric(10,2) CHECK >= 0 | |
| `currency` | text DEFAULT 'UYU' | |
| `category` | text | valores típicos: `clasicos`, `chocolate`, `especiales`, `saludable` |
| `image` | text | URL pública del bucket o `/Assets/...` (puede ser vacío) |
| `badge` | text NULL | "Edición limitada", "Nuevo", etc. |
| `is_active` | boolean DEFAULT true | |
| `sort_order` | integer DEFAULT 0 | |
| `nutrition` | jsonb NULL | Estructura `Nutrition` (ver §6.8) |
| `created_at` / `updated_at` | timestamptz | trigger `trg_products_updated` |

**RLS**: `products public read` (SELECT con `is_active=true`) + `products admin write` (all, `auth.role()='authenticated'`).

#### `public.wholesale_products` (catálogo mayorista)
Misma estructura que `products`, tabla separada para no mezclar precios. Mismas policies RLS. **No tiene fallback JSON** (devuelve `[]` si Supabase no está configurado).

#### `public.categories`
| col | tipo | notas |
|---|---|---|
| `id` | text PK | slug (ej. `clasicos`) |
| `label` | text | nombre legible |
| `sort_order` | integer DEFAULT 0 | |
| `is_active` | boolean DEFAULT true | |

#### `public.gallery_categories`
Idéntico a `categories` pero para categorías de galería (elaboracion / producto / ferias).

#### `public.gallery_items`
| col | tipo | notas |
|---|---|---|
| `id` | bigserial PK | |
| `title` | text | |
| `category` | text | slug de `gallery_categories` |
| `image` | text | URL pública del bucket o `/Assets/...` |
| `sort_order` | integer DEFAULT 0 | |
| `created_at` | timestamptz | |

#### `public.events`
| col | tipo | notas |
|---|---|---|
| `id` | bigserial PK | |
| `title` | text | |
| `date` | date | |
| `location` | text | |
| `description` | text | |
| `image` | text | URL de la portada (sincronizada con `event_images[0]`) |
| `kind` | text CHECK en ('upcoming','past') | |
| `created_at` | timestamptz | |

#### `public.event_images`
Galería múltiple por evento. Una fila por foto.
| col | tipo | notas |
|---|---|---|
| `id` | bigserial PK | |
| `event_id` | bigint FK → `events.id` | |
| `url` | text | |
| `position` | integer DEFAULT 0 | orden; la position=0 es la portada |

#### `public.site_content`
Tabla key-value. `key` (PK text) + `value` (jsonb) + `updated_at`.
Claves: `historia`, `hero`, `mision`, `vision`, `valores`, `puntos_venta`, `regalos_empresariales`, `mayoristas`, `contacto`. Ver `lib/queries.ts` para el shape exacto de cada una.

#### `public.coupons`
| col | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `code` | text unique | mayúsculas |
| `description` | text | |
| `is_active` | boolean | |
| `starts_at` / `ends_at` | timestamptz | |
| `min_subtotal` / `max_discount` | numeric | |
| `usage_limit` / `usage_count` | integer | `usage_count` se incrementa atómicamente vía RPC |
| `per_user_limit` | integer | |
| `combinable` | boolean | |
| `customer_type` | text CHECK | retail / wholesale / null |

#### `public.coupon_rules`
Una fila por regla de descuento (un cupón tiene 1..N reglas).
| col | tipo | notas |
|---|---|---|
| `coupon_id` | uuid FK | |
| `kind` | text | `percent` / `fixed` / `free_shipping` / `bxgy` / `gift_product` |
| `value` | numeric NULL | % o monto según `kind` |
| `config` | jsonb | shape depende de `kind` (ver §6.7) |
| `applies_to` | jsonb | `{ all: true }` o `{ product_ids: [...] }` o `{ categories: [...] }` |
| `sort_order` | integer | |

#### `public.coupon_redemptions`
Una fila por línea redimida (no por cupón entero). Permite rollback granular.
| col | tipo | notas |
|---|---|---|
| `coupon_id` / `rule_id` / `order_id` | uuid FKs | |
| `user_id` | uuid FK NULL | |
| `customer_email` | text NULL | |
| `customer_type` | text NULL | |
| `status` | text CHECK | `applied` / `refunded` |
| `discount_amount` | numeric | |
| `currency` | text | |
| `cart_snapshot` | jsonb | { items, line_description } |

**RPC**: `increment_coupon_usage(p_coupon_id uuid)` — incrementa `usage_count` con guarda de `usage_limit`. Si llega al límite, falla con `coupon_usage_limit_reached`.

#### `public.orders`
| col | tipo | notas |
|---|---|---|
| `id` | bigserial PK | |
| `items` | jsonb | array de `{id, name, qty, price, currency}`. Las líneas de cupón se guardan como `{id: 'coupon:<id>', qty: 1, price: -discount}` |
| `total` | numeric(10,2) CHECK 0..1000000 | |
| `currency` | text CHECK `^[A-Z]{3}$` | ISO 4217 |
| `channel` | text CHECK | `mercadopago` / `whatsapp` |
| `status` | text CHECK | `pending` / `paid` / `fulfilled` / `cancelled` |
| `customer_name` / `customer_phone` / `customer_email` | text NULL | |
| `customer_address` / `customer_city` / `customer_notes` | text NULL | |
| `customer_type` | text CHECK | `retail` / `wholesale` |
| `user_id` | uuid FK → `auth.users(id)` NULL | ON DELETE SET NULL |
| `coupon_code` / `coupon_discount` | text / numeric NULL | |
| `mp_preference_id` | text NULL | UNIQUE cuando no nulo (índice parcial) |
| `mp_payment_id` | text NULL | |
| `created_at` | timestamptz | |

**RLS** (migración 0015):
- `orders_admin_select` (SELECT): `EXISTS` contra `profiles` con `is_admin=true`.
- `orders_owner_select` (SELECT): `user_id = auth.uid()` (mi-cuenta).
- `anon insert whatsapp orders` (INSERT anon): `channel='whatsapp'`.
- MP orders se insertan con service_role (no necesitan policy).

#### `public.visitas`
Tracking de pageviews (fire-and-forget desde middleware).
| col | tipo | notas |
|---|---|---|
| `id` | bigserial PK | |
| `ruta` | varchar(255) | pathname del request |
| `fecha_hora` | timestamptz | now() default |
| `ip` | varchar NULL | |
| `user_agent` | varchar(255) NULL | |
| `visitor_hash` | varchar NULL | SHA-256(IP+UA), permite contar unique visitors sin guardar IP |

### Storage

**Bucket**: `barlovento-media` (público). Policies:
- `media public read` (SELECT)
- `media admin write` / `update` / `delete` (todas requieren `auth.role()='authenticated'`)

Convenciones de path:
- `products/<timestamp>-<safeName>.<ext>`
- `gallery/<timestamp>-<safeName>.<ext>`
- `events/<eventId>/<timestamp>-<safeName>.<ext>` (galería múltiple)
- `site/historia/<timestamp>-<safeName>.<ext>`
- `site/hero/<timestamp>-<safeName>.<ext>`

---

## 6. Flujos clave

### 6.1 Compra por WhatsApp

1. Usuario arma carrito en `CartDrawer` (state en `localStorage`).
2. Click en "Comprar por WhatsApp" → abre `wa.me/<phone>?text=<mensaje>`.
3. En paralelo, `captureWhatsAppOrder()` hace POST a `/api/orders/whatsapp` con `keepalive: true`.
4. Server inserta row con `channel='whatsapp'` y `status='pending'` vía service_role.
5. Validación server-side: si `customer_type='wholesale'`, exige mínimo 6 unidades por producto.

### 6.2 Compra por Mercado Pago

1. Cliente completa `/checkout` → POST a `/api/checkout` con `{items, customer_*, coupon_code?}`.
2. Server **resuelve productos server-side** desde `products` y `wholesale_products` (no confía en precios del cliente).
3. **Sanitiza** datos del cliente (límite de longitud, control chars).
4. **Revalida cupón** con `validateCouponForCheckout` (server-side, no cliente).
5. **Pre-persiste** la orden con `status='pending'`, sin `mp_preference_id`.
6. Crea Preference en MP con `back_urls` + `auto_return='approved'` + `notification_url=/api/webhook/mp`.
7. Si falla la Preference, marca la orden como `cancelled` para no dejar huérfanas.
8. Devuelve `init_point` → cliente redirige a MP.
9. MP notifica el resultado vía webhook.

**Validaciones server-side** (`/api/checkout/route.ts`):
- `MAX_ITEMS=50`, `MAX_QTY=99`.
- Currency ISO 4217 de la lista: UYU/USD/ARS/BRL/CLP/MXN/COP/PEN.
- Un solo currency por carrito.
- Wholesale bloqueado para MP (403).
- Coupon `currency` debe matchear la del carrito.
- Precios resueltos desde DB (ignora lo que manda el cliente).
- Emails en sesión tienen prioridad sobre el del form.

### 6.3 Webhook de Mercado Pago

Endpoint: `/api/webhook/mp` (POST). Topics aceptados: `payment`, `merchant_order`.

**Seguridad**:
1. Verifica firma HMAC-SHA256 contra `MERCADO_PAGO_WEBHOOK_SECRET` con manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Si falta el secret, fail-closed (excepto si `MERCADO_PAGO_WEBHOOK_SECRET_ALLOW_UNVERIFIED=1`).
2. Valida `payment.transaction_amount` y `currency_id` contra la orden en DB (rechaza con 409 si difieren).
3. Errores transitorios devuelven 5xx para que MP reintente.

**Procesamiento** (`lib/mp-webhook.ts`):
- `processPaymentResult({ preferenceId, paymentId, paymentStatus })`: actualiza orden con transición **estricta** `pending → ?` (no permite rebobinar).
- `redeemCouponIfAny`: si quedó `paid` y la orden tiene línea `coupon:<id>`, inserta `coupon_redemptions` con status `applied` y llama `increment_coupon_usage` RPC (idempotente).
- `processOrderById(orderId, nextStatus, paymentId)`: versión **admin permissive**, usada por mark-paid y simulate-payment. Permite cualquier transición (incluido `paid → cancelled` que dispara `refundRedemption`).

### 6.4 Login, signup y sesión

**Persistencia**: cookies nativas de `@supabase/ssr` (no `localStorage`). `getBrowserSupabase` (en `lib/types.ts`) reusa una instancia única por navegador.

**Server Actions** en `lib/auth-actions.ts`:
- `signIn(email, password, destination)`: `supabase.auth.signInWithPassword`. Devuelve `{ ok, destination }` sanitizada.
- `signUp({email, password, fullName, phone, address, city})`: valida password server-side (`password-validation.ts`), crea usuario con `emailRedirectTo` derivado de `NEXT_PUBLIC_SITE_URL`. Si requiere confirmación, devuelve `destination='/signup/check-email'`.
- `signOut()`: invalida sesión.

**Sanitización de destinos**: helper `safeInternalPath()` acepta solo rutas que empiecen por `/` (rechaza `//`, esquemas externos). Aplicado a `?next=`, `?destination=`, `?redirect=`.

**Middleware** (`web/middleware.ts`):
- Refresca la cookie de sesión en cada request.
- Setea header `x-pathname` para que el root layout oculte el chrome público en `/admin/*`.
- Protege `/admin/*` (sin sesión → `/admin/login`; con sesión pero sin admin → `/admin/login?error=no_admin`).
- Tracking de pageviews: registra `visitas` fire-and-forget vía `waitUntil`. Excluye `/admin/*`, `/api/*`. Calcula `visitor_hash = SHA-256(IP + UA)` (Edge Runtime → usa Web Crypto).

### 6.5 Doble chequeo de admin

1. **Middleware** (Edge): bloquea `/admin/*` antes de cargar el server component.
2. **`app/admin/layout.tsx`** (server): re-valida sesión + `is_admin` como defensa en profundidad.
3. **`requireAdminStrict()`** (`lib/admin-actions.ts`): helper para API routes y server actions. Lee sesión con cliente autenticado, valida `is_admin` con **service-role** (evita que RLS de `profiles` oculte la fila), devuelve el cliente service-role para que las mutaciones no queden atrapadas por RLS.

### 6.6 Server Actions con File

Next.js no acepta `File` como argumento directo de Server Action. **Todas las acciones que suben imágenes reciben `FormData`**, parsean los campos con `formData.get('xxx')` y leen el archivo con `formData.get('imageFile') as File | null`. Aplicado en:
- `upsertProduct(formData)`
- `upsertWholesaleProduct(formData)`
- `upsertGalleryItem(formData)`
- `upsertEvent(formData)`
- `uploadHistoryImage(formData)`
- `uploadHeroImage(formData)`
- `cloneProductToWholesale(sourceId: string)` — no usa FormData (clona un row existente).

### 6.7 Motor de cupones

`lib/coupons.ts` implementa:
- **Tipos de regla**: `percent`, `fixed`, `free_shipping`, `bxgy` (comprá N llevá M), `gift_product`.
- **Aplica a**: `{ all: true }`, `{ product_ids: [...] }`, o `{ categories: [...] }`.
- **`evaluateCoupon({ coupon, cart, customer, user_redemption_count, shipping_cost })`**: valida vigencia, límites, customer_type, combinabilidad, calcula `breakdown`.
- **`computeBreakdown(rules, cart, shipping)`**: itera reglas ordenadas por `sort_order`, calcula descuentos respetando `max_discount` (escala proporcional si excede).
- **`recordRedemption(supabase, args)`**: inserta una fila en `coupon_redemptions` por cada línea con `amount > 0 || free_shipping || gift_product`. Después llama `increment_coupon_usage` RPC atómicamente.
- **`refundRedemption(supabase, orderId)`**: marca las redenciones de la orden como `refunded` (rollback).
- **`fetchCouponByCode`** / **`countUserRedemptions`**: helpers de DB.

Doble validación:
1. `/api/coupons/validate` (cliente): preview con carrito del cliente para mostrar el descuento en el form antes de pagar.
2. `validateCouponForCheckout` (`lib/coupon-checkout.ts`): revalidación **server-side autoritativa** en `/api/checkout` con carrito resuelto del server. Devuelve códigos de error (`not_found`, `inactive`, `expired`, `min_subtotal`, `usage_limit_reached`, `per_user_limit_reached`, `customer_type_mismatch`, `not_applicable`, `empty_cart`, `not_combinable`, `already_applied`).

### 6.8 Información nutricional

`Nutrition` (jsonb en `products.nutrition` y `wholesale_products.nutrition`) tiene dos shapes compatibles:

**Bloque viejo** (`rows[]`):
```ts
{ portion: string, servings_per_package: number | null, rows: Array<{ nutrient, amount, dv }> }
```

**Bloque nuevo (packaging-style)**: campos planos opcionales `kcal`, `kj`, `carbs_g`, `protein_g`, `fat_g`, `saturated_g`, `fiber_g`, `sodium_mg`, `trans_g`, `warning_labels: string[]`.

`NutritionTable` decide qué bloque mostrar: si algún campo extendido tiene valor → `ExtendedBlock`, sino → `LegacyRowsBlock`. Si está todo vacío/null → no se renderiza nada.

`ProductoForm.parseNutritionField()` toma el JSON del form y devuelve `null` si no hay datos útiles, o el objeto normalizado con el subset presente.

### 6.9 Lectura con fallback

`lib/queries.ts` envuelve cada query con `fromSupabase()`. Si Supabase no está configurado (sin env vars) o falla, devuelve los JSON de `data/*.json` (o `[]` para wholesale, que no tiene fallback). Esto permite que el dev local funcione sin setup y que la home nunca rompa por una caída de DB.

Para `getEvents` hay un merge adicional: trae `event_images` y los agrupa por `event_id`, si no hay, devuelve `[e.image]` como single-element array.

### 6.10 Tracking de pageviews

En `middleware.ts`:
- Excluye `/admin/*`, `/api/*`, GET requests.
- IP: `x-forwarded-for` → `x-real-ip` → `cf-connecting-ip`.
- `visitor_hash = SHA-256(IP + UA)` calculado con `crypto.subtle.digest` (Edge Runtime).
- Inserta via service-role, fire-and-forget (no bloquea la respuesta).

`lib/analytics.ts: getTrafficMetrics(period)`:
- Períodos: `7d`, `30d`, `90d`, `all`.
- `all`: encuentra primer hit, si el rango > 90 días agrupa por semana (alineado al lunes UTC).
- Devuelve totales, deltas vs período anterior equivalente, y serie diaria con un punto por día (aunque tenga 0).

### 6.11 Acciones admin manuales de orders

`/api/admin/orders/mark-paid` (POST): cambia el status de cualquier orden.
- Body: `{ order_id, status: 'paid'|'cancelled'|'fulfilled'|'pending', mp_payment_id?, note? }`.
- Si sale de `paid` → llama `refundRedemption` (rollback del cupón).
- Loguea con `[admin/orders/set-status]` para auditoría.
- Usa `processOrderById` (admin permissive).

`/api/admin/simulate-payment` (POST): simula un pago de MP sin pasar por MP.
- Gateado por `ENABLE_MP_SIMULATOR=1` (default: apagado).
- Body: `{ order_id, status: 'approved'|'rejected'|'cancelled', payment_id? }`.
- `approved` → `paid`, `rejected|cancelled` → `cancelled`.

`/api/admin/mp-health` (GET): diagnóstico del access token. Pega a `https://api.mercadopago.com/users/me` y devuelve metadata de la cuenta (user_id, país, site_id, email confirmado, user_type, `looks_like_test`). Nunca expone el token completo, sólo el prefix (8 chars) y el length.

---

## 7. Sistema de diseño

### Tokens de color (`tailwind.config.ts`)
| Token | Hex | Uso |
|---|---|---|
| `carbon` | `#0B0B0B` | Fondo principal (carbón cálido) |
| `carbon-raised` | `#1A1A1A` | Tarjetas en fondo negro |
| `carbon-line` | `#262626` | Bordes, separadores |
| `cream` | `#F5F1E6` | Superficies claras (alternativa al blanco clínico) |
| `ink` | `#111111` | Texto sobre cream |
| `gold` | `#D4AF37` | Acentos primarios |
| `gold-deep` | `#C9A227` | Hover / active |
| `gold-shadow` | `#8C6F1A` | Sombras |
| `gold-light` | `#E8C766` | Hover claro |
| `bone` | `#F5F5F0` | Texto principal sobre carbón |

### Tipografía
- **Display**: Cormorant Garamond (serif editorial, titulares).
- **Body**: Inter (sans, UI y párrafos).
- **`text-eyebrow`**: pre-título con `tracking-ultra`.
- **`tracking-ultra`** = 0.35em.
- **`max-w-editorial`** = 64ch (medida óptima de lectura).

### Animaciones custom
- `gold-draw` (1.2s ease cubic-bezier): dibuja una línea dorada (hover links, divider).
- `fade-up` (0.9s ease-out): entrada de secciones.
- `soft-pulse` (3.5s loop): opacidad suave (badge de medalla).
- `shimmer` (6s loop): gradiente en movimiento.

### Layout patterns
- Container: `mx-auto max-w-7xl px-6 lg:px-10`.
- Sections: `py-28 lg:py-40` con `GoldDivider` entre ellas.
- Botones primarios: `bg-gold text-carbon rounded-full px-7 py-3.5`.
- Botones secundarios: `border border-gold/40 text-gold rounded-full`.
- Etiquetas eyebrow: `font-body text-[10px] uppercase tracking-ultra text-gold`.

### Reveal-on-scroll
`Reveal` + `useInView` aplican clases `is-in-view` cuando el elemento entra al viewport (threshold 0.18). Las animaciones CSS asociadas viven en `globals.css`.

---

## 8. Convenciones del código

- **Server components por default**; client components solo cuando hace falta estado/efectos (`'use client'` al tope).
- **No usar `File` como argumento de Server Action** → siempre `FormData`.
- **No exponer `service_role` key al cliente** → solo en route handlers y server actions. Middleware usa `createClient(url, key, { auth: { persistSession: false }})`.
- **Toda query a Supabase con RLS** (excepto las que explícitamente usan `getServiceSupabase()` o `requireAdminStrict()`).
- **Fechas**: ISO `YYYY-MM-DD` en DB. Formateo en el cliente con helpers de `formatDate.ts` (no `toLocaleString`/`Intl` para evitar hydration mismatches). Para server-rendered: `ShortDate` (`dd/mm/yyyy`).
- **Moneda**: default UYU. Soportadas también USD, ARS, BRL, CLP, MXN, COP, PEN. Símbolos formateados manualmente con `String.replace(/\B(?=(\d{3})+(?!\d))/g, '.')` en lugar de `Intl.NumberFormat` (consistencia SSR/CSR).
- **Naming**: tablas y columnas `snake_case`, tipos TS `PascalCase`, funciones `camelCase`, server actions exportadas en `camelCase` descriptivo.
- **Comentarios en español** dentro de los archivos `.ts/.tsx`. Mensajes de UI también en español (es-AR/es-UY).
- **Fallback JSON**: cualquier tabla nueva que se consulte en la home debería tener su JSON en `web/data/` para que dev local funcione sin setup. Wholesale NO tiene fallback (devuelve `[]`).
- **Edge Runtime**: en middleware usar `crypto.subtle.digest` (no `node:crypto`).
- **No usar `Date.now()` ni `new Date()` en componentes cliente que se renderizan también en server** → produce hydration mismatches. Usar el año del server en `Footer` (server component). Para fechas en server-rendered: usar `<ShortDate iso={...} />`.

---

## 9. Endpoints API

| Path | Método | Auth | Descripción |
|---|---|---|---|
| `/api/checkout` | POST | público | Crea Preference MP, pre-persiste orden |
| `/api/webhook/mp` | POST | HMAC | Recibe notificación MP |
| `/api/orders/whatsapp` | POST | público | Inserta orden whatsapp |
| `/api/coupons/validate` | POST | público | Preview de descuento |
| `/api/me` | GET | opcional | `{ user, profile }` |
| `/api/admin/coupons` | GET/POST/PATCH/DELETE | admin | CRUD coupons |
| `/api/admin/orders/mark-paid` | POST | admin | Cambia status manualmente |
| `/api/admin/simulate-payment` | POST | admin + `ENABLE_MP_SIMULATOR=1` | Simula resultado MP |
| `/api/admin/mp-health` | GET | admin | Diagnóstico token MP |
| `/api/admin/metrics` | GET | admin | Traffic analytics |
| `/api/admin/sales` | GET | admin | Ingresos + deltas |
| `/api/admin/top-products` | GET | admin | Top 5 por canal |
| `/api/admin/user-orders` | GET | admin | Pedidos por email |
| `/api/admin/event-images` | GET | admin | Imágenes de un evento |

---

## 10. Rutas de página

### Públicas
- `/` (home): Hero · Historia · Misión/Visión · Valores · Puntos de venta · ProductosHero · TiendaServer (con detección wholesale) · Eventos · RegalosEmpresariales · GaleriaServer · ContactoServer.
- `/productos/[id]`: detalle de producto (busca primero en retail, luego wholesale).
- `/checkout`: formulario de pago MP.
- `/checkout/success|failure|pending`: páginas estáticas con CTA.
- `/login`, `/signup`, `/signup/check-email`.
- `/mi-cuenta`: protegida por middleware, edición de profile + lista de pedidos propios.

### Admin (`/admin/*`)
- `/admin/login`: login (reusa signIn).
- `/admin`: dashboard con cards de contadores + tabla de últimos 5 pedidos.
- `/admin/productos`: tabs retail / wholesale, con reordenar ▲▼, toggle active, clonar a mayorista.
- `/admin/productos/nuevo`, `/admin/productos/[id]`: ProductoForm (con ImageDropzone + nutrición).
- `/admin/categorias`, `/admin/categorias-galeria`: CategoriasTable compartida.
- `/admin/galeria`: GaleriaGrid con dropzone.
- `/admin/eventos`: EventosTable con MultiImageEditor.
- `/admin/textos`: TextosEditor para los key-values de `site_content`.
- `/admin/pedidos`: PedidosTable con acciones marcar pagado / no pago / revertir.
- `/admin/cupones`: CouponsAdmin con steps colapsados.
- `/admin/usuarios`: UsuariosTable con drawer de pedidos por email.
- `/admin/analiticas`: AnalyticsDashboard (traffic + sales + top products).

---

## 11. Historial de cambios recientes

### Sesión 2026-08-10
- **Limpieza de imágenes muertas**: removidas referencias a `/Assets/placeholder.png`, `/Assets/premio-pyme-oro-2024.png` y `/Assets/og-image.png` (archivos borrados en `b3b3b36` pero el código seguía pidiéndolos). `HeroAnimated.tsx`: el badge de medalla ahora es texto + estrella dorada (sin `<img>`, sin lightbox). `ProductoForm.tsx`: `existingImage` arranca en `''`. `storage.ts`: fallback de Supabase devuelve `''`.
- **Limpieza de BD**: borrado el producto de prueba (`id: "as"`) que tenía `image='/Assets/placeholder.png'`.
- **Branch**: `chore/remove-dead-image-refs` (no mergeado a main todavía — pendiente PR).

### Sesión 2026-08-06 (resumen)
- **Server Actions con File**: `upsertProduct/GalleryItem/Event` y `uploadHistoryImage` ahora reciben `FormData`. Refactor de `ProductoForm`, `EventosTable`, `GaleriaGrid`, `TextosEditor` para usar `new FormData()`.
- **Error boundary global**: creado `app/error.tsx`.
- **Profile persistence**: `updateProfile` cambió a `.upsert(..., { onConflict: 'user_id' })` para crear la fila si no existía.
- **Navbar auth-aware**: detecta `userEmail` con `getUser()` + `onAuthStateChange`.
- **Admin panel button**: `is_admin` en RLS con función `SECURITY DEFINER` para evitar recursión.
- **Unify SSR auth flow** (`81825f9`): `lib/auth-actions.ts` con `signIn/signUp/signOut` server-side. `getBrowserSupabase` pasa a cookies nativas. Middleware protege `/mi-cuenta` y sanitiza `next`. `safeInternalPath()` bloquea open redirects.
- **Hardening Supabase** (`0004_auth_security_hardening.sql`): `search_path=''` + `EXECUTE` restringido en funciones. `mark_user_as_admin` solo `service_role`. `is_admin(uid)` accesible a `authenticated` + `service_role`.
- **Validación de contraseñas** (`lib/password-validation.ts`): 8 chars + 4 clases + blacklist local.
- **Rotaciones Vercel**: `SUPABASE_SERVICE_ROLE_KEY` y `MERCADO_PAGO_ACCESS_TOKEN` rotados.

### Sesión 2026-08-07 a 2026-08-09
- **Webhook MP completo** (`becfab4` + `f8d7548`): `/api/webhook/mp` con verificación HMAC-SHA256, validación de monto/currency, idempotencia via `pending → ?` transition. Shared `lib/mp-webhook.ts` con `processPaymentResult` (estricto) y `processOrderById` (admin permissive).
- **Critical security fixes** (`daf9d19`): server-side validation en `/api/checkout` (precios desde DB, MAX_ITEMS/MAX_QTY, currency ISO, sanitización, wholesale bloqueado). Pre-persistencia de orden antes de crear Preference (evita huérfanas). Cupones revalidados server-side via `validateCouponForCheckout`. Error scrubbing (no se devuelve `err.message` de MP al cliente). `siteUrlFor()` helper arregla double-slash.
- **Mark-paid admin** (`99175c8`, `e42436a`, `e11786f`): botones "Marcar pagado", "No pago", "Revertir a pendiente" en PedidosTable. Si paid → cancelled, dispara `refundRedemption`. `simulate-payment` gateado por env.
- **MP health check** (`99175c8`): `/api/admin/mp-health` para diagnosticar el token.
- **Service-role en orders** (`8f4fdfe`): `listOrders` usa `getServiceSupabase()` para que el panel no dependa de RLS.
- **Hydration fixes** (`a90fc32`, `bd85b9c`, `d4ed3d4`): removido `toLocaleString`, `toLocaleDateString`, `Intl.NumberFormat`, `Date.getFullYear` de los componentes renderizados. Reemplazados por `formatDate.ts` helpers y `ShortDate`. `next.config.js` agrega `Cache-Control: max-age=0, must-revalidate` en `/_next/static/*`.
- **CouponsAdmin UX** (`292e39c`, `cabb474`, `0397c38`): pasos colapsados, etiquetas en español, picker con imágenes retail/wholesale.
- **Hero text right** (`359a436`, `2db4e8a`): hero content alineado a la derecha.

### Fases del proyecto (acumulado)
- **Fase 1**: sitio estático con JSON local.
- **Fase 2**: Supabase + RLS + admin panel + storage.
- **Fase 3**: auth + profiles + customer_type + service role para orders.
- **Fase 4**: checkout Mercado Pago + captura WhatsApp.
- **Fase 5**: cupones, analytics, admin tooling (mark-paid + simulate + mp-health), hydration fixes.

---

## 12. Estado actual y temas abiertos

### 12.1 Imágenes borradas y bundle viejo
- **Status actual (2026-08-10)**: el branch `chore/remove-dead-image-refs` tiene la limpieza lista pero NO está mergeado a `main` (Vercel deploya desde `main`). Por eso la consola del browser todavía muestra 404 a `placeholder.png` y los React errors por mismatches.
- **Pendiente**: mergear el branch (PR pendiente) y hacer hard refresh (Cmd/Ctrl+Shift+R).

### 12.2 Requerimientos no automatizables

**Configuración de Vercel**:
- Rotar `SUPABASE_ANON_KEY` (sigue pendiente).
- Confirmar `MERCADPAGO_WEBHOOK_SECRET` esté configurado en Vercel. Sin él el webhook rechaza todas las notificaciones (fail-closed). Configurar en MP → Webhooks → URL del sitio + Secret.

**Configuración de Supabase Auth**:
- Site URL: `https://barlovento-oy5q.vercel.app`
- Redirect URLs: `https://barlovento-oy5q.vercel.app/**` + `http://localhost:3000/**`

### 12.3 Seguridad

**Avisos restantes en Security Advisor** (post-0004):
- `is_admin` invocable por `authenticated` — esperado, lo requieren las RLS.
- `auth_leaked_password_protection` — requiere Pro; mitigado a nivel de aplicación (`password-validation.ts`).

**Cuestiones de diseño aceptadas**:
- `customer_type` e `is_admin` en `profiles` no son escribibles por el usuario vía RLS — solo admins con service_role.
- Middleware y layout admin hacen doble chequeo de `is_admin`.
- Todas las API admin validan `requireAdminStrict()`.

### 12.4 Falta de tests y CI

No hay framework de testing. `next lint` corre pero sin reglas custom. No hay GitHub Actions. No hay preview deploys por PR.

### 12.5 Escalabilidad

- `getOrderMetrics` agrega las últimas 100 filas en JS. Si el volumen crece → mover a SQL aggregation.
- `listUsersWithStats` lee hasta 500 profiles + 2000 orders. Suficiente para escala actual.
- `webhook/mp` no tiene rate limiting más allá del de MP.

---

## 13. Comandos útiles

```bash
# Levantar el sitio
cd web && npm install && npm run dev

# Build de producción
cd web && npm run build && npm start

# Limpiar caché de Next (si hay 404 raros en chunks)
rm -rf web/.next

# Re-aplicar schema de Supabase (idempotente)
# Pegar supabase/setup-completo.sql en SQL Editor → New query

# Probar webhook localmente (después de configurar ngrok o similar)
curl -X POST http://localhost:3000/api/webhook/mp -H "Content-Type: application/json" -d '{"type":"payment","data":{"id":123}}'

# Diagnóstico de MP
curl -H "Cookie: ..." https://barlovento-oy5q.vercel.app/api/admin/mp-health
```

### MCP de Supabase (este proyecto)
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=gzoxqdmzrwjeuwqziazt&features=docs,account,database,debugging,development,functions,branching"
    }
  }
}
```

Project ref: `gzoxqdmzrwjeuwqziazt`. Requiere auth con la cuenta Supabase del dueño al primer uso.

---

## 14. Glosario

- **Preference**: objeto que MP crea para una sesión de pago. Tiene `init_point` (URL a la que redirigir al cliente) y `id` (que va al webhook).
- **Webhook**: notificación asíncrona que MP manda cuando un pago cambia de estado. Llega a `notification_url`.
- **Service role**: clave de Supabase con permisos totales (bypasea RLS). Solo server-side.
- **RLS** (Row Level Security): policies de Postgres que filtran qué filas puede ver/escribir cada usuario.
- **Hydration mismatch**: error de React cuando el HTML que el server produce no coincide con lo que el cliente renderiza al hidratar.
- **Order status flow**: `pending` → `paid` (cobrado) / `cancelled` (no pago o rollback) / `fulfilled` (entregado). El webhook sólo avanza desde `pending` (transición estricta); `processOrderById` (admin) permite cualquier transición.
- **Homologación MP**: proceso de verificación que MP exige antes de permitir cobros reales. Sin homologar, MP puede rechazar pagos o devolver "una de las partes es de prueba".
