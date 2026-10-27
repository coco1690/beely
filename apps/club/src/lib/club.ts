// Negocio y tarjeta de esta visita: el slug sale del subdominio y el token de la URL
// (/t/{token}) o de lo guardado en este dispositivo.
import { esSlugValido, slugDeHost } from './slug'

const dominioBase = import.meta.env.VITE_CLUB_DOMINIO_BASE ?? 'hibeely.com'
const LLAVE_NEGOCIO = 'beely-club-negocio'
const llaveTarjeta = (slug: string) => `beely-club-tarjeta:${slug}`

const leer = (llave: string) => {
  try {
    return localStorage.getItem(llave)
  } catch {
    return null
  }
}
const escribir = (llave: string, valor: string | null) => {
  try {
    if (valor === null) localStorage.removeItem(llave)
    else localStorage.setItem(llave, valor)
  } catch {
    // Sin almacenamiento (modo privado): el enlace /t/{token} sigue funcionando.
  }
}

// En producción, el subdominio. Fuera de *.hibeely.com (local, vista previa) se usa
// ?negocio={slug} y se recuerda para las siguientes visitas.
export const slugPorSubdominio = slugDeHost(location.hostname, dominioBase)

export function slugActual(): string | null {
  if (slugPorSubdominio) return slugPorSubdominio
  const param = new URLSearchParams(location.search).get('negocio')?.toLowerCase()
  if (param && esSlugValido(param)) {
    escribir(LLAVE_NEGOCIO, param)
    return param
  }
  return leer(LLAVE_NEGOCIO)
}

export const tokenGuardado = (slug: string) => leer(llaveTarjeta(slug))
export const guardarToken = (slug: string, token: string) => escribir(llaveTarjeta(slug), token)
export const olvidarToken = (slug: string) => escribir(llaveTarjeta(slug), null)

// URL del club de otro negocio (si alguien abre una tarjeta en el subdominio equivocado).
export function urlClub(slug: string, ruta: string): string | null {
  if (!slugPorSubdominio) return null
  return `${location.protocol}//${slug}.${dominioBase}${ruta}`
}

// El manifest de cada negocio lo sirve api/manifest.ts; fuera del subdominio necesita el slug.
export function apuntarManifest(slug: string) {
  const enlace = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (enlace && !slugPorSubdominio) enlace.href = `/manifest.webmanifest?negocio=${encodeURIComponent(slug)}`
}
