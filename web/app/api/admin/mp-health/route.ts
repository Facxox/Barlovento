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
    // El SDK v3 expone `users` para /users/me.
    const { Users } = await import('mercadopago');
    const users = new Users(mp);
    const me: any = (await users.get()) as any;
    const data: MpMeResponse = (me?.response ?? me?.body ?? me) as MpMeResponse;

    return NextResponse.json({
      ok: true,
      token: {
        prefix: tokenPrefix,
        length: tokenLength,
        // Heurística: TEST- o token que empieza con TEST_APP_USR
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