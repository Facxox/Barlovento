import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServiceSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const BUCKET = 'transfer-receipts';

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'supabase_not_configured' },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: 'file_missing' },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'unsupported_type',
        message: 'Subí una imagen (JPG/PNG/WebP) o un PDF.',
      },
      { status: 400 }
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { ok: false, error: 'empty_file' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: 'too_large',
        message: 'El comprobante no puede superar los 5 MB.',
      },
      { status: 400 }
    );
  }

  const ext = EXT_BY_MIME[file.type] ?? 'bin';
  const safeName = `${Date.now()}-${randomUUID()}.${ext}`;
  const path = `pending/${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { ok: false, error: uploadError.message },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    path,
    url: publicUrl,
    mime: file.type,
    size: file.size,
  });
}
