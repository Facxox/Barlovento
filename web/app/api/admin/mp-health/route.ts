import 'server-only';
import { NextResponse } from 'next/server';
import { getMercadoPago } from '@/lib/mercadopago';

/**
 * GET /api/admin/mp-health
 *
 * Diagnóstico: valida que el access_token de MP funcione y devuelve
 * metadata sobre la cuenta asociada (user_id, país, modo).
 *
 * Sólo accesible por admin. NO expone el token completo.
 */

export const runtime = 'nodejs';

type MpMeResponse = {
  id: number;
  nickname?: string;
  email?: string;
  country_id?: string;
  site_id?: string;
  status?: { sitous_status?: string; confirmed_email?: boolean };
  user_type?: string;
};

export async function GET() {
  const { requireAdminStrict } = await import('@/lib/admin-actions');
  try {
    await requireAdminStrict();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autorizado.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? '';
  const tokenPrefix = token.slice(0, 8);
  const tokenLength = token.length;

  const mp = getMercadoPago();
  if (!mp) {
    return NextResponse.json({
      ok: false,
      token_present: false,
      hint: 'MERCADO_PAGO_ACCESS_TOKEN no está seteado en este env.',
    });
  }

  try {
    // /users/me no está tipado en el SDK v3, así que pegamos directo a la API.
    const r = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      // MP responde rápido o no responde; cache off para tener lectura fresca.
      cache: 'no-store',
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return NextResponse.json({
        ok: false,
        token_present: true,
        token_prefix: tokenPrefix,
        http_status: r.status,
        error: 'mp_rejected_token',
        body_excerpt: text.slice(0, 200),
        hint:
          r.status === 401
            ? 'Token rechazado. Probablemente sea de test o esté mal copiado.'
            : 'MP rechazó la consulta. Revisá estado de la cuenta.',
      });
    }
    const data = (await r.json()) as MpMeResponse;

    return NextResponse.json({
      ok: true,
      token: {
        prefix: tokenPrefix,
        length: tokenLength,
        looks_like_test: /^TEST(-|_)/i.test(tokenPrefix),
      },
      mp_account: {
        user_id: data.id ?? null,
        nickname: data.nickname ?? null,
        email: data.email ?? null,
        country: data.country_id ?? null,
        site: data.site_id ?? null,
        email_confirmed: data.status?.confirmed_email ?? null,
        user_type: data.user_type ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      token_present: true,
      token_prefix: tokenPrefix,
      error: e?.message ?? 'mp_me_failed',
      hint:
        'El token no es válido o la API de MP lo rechazó. Revisá que sea de producción y que la cuenta esté habilitada.',
    });
  }
}