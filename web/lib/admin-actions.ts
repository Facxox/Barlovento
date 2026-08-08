'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from './supabase-server';
import { getServiceSupabase } from './supabase-admin';
import { uploadImage, deleteImageByUrl } from './storage';
import type { Product, WholesaleProduct, GalleryItem, BarloventoEvent, SiteContent, Nutrition } from './queries';

// ----------------------------------------------------------------
// Auth helper
// ----------------------------------------------------------------
/**
 * Resuelve el usuario autenticado y verifica que sea admin.
 * Devuelve el cliente service-role para que las mutaciones de las
 * acciones administrativas no queden atrapadas por RLS (en particular
 * la policy `wholesale_products admin write` exige EXISTS contra
 * profiles y devuelve false si la sesión se invalida parcialmente).
 */
async function requireAdmin() {
  // Cliente autenticado para validar la sesión del usuario.
  const authed = await getServerSupabase();
  if (!authed) throw new Error('Supabase no configurado.');
  const { data: { user } } = await authed.auth.getUser();
  if (!user) throw new Error('No autenticado.');

  // Verificamos is_admin con el cliente service-role para evitar que
  // RLS de `profiles` oculte la fila del admin. El middleware ya
  // bloquea el acceso; este chequeo es defensa en profundidad.
  const service = getServiceSupabase();
  if (service) {
    const { data: profile } = await service
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile && profile.is_admin !== true) {
      throw new Error('No autorizado.');
    }
  }

  // Si por algún motivo no hay service-role disponible, caemos al
  // cliente autenticado. Las mutaciones pueden fallar por RLS en
  // algunos casos, pero sólo en entornos sin la key configurada.
  return service ?? authed;
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
  nutrition: Nutrition | null;
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
 *   badge, is_active, sort_order, nutrition, imageFile (File | null)
 *
 * Nutrition: se envía como JSON string en el campo `nutrition_json`.
 * Si el JSON está vacío o no se puede parsear, se guarda como NULL.
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
    nutrition: parseNutritionField(formData.get('nutrition_json') as string | null),
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
    nutrition: input.nutrition,
  };

  // Si es un producto nuevo, lo ubicamos al final de la lista. El admin
  // lo reordena después con las flechas ▲▼ de la tabla.
  if (!input.id) {
    const { data: lastRow } = await supabase
      .from('products')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    input.sort_order = lastRow?.sort_order ? Number(lastRow.sort_order) + 1 : 1;
  }

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

/**
 * Mueve un producto una posición arriba o abajo en el listado. Intercambia
 * sort_order con su vecino inmediato. No-op si está en un extremo.
 */
export async function moveProduct(
  id: string,
  dir: -1 | 1
): Promise<void> {
  await swapAdjacent('products', 'id', id, dir);
  revalidatePath('/');
  revalidatePath('/admin/productos');
}

export async function moveWholesaleProduct(
  id: string,
  dir: -1 | 1
): Promise<void> {
  await swapAdjacent('wholesale_products', 'id', id, dir);
  revalidatePath('/admin/productos');
}

/**
 * Swap genérico entre dos filas adyacentes ordenadas por sort_order.
 * Usado por las acciones `move*` de cada tabla.
 *
 * Estrategia: movemos ambos registros a valores temporales negativos para
 * evitar pisar el sort_order del otro durante la transacción, y luego
 * asignamos los valores definitivos.
 *
 * Dispatch sobre `table` porque las cinco tablas tienen tipos de Row
 * distintos y supabase-js no acepta un union genérico en `.from()`.
 */
async function swapAdjacent(
  table: 'products' | 'wholesale_products' | 'categories' | 'gallery_items' | 'gallery_categories' | 'events',
  pkCol: string,
  id: string | number,
  dir: -1 | 1
): Promise<void> {
  switch (table) {
    case 'products':
      return swapAdjacentImpl('products', pkCol, id as string, dir, 'id');
    case 'wholesale_products':
      return swapAdjacentImpl('wholesale_products', pkCol, id as string, dir, 'id');
    case 'categories':
      return swapAdjacentImpl('categories', pkCol, id as string, dir, 'id');
    case 'gallery_items':
      return swapAdjacentImpl('gallery_items', pkCol, id as number, dir, 'id');
    case 'gallery_categories':
      return swapAdjacentImpl('gallery_categories', pkCol, id as string, dir, 'id');
    case 'events':
      return swapAdjacentImpl('events', pkCol, id as number, dir, 'id');
  }
}

type TableName =
  | 'products'
  | 'wholesale_products'
  | 'categories'
  | 'gallery_items'
  | 'gallery_categories'
  | 'events';

async function swapAdjacentImpl<T extends TableName>(
  table: T,
  pkCol: string,
  id: string | number,
  dir: -1 | 1,
  _pk: 'id' // sólo para satisfacer el tipado de supabase-js
): Promise<void> {
  const supabase = await requireAdmin();

  const sourceRes = await supabase
    .from(table)
    .select('*')
    .eq(pkCol, id)
    .maybeSingle();
  if (sourceRes.error || !sourceRes.data) return;
  const source = sourceRes.data as Record<string, unknown> & { sort_order: number };
  const sourcePkVal = source[pkCol];

  const baseQuery = supabase
    .from(table)
    .select('*')
    .order('sort_order', { ascending: dir === 1 })
    .limit(1);
  const neighborQuery =
    dir === -1
      ? baseQuery.lt('sort_order', source.sort_order)
      : baseQuery.gt('sort_order', source.sort_order);

  const neighborRes = await neighborQuery.maybeSingle();
  if (neighborRes.error || !neighborRes.data) return;
  const nb = neighborRes.data as Record<string, unknown> & { sort_order: number };
  const nbPkVal = nb[pkCol];

  const tempA = -source.sort_order - 1;
  const tempB = -nb.sort_order - 1;

  const upd = async (colVal: unknown, sortTemp: number) => {
    const { error } = await supabase
      .from(table)
      .update({ sort_order: sortTemp })
      .eq(pkCol, colVal as string | number);
    if (error) throw new Error(`swapAdjacent[${table}]: ${error.message}`);
  };

  await upd(sourcePkVal, tempA);
  await upd(nbPkVal, tempB);
  await upd(sourcePkVal, nb.sort_order);
  await upd(nbPkVal, source.sort_order);
}

export async function moveCategory(
  id: string,
  dir: -1 | 1
): Promise<void> {
  await swapAdjacent('categories', 'id', id, dir);
  revalidatePath('/');
  revalidatePath('/admin/categorias');
  revalidatePath('/admin/productos');
}

// ----------------------------------------------------------------
// Gallery categories (separadas de las categorías de producto)
// ----------------------------------------------------------------
export async function upsertGalleryCategory(formData: FormData): Promise<void> {
  const supabase = await requireAdmin();

  const id = ((formData.get('id') as string) ?? '').trim();
  const label = ((formData.get('label') as string) ?? '').trim();
  if (!id) throw new Error('Falta el slug de la categoría.');
  if (!label) throw new Error('Falta el nombre visible.');
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error('El slug solo puede tener minúsculas, números y guiones.');
  }

  const sort_order = Number(formData.get('sort_order') ?? 0);
  const is_active = formData.get('is_active') === 'true';

  const { error } = await supabase
    .from('gallery_categories')
    .upsert({ id, label, sort_order, is_active, updated_at: now() });
  if (error) throw new Error(`upsertGalleryCategory: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/categorias-galeria');
  revalidatePath('/admin/galeria');
  revalidatePath('/admin/productos'); // la nav puede usar el mismo árbol
}

export async function deleteGalleryCategory(id: string): Promise<void> {
  const supabase = await requireAdmin();

  const { count } = await supabase
    .from('gallery_items')
    .select('id', { count: 'exact', head: true })
    .eq('category', id);
  if ((count ?? 0) > 0) {
    throw new Error(
      `No se puede borrar: hay ${count} foto(s) con esta categoría. Reasignálos primero.`
    );
  }

  const { error } = await supabase
    .from('gallery_categories')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`deleteGalleryCategory: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/categorias-galeria');
  revalidatePath('/admin/galeria');
}

export async function toggleGalleryCategoryActive(
  id: string,
  isActive: boolean
): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from('gallery_categories')
    .update({ is_active: isActive, updated_at: now() })
    .eq('id', id);
  if (error) throw new Error(`toggleGalleryCategoryActive: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/categorias-galeria');
}

export async function moveGalleryCategory(
  id: string,
  dir: -1 | 1
): Promise<void> {
  await swapAdjacent('gallery_categories', 'id', id, dir);
  revalidatePath('/');
  revalidatePath('/admin/categorias-galeria');
  revalidatePath('/admin/galeria');
}

export async function moveGalleryItem(
  id: number,
  dir: -1 | 1
): Promise<void> {
  await swapAdjacent('gallery_items', 'id', id, dir);
  revalidatePath('/');
  revalidatePath('/admin/galeria');
}

export async function moveEvent(
  id: number,
  dir: -1 | 1
): Promise<void> {
  await swapAdjacent('events', 'id', id, dir);
  revalidatePath('/');
  revalidatePath('/admin/eventos');
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
    nutrition: parseNutritionField(formData.get('nutrition_json') as string | null),
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
    nutrition: input.nutrition,
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
    nutrition: ((source as { nutrition?: unknown }).nutrition ??
      null) as WholesaleProduct['nutrition'] | null,
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

/**
 * Sube una foto para un evento. La guarda en Storage bajo
 * `events/{eventId}/{timestamp}.ext` y crea una fila en event_images
 * con position = max(position)+1.
 *
 * Si el evento todavía no tiene portada (`events.image` vacío), la
 * nueva foto pasa a ser la portada.
 */
export async function addEventImage(
  eventId: number,
  file: File
): Promise<{ id: number; url: string }> {
  const supabase = await requireAdmin();

  // Verificamos que el evento exista.
  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('id,image')
    .eq('id', eventId)
    .single();
  if (evErr || !ev) throw new Error('Evento no encontrado.');

  // Subimos al storage. Usamos el path del evento para mantener orden.
  const url = await uploadImage(file, `events/${eventId}`);

  // Calculamos position.
  const { data: maxRow } = await supabase
    .from('event_images')
    .select('position')
    .eq('event_id', eventId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (maxRow?.position ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from('event_images')
    .insert({ event_id: eventId, url, position: nextPos })
    .select('id,url')
    .single();
  if (error || !inserted) throw new Error(`addEventImage: ${error?.message ?? 'insert_failed'}`);

  // Si no había portada, esta pasa a ser la portada.
  if (!ev.image) {
    await supabase.from('events').update({ image: url }).eq('id', eventId);
  }

  revalidatePath('/');
  revalidatePath('/admin/eventos');
  return inserted as { id: number; url: string };
}

/**
 * Borra una imagen de un evento. Si era la portada (`position = 0`),
 * promueve la siguiente imagen (si existe) como nueva portada y
 * actualiza `events.image`.
 */
export async function removeEventImage(imageId: number): Promise<void> {
  const supabase = await requireAdmin();

  const { data: row, error: getErr } = await supabase
    .from('event_images')
    .select('id,event_id,url,position')
    .eq('id', imageId)
    .single();
  if (getErr || !row) throw new Error('Imagen no encontrada.');

  const { error: delErr } = await supabase
    .from('event_images')
    .delete()
    .eq('id', imageId);
  if (delErr) throw new Error(`removeEventImage: ${delErr.message}`);

  // Borramos el archivo del storage (best-effort).
  await deleteImageByUrl(row.url).catch(() => undefined);

  // Si era la portada, buscamos la siguiente.
  if (row.position === 0) {
    const { data: next } = await supabase
      .from('event_images')
      .select('url')
      .eq('event_id', row.event_id)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();
    await supabase
      .from('events')
      .update({ image: next?.url ?? '' })
      .eq('id', row.event_id);
  }

  revalidatePath('/');
  revalidatePath('/admin/eventos');
}

/**
 * Reordena las imágenes de un evento. `orderedIds` es la lista de
 * image_id en el nuevo orden (0..N-1). Solo afecta filas del evento
 * dado.
 */
export async function reorderEventImages(
  eventId: number,
  orderedIds: number[]
): Promise<void> {
  const supabase = await requireAdmin();

  // Verificamos que la cantidad coincida con la realidad para no
  // dejar la tabla inconsistente.
  const { count } = await supabase
    .from('event_images')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if ((count ?? 0) !== orderedIds.length) {
    throw new Error('Cantidad de imágenes no coincide.');
  }

  // Update en batch. No es atómico pero Supabase los procesa
  // secuencialmente y al ser admin-only no genera conflicto.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('event_images')
      .update({ position: i })
      .eq('id', orderedIds[i])
      .eq('event_id', eventId);
    if (error) throw new Error(`reorderEventImages: ${error.message}`);
  }

  // Si el orden cambió y la portada se movió, actualizamos events.image
  // para que coincida con position=0.
  const { data: first } = await supabase
    .from('event_images')
    .select('url')
    .eq('event_id', eventId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (first?.url) {
    await supabase.from('events').update({ image: first.url }).eq('id', eventId);
  }

  revalidatePath('/');
  revalidatePath('/admin/eventos');
}

// ----------------------------------------------------------------
// Categories
// ----------------------------------------------------------------
/**
 * Crea o actualiza una categoría. `id` es el slug y la PK — el admin lo
 * genera a partir del label. La función valida unicidad y caracteres.
 */
export async function upsertCategory(formData: FormData): Promise<void> {
  const supabase = await requireAdmin();

  const id = ((formData.get('id') as string) ?? '').trim();
  const label = ((formData.get('label') as string) ?? '').trim();
  if (!id) throw new Error('Falta el slug de la categoría.');
  if (!label) throw new Error('Falta el nombre visible.');
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error('El slug solo puede tener minúsculas, números y guiones.');
  }

  const sort_order = Number(formData.get('sort_order') ?? 0);
  const is_active = formData.get('is_active') === 'true';

  const { error } = await supabase
    .from('categories')
    .upsert({ id, label, sort_order, is_active, updated_at: now() });
  if (error) throw new Error(`upsertCategory: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/categorias');
  revalidatePath('/admin/productos');
}

/**
 * Borra una categoría por slug. Falla si hay productos (retail o mayorista)
 * usándola — el admin tiene que reasignarlos primero.
 */
export async function deleteCategory(id: string): Promise<void> {
  const supabase = await requireAdmin();

  const [{ count: retailCount }, { count: wsCount }] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('category', id),
    supabase.from('wholesale_products').select('id', { count: 'exact', head: true }).eq('category', id),
  ]);

  const total = (retailCount ?? 0) + (wsCount ?? 0);
  if (total > 0) {
    throw new Error(
      `No se puede borrar: hay ${total} producto(s) con esta categoría. Reasignálos primero.`
    );
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw new Error(`deleteCategory: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/categorias');
  revalidatePath('/admin/productos');
}

export async function toggleCategoryActive(id: string, isActive: boolean): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from('categories')
    .update({ is_active: isActive, updated_at: now() })
    .eq('id', id);
  if (error) throw new Error(`toggleCategoryActive: ${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin/categorias');
}

/** Helper para no importar Date en cada lugar. */
function now() {
  return new Date().toISOString();
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

/**
 * Sube la imagen de fondo del Hero. Misma firma que `uploadHistoryImage`
 * pero guarda en `site/hero` para mantener las URLs separadas por sección.
 */
export async function uploadHeroImage(formData: FormData): Promise<string> {
  await requireAdmin();
  const file = formData.get('imageFile') as File | null;
  if (!file || file.size === 0) {
    throw new Error('No se recibió ninguna imagen.');
  }
  const url = await uploadImage(file, 'site/hero');
  revalidatePath('/');
  revalidatePath('/admin/textos');
  return url;
}

// ----------------------------------------------------------------
// Usuarios (customer_type: retail / wholesale)
// ----------------------------------------------------------------
export async function requireAdminStrict() {
  // Sesión del visitante (cliente autenticado, respeta RLS) para
  // validar que hay un usuario logueado.
  const authed = await getServerSupabase();
  if (!authed) {
    throw new Error('Supabase no configurado.');
  }
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) throw new Error('No autenticado.');

  // Validamos is_admin con el cliente service-role para que no
  // dependa de RLS. Si la sesión está presente pero la policy
  // "profiles admin read all" fallara (por ejemplo, porque la
  // función is_admin(uid) depende de leer profiles recursivamente),
  // tendríamos un falso negativo. Con service-role, si el caller es
  // admin la fila aparece siempre.
  const service = getServiceSupabase();
  if (!service) {
    throw new Error(
      'Server misconfigurado: falta SUPABASE_SERVICE_ROLE_KEY para verificar admin.'
    );
  }
  const { data: profile } = await service
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile?.is_admin) throw new Error('No autorizado (admin requerido).');

  // Devolvemos el cliente service-role para que las mutaciones
  // siguientes no queden atrapadas por RLS.
  return service;
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
  // requireAdminStrict valida que el caller sea admin y devuelve el
  // cliente service-role. La mutación corre con service-role porque
  // la policy self-update no incluye customer_type y un admin que
  // intente modificar la fila de otro usuario sería bloqueado por
  // RLS con el cliente autenticado.
  const admin = await requireAdminStrict();
  const { error } = await admin
    .from('profiles')
    .update({ customer_type: type })
    .eq('user_id', userId);
  if (error) {
    console.error('[updateCustomerType] Supabase error:', error);
    throw new Error(`updateCustomerType: ${error.message}`);
  }
  revalidatePath('/admin/usuarios');
  revalidatePath('/mi-cuenta');
}

/**
 * Cambia el flag `is_admin` de un usuario. Solo admin puede llamarlo.
 *
 * Seguridad:
 *  - Verifica que el caller sea admin (`requireAdminStrict`).
 *  - Usa el service-role client para bypassear RLS (la policy self-update
 *    no permite escribir is_admin, y un admin update sobre la fila de otro
 *    usuario sería bloqueado por RLS de todas formas).
 *  - Impide que un admin se desactive a sí mismo para evitar lockout.
 */
export async function setAdmin(
  userId: string,
  isAdmin: boolean
): Promise<void> {
  // requireAdminStrict devuelve el cliente service-role y valida que
  // el caller sea admin. Para impedir que se desactive a sí mismo,
  // necesitamos comparar el user_id del caller. Leemos la sesión por
  // separado del cliente autenticado, ya que el service-role no
  // expone la cookie del visitante.
  const admin = await requireAdminStrict();
  const authed = await getServerSupabase();
  if (authed) {
    const {
      data: { user: caller },
    } = await authed.auth.getUser();
    if (caller?.id === userId && !isAdmin) {
      throw new Error(
        'No podés quitarte el rol admin a vos mismo (quedaría el panel sin acceso).'
      );
    }
  }
  const { error } = await admin
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('user_id', userId);
  if (error) {
    console.error('[setAdmin] Supabase error:', error);
    throw new Error(`setAdmin: ${error.message}`);
  }
  revalidatePath('/admin/usuarios');
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

/**
 * Parsea el campo `nutrition_json` que llega por FormData. Devuelve NULL si:
 *   - el string está vacío
 *   - el JSON es inválido
 *   - el shape no tiene rows ni ningún campo del bloque extendido
 *
 * Soporta dos shapes:
 *   - Bloque viejo: `{ portion, servings_per_package, rows[] }`.
 *   - Bloque extendido: `{ ..., kcal, kj, carbs_g, ..., warning_labels[] }`.
 * Si alguno de los dos bloques trae datos, lo incluye en el resultado.
 */
function parseNutritionField(raw: string | null): Nutrition | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const portion = typeof obj.portion === 'string' ? obj.portion.trim() : '';
  const sp = obj.servings_per_package;
  const servings_per_package =
    typeof sp === 'number' && Number.isFinite(sp) ? sp : null;

  // Bloque viejo: rows[]
  const rowsIn = Array.isArray(obj.rows) ? obj.rows : [];
  const rows = rowsIn
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const rec = r as Record<string, unknown>;
      const nutrient = typeof rec.nutrient === 'string' ? rec.nutrient.trim() : '';
      const amount = typeof rec.amount === 'string' ? rec.amount.trim() : '';
      const dv = typeof rec.dv === 'string' ? rec.dv.trim() : '';
      if (!nutrient && !amount && !dv) return null;
      return { nutrient, amount, dv };
    })
    .filter((r): r is { nutrient: string; amount: string; dv: string } => r !== null);

  // Bloque extendido: campos planos opcionales
  const num = (k: string) => {
    const v = obj[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const warning_labels = Array.isArray(obj.warning_labels)
    ? obj.warning_labels.filter((s): s is string => typeof s === 'string')
    : null;
  const extended = {
    kcal: num('kcal'),
    kj: num('kj'),
    carbs_g: num('carbs_g'),
    protein_g: num('protein_g'),
    fat_g: num('fat_g'),
    saturated_g: num('saturated_g'),
    fiber_g: num('fiber_g'),
    sodium_mg: num('sodium_mg'),
    trans_g: num('trans_g'),
    warning_labels,
  };
  const hasExtended = Object.entries(extended).some(([k, v]) => {
    if (k === 'warning_labels') return v != null && (v as string[]).length > 0;
    return v !== null;
  });

  if (!portion && rows.length === 0 && !hasExtended) return null;

  return {
    portion,
    servings_per_package,
    rows,
    ...(hasExtended ? extended : {}),
  };
}