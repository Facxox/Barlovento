'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabase } from './supabase-admin';

// ----------------------------------------------------------------
// Server actions para la galería de imágenes (0018_product_images.sql)
// ----------------------------------------------------------------

type ProductImagesRow = {
  id: number;
  url: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
};

/**
 * Sube múltiples imágenes a un producto. Devuelve las filas nuevas en
 * el mismo orden recibido. La primera imagen subida se marca
 * automáticamente como `is_primary = true` SI el producto no tenía ya
 * una.
 *
 * IMPORTANTE: Next.js no permite `File[]` como argumento directo de
 * un server action — los archivos deben viajar dentro de un FormData.
 * El cliente pasa `formData` con entries `files` (0..N) + entry
 * `productId` (string).
 */
export async function uploadProductImages(
  formData: FormData
): Promise<{ ok: true; rows: ProductImagesRow[] } | { ok: false; error: string }> {
  const productId = String(formData.get('productId') ?? '');
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (!productId || files.length === 0) {
    return { ok: false, error: 'invalid_input' };
  }
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };

  const { data: existingPrimary } = await supabase
    .from('product_images')
    .select('id')
    .eq('product_id', productId)
    .eq('is_primary', true)
    .maybeSingle();

  const { data: last } = await supabase
    .from('product_images')
    .select('sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  let next = (last?.sort_order ?? -1) + 1;

  const inserted: ProductImagesRow[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .slice(0, 40);
    const path = `products/${productId}/${Date.now()}-${i}-${safeName}.${ext}`;

    const up = await supabase.storage
      .from('barlovento-media')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `image/${ext}`,
      });
    if (up.error) {
      return { ok: false, error: `upload_failed:${up.error.message}` };
    }
    const { data: pub } = supabase.storage
      .from('barlovento-media')
      .getPublicUrl(path);

    const isPrimary = !existingPrimary && i === 0;
    const { data: ins, error: insErr } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        url: pub.publicUrl,
        alt: null,
        sort_order: next++,
        is_primary: isPrimary,
      })
      .select('id, url, alt, sort_order, is_primary')
      .single();
    if (insErr || !ins) {
      return { ok: false, error: `insert_failed:${insErr?.message ?? 'no_row'}` };
    }
    inserted.push(ins as ProductImagesRow);
  }

  revalidatePath('/admin/productos');
  revalidatePath(`/productos/${productId}`);
  return { ok: true, rows: inserted };
}

export async function deleteProductImage(
  imageId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };
  // Borramos el objeto del bucket por la URL (best-effort, silencioso
  // si falla — la fila DB es la fuente de verdad).
  const { data: row } = await supabase
    .from('product_images')
    .select('url, product_id')
    .eq('id', imageId)
    .maybeSingle();
  if (row?.url) {
    const marker = '/storage/v1/object/public/barlovento-media/';
    const idx = row.url.indexOf(marker);
    if (idx !== -1) {
      const path = row.url.slice(idx + marker.length);
      await supabase.storage.from('barlovento-media').remove([path]);
    }
  }
  const { error } = await supabase
    .from('product_images')
    .delete()
    .eq('id', imageId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/productos');
  if (row?.product_id) revalidatePath(`/productos/${row.product_id}`);
  return { ok: true };
}

export async function reorderProductImages(
  orderedIds: number[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };
  // Asignar sort_order por posición.
  const results = await Promise.all(
    orderedIds.map((id, idx) =>
      supabase.from('product_images').update({ sort_order: idx }).eq('id', id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  revalidatePath('/admin/productos');
  return { ok: true };
}

export async function setProductPrimaryImage(
  imageId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };
  // Traemos product_id de la fila para desmarcar el resto y mantener
  // coherencia (constraint 1 primary per product).
  const { data: row, error: rErr } = await supabase
    .from('product_images')
    .select('product_id')
    .eq('id', imageId)
    .maybeSingle();
  if (rErr || !row) return { ok: false, error: rErr?.message ?? 'not_found' };

  // 1) Clear todas las primary del producto
  await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', row.product_id);
  // 2) Set la nueva
  const { error } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/productos');
  revalidatePath(`/productos/${row.product_id}`);
  return { ok: true };
}

// ----------------------------------------------------------------
// Server actions para containers (0019_container_products.sql)
// ----------------------------------------------------------------

/**
 * Habilita o deshabilita la config de contenedor en un producto.
 * Si se deshabilita, los hijos quedan registrados pero el producto
 * deja de comportarse como contenedor.
 */
export async function setContainerConfig(
  productId: string,
  config: {
    is_container: boolean;
    container_base_price: number | null;
    price_mode: 'replace' | 'base_plus_content' | 'content_only';
    container_capacity: number | null;
    container_min_units: number;
    container_max_units: number | null;
    container_require_full: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };

  // Leemos primero el estado actual y solo escribimos lo que DIFERENCIÓ
  // el admin. Sin esto, si el admin marca/desmarca un único toggle (ej.
  // `is_container`), el autosave del ContainerConfigManager pasaría
  // container_capacity=null (estado local del form) y pisaría un valor
  // legítimo guardado. Hacer patch preserva los campos no tocados.
  const { data: existing, error: readErr } = await supabase
    .from('products')
    .select(
      'is_container, container_base_price, price_mode, container_capacity, container_min_units, container_max_units, container_require_full'
    )
    .eq('id', productId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };

  const patch: Record<string, unknown> = {};
  if (existing?.is_container !== config.is_container)
    patch.is_container = config.is_container;
  if ((existing?.container_base_price ?? null) !== (config.container_base_price ?? null))
    patch.container_base_price = config.container_base_price;
  if ((existing?.price_mode ?? null) !== (config.price_mode ?? null))
    patch.price_mode = config.price_mode;
  // Para capacity/min/max: si el admin pasó un número explícito, lo
  // guardamos. Si pasó null, sólo guardamos null si la DB ya era null —
  // así un null "no editado" no pisa un valor legítimo.
  if (config.container_capacity != null) {
    if ((existing?.container_capacity ?? null) !== config.container_capacity)
      patch.container_capacity = config.container_capacity;
  } else if (existing?.container_capacity == null) {
    // Ya era null — no escribimos nada.
  } else {
    // Admin explícitamente vació el campo → pisamos a null. Es intencional.
    patch.container_capacity = null;
  }
  if ((existing?.container_min_units ?? 1) !== (config.container_min_units ?? 1))
    patch.container_min_units = config.container_min_units;
  if (config.container_max_units != null) {
    if ((existing?.container_max_units ?? null) !== config.container_max_units)
      patch.container_max_units = config.container_max_units;
  } else if (existing?.container_max_units == null) {
    // ya era null
  } else {
    patch.container_max_units = null;
  }
  if ((existing?.container_require_full ?? false) !== (!!config.container_require_full))
    patch.container_require_full = !!config.container_require_full;

  // Si no hay nada que cambiar, omitimos el UPDATE (evita updates vacíos).
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/productos');
  revalidatePath(`/productos/${productId}`);
  return { ok: true };
}

/**
 * Marca un producto como habilitado para formar parte de contenedores.
 * Cada producto es seleccionable DENTRO de varios contenedores
 * (configurados independientemente), pero debe tener este flag = true.
 */
export async function setCanBeInContainer(
  productId: string,
  canBeInContainer: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };
  const { error } = await supabase
    .from('products')
    .update({ can_be_in_container: canBeInContainer })
    .eq('id', productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/productos');
  return { ok: true };
}

export type ContainerItemInput = {
  child_product_id: string;
  min_qty: number;
  max_qty: number | null;
  sort_order: number;
};

/**
 * Reemplaza la lista completa de hijos permitidos de un contenedor.
 * Estrategia: borramos todos y re-insertamos los nuevos. La simplicidad
 * gana sobre un diff: el admin puede ver y editar todo en el form.
 */
export async function replaceContainerItems(
  containerProductId: string,
  items: ContainerItemInput[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };

  // Borrar todo lo actual del contenedor.
  const { error: delErr } = await supabase
    .from('product_container_items')
    .delete()
    .eq('container_product_id', containerProductId);
  if (delErr) return { ok: false, error: delErr.message };

  // Insertar los nuevos (si los hay).
  if (items.length > 0) {
    const payload = items.map((i) => ({
      container_product_id: containerProductId,
      child_product_id: i.child_product_id,
      min_qty: Math.max(0, i.min_qty),
      max_qty: i.max_qty,
      sort_order: i.sort_order,
    }));
    const { error: insErr } = await supabase
      .from('product_container_items')
      .insert(payload);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath('/admin/productos');
  revalidatePath(`/productos/${containerProductId}`);
  return { ok: true };
}
