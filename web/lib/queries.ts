import 'server-only';
import { getServerSupabase } from './supabase-server';
import productsJson from '@/data/products.json';
import galleryJson from '@/data/gallery.json';
import galleryCategoriesJson from '@/data/gallery-categories.json';
import eventsJson from '@/data/events.json';
import siteContentJson from '@/data/site-content.json';
import categoriesJson from '@/data/categories.json';

// ----------------------------------------------------------------
// Tipos — alineados 1:1 al esquema SQL en supabase/migrations/0001_init.sql
// ----------------------------------------------------------------

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  image: string;
  badge: string | null;
  is_active: boolean;
  sort_order: number;
  nutrition: Nutrition | null;
};

/**
 * Mismo shape que Product pero lee de `wholesale_products`.
 * Los mayoristas SIEMPRE coordinan por WhatsApp, así que el storefront
 * público no la consume — solo el panel admin.
 */
export type WholesaleProduct = Product;

/**
 * Información nutricional tipo packaging.
 *
 * Soporta dos shapes compatibles:
 *  - Bloque viejo (`rows[]`): el admin lo carga fila por fila.
 *  - Bloque nuevo (campos planos): usado por los alfajores con tabla
 *    nutricional estilo packaging. Si está presente y completo, el
 *    `NutritionTable` lo renderiza con macros, valor energético y
 *    octógonos de rotulado.
 *
 * Los campos del bloque nuevo son todos opcionales; si ninguno tiene
 * valor, el producto no muestra tabla nutricional.
 */
export type Nutrition = {
  portion: string;
  servings_per_package: number | null;
  rows: { nutrient: string; amount: string; dv: string }[];

  // Bloque extendido (opcional)
  kcal?: number | null;
  kj?: number | null;
  carbs_g?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  saturated_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
  trans_g?: number | null;
  /** Etiquetas de octógonos (ej. "Exceso Azúcar"). Lista vacía = sin advertencias. */
  warning_labels?: string[] | null;
};

export type Category = {
  id: string;            // slug — se guarda en products.category / wholesale_products.category
  label: string;         // nombre legible
  sort_order: number;
  is_active: boolean;
};

/**
 * Categorías de la galería. Misma forma que `Category`, pero vive en
 * una tabla separada (`gallery_categories`) para no mezclarse con las
 * categorías de producto. El slug se guarda en `gallery_items.category`.
 */
export type GalleryCategory = {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export type GalleryItem = {
  id: number;
  title: string;
  category: 'elaboracion' | 'producto' | 'ferias' | string;
  image: string;
  sort_order: number;
};

export type BarloventoEvent = {
  id: number;
  title: string;
  date: string;          // ISO yyyy-mm-dd
  location: string;
  description: string;
  /** Portada. Se mantiene igual a images[0] (se escribe al subir
   *  la primera foto o al promover una nueva portada). */
  image: string;
  /** Todas las fotos del evento, ordenadas por position asc. */
  images: string[];
  kind: 'upcoming' | 'past';
};

export type SiteContent = {
  historia: {
    eyebrow: string;
    headline: string;
    body: string[];
    image: string;
    image_caption: string | null;
    /** Múltiples imágenes para la sección Historia. La primera es la
     *  principal. Las imágenes se suben desde el admin (TextosEditor). */
    images: { url: string; caption: string | null }[];
  };
  hero: {
    eyebrow: string;
    headline: string;
    intro: string;
    cta_label: string;
    cta_href: string;
    background_image: string;
  };
  mision: { eyebrow: string; headline: string; body: string };
  vision:  { eyebrow: string; headline: string; body: string };
  valores: {
    eyebrow: string;
    headline: string;
    items: { title: string; body: string }[];
  };
  puntos_venta: {
    eyebrow: string;
    headline: string;
    intro: string;
    departamentos: string[];
  };
  regalos_empresariales: {
    eyebrow: string;
    headline: string;
    body: string;
    items: { title: string; body: string }[];
    cta: string;
  };
  mayoristas: {
    eyebrow: string;
    headline: string;
    intro: string;
    beneficios: string[];
    requisitos: string[];
  };
  contacto: {
    whatsapp: string;
    email: string;
    direccion: string;
    instagram: string;
    facebook: string;
    horarios: string;
  };
};

// ----------------------------------------------------------------
// Queries con fallback automático
//
// Si las env vars de Supabase no están seteadas, los componentes
// siguen funcionando contra data/*.json — así el dev local anda
// sin tener que crear el proyecto antes. En prod (Vercel), basta
// con setear las env vars y se conecta solo.
// ----------------------------------------------------------------

async function fromSupabase<T>(
  table: string,
  orderBy: string,
  fallback: T,
  extra?: (q: any) => any
): Promise<T> {
  const supabase = await getServerSupabase();
  if (!supabase) return fallback;
  try {
    let q = supabase.from(table).select('*').order(orderBy, { ascending: true });
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error || !data) return fallback;
    return data as T;
  } catch {
    return fallback;
  }
}

export async function getProducts(): Promise<Product[]> {
  const fallback = productsJson
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order) as Product[];
  return fromSupabase<Product[]>(
    'products',
    'sort_order',
    fallback,
    (q) => q.eq('is_active', true)
  );
}

/**
 * Catálogo mayorista. Solo lo consume el panel admin; el storefront
 * público (`Tienda`) sigue leyendo `getProducts()`.
 * Fallback: lista vacía — todavía no hay JSON de fallback porque no
 * existen productos mayoristas en el repo de data/.
 */
export async function getWholesaleProducts(): Promise<WholesaleProduct[]> {
  return fromSupabase<WholesaleProduct[]>(
    'wholesale_products',
    'sort_order',
    []
  );
}

/**
 * Lista administrable de categorías de alfajores. La fuente de verdad es la
 * tabla `categories`; si Supabase no está configurado o la tabla no existe,
 * cae al JSON local para que el dev local siga andando.
 */
export async function getCategories(): Promise<Category[]> {
  const fallback = [...categoriesJson].sort(
    (a, b) => a.sort_order - b.sort_order
  ) as Category[];
  return fromSupabase<Category[]>(
    'categories',
    'sort_order',
    fallback
  );
}

/**
 * Categorías de la galería. Mismo patrón que `getCategories` pero sobre
 * la tabla `gallery_categories`. El fallback (`gallery-categories.json`)
 * mantiene las 3 categorías originales mientras no haya Supabase.
 */
export async function getGalleryCategories(): Promise<GalleryCategory[]> {
  const fallback = [...galleryCategoriesJson].sort(
    (a, b) => a.sort_order - b.sort_order
  ) as GalleryCategory[];
  return fromSupabase<GalleryCategory[]>(
    'gallery_categories',
    'sort_order',
    fallback
  );
}

export async function getGallery(): Promise<GalleryItem[]> {
  const fallback = [...galleryJson].sort(
    (a, b) => a.sort_order - b.sort_order
  ) as GalleryItem[];
  return fromSupabase<GalleryItem[]>('gallery_items', 'sort_order', fallback);
}

export async function getEvents(): Promise<BarloventoEvent[]> {
  const fallback = [...eventsJson].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'upcoming' ? -1 : 1;
    return a.date.localeCompare(b.date);
  }) as BarloventoEvent[];

  const events = await fromSupabase<BarloventoEvent[]>(
    'events',
    'date',
    fallback
  );

  // Merge con event_images. Si no hay Supabase o no hay fotos,
  // devolvemos [image] como único elemento para no romper consumers.
  const supabase = await getServerSupabase();
  if (!supabase) {
    return events.map((e) => ({ ...e, images: [e.image] }));
  }
  try {
    const { data: rows, error } = await supabase
      .from('event_images')
      .select('event_id,url,position')
      .order('position', { ascending: true });
    if (error || !rows) {
      return events.map((e) => ({ ...e, images: [e.image] }));
    }
    const byEvent = new Map<number, string[]>();
    for (const r of rows as Array<{
      event_id: number;
      url: string;
      position: number;
    }>) {
      const arr = byEvent.get(r.event_id) ?? [];
      arr.push(r.url);
      byEvent.set(r.event_id, arr);
    }
    return events.map((e) => ({
      ...e,
      images: byEvent.get(e.id)?.length ? byEvent.get(e.id)! : [e.image],
    }));
  } catch {
    return events.map((e) => ({ ...e, images: [e.image] }));
  }
}

export async function getSiteContent(): Promise<SiteContent> {
  const fallback = siteContentJson as SiteContent;
  const supabase = await getServerSupabase();
  if (!supabase) return fallback;
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('key, value');
    if (error || !data) return fallback;
    const map: Record<string, any> = {};
    for (const row of data) map[row.key] = row.value;
    // Solo sobreescribimos si la fila existe en Supabase. Si está vacío,
    // mantenemos el JSON como base.
    const dbHistoria = map.historia as
      | (Partial<SiteContent['historia']> & { images?: SiteContent['historia']['images'] })
      | undefined;
    const mergedHistoria: SiteContent['historia'] = dbHistoria
      ? { ...fallback.historia, ...dbHistoria, images: dbHistoria.images ?? fallback.historia.images }
      : fallback.historia;
    return {
      historia: mergedHistoria,
      hero: (map.hero as SiteContent['hero']) ?? fallback.hero,
      mision:   map.mision   ?? fallback.mision,
      vision:   map.vision   ?? fallback.vision,
      valores:  map.valores  ?? fallback.valores,
      puntos_venta:         map.puntos_venta         ?? fallback.puntos_venta,
      regalos_empresariales: map.regalos_empresariales ?? fallback.regalos_empresariales,
      mayoristas:           map.mayoristas           ?? fallback.mayoristas,
      contacto: map.contacto ?? fallback.contacto,
    };
  } catch {
    return fallback;
  }
}