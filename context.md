# Barlovento — Contexto completo del proyecto

Documento de referencia único. Cubre producto, stack, estructura, modelo de datos, integraciones, convenciones y estado actual al 2026-08-06.

---

## 1. Producto

**Barlovento** es la marca de **alfajores artesanales de Trinidad, Flores, Uruguay**. Premio Pyme — Medalla de Oro al mejor alfajor Pyme del departamento.

El sitio web es a la vez:
- **Brand showcase / landing** (historia, misión, visión, galería, eventos, prensa).
- **Tienda online** con catálogo dinámico y dos canales de checkout.
- **Panel de administración** para gestionar contenido sin tocar código.

**URL pública en producción**: https://barlovento.uy
**Dev local**: http://localhost:3000

### Canales de venta
1. **WhatsApp**: el cliente arma el carrito y se redirige a un mensaje pre-armado a `+59899123456` con el detalle del pedido. Fire-and-forget: en paralelo se inserta un row en `orders` con `channel='whatsapp'` para tracking.
2. **Mercado Pago**: crea una Preference con `auto_return='approved'` y `back_urls` a `/checkout/success|failure|pending`. El server inserta el order con `channel='mercadopago'` vía service_role (bypaseando RLS).

### Tipos de cliente
- **Retail** (default): consumidor final.
- **Wholesale** (mayorista): marcado manualmente por el admin. Habilita precios mayoristas y un badge en la UI.

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
| Fonts | Cormorant Garamond + Inter (Google Fonts) | — |

### Runtime
- Node 20.x, dev con `npm run dev`, build con `npm run build`, prod con `npm start`.
- No hay framework de testing ni linter configurado más allá del default de Next (`next lint`).

---

## 3. Estructura de carpetas

```
Barlovento/
├── .mcp.json                          # MCP servers (Supabase)
├── Assets/                            # Imágenes de marca (logo, fotos de producto, fotos de historia)
├── imagenContexto/                    # Capturas que el usuario comparte para diagnóstico
├── imagenesEstaticas/                 # (legacy / experimental)
├── supabase/
│   ├── setup-completo.sql             # Schema completo, RLS, storage, seed (idempotente)
│   └── migrations/0004_profiles.sql   # Migración incremental de profiles
├── web/
│   ├── .env.example                   # Plantilla de env vars
│   ├── .env.local                     # Env vars reales (NO commitear)
│   ├── middleware.ts                  # Refresh de cookies + guard de /admin/*
│   ├── next.config.js                 # reactStrictMode + image formats (avif/webp)
│   ├── tailwind.config.ts             # Tokens de marca
│   ├── tsconfig.json
│   ├── package.json
│   ├── app/                           # App Router (rutas)
│   │   ├── layout.tsx                 # Root layout: Navbar + Footer + Cart + WhatsApp float
│   │   ├── page.tsx                   # Home: composición de secciones
│   │   ├── error.tsx                  # Global error boundary
│   │   ├── globals.css                # (no inspeccionado en este read)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── signup/check-email/page.tsx
│   │   ├── mi-cuenta/
│   │   │   ├── page.tsx               # Server component: lee profile + orders
│   │   │   └── CuentaForm.tsx         # Client: edita datos + sign out
│   │   ├── admin/                     # Layout protegido por middleware
│   │   │   ├── layout.tsx             # Doble chequeo de is_admin
│   │   │   ├── page.tsx               # Dashboard con contadores
│   │   │   ├── login/page.tsx
│   │   │   ├── productos/             # Lista, nuevo, [id]
│   │   │   ├── galeria/page.tsx
│   │   │   ├── eventos/page.tsx
│   │   │   ├── textos/page.tsx
│   │   │   ├── pedidos/page.tsx
│   │   │   └── usuarios/page.tsx
│   │   ├── checkout/
│   │   │   ├── success/page.tsx
│   │   │   ├── failure/page.tsx
│   │   │   └── pending/page.tsx
│   │   └── api/
│   │       ├── checkout/route.ts      # Crea Preference de MP
│   │       ├── orders/whatsapp/route.ts  # Inserta order whatsapp vía service_role
│   │       └── me/route.ts            # Devuelve user + profile
│   ├── components/
│   │   ├── Navbar.tsx                 # Header con detección de sesión
│   │   ├── Footer.tsx
│   │   ├── CartContext.tsx            # Provider + reducer + persistencia en localStorage
│   │   ├── CartDrawer.tsx             # Drawer lateral con MP + WhatsApp
│   │   ├── WhatsAppFloat.tsx          # Botón flotante
│   │   ├── Hero.tsx
│   │   ├── Historia.tsx
│   │   ├── MisionVision.tsx
│   │   ├── ProductosHero.tsx
│   │   ├── Tienda.tsx                 # UI cliente
│   │   ├── TiendaServer.tsx           # Carga productos y pasa a Tienda
│   │   ├── Galeria.tsx / GaleriaServer.tsx
│   │   ├── Contacto.tsx / ContactoServer.tsx
│   │   ├── Eventos.tsx
│   │   ├── Reveal.tsx                 # Animación on-scroll
│   │   ├── useInView.ts
│   │   ├── GoldDivider.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── SignupForm.tsx
│   │   └── admin/
│   │       ├── AdminNav.tsx
│   │       ├── ProductosTable.tsx
│   │       ├── ProductoForm.tsx
│   │       ├── GaleriaGrid.tsx
│   │       ├── EventosTable.tsx
│   │       ├── TextosEditor.tsx
│   │       ├── PedidosTable.tsx
│   │       ├── UsuariosTable.tsx
│   │       └── ImageDropzone.tsx
│   ├── data/                          # Fallback JSON (cuando Supabase no está configurado)
│   │   ├── products.json
│   │   ├── gallery.json
│   │   ├── events.json
│   │   └── site-content.json
│   ├── lib/
│   │   ├── supabase-server.ts         # createServerClient con cookies
│   │   ├── supabase-admin.ts          # service_role client (bypasea RLS)
│   │   ├── types.ts                   # getBrowserSupabase (cliente con localStorage)
│   │   ├── queries.ts                 # getProducts / getGallery / getEvents / getSiteContent (con fallback)
│   │   ├── admin-queries.ts           # listUsersWithStats (admin only)
│   │   ├── admin-actions.ts           # Server Actions: upsert/delete productos, galería, eventos, textos, customer_type
│   │   ├── profile-actions.ts         # updateProfile + listMyOrders
│   │   ├── storage.ts                 # uploadImage + deleteImageByUrl (bucket barlovento-media)
│   │   ├── orders.ts                  # listOrders + countPendingOrders
│   │   └── mercadopago.ts             # getMercadoPago (singleton)
│   ├── public/                        # Assets estáticos servidos por Next
│   └── supabase/migrations/0002_customer_type.sql
```

---

## 4. Variables de entorno

Definidas en `web/.env.example` (copiar a `web/.env.local`):

| Variable | Tipo | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (lectura RLS + auth cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | Bypasea RLS server-side (orders MP, backfills) |
| `MERCADO_PAGO_ACCESS_TOKEN` | **SECRET** | Token de MP (credenciales de la app) |
| `NEXT_PUBLIC_SITE_URL` | public | URL base para back_urls de MP (default `http://localhost:3000`) |

**Importante**: `NEXT_PUBLIC_*` se exponen al bundle del cliente. Las otras dos **nunca** deben llegar al cliente.

**JWT expiry**: el cliente configura `maxAge: 1 año` en cookies. Para que esto funcione, el JWT expiry en Supabase Dashboard → Auth → Settings tiene que estar en 1 año también (default 1h rompería la sesión).

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

**Trigger `on_auth_user_created`**: al insertarse un `auth.users`, crea automáticamente la fila en `profiles` con `is_admin=false`. `full_name` viene de `raw_user_meta_data->>'full_name'` (lo manda el `SignupForm`).

**RLS**:
- `profiles self read` (SELECT): `auth.uid() = user_id`
- `profiles self insert` (INSERT): `auth.uid() = user_id`
- `profiles self update` (UPDATE): `auth.uid() = user_id`
- `profiles admin read all` (SELECT): la policy más nueva, permite a admins ver todas las filas usando la función `public.is_admin(uid)` (SECURITY DEFINER, evita recursión)

#### `public.products`
| col | tipo | notas |
|---|---|---|
| `id` | text PK | slug (ej. `clasico`, `chocolate-negro`) |
| `name` | text | |
| `description` | text | |
| `price` | numeric(10,2) CHECK >= 0 | |
| `currency` | text DEFAULT 'UYU' | |
| `category` | text | valores típicos: `clasicos`, `chocolate`, `especiales` |
| `image` | text | URL pública del bucket o `/Assets/...` |
| `badge` | text NULL | "Edición limitada", "Nuevo", etc. |
| `is_active` | boolean DEFAULT true | |
| `sort_order` | integer DEFAULT 0 | |
| `created_at` / `updated_at` | timestamptz | trigger `trg_products_updated` |

**RLS**: `products public read` (SELECT con `is_active=true`) + `products admin write` (all, `auth.role()='authenticated'`).

#### `public.gallery_items`
| col | tipo | notas |
|---|---|---|
| `id` | bigserial PK | |
| `title` | text | |
| `category` | text CHECK en ('elaboracion','producto','ferias') | |
| `image` | text | |
| `sort_order` | integer DEFAULT 0 | |

#### `public.events`
| col | tipo | notas |
|---|---|---|
| `id` | bigserial PK | |
| `title` | text | |
| `date` | date | |
| `location` | text | |
| `description` | text | |
| `image` | text | |
| `kind` | text CHECK en ('upcoming','past') | |
| `created_at` | timestamptz | |

#### `public.site_content`
Tabla key-value. Cada fila tiene `key` (PK text) y `value` (jsonb). Claves usadas:
- `historia` → `{eyebrow, headline, body[], image, image_caption}`
- `mision` → `{eyebrow, headline, body}`
- `vision` → `{eyebrow, headline, body}`
- `contacto` → `{whatsapp, email, direccion, instagram, facebook, horarios}`

#### `public.orders`
| col | tipo | notas |
|---|---|---|
| `id` | bigserial PK | |
| `items` | jsonb | array de `{id, name, qty, price}` |
| `total` | numeric(10,2) | |
| `currency` | text DEFAULT 'UYU' | |
| `channel` | text CHECK en ('mercadopago','whatsapp') | |
| `status` | text CHECK en ('pending','paid','fulfilled','cancelled') | |
| `customer_name` / `customer_phone` / `customer_email` | text NULL | |
| `mp_preference_id` / `mp_payment_id` | text NULL | |
| `created_at` | timestamptz | |

**RLS**: `orders admin read` (SELECT `auth.role()='authenticated'`) + `anon insert whatsapp orders` (INSERT anon con `channel='whatsapp'`).

### Storage

**Bucket**: `barlovento-media` (público). Policies:
- `media public read` (SELECT)
- `media admin write` / `update` / `delete` (todas requieren `auth.role()='authenticated'`)

Convenciones de path:
- `products/<timestamp>-<safeName>.<ext>`
- `gallery/<timestamp>-<safeName>.<ext>`
- `events/<timestamp>-<safeName>.<ext>`
- `site/historia/<timestamp>-<safeName>.<ext>`

---

## 6. Flujos clave

### 6.1 Compra por WhatsApp
1. Usuario arma carrito en `CartDrawer` (state en `localStorage`).
2. Click en "Comprar por WhatsApp" → abre `wa.me/<phone>?text=<mensaje>`.
3. En paralelo, `captureWhatsAppOrder()` hace POST a `/api/orders/whatsapp` con `keepalive: true`. El server inserta el row con `channel='whatsapp'` y `status='pending'` vía service_role.

### 6.2 Compra por Mercado Pago
1. Click en "Pagar con Mercado Pago" → POST a `/api/checkout`.
2. Server arma Preference con items, payer, back_urls (`/checkout/success|failure|pending`).
3. Server inserta row en `orders` con `channel='mercadopago'`, `mp_preference_id`, `status='pending'` (vía service_role).
4. Devuelve `init_point` → cliente hace `window.location.href`.
5. Al volver, el `success|failure|pending` page muestra el estado (sin webhook configurado todavía para update status → paid).

### 6.3 Login y sesión
- `getBrowserSupabase` configura persistencia en `localStorage` con TTL 1 año y `autoRefreshToken: false`.
- El `Navbar` escucha `onAuthStateChange` y muestra "Iniciar sesión" o "Mi cuenta" según el estado.
- En `mi-cuenta`, server component llama `getUser()` y, si no hay user, redirige a `/login`.

### 6.4 Middleware de admin
- `web/middleware.ts` corre para todo `/admin/:path*`.
- Sin sesión y ruta admin no-login → redirect `/admin/login`.
- Con sesión pero `is_admin=false` → redirect `/admin/login?error=no_admin`.
- `app/admin/layout.tsx` re-chequea como defensa en profundidad.

### 6.5 Server Actions y archivos
Next.js no acepta `File` como argumento directo de un Server Action. **Todos los Server Actions que suben imágenes reciben `FormData`**, parsean los campos con `formData.get('xxx')` y leen el archivo con `formData.get('imageFile') as File | null`. Patrón usado en:
- `upsertProduct(formData)`
- `upsertGalleryItem(formData)`
- `upsertEvent(formData)`
- `uploadHistoryImage(formData)`

### 6.6 Lectura con fallback
`lib/queries.ts` envuelve cada query: si Supabase no está configurado (sin env vars) o falla, devuelve los JSON de `data/*.json`. Esto permite que el dev local funcione sin setup y que la home nunca rompa por una caída de DB.

---

## 7. Sistema de diseño

### Tokens de color (`tailwind.config.ts`)
| Token | Hex | Uso |
|---|---|---|
| `carbon` | `#0B0B0B` | Fondo principal |
| `carbon-raised` | `#1A1A1A` | Tarjetas, drawer |
| `carbon-line` | `#262626` | Bordes, separadores |
| `cream` | `#F5F1E6` | Superficies claras |
| `gold` | `#D4AF37` | Acentos primarios (CTA, links) |
| `gold-deep` | `#C9A227` | Hover/active |
| `gold-shadow` | `#8C6F1A` | Sombras |
| `gold-light` | `#E8C766` | Hover claro |
| `bone` | `#F5F5F0` | Texto principal sobre carbón |

### Tipografía
- **Display**: Cormorant Garamond (serif editorial, para titulares).
- **Body**: Inter (sans, para UI y párrafos).
- **Letter-spacing**: `tracking-ultra` = 0.35em (eyebrows y botones).

### Animaciones custom
- `gold-draw` (1.2s ease): dibuja una línea dorada (usado en hover de links).
- `fade-up` (0.9s): entrada de secciones.
- `soft-pulse` (3.5s loop): opacidad suave.
- `shimmer` (6s loop): gradiente en movimiento.

### Layout patterns
- `mx-auto max-w-7xl px-6 lg:px-10` para containers.
- `font-display` para H1/H2, `font-body` para el resto.
- Botones primarios: `bg-gold text-carbon rounded-full px-7 py-3`.
- Botones secundarios: `border border-gold/40 text-gold rounded-full`.

---

## 8. Historial de cambios recientes

### Sesión 2026-08-06
- **Fix Server Actions con File**: `upsertProduct/GalleryItem/Event` y `uploadHistoryImage` ahora reciben `FormData` (antes recibían `File` directo, lo que rompía el boundary client↔server). Refactor de `ProductoForm`, `EventosTable`, `GaleriaGrid`, `TextosEditor` para usar `new FormData()`.
- **Fix error boundary**: creado `app/error.tsx` (antes faltaba → "missing required error components").
- **Fix profile persistence**: `updateProfile` cambió de `.update().eq()` a `.upsert(..., { onConflict: 'user_id' })` para crear la fila si no existía (algunos users se loguean sin que el trigger de signup haya corrido).
- **Fix Navbar auth-aware**: detecta `userEmail` con `getUser()` + `onAuthStateChange`, cambia "Iniciar sesión" → "Mi cuenta" cuando hay sesión.
- **Fix admin panel button**: agregado `is_admin` a la policy de SELECT de `profiles` con función `SECURITY DEFINER` para evitar recursión de RLS.

### Fases del proyecto (acumulado)
- **Fase 1**: sitio estático con JSON local.
- **Fase 2**: Supabase + RLS + admin panel + storage.
- **Fase 3**: auth + profiles + customer_type + service role para orders.
- **Fase 4**: checkout Mercado Pago + captura WhatsApp.

---

## 9. Estado actual y temas abiertos

### 9.1 Botón "Panel admin" en /mi-cuenta
**Síntoma**: el usuario tiene `is_admin=true` en la DB pero el botón no se muestra en `/mi-cuenta`.

**Causa más probable** (en diagnóstico al 2026-08-06): RLS de `profiles` filtraba la fila para el user logueado. Se agregó policy con función `public.is_admin(uid) SECURITY DEFINER` para romper la recursión. Pendiente verificar:
- Confirmar que la policy quedó aplicada en la DB del usuario.
- Confirmar que la función `is_admin` devuelve `true` para su `auth.uid()`.
- Si el botón sigue sin aparecer tras el fix, mirar el JSON de la response a `/rest/v1/profiles` en Network de DevTools.

### 9.2 Falta webhook de Mercado Pago
Los orders quedan en `status='pending'` aunque el cliente pague. Falta implementar el endpoint que recibe la notificación de MP y hace update a `paid` (más `mp_payment_id`). Hoy el merchant confirma manualmente desde el panel de pedidos.

### 9.3 `customer_type` no se setea solo al signup
El default es `retail`. La promoción a `wholesale` la hace un admin desde `/admin/usuarios`. Está cubierto pero es flujo manual.

### 9.4 Sin tests automatizados
No hay ni unit ni integration tests. `next lint` corre pero no hay reglas custom ni CI.

### 9.5 Sin pipeline de deploy
El proyecto está pensado para Vercel pero no hay config específica más allá de las env vars. No hay GitHub Actions, ni preview deploys.

---

## 10. Comandos útiles

```bash
# Levantar el sitio
cd web && npm install && npm run dev

# Build de producción
cd web && npm run build && npm start

# Limpiar caché de Next (si hay 404 raros en chunks)
rm -rf web/.next

# Re-aplicar schema de Supabase (idempotente)
# Pegar supabase/setup-completo.sql en SQL Editor
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

Project ref: `gzoxqdmzrwjeuwqziazt`. Requiere auth con la cuenta Supabase del dueño al primer uso (re-abrir OpenClaude para que el server se conecte).

---

## 11. Convenciones del código

- **Server components por default**; client components solo cuando hace falta estado/efectos.
- **No usar `File` como argumento de Server Action** → siempre `FormData`.
- **No exponer `service_role` key al cliente** → solo en route handlers y server actions.
- **Toda query a Supabase con RLS** (excepto las que explícitamente usan service_role).
- **Fechas en formato ISO `YYYY-MM-DD` en DB**, formateo en el cliente con `toLocaleDateString('es-UY', ...)`.
- **Moneda por defecto UYU** (peso uruguayo). Formateo con `Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' })`.
- **Naming**: tablas y columnas en `snake_case`, tipos TS en `PascalCase`, funciones en `camelCase`, server actions exportadas en `camelCase` descriptivo.
- **Comentarios en español** dentro de los archivos `.ts/.tsx`. Mensajes de UI también en español (es-AR/es-UY).
- **Fallback JSON**: cualquier tabla nueva que se consulte en la home debería tener su JSON en `web/data/` para que dev local funcione sin setup.
