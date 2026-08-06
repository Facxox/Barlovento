import 'server-only';
import { getServerSupabase } from './supabase-server';
import productsJson from '@/data/products.json';
import galleryJson from '@/data/gallery.json';
import eventsJson from '@/data/events.json';
import siteContentJson from '@/data/site-content.json';

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
};

/**
 * Mismo shape que Product pero lee de `wholesale_products`.
 * Los mayoristas SIEMPRE coordinan por WhatsApp, así que el storefront
 * público no la consume — solo el panel admin.
 */
export type WholesaleProduct = Product;

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
  image: string;
  kind: 'upcoming' | 'past';
};

export type SiteContent = {
  historia: {
    eyebrow: string;
    headline: string;
    body: string[];
    image: string;
    image_caption: string | null;
  };
  mision: { eyebrow: string; headline: string; body: string };
  vision:  { eyebrow: string; headline: string; body: string };
  valores: {
    eyebrow: string;
    headline: string;
    items: { title: string; body: string }[];
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

export async function getGallery(): Promise<GalleryItem[]> {
  const fallback = [...galleryJson].sort(
    (a, b) => a.sort_order - b.sort_order
  ) as GalleryItem[];
  return fromSupabase<GalleryItem[]>('gallery_items', 'sort_order', fallback);
}

export async function getEvents(): Promise<BarloventoEvent[]> {
  const fallback = [...eventsJson] as BarloventoEvent[];
  // upcoming primero, luego past; dentro de cada grupo, por fecha.
  return fallback.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'upcoming' ? -1 : 1;
    return a.date.localeCompare(b.date);
  });
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
    return {
      historia: map.historia ?? fallback.historia,
      mision:   map.mision   ?? fallback.mision,
      vision:   map.vision   ?? fallback.vision,
      valores:  map.valores  ?? fallback.valores,
      contacto: map.contacto ?? fallback.contacto,
    };
  } catch {
    return fallback;
  }
}