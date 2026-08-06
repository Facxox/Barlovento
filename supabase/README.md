# Supabase · Barlovento

## Setup (una sola vez)

1. **Crear proyecto** en https://supabase.com
2. Ir a **SQL Editor** y correr en este orden:
   - `supabase/migrations/0001_init.sql` (tablas + RLS + storage)
   - `supabase/seed.sql` (datos iniciales)
3. Crear un **usuario admin** en *Authentication > Users* (email + password).
4. En Vercel/local: setear las env vars listadas en `web/.env.example`.

## Estructura

| Tabla | Contenido | Lectura pública |
|---|---|---|
| `products` | Catálogo con `is_active`, `sort_order` | solo `is_active = true` |
| `gallery_items` | Fotos categorizadas | sí |
| `events` | Próximos y pasados (`kind`) | sí |
| `site_content` | Textos editables key→jsonb (historia/misión/visión/contacto) | sí |
| `orders` | Pedidos MP + WhatsApp | solo admin |

## Bucket

- `barlovento-media` (público para lectura, escritura solo autenticado).
  Las imágenes del admin se suben acá y devuelven una URL pública.

## Fase 3 (próxima)

El panel `/admin` usará `@supabase/ssr` con cookies de sesión, y todos los
CRUDs irán contra estas tablas con el usuario admin autenticado.