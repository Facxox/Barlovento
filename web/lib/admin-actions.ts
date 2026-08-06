'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from './supabase-server';
import { uploadImage, deleteImageByUrl } from './storage';
import type { Product, WholesaleProduct, GalleryItem, BarloventoEvent, SiteContent } from './queries';

// ----------------------------------------------------------------
// Auth helper
// ----------------------------------------------------------------
async function requireAdmin() {
  const supabase = await getServerSupabase();
  if (!supabase) throw new Error('Supabase no configurado.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado.');
  return supabase;
}

// ----------------------------------------------------------------
// Tipos de input
// ----------------------------------------------------------------
export type ProductoInput = {
  id?: string;
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

export type GalleryInput = {
  id?: number;
  title: string;
  category: 'elaboracion' | 'producto' | 'ferias';
  image: string;
  sort_order: number;
};

export type EventoInput = {
  id?: number;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
  kind: 'upcoming' | 'past';
};

// ----------------------------------------------------------------
// Products
// ----------------------------------------------------------------
/**
 * Recibe los datos del producto dentro de un FormData para que el `File`
 * viaje serializable (Next.js no acepta `File` como argumento directo
 * de un Server Action; sí lo acepta dentro de FormData).
 * Campos esperados:
 *   id, name, description, price, currency, category, image,
 *   badge, is_active, sort_order, imageFile (File | null)
 */
export async function upsertProduct(formData: FormData): Promise<Product> {
  const supabase = await requireAdmin();

  const input: ProductoInput = {
    id: (formData.get('id') as string) || undefined,
    name: (formData.get('name') as string) ?? '',
    description: (formData.get('description') as string) ?? '',
    price: Number(formData.get('price')),
    currency: (formData.get('currency') as string) || 'UYU',
    category: (formData.get('category') as string) ?? 'clasicos',
    image: (formData.get('image') as string) ?? '',
    badge: ((formData.get('badge') as string) || '').trim() || null,
    is_active: formData.get('is_active') === 'true',
    sort_order: Number(formData.get('sort_order') ?? 99),
  };
  const imageFile = formData.get('imageFile') as File | null;

  let imageUrl = input.image;
  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadImage(imageFile, 'products', input.image);
  }

  const payload: Product = {
    id: input.id ?? slugify(input.name),
    name: input.name,
    description: input.description,
    price: Number(input.price),
    currency: input.currency || 'UYU',
    category: input.category,
    image: imageUrl,
    badge: input.badge || null,
    is_active: input.is_active,
    sort_order: Number(input.sort_order),
  };

  const { data, error } = await supabase
    .from('products')
    .upsert(payload)
    .select()
    .single();

  if (error) throw new Error(`upsertProduct: ${error.message}`);

  // Limpia la imagen vieja si fue reemplazada.
  if (imageFile && imageFile.size > 0 && input.image && input.image !== imageUrl) {
    await deleteImageByUrl(input.image);
  }

  revalidatePath('/');
  revalidatePath('/admin/productos');
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await requireAdmin();
  const { data: row } = await supabase
    .from('products')
    .select('image')
    .eq('id', id)
    .single();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(`deleteProduct: ${error.message}`);
  if (row?.image) await deleteImageByUrl(row.image);
  revalidatePath('/');
  revalidatePath('/admin/productos');
}

export async function toggleProductActive(id: string): Promise<void> {
  const supabase = await requireAdmin();
  const { data: row } = await supabase
    .from('products')
    .select('is_active')
    .eq('id', id)
    .single();
  if (!row) return;
  const { error } = await supabase
    .from('products')
    .update({ is_active: !row.is_active })
    .eq('id', id);
  if (error) throw new Error(`toggleProductActive: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/productos');
}

export async function reorderProducts(orderedIds: string[]): Promise<void> {
  const supabase = await requireAdmin();
  // Asigna sort_order según la posición (1-based).
  const updates = orderedIds.map((id, idx) =>
    supabase
      .from('products')
      .update({ sort_order: idx + 1 })
      .eq('id', id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`reorderProducts: ${failed.error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/productos');
}

// ----------------------------------------------------------------
// Wholesale products
// ----------------------------------------------------------------
/**
 * Igual que `upsertProduct` pero escribe en `wholesale_products`.
 * El campo price puede llegar en 0 (es lo que produce el botón
 * "Clonar a mayorista" en ProductosTable).
 */
export async function upsertWholesaleProduct(
  formData: FormData
): Promise<WholesaleProduct> {
  const supabase = await requireAdmin();

  const input = {
    id: (formData.get('id') as string) || undefined,
    name: (formData.get('name') as string) ?? '',
    description: (formData.get('description') as string) ?? '',
    price: Number(formData.get('price')),
    currency: (formData.get('currency') as string) || 'UYU',
    category: (formData.get('category') as string) ?? 'clasicos',
    image: (formData.get('image') as string) ?? '',
    badge: ((formData.get('badge') as string) || '').trim() || null,
    is_active: formData.get('is_active') === 'true',
    sort_order: Number(formData.get('sort_order') ?? 99),
  };
  const imageFile = formData.get('imageFile') as File | null;

  let imageUrl = input.image;
  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadImage(imageFile, 'products', input.image);
  }

  const payload: WholesaleProduct = {
    id: input.id ?? slugify(input.name),
    name: input.name,
    description: input.description,
    price: Number(input.price),
    currency: input.currency || 'UYU',
    category: input.category,
    image: imageUrl,
    badge: input.badge || null,
    is_active: input.is_active,
    sort_order: Number(input.sort_order),
  };

  const { data, error } = await supabase
    .from('wholesale_products')
    .upsert(payload)
    .select()
    .single();
  if (error) throw new Error(`upsertWholesaleProduct: ${error.message}`);

  if (imageFile && imageFile.size > 0 && input.image && input.image !== imageUrl) {
    await deleteImageByUrl(input.image);
  }

  revalidatePath('/admin/productos');
  return data as WholesaleProduct;
}

export async function deleteWholesaleProduct(id: string): Promise<void> {
  const supabase = await requireAdmin();
  const { data: row } = await supabase
    .from('wholesale_products')
    .select('image')
    .eq('id', id)
    .single();
  const { error } = await supabase
    .from('wholesale_products')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`deleteWholesaleProduct: ${error.message}`);
  if (row?.image) await deleteImageByUrl(row.image);
  revalidatePath('/admin/productos');
}

export async function toggleWholesaleProductActive(id: string): Promise<void> {
  const supabase = await requireAdmin();
  const { data: row } = await supabase
    .from('wholesale_products')
    .select('is_active')
    .eq('id', id)
    .single();
  if (!row) return;
  const { error } = await supabase
    .from('wholesale_products')
    .update({ is_active: !row.is_active })
    .eq('id', id);
  if (error) throw new Error(`toggleWholesaleProductActive: ${error.message}`);
  revalidatePath('/admin/productos');
}

export async function reorderWholesaleProducts(
  orderedIds: string[]
): Promise<void> {
  const supabase = await requireAdmin();
  const updates = orderedIds.map((id, idx) =>
    supabase
      .from('wholesale_products')
      .update({ sort_order: idx + 1 })
      .eq('id', id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error)
    throw new Error(`reorderWholesaleProducts: ${failed.error.message}`);
  revalidatePath('/admin/productos');
}

/**
 * Clona un producto minorista (`products`) a mayorista (`wholesale_products`).
 * Copia todos los campos excepto `price` (queda en 0 para que el admin lo
 * edite después). El id resultante es `${sourceId}-ws` para evitar colisión
 * de PK; si ya existe uno con ese id lo sobreescribe (idempotente).
 *
 * Devuelve el id del nuevo producto mayorista para que la UI pueda
 * navegar a su editor (`/admin/productos/${id}?type=wholesale`).
 */
export async function cloneProductToWholesale(
  sourceId: string
): Promise<string> {
  const supabase = await requireAdmin();
  const { data: source, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', sourceId)
    .single();
  if (error || !source)
    throw new Error(
      `cloneProductToWholesale: producto origen no encontrado (${sourceId}).`
    );

  // Calculamos el siguiente sort_order (al final de la lista mayorista).
  const { data: lastRow } = await supabase
    .from('wholesale_products')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = lastRow?.sort_order ? Number(lastRow.sort_order) + 1 : 1;

  const newId = `${sourceId}-ws`;
  const payload: WholesaleProduct = {
    id: newId,
    name: source.name,
    description: source.description,
    price: 0,
    currency: source.currency,
    category: source.category,
    image: source.image,
    badge: source.badge,
    is_active: true,
    sort_order: nextSort,
  };

  const { error: insertError } = await supabase
    .from('wholesale_products')
    .upsert(payload);
  if (insertError)
    throw new Error(`cloneProductToWholesale: ${insertError.message}`);

  revalidatePath('/admin/productos');
  return newId;
}

// ----------------------------------------------------------------
// Gallery
// ----------------------------------------------------------------
/**
 * Recibe los datos dentro de FormData (el `File` debe viajar en FormData,
 * no como argumento directo). Campos:
 *   id (opcional), title, category, image (URL previa), sort_order, imageFile
 */
export async function upsertGalleryItem(
  formData: FormData
): Promise<GalleryItem> {
  const supabase = await requireAdmin();

  const input: GalleryInput = {
    id: formData.get('id') ? Number(formData.get('id')) : undefined,
    title: (formData.get('title') as string) ?? '',
    category: (formData.get('category') as GalleryInput['category']) ?? 'elaboracion',
    image: (formData.get('image') as string) ?? '',
    sort_order: Number(formData.get('sort_order') ?? 0),
  };
  const imageFile = formData.get('imageFile') as File | null;

  let imageUrl = input.image;
  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadImage(imageFile, 'gallery', input.image);
  }

  const payload = {
    ...(input.id ? { id: input.id } : {}),
    title: input.title,
    category: input.category,
    image: imageUrl,
    sort_order: Number(input.sort_order),
  };

  const { data, error } = await supabase
    .from('gallery_items')
    .upsert(payload)
    .select()
    .single();
  if (error) throw new Error(`upsertGalleryItem: ${error.message}`);

  if (imageFile && imageFile.size > 0 && input.image && input.image !== imageUrl) {
    await deleteImageByUrl(input.image);
  }

  revalidatePath('/');
  revalidatePath('/admin/galeria');
  return data as GalleryItem;
}

export async function deleteGalleryItem(id: number): Promise<void> {
  const supabase = await requireAdmin();
  const { data: row } = await supabase
    .from('gallery_items')
    .select('image')
    .eq('id', id)
    .single();
  const { error } = await supabase.from('gallery_items').delete().eq('id', id);
  if (error) throw new Error(`deleteGalleryItem: ${error.message}`);
  if (row?.image) await deleteImageByUrl(row.image);
  revalidatePath('/');
  revalidatePath('/admin/galeria');
}

// ----------------------------------------------------------------
// Events
// ----------------------------------------------------------------
/**
 * Recibe los datos del evento dentro de FormData (File debe viajar
 * serializable). Campos:
 *   id (opcional), title, date, location, description, image (URL previa),
 *   kind, imageFile
 */
export async function upsertEvent(formData: FormData): Promise<BarloventoEvent> {
  const supabase = await requireAdmin();

  const input: EventoInput = {
    id: formData.get('id') ? Number(formData.get('id')) : undefined,
    title: (formData.get('title') as string) ?? '',
    date: (formData.get('date') as string) ?? '',
    location: (formData.get('location') as string) ?? '',
    description: (formData.get('description') as string) ?? '',
    image: (formData.get('image') as string) ?? '',
    kind: (formData.get('kind') as 'upcoming' | 'past') ?? 'upcoming',
  };
  const imageFile = formData.get('imageFile') as File | null;

  let imageUrl = input.image;
  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadImage(imageFile, 'events', input.image);
  }

  const payload = {
    ...(input.id ? { id: input.id } : {}),
    title: input.title,
    date: input.date,
    location: input.location,
    description: input.description,
    image: imageUrl,
    kind: input.kind,
  };
  const { data, error } = await supabase
    .from('events')
    .upsert(payload)
    .select()
    .single();
  if (error) throw new Error(`upsertEvent: ${error.message}`);

  if (imageFile && imageFile.size > 0 && input.image && input.image !== imageUrl) {
    await deleteImageByUrl(input.image);
  }

  revalidatePath('/');
  revalidatePath('/admin/eventos');
  return data as BarloventoEvent;
}

export async function deleteEvent(id: number): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error(`deleteEvent: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/eventos');
}

// ----------------------------------------------------------------
// Site content (historia / mision / vision / contacto)
// ----------------------------------------------------------------
export async function upsertSiteContent(
  key: keyof SiteContent,
  value: SiteContent[keyof SiteContent]
): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from('site_content')
    .upsert({ key, value });
  if (error) throw new Error(`upsertSiteContent: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/textos');
}

/**
 * Sube una imagen para la sección Historia y devuelve la URL pública.
 * Se usa desde TextosEditor para reemplazar el input "URL de imagen".
 * El File viaja dentro de FormData (no se puede pasar File como argumento
 * directo de un Server Action).
 */
export async function uploadHistoryImage(formData: FormData): Promise<string> {
  await requireAdmin();
  const file = formData.get('imageFile') as File | null;
  if (!file || file.size === 0) {
    throw new Error('No se recibió ninguna imagen.');
  }
  const url = await uploadImage(file, 'site/historia');
  revalidatePath('/');
  revalidatePath('/admin/textos');
  return url;
}

// ----------------------------------------------------------------
// Usuarios (customer_type: retail / wholesale)
// ----------------------------------------------------------------
async function requireAdminStrict() {
  const supabase = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user!.id)
    .maybeSingle();
  if (!profile?.is_admin) throw new Error('No autorizado (admin requerido).');
  return supabase;
}

export type CustomerType = 'retail' | 'wholesale';

/**
 * Cambia el customer_type de un usuario. Solo admin puede llamarlo.
 * El usuario común NO puede llamarlo aunque conozca el server action:
 * la policy RLS "profiles self-update" no incluye esta columna.
 */
export async function updateCustomerType(
  userId: string,
  type: CustomerType
): Promise<void> {
  const supabase = await requireAdminStrict();
  const { error } = await supabase
    .from('profiles')
    .update({ customer_type: type })
    .eq('user_id', userId);
  if (error) throw new Error(`updateCustomerType: ${error.message}`);
  revalidatePath('/admin/usuarios');
  revalidatePath('/mi-cuenta');
}

// ----------------------------------------------------------------
// Utils
// ----------------------------------------------------------------
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}