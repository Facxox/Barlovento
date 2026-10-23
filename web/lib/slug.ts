// Helper puro (sin server-only) para generar slugs de URL. Lo usan las
// server actions y el preview del admin, así el slug que ve el admin es
// el mismo que termina guardado.

/** "Stand en la Feria ñandú" → "stand-en-la-feria-nandu" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}
