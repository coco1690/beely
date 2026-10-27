// Manifest web de cada negocio: toma la base que publica el build
// (manifest-base.webmanifest, hecha con crearManifest de @beely/ui) y le pone el
// nombre del negocio. Vercel la sirve en /manifest.webmanifest (ver vercel.json).
import { esSlugValido, slugDeHost } from '../src/lib/slug'

type Manifest = Record<string, unknown>

async function nombreNegocio(slug: string): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL
  const llave = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !llave) return null
  // Misma regla que la PWA: con x-negocio-slug, RLS deja ver solo ese negocio activo.
  const respuesta = await fetch(`${url}/rest/v1/negocios?select=nombre&slug=eq.${slug}`, {
    headers: { apikey: llave, 'x-negocio-slug': slug },
  })
  if (!respuesta.ok) return null
  const filas = (await respuesta.json()) as { nombre: string }[]
  return filas[0]?.nombre ?? null
}

export async function GET(peticion: Request): Promise<Response> {
  const url = new URL(peticion.url)
  const base = (await (await fetch(new URL('/manifest-base.webmanifest', url))).json()) as Manifest
  const slug = slugDeHost(url.hostname, process.env.VITE_CLUB_DOMINIO_BASE ?? 'hibeely.com') ?? url.searchParams.get('negocio')
  const nombre = slug && esSlugValido(slug) ? await nombreNegocio(slug) : null
  const manifest: Manifest = nombre
    ? { ...base, name: nombre, short_name: nombre.length <= 15 ? nombre : (nombre.split(' ')[0] ?? nombre), description: `Tu tarjeta de sellos de ${nombre}` }
    : base
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  })
}
