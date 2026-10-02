import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type MerchRow = {
  id: string;
  name: string;
  price: number | string;
  currency: string;
  image: string;
  description: string | null;
};

type MerchProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  description: string | null;
};

/**
 * Devuelve hasta 3 productos al azar de la categoría `merch`
 * (Barlovento Momentos) para mostrar como upsell en el checkout.
 *
 * Si Supabase no está configurado o no hay merch activa, devuelve
 * un array vacío — la UI del checkout lo trata como "no mostrar modal".
 */
export async function GET() {
  const supabase = await getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, products: [] });
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, currency, image, description')
      .eq('category', 'merch')
      .eq('is_active', true);

    if (error || !data) {
      return NextResponse.json({ ok: true, products: [] });
    }

    const pool = (data as MerchRow[]).map((p) => ({
      id: p.id,
      name: p.name,
      price: typeof p.price === 'string' ? Number(p.price) : p.price,
      currency: p.currency,
      image: p.image,
      description: p.description ?? null,
    })) as MerchProduct[];

    // Mezclamos y tomamos 3. Si hay menos de 3, devolvemos los que haya.
    const shuffled = pool
      .map((p) => ({ p, k: Math.random() }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.p)
      .slice(0, 3);

    return NextResponse.json({ ok: true, products: shuffled });
  } catch {
    return NextResponse.json({ ok: true, products: [] });
  }
}
