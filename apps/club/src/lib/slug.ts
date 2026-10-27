// Qué negocio es este club. Sin dependencias: lo usan la PWA y api/manifest.ts.
//  * Producción: el subdominio, {slug}.hibeely.com.
//  * Local o vista previa de Vercel: ?negocio={slug} (la PWA lo recuerda).

const reservados = new Set(['app', 'www', 'api'])

export function slugDeHost(host: string, dominioBase: string): string | null {
  const sufijo = `.${dominioBase}`
  if (!host.endsWith(sufijo)) return null
  const sub = host.slice(0, -sufijo.length)
  if (!sub || sub.includes('.') || reservados.has(sub)) return null
  return sub
}

export const esSlugValido = (slug: string) => /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(slug)
