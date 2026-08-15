/**
 * Compresión y conversión a WebP en el cliente, sin dependencias.
 *
 * - Imágenes raster: redimensiona para que ninguna dimensión supere el
 *   máximo (default 2000px), manteniendo aspect ratio, y re-encodea
 *   como WebP a calidad 0.8. ~90% de reducción típica en fotos de
 *   cámara de teléfono.
 * - PDFs y otros no-imagen: pasan tal cual (el navegador no los puede
 *   rasterizar).
 *
 * Diseñado para correr antes del POST /api/orders/bank-transfer/upload
 * para que el archivo que llega a Supabase Storage ya esté optimizado.
 */

export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
};

export type CompressResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  wasCompressed: boolean;
};

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 2000,
  maxHeight: 2000,
  quality: 0.8,
  mimeType: 'image/webp',
};

export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<CompressResult> {
  const { maxWidth, maxHeight, quality, mimeType } = { ...DEFAULTS, ...opts };

  // No-imagen (PDF, etc.) pasa tal cual.
  if (!file.type.startsWith('image/')) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      ratio: 1,
      wasCompressed: false,
    };
  }

  // Ya WebP y razonablemente chico → no tocamos.
  if (file.type === mimeType && file.size <= 500 * 1024) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      ratio: 1,
      wasCompressed: false,
    };
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // createImageBitmap falla en algunos navegadores con HEIC/HEIF
    // antiguos; en ese caso dejamos el original.
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      ratio: 1,
      wasCompressed: false,
    };
  }

  const scale = Math.min(
    1,
    maxWidth / bitmap.width,
    maxHeight / bitmap.height
  );
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(targetW, targetH)
      : Object.assign(document.createElement('canvas'), {
          width: targetW,
          height: targetH,
        });
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) {
    bitmap.close();
    throw new Error('No se pudo obtener contexto 2D del canvas.');
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob = await canvasToBlob(canvas, mimeType, quality);
  const newName = renameToWebp(file.name);
  const compressed = new File([blob], newName, {
    type: mimeType,
    lastModified: Date.now(),
  });

  return {
    file: compressed,
    originalSize: file.size,
    compressedSize: compressed.size,
    ratio: compressed.size / file.size,
    wasCompressed: true,
  };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number
): Promise<Blob> {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob devolvió null.'))),
      type,
      quality
    );
  });
}

function renameToWebp(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot >= 0 ? name.slice(0, dot) : name;
  return `${base}.webp`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
